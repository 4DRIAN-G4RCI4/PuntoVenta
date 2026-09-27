// electron/db.js — SQLite bootstrap + seed (main process only)
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

let dbInstance = null;
let dbPath = null;

function openDatabase(targetPath) {
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const isNew = !fs.existsSync(targetPath);
  const db = new Database(targetPath);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');

  // Instalaciones existentes traían la tabla "tallas"/columna "talla_id" (nombre
  // pensado para zapatería). Se renombra a "presentaciones"/"presentacion_id"
  // ANTES de aplicar schema.sql, para no perder el inventario ya capturado.
  migrarRenombrePresentaciones(db);

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(schema);
  db.prepare(`INSERT OR IGNORE INTO app_config (id, nombre_negocio) VALUES (1, 'Poblano')`).run();

  // Migraciones ligeras: agrega columnas nuevas a instalaciones existentes.
  ensureColumn(db, 'app_config', 'tipo_negocio', "TEXT NOT NULL DEFAULT 'general'");
  ensureColumn(db, 'app_config', 'impresora_ticket', 'TEXT');
  ensureColumn(db, 'app_config', 'ancho_papel', "TEXT DEFAULT '80mm'");
  ensureColumn(db, 'app_config', 'supabase_url', 'TEXT');
  ensureColumn(db, 'app_config', 'supabase_anon_key', 'TEXT');
  ensureColumn(db, 'app_config', 'supabase_refresh_token', 'TEXT');
  ensureColumn(db, 'app_config', 'supabase_email', 'TEXT');
  ensureColumn(db, 'app_config', 'supabase_ultimo_sync', 'TEXT');
  ensureColumn(db, 'app_config', 'recovery_key_hash', 'TEXT');

  // Campos para negocios que venden productos regulados/perecederos (ej. farmacias).
  ensureColumn(db, 'productos', 'principio_activo', 'TEXT');
  ensureColumn(db, 'productos', 'laboratorio', 'TEXT');
  ensureColumn(db, 'productos', 'forma_farmaceutica', 'TEXT');
  ensureColumn(db, 'productos', 'registro_sanitario', 'TEXT');
  ensureColumn(db, 'productos', 'requiere_receta', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'productos', 'sustancia_controlada', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'productos', 'iva', 'REAL NOT NULL DEFAULT 16');
  ensureColumn(db, 'productos', 'maneja_lotes', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'ventas_detalle', 'receta_folio', 'TEXT');
  ensureColumn(db, 'ventas_detalle', 'identificacion_comprador', 'TEXT');
  ensureColumn(db, 'gastos', 'proveedor_id', 'INTEGER REFERENCES proveedores(id) ON DELETE SET NULL');
  ensureColumn(db, 'usuarios', 'debe_cambiar_password', 'INTEGER NOT NULL DEFAULT 0');

  if (isNew) seed(db);

  // Instalaciones que se actualizan desde una versión sin llave de recuperación
  // también necesitan una — si no, quedarían sin forma de recuperar el acceso.
  const cfg = db.prepare('SELECT recovery_key_hash FROM app_config WHERE id=1').get();
  if (cfg && !cfg.recovery_key_hash) generarLlaveRecuperacion(db);

  dbInstance = db;
  dbPath = targetPath;
  return db;
}

/** Genera una nueva llave de recuperación (formato PVP-XXXX-XXXX-XXXX), la guarda
 * hasheada (nunca en texto plano) y devuelve la llave en claro UNA sola vez — quien
 * llama debe mostrarla al admin de inmediato, porque después no se puede recuperar. */
function generarLlaveRecuperacion(db) {
  const bcrypt = require('bcryptjs');
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O/1/I, se confunden al transcribir
  const grupo = () => Array.from({ length: 4 }, () => alfabeto[Math.floor(Math.random() * alfabeto.length)]).join('');
  const llave = `PVP-${grupo()}-${grupo()}-${grupo()}`;
  db.prepare('UPDATE app_config SET recovery_key_hash=? WHERE id=1').run(bcrypt.hashSync(llave, 10));
  return llave;
}

function tablaExiste(db, tabla) {
  return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tabla);
}

function migrarRenombrePresentaciones(db) {
  if (tablaExiste(db, 'tallas') && !tablaExiste(db, 'presentaciones')) {
    db.exec('ALTER TABLE tallas RENAME TO presentaciones');
    db.exec('ALTER TABLE presentaciones RENAME COLUMN talla TO presentacion');
  }
  for (const tabla of ['ventas_detalle', 'devoluciones_detalle', 'inventario_movimientos']) {
    if (!tablaExiste(db, tabla)) continue;
    const cols = db.prepare(`PRAGMA table_info(${tabla})`).all();
    if (cols.some((c) => c.name === 'talla_id') && !cols.some((c) => c.name === 'presentacion_id')) {
      db.exec(`ALTER TABLE ${tabla} RENAME COLUMN talla_id TO presentacion_id`);
    }
  }
}

