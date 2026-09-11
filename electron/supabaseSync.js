// ================================================================
// supabaseSync.js — Sincronización de solo-subida hacia Supabase.
//
// La base de datos local (SQLite) sigue siendo la única fuente de
// verdad: la app de escritorio funciona 100% igual con o sin internet.
// Este módulo solo "empuja" una copia resumida (ventas, alertas de
// stock, gastos, identidad del negocio) hacia Supabase para que la
// app móvil de solo-lectura la consulte.
//
// Si no hay internet o falla la subida, el registro se queda en la
// tabla sync_queue y se reintenta automáticamente — nunca bloquea ni
// pierde una venta. Los upserts pendientes de una misma tabla se
// agrupan en un solo request (mucho más rápido para cargas grandes,
// como sincronizar todo el historial de una vez).
// ================================================================
const { getDb } = require('./db');

// Credenciales del proyecto de Supabase (URL + clave "publishable"/anon).
// No son secretas por diseño — están protegidas por las políticas RLS
// del lado de Supabase (solo usuarios autenticados pueden leer/escribir).
const SUPABASE_URL = 'https://wsyjdhbnuaqkmixmgopx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable__45JgkYo2a0FGsYCjkazLQ_565K0mgh';

const PK = {
  ventas_resumen: 'id', gastos_resumen: 'id', stock_alertas: 'presentacion_id', negocio: 'id',
  inventario_resumen: 'presentacion_id', cortes_resumen: 'id', creditos_resumen: 'venta_id', devoluciones_resumen: 'id'
};

let accessToken = null;
let sincronizando = false;
let loopIniciado = false;

function db() { return getDb(); }

function getConfig() {
  return db().prepare('SELECT supabase_refresh_token, supabase_email, supabase_ultimo_sync FROM app_config WHERE id=1').get() || {};
}

function estaConfigurado() {
  const cfg = getConfig();
  return !!cfg.supabase_refresh_token;
}

async function configurarSync({ email, password }) {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok || !data.refresh_token) {
      return { ok: false, error: data.error_description || data.msg || 'Correo o contraseña incorrectos en Supabase.' };
    }
    accessToken = data.access_token;
    db().prepare('UPDATE app_config SET supabase_refresh_token=?, supabase_email=? WHERE id=1').run(data.refresh_token, email);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: 'No se pudo conectar a Supabase: ' + e.message };
  }
}

function desconectarSync() {
  accessToken = null;
  db().prepare('UPDATE app_config SET supabase_refresh_token=NULL, supabase_email=NULL WHERE id=1').run();
}

async function refrescarToken() {
  const cfg = getConfig();
  if (!cfg.supabase_refresh_token) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ refresh_token: cfg.supabase_refresh_token })
    });
    const data = await res.json();
    if (!res.ok || !data.access_token) return false;
    accessToken = data.access_token;
    // Supabase rota el refresh_token en cada uso: hay que guardar el nuevo.
    if (data.refresh_token) {
      db().prepare('UPDATE app_config SET supabase_refresh_token=? WHERE id=1').run(data.refresh_token);
    }
    return true;
  } catch (_e) {
    return false;
  }
}

function encolar(tabla, operacion, payload) {
  try {
    db().prepare('INSERT INTO sync_queue (tabla, operacion, payload) VALUES (?,?,?)')
      .run(tabla, operacion, JSON.stringify(payload));
  } catch (_e) {}
}

/** Evalúa el stock actual de una presentación y encola alta (si está baja/agotada) o baja (si ya se
 * repuso) en stock_alertas (usado por el Dashboard/Stock móvil), y SIEMPRE actualiza inventario_resumen
 * (usado por el reporte de Inventario, que necesita el catálogo completo, no solo lo bajo). */
