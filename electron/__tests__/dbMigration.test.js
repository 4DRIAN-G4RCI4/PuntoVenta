// electron/__tests__/dbMigration.test.js — verifica que abrir la base de datos
// (nueva, o una instalación vieja con el esquema "tallas") deja todo consistente.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const Database = require('better-sqlite3');

const { openDatabase } = require('../db');

function tmpPath() {
  return path.join(os.tmpdir(), 'pvp-migtest-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.db');
}

function limpiar(p) {
  for (const suf of ['', '-wal', '-shm']) {
    try { fs.unlinkSync(p + suf); } catch (_e) {}
  }
}

test('base de datos nueva: crea presentaciones/lotes/proveedores y los campos de farmacia', () => {
  const tmp = tmpPath();
  try {
    const db = openDatabase(tmp);
    const cols = (t) => db.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name);

    assert.ok(cols('presentaciones').includes('presentacion'));
    assert.ok(cols('lotes').includes('presentacion_id'));
    assert.ok(cols('proveedores').includes('nombre'));
    assert.ok(cols('usuarios').includes('debe_cambiar_password'));

    const admin = db.prepare("SELECT debe_cambiar_password FROM usuarios WHERE email='admin@tienda.com'").get();
    assert.equal(admin.debe_cambiar_password, 1, 'las contraseñas semilla deben quedar marcadas como temporales (A4)');

    const prodCols = cols('productos');
    for (const campo of ['principio_activo', 'laboratorio', 'forma_farmaceutica', 'registro_sanitario', 'requiere_receta', 'sustancia_controlada', 'iva', 'maneja_lotes']) {
      assert.ok(prodCols.includes(campo), `productos debe tener la columna ${campo}`);
    }
    assert.ok(cols('ventas_detalle').includes('receta_folio'));
    assert.ok(cols('ventas_detalle').includes('identificacion_comprador'));

    db.close();
  } finally {
    limpiar(tmp);
  }
});

test('base de datos nueva: abrir dos veces es idempotente (no truena, no duplica)', () => {
  const tmp = tmpPath();
  try {
    const db1 = openDatabase(tmp);
    const antes = db1.prepare('SELECT COUNT(*) c FROM productos').get().c;
    db1.close();

    const db2 = openDatabase(tmp);
    const despues = db2.prepare('SELECT COUNT(*) c FROM productos').get().c;
    assert.equal(antes, despues);
    db2.close();
  } finally {
    limpiar(tmp);
  }
});

