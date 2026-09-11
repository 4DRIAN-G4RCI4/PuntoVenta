// electron/seedTestData.js — genera datos de prueba (~1000 ventas) en la BD real.
// Ejecutar con: node_modules/electron/dist/electron.exe electron/seedTestData.js
const path = require('path');
const os = require('os');
const Database = require('better-sqlite3');

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'punto-venta-poblano', 'data', 'data.db');
console.log('Usando base de datos:', dbPath);

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[rnd(0, arr.length - 1)]; }
function round2(n) { return Math.round(n * 100) / 100; }

const NOMBRES = ['Juan', 'María', 'Carlos', 'Ana', 'Luis', 'Sofía', 'Jorge', 'Laura', 'Pedro', 'Fernanda', 'Miguel', 'Paola', 'Ricardo', 'Karla', 'Diego', 'Valeria', 'Andrés', 'Daniela', 'Roberto', 'Ximena'];
const APELLIDOS = ['García', 'Hernández', 'López', 'Martínez', 'Pérez', 'Sánchez', 'Ramírez', 'Torres', 'Flores', 'Rivera', 'Gómez', 'Díaz', 'Cruz', 'Morales', 'Ortiz'];

const CATS = [
  { nombre: 'Calzado', dept: 'Calzado' },
  { nombre: 'Ropa', dept: 'Ropa' },
  { nombre: 'Joyería', dept: 'Joyería' },
  { nombre: 'Accesorios', dept: 'Accesorios' },
  { nombre: 'Deportes', dept: 'Deportes' },
];

const MARCAS = ['Nortex', 'Poblano Wear', 'ArgentaMX', 'UrbanFit', 'ClassicMx', 'Vertex', 'Aurora'];
const COLORES = ['Negro', 'Blanco', 'Rojo', 'Azul', 'Gris', 'Verde', 'Café'];
const PRESENTACIONES_CALZADO = ['24', '25', '26', '27', '28'];
const PRESENTACIONES_ROPA = ['CH', 'M', 'G', 'XG'];

const insCat = db.prepare(`INSERT INTO categorias (parent_id, nombre, descripcion) VALUES (?,?,?)`);
const insProd = db.prepare(`INSERT INTO productos
  (sku, codigo_barras, nombre, descripcion, categoria_id, departamento, marca, modelo, color, material, costo_unitario, precio_publico, activo)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)`);
const insPresentacion = db.prepare(`INSERT INTO presentaciones (producto_id, presentacion, stock, stock_minimo) VALUES (?,?,?,?)`);
const insCli = db.prepare(`INSERT INTO clientes (nombre, apellido, telefono, email, limite_credito) VALUES (?,?,?,?,?)`);

