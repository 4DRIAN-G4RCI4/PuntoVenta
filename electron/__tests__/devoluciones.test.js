// electron/__tests__/devoluciones.test.js — cubre los hallazgos C1/C2 de
// docs/DIAGNOSTICO.md: la devolución debe reintegrar a lotes (no solo al
// total) y debe revertir deuda/generar egreso de caja correctamente.
const test = require('node:test');
const assert = require('node:assert/strict');

const { calcularReversionDevolucion, reconciliarStockPresentacion } = require('../logicaFarmacia');
const { openDatabase } = require('../db');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

function tmpPath() {
  return path.join(os.tmpdir(), 'pvp-devtest-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.db');
}
function limpiar(p) {
  for (const suf of ['', '-wal', '-shm']) { try { fs.unlinkSync(p + suf); } catch (_e) {} }
}

// ── C2: la matemática de dinero de una devolución ──────────────────────

test('calcularReversionDevolucion: reembolso sin deuda regresa todo en efectivo', () => {
  const r = calcularReversionDevolucion({
    ventaTotal: 500, ventaSaldoPendiente: 0, ventaMontoPagado: 500, ventaEstado: 'pagada',
    tipoDevolucion: 'reembolso', montoDevuelto: 200, totalDevueltoAcumulado: 200
  });
  assert.equal(r.montoAbsorbidoPorDeuda, 0);
  assert.equal(r.montoARegresarEnEfectivo, 200, 'todo lo devuelto debe salir de caja, no había deuda que cubrir');
  assert.equal(r.nuevoMontoPagado, 300);
  assert.equal(r.nuevoEstado, 'pagada', 'devolución parcial no debe marcar la venta como devuelta');
});

test('calcularReversionDevolucion: devolución en venta a crédito cancela deuda, no saca dinero de caja', () => {
  const r = calcularReversionDevolucion({
    ventaTotal: 500, ventaSaldoPendiente: 500, ventaMontoPagado: 0, ventaEstado: 'credito',
    tipoDevolucion: 'nota_credito', montoDevuelto: 200, totalDevueltoAcumulado: 200
  });
  assert.equal(r.montoAbsorbidoPorDeuda, 200, 'debe cancelar deuda por el monto devuelto');
  assert.equal(r.montoARegresarEnEfectivo, 0, 'nota_credito nunca saca dinero de caja');
  assert.equal(r.nuevoSaldoPendiente, 300);
  assert.equal(r.nuevoEstado, 'credito', 'sigue debiendo el resto');
});

test('calcularReversionDevolucion: reembolso de venta a crédito primero cancela deuda, el resto sí sale de caja', () => {
  const r = calcularReversionDevolucion({
    ventaTotal: 500, ventaSaldoPendiente: 300, ventaMontoPagado: 200, ventaEstado: 'credito',
    tipoDevolucion: 'reembolso', montoDevuelto: 500, totalDevueltoAcumulado: 500
  });
  assert.equal(r.montoAbsorbidoPorDeuda, 300, 'cancela toda la deuda restante');
  assert.equal(r.montoARegresarEnEfectivo, 200, 'el resto (lo ya pagado) sí se regresa en efectivo');
  assert.equal(r.nuevoSaldoPendiente, 0);
  assert.equal(r.nuevoEstado, 'devuelta', 'se devolvió el 100% del valor de la venta');
});

test('calcularReversionDevolucion: saldar toda la deuda restante (sin devolver el 100%) pasa a pagada', () => {
  const r = calcularReversionDevolucion({
    ventaTotal: 1000, ventaSaldoPendiente: 300, ventaMontoPagado: 700, ventaEstado: 'credito',
    tipoDevolucion: 'cambio', montoDevuelto: 300, totalDevueltoAcumulado: 300
  });
  assert.equal(r.nuevoSaldoPendiente, 0);
  assert.equal(r.nuevoEstado, 'pagada', 'ya no debe nada, pero no se devolvió el total de la venta (no es "devuelta")');
});

// ── C1: la devolución debe reintegrar el stock pasando por lotes ───────

