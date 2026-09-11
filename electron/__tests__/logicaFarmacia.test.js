// electron/__tests__/logicaFarmacia.test.js
// Corre con: npm test (usa el runtime de Electron porque better-sqlite3 está
// compilado contra su ABI, no contra el Node del sistema).
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const { openDatabase } = require('../db');
const { seleccionarLotesFEFO, reconciliarStockPresentacion } = require('../logicaFarmacia');

function crearProductoConPresentacion(db, { manejaLotes = 1 } = {}) {
  const prod = db.prepare(
    'INSERT INTO productos (sku, nombre, costo_unitario, precio_publico, activo, maneja_lotes) VALUES (?,?,?,?,1,?)'
  ).run('TEST-' + Math.random().toString(36).slice(2, 8), 'Producto de prueba', 10, 25, manejaLotes);
  const productoId = prod.lastInsertRowid;
  const pres = db.prepare('INSERT INTO presentaciones (producto_id, presentacion, stock) VALUES (?,?,0)').run(productoId, 'Caja');
  return { productoId, presentacionId: pres.lastInsertRowid };
}

function conBaseDeDatosTemporal(fn) {
  const tmp = path.join(os.tmpdir(), 'pvp-test-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.db');
  const db = openDatabase(tmp);
  try {
    fn(db);
  } finally {
    db.close();
    try { fs.unlinkSync(tmp); } catch (_e) {}
    try { fs.unlinkSync(tmp + '-wal'); } catch (_e) {}
    try { fs.unlinkSync(tmp + '-shm'); } catch (_e) {}
  }
}

test('seleccionarLotesFEFO: toma primero el lote que caduca antes', () => {
  conBaseDeDatosTemporal((db) => {
    const { presentacionId } = crearProductoConPresentacion(db);
    db.prepare('INSERT INTO lotes (presentacion_id, numero_lote, fecha_caducidad, cantidad) VALUES (?,?,?,?)').run(presentacionId, 'L-LEJANO', '2030-01-01', 10);
    db.prepare('INSERT INTO lotes (presentacion_id, numero_lote, fecha_caducidad, cantidad) VALUES (?,?,?,?)').run(presentacionId, 'L-CERCANO', '2027-01-01', 10);

    const sel = seleccionarLotesFEFO(db, presentacionId, 5, '2026-01-01');
    assert.equal(sel.ok, true);
    assert.equal(sel.deducciones.length, 1);
    const loteUsado = db.prepare('SELECT numero_lote FROM lotes WHERE id=?').get(sel.deducciones[0].lote_id);
    assert.equal(loteUsado.numero_lote, 'L-CERCANO', 'debe preferir el lote que caduca primero (FEFO)');
  });
});

test('seleccionarLotesFEFO: combina varios lotes si uno solo no alcanza', () => {
  conBaseDeDatosTemporal((db) => {
    const { presentacionId } = crearProductoConPresentacion(db);
    db.prepare('INSERT INTO lotes (presentacion_id, numero_lote, fecha_caducidad, cantidad) VALUES (?,?,?,?)').run(presentacionId, 'L1', '2027-01-01', 3);
    db.prepare('INSERT INTO lotes (presentacion_id, numero_lote, fecha_caducidad, cantidad) VALUES (?,?,?,?)').run(presentacionId, 'L2', '2027-06-01', 4);

    const sel = seleccionarLotesFEFO(db, presentacionId, 5, '2026-01-01');
    assert.equal(sel.ok, true);
    assert.equal(sel.deducciones.length, 2);
    assert.equal(sel.deducciones[0].cantidad + sel.deducciones[1].cantidad, 5);
  });
});

test('seleccionarLotesFEFO: rechaza si el único stock está caducado', () => {
  conBaseDeDatosTemporal((db) => {
    const { presentacionId } = crearProductoConPresentacion(db);
    db.prepare('INSERT INTO lotes (presentacion_id, numero_lote, fecha_caducidad, cantidad) VALUES (?,?,?,?)').run(presentacionId, 'L-VIEJO', '2020-01-01', 10);

    const sel = seleccionarLotesFEFO(db, presentacionId, 1, '2026-01-01');
    assert.equal(sel.ok, false);
    assert.equal(sel.sinLotesCapturados, false, 'sí hay lotes capturados, solo que caducaron');
  });
});

test('seleccionarLotesFEFO: distingue "sin lotes capturados" de "sin stock vigente"', () => {
  conBaseDeDatosTemporal((db) => {
    const { presentacionId } = crearProductoConPresentacion(db);
    // Cero registros en `lotes` — nadie ha capturado nada todavía.
    const sel = seleccionarLotesFEFO(db, presentacionId, 1, '2026-01-01');
    assert.equal(sel.ok, false);
    assert.equal(sel.sinLotesCapturados, true, 'debe distinguir este caso para dar un mensaje de error distinto');
  });
});