function evaluarYEncolarStock(presentacionId) {
  const t = db().prepare(`
    SELECT t.id as presentacion_id, t.presentacion, t.stock, t.stock_minimo, p.id as producto_id, p.nombre, p.sku, p.departamento,
           p.costo_unitario, p.precio_publico
    FROM presentaciones t JOIN productos p ON p.id = t.producto_id WHERE t.id = ?
  `).get(presentacionId);
  if (!t) return;
  if (t.stock <= t.stock_minimo) {
    encolar('stock_alertas', 'upsert', {
      presentacion_id: t.presentacion_id, producto_id: t.producto_id, nombre: t.nombre, sku: t.sku,
      presentacion: t.presentacion, departamento: t.departamento, stock: t.stock, stock_minimo: t.stock_minimo,
      actualizado_en: new Date().toISOString()
    });
  } else {
    encolar('stock_alertas', 'delete', { presentacion_id: t.presentacion_id });
  }
  encolar('inventario_resumen', 'upsert', {
    presentacion_id: t.presentacion_id, producto_id: t.producto_id, nombre: t.nombre, sku: t.sku, presentacion: t.presentacion,
    departamento: t.departamento, costo_unitario: t.costo_unitario, precio_publico: t.precio_publico,
    stock: t.stock, actualizado_en: new Date().toISOString()
  });
}

function encolarCorte(corteId) {
  const c = db().prepare(`
    SELECT co.id, co.estado, co.efectivo_esperado, co.efectivo_contado, co.tarjeta_esperado, co.tarjeta_contado,
           co.transferencia_esperado, co.transferencia_contado, co.diferencia, co.motivo_omision, co.created_at,
           IFNULL(u.nombre,'') as usuario_nombre
    FROM cortes_caja co LEFT JOIN usuarios u ON u.id=co.usuario_id WHERE co.id = ?
  `).get(corteId);
  if (!c) return;
  encolar('cortes_resumen', 'upsert', {
    id: c.id, usuario_nombre: c.usuario_nombre || null, estado: c.estado,
    efectivo_esperado: c.efectivo_esperado, efectivo_contado: c.efectivo_contado,
    tarjeta_esperado: c.tarjeta_esperado, tarjeta_contado: c.tarjeta_contado,
    transferencia_esperado: c.transferencia_esperado, transferencia_contado: c.transferencia_contado,
    diferencia: c.diferencia, motivo_omision: c.motivo_omision,
    creado_en: new Date(c.created_at.replace(' ', 'T')).toISOString()
  });
}

/** Los créditos son dinámicos: si ya no tiene saldo pendiente, se quita del reporte remoto
 * (deja de aparecer como crédito activo) en vez de quedar con saldo 0 para siempre. */
function encolarCredito(ventaId) {
  const v = db().prepare(`
    SELECT v.id, v.folio, v.total, v.monto_pagado, v.saldo_pendiente, v.created_at,
           IFNULL(c.nombre,'') || ' ' || IFNULL(c.apellido,'') as cliente_nombre, c.telefono
    FROM ventas v LEFT JOIN clientes c ON c.id=v.cliente_id WHERE v.id = ?
  `).get(ventaId);
  if (!v) return;
  if (!v.saldo_pendiente || v.saldo_pendiente <= 0) {
    encolar('creditos_resumen', 'delete', { venta_id: v.id });
    return;
  }
  encolar('creditos_resumen', 'upsert', {
    venta_id: v.id, folio: v.folio, cliente_nombre: v.cliente_nombre?.trim() || null, telefono: v.telefono || null,
    total: v.total, monto_pagado: v.monto_pagado, saldo_pendiente: v.saldo_pendiente,
    creado_en: new Date(v.created_at.replace(' ', 'T')).toISOString()
  });
}