function crearProductoConLote(db, cantidadInicial) {
  const prod = db.prepare('INSERT INTO productos (sku, nombre, costo_unitario, precio_publico, activo, maneja_lotes) VALUES (?,?,?,?,1,1)')
    .run('DEV-TEST-' + Math.random().toString(36).slice(2, 8), 'Producto con lote', 10, 25);
  const productoId = prod.lastInsertRowid;
  const pres = db.prepare('INSERT INTO presentaciones (producto_id, presentacion, stock) VALUES (?,?,0)').run(productoId, 'Caja');
  const presentacionId = pres.lastInsertRowid;
  db.prepare('INSERT INTO lotes (presentacion_id, numero_lote, fecha_caducidad, cantidad) VALUES (?,?,?,?)')
    .run(presentacionId, 'L-ORIGINAL', '2030-01-01', cantidadInicial);
  db.prepare('UPDATE presentaciones SET stock=? WHERE id=?').run(cantidadInicial, presentacionId);
  return { productoId, presentacionId };
}

test('C1 — devolver stock a un producto con lotes crea un lote DEV-VENTA y mantiene la invariante', () => {
  const tmp = tmpPath();
  try {
    const db = openDatabase(tmp);
    // Simula que se vendieron 5 (quedan 10 de 15 iniciales tras la venta).
    const { presentacionId } = crearProductoConLote(db, 10);

    const pres = db.prepare('SELECT stock FROM presentaciones WHERE id=?').get(presentacionId);
    const r = reconciliarStockPresentacion(db, presentacionId, pres.stock + 5, {
      motivo: 'Devolución de venta V-TEST', etiquetaLoteAlta: 'DEV-VENTA', tipoMovimiento: 'entrada'
    });
    assert.equal(r.ok, true);

    const devLote = db.prepare("SELECT cantidad FROM lotes WHERE presentacion_id=? AND numero_lote='DEV-VENTA'").get(presentacionId);
    assert.ok(devLote, 'debe crear un lote identificable como devolución, no perderse en el total');
    assert.equal(devLote.cantidad, 5);

    const sumaLotes = db.prepare('SELECT COALESCE(SUM(cantidad),0) s FROM lotes WHERE presentacion_id=?').get(presentacionId).s;
    const stockFinal = db.prepare('SELECT stock FROM presentaciones WHERE id=?').get(presentacionId).stock;
    assert.equal(stockFinal, 15);
    assert.equal(sumaLotes, stockFinal, 'lotes y stock total deben seguir sincronizados después de la devolución (el bug C1 original los desincronizaba)');

    db.close();
  } finally {
    limpiar(tmp);
  }
});

// ── C4: el backup no debe perder cambios recientes en modo WAL ─────────

test('C4 — VACUUM INTO produce un backup completo aunque haya cambios recientes sin checkpoint', () => {
  const tmpOrigen = tmpPath();
  const tmpBackup = tmpPath();
  try {
    const db = openDatabase(tmpOrigen);
    // openDatabase ya deja journal_mode=WAL (ver db.js) — journal_mode se hereda
    // del archivo, así que basta con seguir usando esta misma conexión.
    db.prepare('INSERT INTO clientes (nombre, apellido, telefono) VALUES (?,?,?)').run('Cliente', 'DeBackup', '5551234567');

    // Exactamente lo que hace config:exportDb: si el destino ya existe, VACUUM
    // INTO falla — hay que quitarlo primero (mismo comportamiento que el fix real).
    if (fs.existsSync(tmpBackup)) fs.unlinkSync(tmpBackup);
    db.prepare('VACUUM INTO ?').run(tmpBackup);
    db.close();

    const backupDb = require('better-sqlite3')(tmpBackup, { readonly: true });
    const cliente = backupDb.prepare("SELECT nombre FROM clientes WHERE apellido='DeBackup'").get();
    assert.ok(cliente, 'el cliente insertado justo antes del backup debe estar presente — con fs.copyFileSync esto podía faltar');
    backupDb.close();
  } finally {
    limpiar(tmpOrigen);
    limpiar(tmpBackup);
  }
});