function ensureColumn(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function getDb() {
  return dbInstance;
}

function getDbPath() {
  return dbPath;
}

function reopenDatabase(newPath) {
  try { dbInstance && dbInstance.close(); } catch (_e) {}
  return openDatabase(newPath);
}

function generateFolio() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const row = dbInstance
    .prepare("SELECT COUNT(*) c FROM ventas WHERE date(created_at) = date('now','localtime')")
    .get();
  const seq = String((row?.c || 0) + 1).padStart(4, '0');
  return `V${y}${m}${d}-${seq}`;
}

function seed(db) {
  const hash = (p) => bcrypt.hashSync(p, 10);

  // Contraseñas temporales: debe_cambiar_password=1 obliga a cambiarlas en el
  // primer inicio de sesión (antes de poder usar el resto de la app) — así
  // que aunque estas queden documentadas para la instalación inicial, nunca
  // se quedan activas en un sistema ya en uso real. Ver docs/CREDENCIALES-INICIALES.md.
  const insUser = db.prepare(
    `INSERT INTO usuarios (nombre, email, password, rol, activo, debe_cambiar_password) VALUES (?,?,?,?,1,1)`
  );
  insUser.run('Administrador', 'admin@tienda.com', hash('admin123'), 'admin');
  insUser.run('Vendedor Demo', 'vendedor@tienda.com', hash('vendedor123'), 'vendedor');
  insUser.run('Almacén Demo', 'almacen@tienda.com', hash('almacen123'), 'almacen');

  const insCat = db.prepare(
    `INSERT INTO categorias (parent_id, nombre, descripcion) VALUES (?,?,?)`
  );
  const calzado = insCat.run(null, 'Calzado', 'Tenis y zapatos').lastInsertRowid;
  const ropa = insCat.run(null, 'Ropa', 'Prendas de vestir').lastInsertRowid;
  const joyeria = insCat.run(null, 'Joyería', 'Accesorios y joyería').lastInsertRowid;
  insCat.run(calzado, 'Deportivo', 'Tenis deportivos');
  insCat.run(ropa, 'Playeras', 'Playeras y camisetas');

  const insProd = db.prepare(`INSERT INTO productos
    (sku, codigo_barras, nombre, descripcion, categoria_id, departamento, marca, modelo, color, material, costo_unitario, precio_publico, activo)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)`);
  const insPresentacion = db.prepare(`INSERT INTO presentaciones (producto_id, presentacion, stock, stock_minimo) VALUES (?,?,?,?)`);

  const p1 = insProd.run('CAL-001', '750100000001', 'Tenis Runner Pro', 'Tenis deportivos para correr',
    calzado, 'Calzado', 'Nortex', 'Runner Pro', 'Negro/Rojo', 'Malla', 450, 899).lastInsertRowid;
  insPresentacion.run(p1, '25', 8, 3);
  insPresentacion.run(p1, '26', 5, 3);
  insPresentacion.run(p1, '27', 2, 3);

  const p2 = insProd.run('ROP-001', '750100000002', 'Playera Básica', 'Playera de algodón 100%',
    ropa, 'Ropa', 'Poblano Wear', 'Básica', 'Blanco', 'Algodón', 60, 149).lastInsertRowid;
  insPresentacion.run(p2, 'CH', 10, 4);
  insPresentacion.run(p2, 'M', 12, 4);
  insPresentacion.run(p2, 'G', 6, 4);

  const p3 = insProd.run('JOY-001', '750100000003', 'Pulsera Plata .925', 'Pulsera de plata fina',
    joyeria, 'Joyería', 'ArgentaMX', 'Clásica', 'Plateado', 'Plata', 180, 399).lastInsertRowid;
  insPresentacion.run(p3, 'Única', 15, 3);

  const insCli = db.prepare(`INSERT INTO clientes (nombre, apellido, telefono, email, limite_credito) VALUES (?,?,?,?,?)`);
  insCli.run('Juan', 'Pérez', '7351234567', 'juan.perez@example.com', 3000);
  insCli.run('María', 'López', '7359876543', 'maria.lopez@example.com', 5000);

  generarLlaveRecuperacion(db);
}

module.exports = { openDatabase, getDb, getDbPath, reopenDatabase, generateFolio, generarLlaveRecuperacion };
