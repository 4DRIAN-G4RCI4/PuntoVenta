PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS usuarios (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre                 TEXT NOT NULL,
  email                  TEXT NOT NULL UNIQUE,
  password               TEXT NOT NULL,
  rol                    TEXT NOT NULL CHECK (rol IN ('admin','vendedor','almacen')) DEFAULT 'vendedor',
  activo                 INTEGER NOT NULL DEFAULT 1,
  debe_cambiar_password  INTEGER NOT NULL DEFAULT 0,
  created_at             TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categorias (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id   INTEGER NULL REFERENCES categorias(id) ON DELETE SET NULL,
  nombre      TEXT NOT NULL,
  descripcion TEXT,
  activo      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS productos (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  sku             TEXT NOT NULL UNIQUE,
  codigo_barras   TEXT UNIQUE,
  nombre          TEXT NOT NULL,
  descripcion     TEXT,
  categoria_id    INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
  departamento    TEXT,
  marca           TEXT,
  modelo          TEXT,
  color           TEXT,
  material        TEXT,
  costo_unitario  REAL NOT NULL DEFAULT 0,
  precio_publico  REAL NOT NULL DEFAULT 0,
  imagen          TEXT,
  activo          INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS presentaciones (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id   INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  presentacion         TEXT NOT NULL,
  stock         INTEGER NOT NULL DEFAULT 0,
  stock_minimo  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS inventario_movimientos (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id  INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  presentacion_id     INTEGER REFERENCES presentaciones(id) ON DELETE SET NULL,
  tipo         TEXT NOT NULL CHECK (tipo IN ('entrada','salida','ajuste')),
  cantidad     INTEGER NOT NULL,
  motivo       TEXT,
  usuario_id   INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clientes (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre          TEXT NOT NULL,
  apellido        TEXT NOT NULL DEFAULT '',
  telefono        TEXT,
  email           TEXT,
  calle           TEXT,
  colonia         TEXT,
  ciudad          TEXT,
  estado          TEXT,
  cp              TEXT,
  rfc             TEXT,
  limite_credito  REAL NOT NULL DEFAULT 0,
  saldo_deuda     REAL NOT NULL DEFAULT 0,
  notas           TEXT,
  activo          INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS promociones (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre        TEXT NOT NULL,
  codigo        TEXT,
  tipo          TEXT NOT NULL CHECK (tipo IN ('porcentaje','monto_fijo')) DEFAULT 'porcentaje',
  valor         REAL NOT NULL DEFAULT 0,
  departamento  TEXT DEFAULT 'todos',
  categoria_id  INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
  producto_id   INTEGER REFERENCES productos(id) ON DELETE SET NULL,
  fecha_inicio  TEXT,
  fecha_fin     TEXT,
  activo        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ventas (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  folio                 TEXT NOT NULL UNIQUE,
  cliente_id            INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
  tipo_venta            TEXT NOT NULL CHECK (tipo_venta IN ('contado','credito','a_meses')) DEFAULT 'contado',
  forma_pago            TEXT NOT NULL DEFAULT 'efectivo',
  subtotal              REAL NOT NULL DEFAULT 0,
  descuento_monto       REAL NOT NULL DEFAULT 0,
  descuento_porcentaje  REAL NOT NULL DEFAULT 0,
  total                 REAL NOT NULL DEFAULT 0,
  monto_pagado          REAL NOT NULL DEFAULT 0,
  saldo_pendiente       REAL NOT NULL DEFAULT 0,
  estado                TEXT NOT NULL CHECK (estado IN ('pagada','pendiente','credito','a_meses','devuelta','cancelada')) DEFAULT 'pagada',
  notas                 TEXT,
  usuario_id            INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  num_meses             INTEGER NOT NULL DEFAULT 0,
  tasa_interes          REAL NOT NULL DEFAULT 0,
  enganche              REAL NOT NULL DEFAULT 0,
  cuota_mensual         REAL NOT NULL DEFAULT 0,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ventas_detalle (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  venta_id        INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  producto_id     INTEGER NOT NULL REFERENCES productos(id),
  presentacion_id        INTEGER REFERENCES presentaciones(id) ON DELETE SET NULL,
  cantidad        INTEGER NOT NULL DEFAULT 1,
  precio_unitario REAL NOT NULL DEFAULT 0,
  costo_unitario  REAL NOT NULL DEFAULT 0,
  subtotal        REAL NOT NULL DEFAULT 0,
  receta_folio    TEXT,
  identificacion_comprador TEXT
);

CREATE TABLE IF NOT EXISTS pagos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  venta_id    INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  cliente_id  INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
  monto       REAL NOT NULL DEFAULT 0,
  forma_pago  TEXT NOT NULL DEFAULT 'efectivo',
  referencia  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS devoluciones (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  venta_id         INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  motivo           TEXT,
  tipo_devolucion  TEXT NOT NULL CHECK (tipo_devolucion IN ('reembolso','cambio','nota_credito')) DEFAULT 'reembolso',
  monto_total      REAL NOT NULL DEFAULT 0,
  notas            TEXT,
  usuario_id       INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  estado           TEXT NOT NULL CHECK (estado IN ('pendiente','aprobada','rechazada','procesada')) DEFAULT 'procesada',
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS devoluciones_detalle (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  devolucion_id    INTEGER NOT NULL REFERENCES devoluciones(id) ON DELETE CASCADE,
  producto_id      INTEGER REFERENCES productos(id),
  presentacion_id         INTEGER REFERENCES presentaciones(id) ON DELETE SET NULL,
  cantidad         INTEGER NOT NULL DEFAULT 1,
  precio_unitario  REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS gastos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  concepto    TEXT NOT NULL,
  monto       REAL NOT NULL DEFAULT 0,
  categoria   TEXT NOT NULL DEFAULT 'general',
  forma_pago  TEXT NOT NULL DEFAULT 'efectivo',
  fecha       TEXT NOT NULL,
  notas       TEXT,
  proveedor   TEXT,
  usuario_id  INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS app_config (
  id                       INTEGER PRIMARY KEY CHECK (id = 1),
  nombre_negocio           TEXT NOT NULL DEFAULT 'Poblano',
  tipo_negocio             TEXT NOT NULL DEFAULT 'general',
  logo                     TEXT,
  impresora_ticket         TEXT,
  ancho_papel              TEXT DEFAULT '80mm',
  supabase_url             TEXT,
  supabase_anon_key        TEXT,
  supabase_refresh_token   TEXT,
  supabase_email           TEXT,
  supabase_ultimo_sync     TEXT
);

-- Cola de sincronización hacia Supabase (bd en línea). Cada venta, gasto
-- o cambio de stock relevante se encola aquí; un proceso en segundo plano
-- intenta subirlo y lo reintenta solo si falló (sin internet, etc.) — así
-- la app de escritorio nunca depende de la conexión para poder vender.
CREATE TABLE IF NOT EXISTS sync_queue (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  tabla        TEXT NOT NULL,
  operacion    TEXT NOT NULL CHECK (operacion IN ('upsert','delete')) DEFAULT 'upsert',
  payload      TEXT NOT NULL,
  intentos     INTEGER NOT NULL DEFAULT 0,
  ultimo_error TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cortes_caja (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id              INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha_inicio            TEXT NOT NULL,
  fecha_fin               TEXT NOT NULL DEFAULT (datetime('now')),
  estado                  TEXT NOT NULL CHECK (estado IN ('completado','omitido')) DEFAULT 'completado',
  motivo_omision          TEXT,
  efectivo_esperado       REAL NOT NULL DEFAULT 0,
  efectivo_contado        REAL,
  tarjeta_esperado        REAL NOT NULL DEFAULT 0,
  tarjeta_contado         REAL,
  transferencia_esperado  REAL NOT NULL DEFAULT 0,
  transferencia_contado   REAL,
  diferencia              REAL NOT NULL DEFAULT 0,
  num_ventas              INTEGER NOT NULL DEFAULT 0,
  created_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Lotes de mercancía perecedera (medicamentos, alimentos, etc.). Cada entrada
-- de inventario de un producto que "maneja_lotes" crea aquí un registro con
-- su propia caducidad, para poder vender FEFO (primero el que antes caduca)
-- y alertar antes de que algo caduque o se venda ya caducado.
CREATE TABLE IF NOT EXISTS lotes (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  presentacion_id         INTEGER NOT NULL REFERENCES presentaciones(id) ON DELETE CASCADE,
  numero_lote      TEXT,
  fecha_caducidad  TEXT,
  cantidad         INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS proveedores (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre      TEXT NOT NULL,
  contacto    TEXT,
  telefono    TEXT,
  email       TEXT,
  notas       TEXT,
  activo      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_lotes_presentacion ON lotes(presentacion_id);
CREATE INDEX IF NOT EXISTS idx_lotes_caducidad ON lotes(fecha_caducidad);
CREATE INDEX IF NOT EXISTS idx_cortes_usuario ON cortes_caja(usuario_id);
CREATE INDEX IF NOT EXISTS idx_categorias_parent ON categorias(parent_id);
CREATE INDEX IF NOT EXISTS idx_productos_cat ON productos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_presentaciones_prod ON presentaciones(producto_id);
CREATE INDEX IF NOT EXISTS idx_ventas_cliente ON ventas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ventas_tipo ON ventas(tipo_venta);
CREATE INDEX IF NOT EXISTS idx_ventas_detalle_venta ON ventas_detalle(venta_id);
CREATE INDEX IF NOT EXISTS idx_pagos_venta ON pagos(venta_id);
CREATE INDEX IF NOT EXISTS idx_gastos_fecha ON gastos(fecha);
