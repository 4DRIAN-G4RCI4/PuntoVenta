// electron/logicaFarmacia.js — lógica de lotes/caducidad, aislada de ipcMain
// para que sea testeable sin levantar Electron completo (ver electron/__tests__).
//
// Regla de oro: la tabla `lotes` es la única fuente de verdad de CUÁNDO caduca
// cada unidad. `presentaciones.stock` es solo un total cacheado que SIEMPRE debe
// coincidir con SUM(lotes.cantidad) para presentaciones con maneja_lotes=1.
// Todo cambio de stock en esas presentaciones debe pasar por estas funciones —
// nunca por un UPDATE directo a presentaciones.stock.

/** Elige qué lotes descontar para vender `cantidad` unidades, más antiguo primero
 * (FEFO). Nunca toma de un lote ya caducado. No escribe en la BD — solo calcula;
 * quien la llama aplica los UPDATE dentro de su propia transacción. */
function seleccionarLotesFEFO(db, presentacionId, cantidad, hoyIso = new Date().toISOString().slice(0, 10)) {
  const lotesVigentes = db.prepare(
    `SELECT id, cantidad FROM lotes WHERE presentacion_id=? AND cantidad > 0 AND (fecha_caducidad IS NULL OR fecha_caducidad >= ?) ORDER BY fecha_caducidad IS NULL, fecha_caducidad ASC`
  ).all(presentacionId, hoyIso);
  const disponibleVigente = lotesVigentes.reduce((s, l) => s + l.cantidad, 0);
  const totalLotes = db.prepare(`SELECT COALESCE(SUM(cantidad),0) c FROM lotes WHERE presentacion_id=?`).get(presentacionId).c;

  if (disponibleVigente < cantidad) {
    return {
      ok: false,
      // Distingue "nunca se capturó un lote" (falta trabajo administrativo)
      // de "sí hay lotes pero no alcanza / están caducados" (falta stock real).
      sinLotesCapturados: totalLotes === 0,
      disponibleVigente,
      deducciones: []
    };
  }

  const deducciones = [];
  let restante = cantidad;
  for (const lote of lotesVigentes) {
    if (restante <= 0) break;
    const tomar = Math.min(lote.cantidad, restante);
    deducciones.push({ lote_id: lote.id, cantidad: tomar });
    restante -= tomar;
  }
  return { ok: true, disponibleVigente, deducciones };
}

function aplicarDeducciones(db, deducciones) {
  for (const d of deducciones) {
    db.prepare('UPDATE lotes SET cantidad = cantidad - ? WHERE id=?').run(d.cantidad, d.lote_id);
  }
}

/** Ajusta el stock TOTAL de una presentación a `nuevoStock` (conteo físico, o
 * edición manual), manteniendo `lotes` como fuente de verdad — nunca hace un
 * UPDATE ciego a presentaciones.stock cuando la presentación maneja lotes:
 *
 *  - Si baja el stock: descuenta de los lotes más próximos a caducar primero
 *    (lo más probable es que lo que falta/se dañó sea justo lo más viejo).
 *  - Si sube el stock: crea un lote nuevo "AJUSTE-FISICO" sin caducidad, para
 *    que quede registrado y alguien tenga que capturarle la caducidad real
 *    después — nunca se pierde silenciosamente la trazabilidad.
 *
 * Para presentaciones que NO manejan lotes, simplemente actualiza el stock. */
function reconciliarStockPresentacion(db, presentacionId, nuevoStock, { usuarioId = null, motivo = 'Conteo físico' } = {}) {
  const presentacion = db.prepare(
    `SELECT t.id, t.stock, t.producto_id, p.maneja_lotes FROM presentaciones t JOIN productos p ON p.id = t.producto_id WHERE t.id = ?`
  ).get(presentacionId);
  if (!presentacion) return { ok: false, error: 'Presentación no encontrada.' };

  const diff = nuevoStock - presentacion.stock;
  if (diff === 0) return { ok: true, diff: 0 };

  if (presentacion.maneja_lotes) {
    if (diff < 0) {
      const faltante = -diff;
      const sel = seleccionarLotesFEFO(db, presentacionId, faltante);
      if (!sel.ok) {
        // No hay suficiente en lotes para explicar la baja — de todos modos hay
        // que reflejar el conteo físico real, así que se descuenta lo que haya
        // en lotes (puede dejarlos en 0) y el resto se resta directo del total,
        // dejando evidencia en el motivo para que alguien lo revise.
        const disponibles = db.prepare(
          `SELECT id, cantidad FROM lotes WHERE presentacion_id=? AND cantidad > 0 ORDER BY fecha_caducidad IS NULL, fecha_caducidad ASC`
        ).all(presentacionId);
        let restante = faltante;
        for (const l of disponibles) {
          if (restante <= 0) break;
          const tomar = Math.min(l.cantidad, restante);
          db.prepare('UPDATE lotes SET cantidad = cantidad - ? WHERE id=?').run(tomar, l.id);
          restante -= tomar;
        }
        motivo = `${motivo} (baja mayor a lo capturado en lotes — revisar lotes de esta presentación)`;
      } else {
        aplicarDeducciones(db, sel.deducciones);
      }
    } else {
      db.prepare('INSERT INTO lotes (presentacion_id, numero_lote, fecha_caducidad, cantidad) VALUES (?,?,?,?)')
        .run(presentacionId, 'AJUSTE-FISICO', null, diff);
      motivo = `${motivo} (alta registrada como lote "AJUSTE-FISICO" sin caducidad — captúrala cuando sepas cuál es)`;
    }
  }

  db.prepare('UPDATE presentaciones SET stock=? WHERE id=?').run(nuevoStock, presentacionId);
  db.prepare('INSERT INTO inventario_movimientos (producto_id, presentacion_id, tipo, cantidad, motivo, usuario_id) VALUES (?,?,?,?,?,?)')
    .run(presentacion.producto_id, presentacionId, 'ajuste', diff, motivo, usuarioId);

  return { ok: true, diff };
}

module.exports = { seleccionarLotesFEFO, aplicarDeducciones, reconciliarStockPresentacion };