function encolarDevolucion(devolucionId) {
  const d = db().prepare(`
    SELECT d.id, d.tipo_devolucion, d.monto_total, d.estado, d.created_at, v.folio,
           IFNULL(c.nombre,'') || ' ' || IFNULL(c.apellido,'') as cliente_nombre, IFNULL(u.nombre,'') as usuario_nombre
    FROM devoluciones d LEFT JOIN ventas v ON v.id=d.venta_id LEFT JOIN clientes c ON c.id=v.cliente_id LEFT JOIN usuarios u ON u.id=d.usuario_id
    WHERE d.id = ?
  `).get(devolucionId);
  if (!d) return;
  encolar('devoluciones_resumen', 'upsert', {
    id: d.id, folio: d.folio || null, cliente_nombre: d.cliente_nombre?.trim() || null,
    tipo_devolucion: d.tipo_devolucion, monto_total: d.monto_total, estado: d.estado,
    usuario_nombre: d.usuario_nombre || null,
    creado_en: new Date(d.created_at.replace(' ', 'T')).toISOString()
  });
}

function encolarVenta(ventaId) {
  const v = db().prepare(`
    SELECT v.id, v.folio, v.total, v.forma_pago, v.estado, v.created_at,
           IFNULL(u.nombre,'') as usuario_nombre, IFNULL(c.nombre,'') || ' ' || IFNULL(c.apellido,'') as cliente_nombre
    FROM ventas v LEFT JOIN usuarios u ON u.id=v.usuario_id LEFT JOIN clientes c ON c.id=v.cliente_id
    WHERE v.id = ?
  `).get(ventaId);
  if (!v) return;
  const costo = db().prepare(`SELECT COALESCE(SUM(costo_unitario*cantidad),0) c FROM ventas_detalle WHERE venta_id=?`).get(ventaId).c;
  const deptoDominante = db().prepare(`
    SELECT IFNULL(p.departamento,'todos') as departamento, SUM(vd.cantidad*vd.precio_unitario) as monto
    FROM ventas_detalle vd LEFT JOIN productos p ON p.id = vd.producto_id
    WHERE vd.venta_id = ?
    GROUP BY departamento ORDER BY monto DESC LIMIT 1
  `).get(ventaId);
  encolar('ventas_resumen', 'upsert', {
    id: v.id, folio: v.folio, total: v.total, costo, utilidad: v.total - costo,
    forma_pago: v.forma_pago, estado: v.estado,
    usuario_nombre: v.usuario_nombre || null, cliente_nombre: v.cliente_nombre?.trim() || null,
    departamento: deptoDominante?.departamento || null,
    creado_en: new Date(v.created_at.replace(' ', 'T')).toISOString()
  });
}

function encolarGasto(gastoId) {
  const g = db().prepare('SELECT id, concepto, monto, categoria, fecha FROM gastos WHERE id=?').get(gastoId);
  if (!g) return;
  encolar('gastos_resumen', 'upsert', g);
}

function encolarNegocio() {
  const n = db().prepare('SELECT nombre_negocio, logo FROM app_config WHERE id=1').get();
  if (!n) return;
  encolar('negocio', 'upsert', { id: 1, nombre_negocio: n.nombre_negocio, logo: n.logo });
}

/** Encola TODO lo que ya existe localmente (útil la primera vez que se conecta, para no
 * esperar a que se generen ventas/gastos nuevos — llena las tablas de Supabase de una vez). */
function encolarTodoHistorico() {
  const ventas = db().prepare(`SELECT id FROM ventas WHERE estado != 'cancelada'`).all();
  for (const v of ventas) encolarVenta(v.id);
  const gastos = db().prepare('SELECT id FROM gastos').all();
  for (const g of gastos) encolarGasto(g.id);
  const presentaciones = db().prepare('SELECT id FROM presentaciones').all();
  for (const t of presentaciones) evaluarYEncolarStock(t.id);
  const cortes = db().prepare('SELECT id FROM cortes_caja').all();
  for (const c of cortes) encolarCorte(c.id);
  const creditos = db().prepare(`SELECT id FROM ventas WHERE saldo_pendiente > 0 AND estado != 'cancelada'`).all();
  for (const v of creditos) encolarCredito(v.id);
  const devoluciones = db().prepare('SELECT id FROM devoluciones').all();
  for (const d of devoluciones) encolarDevolucion(d.id);
  encolarNegocio();
  return {
    ventas: ventas.length, gastos: gastos.length, presentaciones: presentaciones.length,
    cortes: cortes.length, creditos: creditos.length, devoluciones: devoluciones.length
  };
}