const insVenta = db.prepare(`INSERT INTO ventas
  (folio, cliente_id, tipo_venta, forma_pago, subtotal, descuento_monto, descuento_porcentaje, total, monto_pagado, saldo_pendiente, estado, usuario_id, created_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
const insDetalle = db.prepare(`INSERT INTO ventas_detalle
  (venta_id, producto_id, presentacion_id, cantidad, precio_unitario, costo_unitario, subtotal) VALUES (?,?,?,?,?,?,?)`);

const seedAll = db.transaction(() => {
  // ── Categorías (si no existen ya suficientes) ──
  const catRows = [];
  const catsExistentes = db.prepare('SELECT id, nombre FROM categorias').all();
  for (const c of CATS) {
    const existente = catsExistentes.find((e) => e.nombre === c.nombre);
    const id = existente ? existente.id : insCat.run(null, c.nombre, c.nombre + ' de prueba').lastInsertRowid;
    catRows.push({ id, ...c });
  }

  // ── Productos de prueba (60) ──
  const productos = [];
  const prodsExistentes = db.prepare('SELECT id, sku, departamento, costo_unitario, precio_publico FROM productos').all();
  productos.push(...prodsExistentes);

  const presentacionesPorProducto = new Map();
  const presentacionesExistentes = db.prepare('SELECT id, producto_id, presentacion FROM presentaciones').all();
  for (const t of presentacionesExistentes) {
    if (!presentacionesPorProducto.has(t.producto_id)) presentacionesPorProducto.set(t.producto_id, []);
    presentacionesPorProducto.get(t.producto_id).push(t);
  }

  const PROD_COUNT = 60;
  for (let i = 1; i <= PROD_COUNT; i++) {
    const cat = pick(catRows);
    const sku = `TEST-${String(i).padStart(3, '0')}`;
    if (productos.find((p) => p.sku === sku)) continue;
    const costo = rnd(80, 600);
    const precio = round2(costo * (1.4 + Math.random() * 0.8));
    const esCalzado = cat.dept === 'Calzado' || cat.dept === 'Deportes';
    const nombre = `${cat.nombre} ${pick(MARCAS)} ${pick(['Clásico', 'Pro', 'Urban', 'Sport', 'Elite', 'Basic'])} ${i}`;
    const prodId = insProd.run(
      sku, `77${String(1000000 + i)}`, nombre, `${nombre} - producto de prueba`,
      cat.id, cat.dept, pick(MARCAS), 'Modelo ' + i, pick(COLORES), esCalzado ? 'Sintético' : 'Textil',
      costo, precio
    ).lastInsertRowid;
    productos.push({ id: prodId, sku, departamento: cat.dept, costo_unitario: costo, precio_publico: precio });

    const presentacionesSet = esCalzado ? PRESENTACIONES_CALZADO : PRESENTACIONES_ROPA;
    const presentacionesArr = [];
    for (const t of presentacionesSet) {
      const tid = insPresentacion.run(prodId, t, rnd(5, 30), 3).lastInsertRowid;
      presentacionesArr.push({ id: tid, producto_id: prodId, presentacion: t });
    }
    presentacionesPorProducto.set(prodId, presentacionesArr);
  }

  // ── Clientes de prueba (40) ──
  const clientes = db.prepare('SELECT id FROM clientes').all();
  for (let i = 0; i < 40; i++) {
    const nombre = pick(NOMBRES);
    const apellido = pick(APELLIDOS);
    const id = insCli.run(nombre, apellido, `55${rnd(10000000, 99999999)}`, `${nombre}.${apellido}${i}@test.com`.toLowerCase(), pick([0, 1500, 3000, 5000])).lastInsertRowid;
    clientes.push({ id });
  }

  const usuarios = db.prepare('SELECT id FROM usuarios').all().map((u) => u.id);
  const FORMAS_PAGO = ['efectivo', 'tarjeta', 'transferencia'];
  const ESTADOS = ['pagada', 'pagada', 'pagada', 'pagada', 'pendiente', 'credito'];

  // ── 1000 ventas distribuidas en los últimos 365 días ──
  const VENTAS_COUNT = 1000;
  let folioSeq = {};
  for (let i = 0; i < VENTAS_COUNT; i++) {
    const diasAtras = rnd(0, 364);
    const fecha = new Date();
    fecha.setDate(fecha.getDate() - diasAtras);
    fecha.setHours(rnd(9, 20), rnd(0, 59), rnd(0, 59), 0);
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, '0');
    const d = String(fecha.getDate()).padStart(2, '0');
    const key = `${y}${m}${d}`;
    folioSeq[key] = (folioSeq[key] || 0) + 1;
    const folio = `V${key}-T${String(folioSeq[key]).padStart(4, '0')}`;

    const clienteId = Math.random() < 0.7 ? pick(clientes).id : null;
    const usuarioId = pick(usuarios);
    const numItems = rnd(1, 4);
    const itemsVenta = [];
    let subtotal = 0;
    let costoTotal = 0;

    for (let j = 0; j < numItems; j++) {
      const prod = pick(productos);
      const presentaciones = presentacionesPorProducto.get(prod.id);
      const presentacion = presentaciones && presentaciones.length ? pick(presentaciones) : null;
      const cantidad = rnd(1, 3);
      const precioU = prod.precio_publico;
      const costoU = prod.costo_unitario;
      const sub = round2(precioU * cantidad);
      subtotal += sub;
      costoTotal += costoU * cantidad;
      itemsVenta.push({ producto_id: prod.id, presentacion_id: presentacion ? presentacion.id : null, cantidad, precio_unitario: precioU, costo_unitario: costoU, subtotal: sub });
    }

    const aplicaDescuento = Math.random() < 0.25;
    const descPct = aplicaDescuento ? pick([5, 10, 15]) : 0;
    const descMonto = round2(subtotal * (descPct / 100));
    const total = round2(subtotal - descMonto);
    const estado = pick(ESTADOS);
    const esCredito = estado === 'credito';
    const montoPagado = esCredito ? round2(total * pick([0, 0.3, 0.5])) : total;
    const saldoPendiente = esCredito ? round2(total - montoPagado) : 0;

    const createdAt = `${y}-${m}-${d} ${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}:${String(fecha.getSeconds()).padStart(2, '0')}`;

    const ventaId = insVenta.run(
      folio, clienteId, esCredito ? 'credito' : 'contado', pick(FORMAS_PAGO),
      subtotal, descMonto, descPct, total, montoPagado, saldoPendiente,
      estado, usuarioId, createdAt
    ).lastInsertRowid;

    for (const it of itemsVenta) {
      insDetalle.run(ventaId, it.producto_id, it.presentacion_id, it.cantidad, it.precio_unitario, it.costo_unitario, it.subtotal);
    }

    if (esCredito && saldoPendiente > 0 && clienteId) {
      db.prepare('UPDATE clientes SET saldo_deuda = saldo_deuda + ? WHERE id = ?').run(saldoPendiente, clienteId);
    }
  }

  // ── Gastos de prueba (100) ──
  const GASTO_CONCEPTOS = ['Renta local', 'Luz', 'Agua', 'Internet', 'Papelería', 'Mantenimiento', 'Publicidad', 'Transporte', 'Sueldos', 'Empaques'];
  const GASTO_CATS = ['servicios', 'operacion', 'nomina', 'marketing', 'general'];
  const insGasto = db.prepare(`INSERT INTO gastos (concepto, monto, categoria, forma_pago, fecha, usuario_id) VALUES (?,?,?,?,?,?)`);
  for (let i = 0; i < 100; i++) {
    const diasAtras = rnd(0, 364);
    const fecha = new Date();
    fecha.setDate(fecha.getDate() - diasAtras);
    const fechaISO = fecha.toISOString().slice(0, 10);
    insGasto.run(pick(GASTO_CONCEPTOS), rnd(200, 5000), pick(GASTO_CATS), pick(FORMAS_PAGO), fechaISO, pick(usuarios));
  }
});

seedAll();

const totalVentas = db.prepare('SELECT COUNT(*) c FROM ventas').get().c;
const totalProductos = db.prepare('SELECT COUNT(*) c FROM productos').get().c;
const totalClientes = db.prepare('SELECT COUNT(*) c FROM clientes').get().c;
const totalGastos = db.prepare('SELECT COUNT(*) c FROM gastos').get().c;
console.log(`Listo. Ventas: ${totalVentas}, Productos: ${totalProductos}, Clientes: ${totalClientes}, Gastos: ${totalGastos}`);

db.close();