test('reconciliarStockPresentacion: producto sin lotes solo actualiza el stock total', () => {
  conBaseDeDatosTemporal((db) => {
    const { presentacionId } = crearProductoConPresentacion(db, { manejaLotes: 0 });
    const r = reconciliarStockPresentacion(db, presentacionId, 20, { motivo: 'test' });
    assert.equal(r.ok, true);
    const p = db.prepare('SELECT stock FROM presentaciones WHERE id=?').get(presentacionId);
    assert.equal(p.stock, 20);
    const lotes = db.prepare('SELECT COUNT(*) c FROM lotes WHERE presentacion_id=?').get(presentacionId);
    assert.equal(lotes.c, 0, 'no debe crear lotes para productos que no manejan lotes');
  });
});

test('reconciliarStockPresentacion: una baja de stock descuenta del lote que caduca antes', () => {
  conBaseDeDatosTemporal((db) => {
    const { presentacionId } = crearProductoConPresentacion(db);
    db.prepare('INSERT INTO lotes (presentacion_id, numero_lote, fecha_caducidad, cantidad) VALUES (?,?,?,?)').run(presentacionId, 'L-CERCANO', '2027-01-01', 10);
    db.prepare('INSERT INTO lotes (presentacion_id, numero_lote, fecha_caducidad, cantidad) VALUES (?,?,?,?)').run(presentacionId, 'L-LEJANO', '2030-01-01', 10);
    db.prepare('UPDATE presentaciones SET stock=20 WHERE id=?').run(presentacionId);

    const r = reconciliarStockPresentacion(db, presentacionId, 15, { motivo: 'conteo' });
    assert.equal(r.ok, true);
    assert.equal(r.diff, -5);

    const cercano = db.prepare("SELECT cantidad FROM lotes WHERE numero_lote='L-CERCANO' AND presentacion_id=?").get(presentacionId);
    const lejano = db.prepare("SELECT cantidad FROM lotes WHERE numero_lote='L-LEJANO' AND presentacion_id=?").get(presentacionId);
    assert.equal(cercano.cantidad, 5, 'el lote que caduca primero debe perder las 5 unidades faltantes');
    assert.equal(lejano.cantidad, 10, 'el lote lejano no debe tocarse mientras el cercano alcance');

    const total = db.prepare('SELECT stock FROM presentaciones WHERE id=?').get(presentacionId);
    assert.equal(total.stock, 15);

    const sumaLotes = db.prepare('SELECT COALESCE(SUM(cantidad),0) s FROM lotes WHERE presentacion_id=?').get(presentacionId);
    assert.equal(sumaLotes.s, total.stock, 'lotes y el stock total deben quedar sincronizados');
  });
});

test('reconciliarStockPresentacion: un alta de stock crea un lote AJUSTE-FISICO para no perder trazabilidad', () => {
  conBaseDeDatosTemporal((db) => {
    const { presentacionId } = crearProductoConPresentacion(db);
    // El stock inicial de un producto con lotes SIEMPRE entra por un lote real
    // (ver productos:save / productos:addPresentacion, que fuerzan esto) — nunca
    // como un número suelto en presentaciones.stock. Así se ve un estado válido.
    db.prepare('INSERT INTO lotes (presentacion_id, numero_lote, fecha_caducidad, cantidad) VALUES (?,?,?,?)').run(presentacionId, 'L-INICIAL', '2028-01-01', 5);
    db.prepare('UPDATE presentaciones SET stock=5 WHERE id=?').run(presentacionId);

    const r = reconciliarStockPresentacion(db, presentacionId, 12, { motivo: 'conteo' });
    assert.equal(r.ok, true);
    assert.equal(r.diff, 7);

    const ajuste = db.prepare("SELECT cantidad, fecha_caducidad FROM lotes WHERE presentacion_id=? AND numero_lote='AJUSTE-FISICO'").get(presentacionId);
    assert.ok(ajuste, 'debe crear un lote de ajuste para el alta no explicada');
    assert.equal(ajuste.cantidad, 7);
    assert.equal(ajuste.fecha_caducidad, null, 'sin caducidad hasta que alguien la capture manualmente');

    const sumaLotes = db.prepare('SELECT COALESCE(SUM(cantidad),0) s FROM lotes WHERE presentacion_id=?').get(presentacionId);
    const total = db.prepare('SELECT stock FROM presentaciones WHERE id=?').get(presentacionId);
    assert.equal(sumaLotes.s, total.stock, 'lotes y el stock total deben quedar sincronizados');
  });
});

test('reconciliarStockPresentacion: no hace nada si el stock contado es igual al del sistema', () => {
  conBaseDeDatosTemporal((db) => {
    const { presentacionId } = crearProductoConPresentacion(db, { manejaLotes: 0 });
    db.prepare('UPDATE presentaciones SET stock=8 WHERE id=?').run(presentacionId);
    const r = reconciliarStockPresentacion(db, presentacionId, 8, {});
    assert.equal(r.ok, true);
    assert.equal(r.diff, 0);
    const movs = db.prepare('SELECT COUNT(*) c FROM inventario_movimientos WHERE presentacion_id=?').get(presentacionId);
    assert.equal(movs.c, 0, 'un ajuste de diferencia cero no debe generar movimiento de inventario');
  });
});