async function textoError(res) {
  try {
    const data = await res.json();
    return `(${res.status}) ${data.message || data.error_description || data.hint || JSON.stringify(data)}`;
  } catch (_e) {
    return `(${res.status}) ${res.statusText || 'error desconocido'}`;
  }
}

/** Envía un grupo de items de la MISMA tabla/operación en un solo request cuando es
 * posible (los upserts se mandan como arreglo; los deletes van uno por uno porque cada
 * uno necesita su propio filtro por llave primaria). Devuelve { ok, error } — el error
 * trae el motivo real que dio Supabase (permisos RLS, columna inválida, etc.). */
async function enviarGrupo(grupo) {
  const url = `${SUPABASE_URL}/rest/v1/${grupo.tabla}`;
  const headers = { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` };

  if (grupo.operacion === 'delete') {
    const key = PK[grupo.tabla] || 'id';
    for (const item of grupo.items) {
      const payload = JSON.parse(item.payload);
      const res = await fetch(`${url}?${key}=eq.${encodeURIComponent(payload[key])}`, { method: 'DELETE', headers });
      if (!res.ok && res.status !== 404) return { ok: false, error: await textoError(res) };
    }
    return { ok: true };
  }

  const payloads = grupo.items.map((i) => JSON.parse(i.payload));
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(payloads)
  });
  if (!res.ok) return { ok: false, error: await textoError(res) };
  return { ok: true };
}

function agruparPendientes(pendientes) {
  // Agrupa upserts consecutivos de la misma tabla en un solo request.
  const grupos = [];
  for (const item of pendientes) {
    const ultimo = grupos[grupos.length - 1];
    if (item.operacion === 'upsert' && ultimo && ultimo.tabla === item.tabla && ultimo.operacion === 'upsert') {
      ultimo.items.push(item);
    } else {
      grupos.push({ tabla: item.tabla, operacion: item.operacion, items: [item] });
    }
  }
  return grupos;
}

/** Devuelve { enviados, error } — error trae el motivo real de Supabase si algo falló
 * (por ejemplo, falta de permisos RLS), para poder mostrárselo al usuario. */
async function enviarGrupoConReintento(grupo) {
  const ids = grupo.items.map((i) => i.id);
  const placeholders = ids.map(() => '?').join(',');
  try {
    let resultado = await enviarGrupo(grupo);
    if (!resultado.ok && accessToken) {
      // El token pudo haber expirado a medio proceso; reintenta una vez con uno nuevo.
      if (await refrescarToken()) resultado = await enviarGrupo(grupo);
    }
    if (resultado.ok) {
      db().prepare(`DELETE FROM sync_queue WHERE id IN (${placeholders})`).run(...ids);
      return { enviados: ids.length, error: null };
    }
    db().prepare(`UPDATE sync_queue SET intentos=intentos+1, ultimo_error=? WHERE id IN (${placeholders})`)
      .run(resultado.error, ...ids);
    return { enviados: 0, error: resultado.error };
  } catch (e) {
    db().prepare(`UPDATE sync_queue SET intentos=intentos+1, ultimo_error=? WHERE id IN (${placeholders})`).run(e.message, ...ids);
    return { enviados: 0, error: e.message };
  }
}

async function procesarCola() {
  if (sincronizando || !estaConfigurado()) return { ok: false, procesados: 0 };
  sincronizando = true;
  let procesados = 0;
  let ultimoError = null;
  try {
    if (!accessToken) {
      const refrescado = await refrescarToken();
      if (!refrescado) return { ok: false, procesados: 0, error: 'No se pudo autenticar con Supabase.' };
    }

    const pendientes = db().prepare('SELECT * FROM sync_queue ORDER BY id ASC LIMIT 2000').all();
    const grupos = agruparPendientes(pendientes);
    for (const grupo of grupos) {
      const r = await enviarGrupoConReintento(grupo);
      procesados += r.enviados;
      if (r.error) ultimoError = r.error;
    }

    db().prepare("UPDATE app_config SET supabase_ultimo_sync=datetime('now') WHERE id=1").run();
    return { ok: true, procesados, error: procesados === 0 ? ultimoError : null };
  } finally {
    sincronizando = false;
  }
}

let cancelarSolicitado = false;
function solicitarCancelacion() { cancelarSolicitado = true; }

/** Vacía la cola por completo, reportando avance (total/enviados/restantes) a través de
 * onProgress después de cada lote, y permite cancelarse a la mitad con solicitarCancelacion().
 * Lo que quede sin subir se queda en la cola y se reintentará solo en el ciclo automático. */
async function vaciarColaCompleta(onProgress) {
  if (sincronizando || !estaConfigurado()) return { ok: false, procesados: 0 };
  sincronizando = true;
  cancelarSolicitado = false;
  let procesados = 0;
  let ultimoError = null;
  try {
    if (!accessToken) {
      const refrescado = await refrescarToken();
      if (!refrescado) return { ok: false, procesados: 0, error: 'No se pudo autenticar con Supabase.' };
    }

    const total = db().prepare('SELECT COUNT(*) c FROM sync_queue').get().c;
    if (onProgress) onProgress({ total, enviados: 0, restantes: total, cancelado: false });
    if (total === 0) return { ok: true, procesados: 0 };

    while (true) {
      if (cancelarSolicitado) {
        if (onProgress) onProgress({ total, enviados: procesados, restantes: total - procesados, cancelado: true });
        return { ok: true, procesados, cancelado: true };
      }
      const pendientes = db().prepare('SELECT * FROM sync_queue ORDER BY id ASC LIMIT 200').all();
      if (!pendientes.length) break;

      const procesadosAntes = procesados;
      const grupos = agruparPendientes(pendientes);
      for (const grupo of grupos) {
        if (cancelarSolicitado) break;
        const r = await enviarGrupoConReintento(grupo);
        procesados += r.enviados;
        if (r.error) ultimoError = r.error;
        const restantes = db().prepare('SELECT COUNT(*) c FROM sync_queue').get().c;
        if (onProgress) onProgress({ total: Math.max(total, procesados + restantes), enviados: procesados, restantes, cancelado: false });
      }
      // Si en toda una pasada no se logró subir nada, no tiene caso seguir
      // reintentando indefinidamente — probablemente es un error real (permisos, etc).
      if (procesados === procesadosAntes) {
        return { ok: false, procesados, error: ultimoError || 'No se pudo subir la información. Revisa tu conexión y los permisos en Supabase.' };
      }
    }

    db().prepare("UPDATE app_config SET supabase_ultimo_sync=datetime('now') WHERE id=1").run();
    return { ok: true, procesados, cancelado: false };
  } finally {
    sincronizando = false;
  }
}

function iniciarLoop() {
  if (loopIniciado) return;
  loopIniciado = true;
  setTimeout(() => procesarCola().catch(() => {}), 8000);
  setInterval(() => procesarCola().catch(() => {}), 30000);
}

function obtenerEstado() {
  const cfg = getConfig();
  const pendientes = db().prepare('SELECT COUNT(*) c FROM sync_queue').get().c;
  return {
    configurado: !!cfg.supabase_refresh_token,
    email: cfg.supabase_email || null,
    ultimoSync: cfg.supabase_ultimo_sync || null,
    pendientes
  };
}

module.exports = {
  configurarSync, desconectarSync, estaConfigurado, obtenerEstado,
  encolarVenta, encolarGasto, encolarNegocio, evaluarYEncolarStock, encolarTodoHistorico,
  encolarCorte, encolarCredito, encolarDevolucion,
  procesarCola, vaciarColaCompleta, solicitarCancelacion, iniciarLoop
};