test('instalación vieja con tabla "tallas": migra a "presentaciones" sin perder datos', () => {
  const tmp = tmpPath();
  try {
    // Simula el esquema legado tal cual existía antes del rename, con datos reales.
    const raw = new Database(tmp);
    raw.pragma('foreign_keys = ON');
    raw.exec(`
      CREATE TABLE categorias (id INTEGER PRIMARY KEY AUTOINCREMENT, parent_id INTEGER, nombre TEXT, descripcion TEXT, activo INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')));
      CREATE TABLE productos (id INTEGER PRIMARY KEY AUTOINCREMENT, sku TEXT UNIQUE, codigo_barras TEXT, nombre TEXT, descripcion TEXT, categoria_id INTEGER, departamento TEXT, marca TEXT, modelo TEXT, color TEXT, material TEXT, costo_unitario REAL DEFAULT 0, precio_publico REAL DEFAULT 0, imagen TEXT, activo INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')));
      CREATE TABLE tallas (id INTEGER PRIMARY KEY AUTOINCREMENT, producto_id INTEGER NOT NULL REFERENCES productos(id), talla TEXT NOT NULL, stock INTEGER DEFAULT 0, stock_minimo INTEGER DEFAULT 0);
      CREATE TABLE clientes (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT, apellido TEXT DEFAULT '', telefono TEXT, saldo_deuda REAL DEFAULT 0, limite_credito REAL DEFAULT 0, activo INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')));
      CREATE TABLE ventas (id INTEGER PRIMARY KEY AUTOINCREMENT, folio TEXT UNIQUE, cliente_id INTEGER, tipo_venta TEXT DEFAULT 'contado', forma_pago TEXT DEFAULT 'efectivo', subtotal REAL DEFAULT 0, total REAL DEFAULT 0, estado TEXT DEFAULT 'pagada', usuario_id INTEGER, created_at TEXT DEFAULT (datetime('now')));
      CREATE TABLE ventas_detalle (id INTEGER PRIMARY KEY AUTOINCREMENT, venta_id INTEGER, producto_id INTEGER, talla_id INTEGER, cantidad INTEGER DEFAULT 1, precio_unitario REAL DEFAULT 0, costo_unitario REAL DEFAULT 0, subtotal REAL DEFAULT 0);
      CREATE TABLE devoluciones (id INTEGER PRIMARY KEY AUTOINCREMENT, venta_id INTEGER, tipo_devolucion TEXT DEFAULT 'reembolso', monto_total REAL DEFAULT 0, estado TEXT DEFAULT 'procesada', created_at TEXT DEFAULT (datetime('now')));
      CREATE TABLE devoluciones_detalle (id INTEGER PRIMARY KEY AUTOINCREMENT, devolucion_id INTEGER, producto_id INTEGER, talla_id INTEGER, cantidad INTEGER DEFAULT 1, precio_unitario REAL DEFAULT 0);
      CREATE TABLE gastos (id INTEGER PRIMARY KEY AUTOINCREMENT, concepto TEXT, monto REAL DEFAULT 0, categoria TEXT DEFAULT 'general', forma_pago TEXT DEFAULT 'efectivo', fecha TEXT, usuario_id INTEGER, created_at TEXT DEFAULT (datetime('now')));
      CREATE TABLE inventario_movimientos (id INTEGER PRIMARY KEY AUTOINCREMENT, producto_id INTEGER, talla_id INTEGER, tipo TEXT, cantidad INTEGER, motivo TEXT, usuario_id INTEGER, created_at TEXT DEFAULT (datetime('now')));
      CREATE TABLE usuarios (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT, email TEXT UNIQUE, password TEXT, rol TEXT DEFAULT 'vendedor', activo INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')));
      CREATE TABLE app_config (id INTEGER PRIMARY KEY CHECK (id=1), nombre_negocio TEXT DEFAULT 'Poblano', logo TEXT);
      CREATE TABLE promociones (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT, tipo TEXT DEFAULT 'porcentaje', valor REAL DEFAULT 0, activo INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')));
      CREATE TABLE pagos (id INTEGER PRIMARY KEY AUTOINCREMENT, venta_id INTEGER, cliente_id INTEGER, monto REAL DEFAULT 0, forma_pago TEXT DEFAULT 'efectivo', created_at TEXT DEFAULT (datetime('now')));
      CREATE TABLE cortes_caja (id INTEGER PRIMARY KEY AUTOINCREMENT, usuario_id INTEGER, fecha_inicio TEXT, fecha_fin TEXT DEFAULT (datetime('now')), estado TEXT DEFAULT 'completado', efectivo_esperado REAL DEFAULT 0, tarjeta_esperado REAL DEFAULT 0, transferencia_esperado REAL DEFAULT 0, diferencia REAL DEFAULT 0, num_ventas INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')));
      CREATE TABLE sync_queue (id INTEGER PRIMARY KEY AUTOINCREMENT, tabla TEXT, operacion TEXT DEFAULT 'upsert', payload TEXT, intentos INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')));
    `);
    raw.prepare('INSERT INTO productos (sku, nombre, costo_unitario, precio_publico) VALUES (?,?,?,?)').run('CAL-001', 'Producto viejo', 450, 899);
    raw.prepare('INSERT INTO tallas (producto_id, talla, stock, stock_minimo) VALUES (1, ?, ?, ?)').run('26', 12, 3);
    raw.prepare('INSERT INTO ventas_detalle (venta_id, producto_id, talla_id, cantidad) VALUES (1,1,1,2)').run();
    raw.close();

    const db = openDatabase(tmp);

    const presentaciones = db.prepare('SELECT * FROM presentaciones').all();
    assert.equal(presentaciones.length, 1);
    assert.equal(presentaciones[0].presentacion, '26');
    assert.equal(presentaciones[0].stock, 12);

    const detalleCols = db.prepare('PRAGMA table_info(ventas_detalle)').all().map((c) => c.name);
    assert.ok(detalleCols.includes('presentacion_id'));
    assert.ok(!detalleCols.includes('talla_id'));

    const detalle = db.prepare('SELECT * FROM ventas_detalle').all();
    assert.equal(detalle[0].presentacion_id, 1);

    const legacy = db.prepare("SELECT name FROM sqlite_master WHERE name='tallas'").get();
    assert.equal(legacy, undefined, 'la tabla vieja "tallas" no debe seguir existiendo tras migrar');

    db.close();

    // Reabrir de nuevo: la migración ya se aplicó, no debe volver a intentarlo ni tronar.
    const db2 = openDatabase(tmp);
    assert.equal(db2.prepare('SELECT COUNT(*) c FROM presentaciones').get().c, 1);
    db2.close();
  } finally {
    limpiar(tmp);
  }
});
