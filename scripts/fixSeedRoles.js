// scripts/fixSeedRoles.js — corrige datos de prueba mal generados:
// reasigna ventas/gastos que quedaron atribuidos a usuarios con rol
// "almacen" (que nunca deberían poder generar ventas ni gastos) hacia
// usuarios admin/vendedor reales, para que Revisión de Actividad sea
// consistente con las reglas de negocio reales de la app.
const path = require('path');
const os = require('os');
const Database = require('better-sqlite3');

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'punto-venta-poblano', 'data', 'data.db');
console.log('Usando base de datos:', dbPath);

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[rnd(0, arr.length - 1)]; }

const candidatos = db.prepare("SELECT id FROM usuarios WHERE rol IN ('admin','vendedor')").all().map((r) => r.id);
if (!candidatos.length) {
  console.log('No hay usuarios admin/vendedor disponibles; nada que reasignar.');
  process.exit(0);
}

const almacenIds = db.prepare("SELECT id FROM usuarios WHERE rol='almacen'").all().map((r) => r.id);

let ventasCorregidas = 0, gastosCorregidos = 0, cortesEliminados = 0;

const fix = db.transaction(() => {
  if (almacenIds.length) {
    const placeholders = almacenIds.map(() => '?').join(',');
    const ventas = db.prepare(`SELECT id FROM ventas WHERE usuario_id IN (${placeholders})`).all(...almacenIds);
    const updVenta = db.prepare('UPDATE ventas SET usuario_id=? WHERE id=?');
    for (const v of ventas) { updVenta.run(pick(candidatos), v.id); ventasCorregidas++; }

    const gastos = db.prepare(`SELECT id FROM gastos WHERE usuario_id IN (${placeholders})`).all(...almacenIds);
    const updGasto = db.prepare('UPDATE gastos SET usuario_id=? WHERE id=?');
    for (const g of gastos) { updGasto.run(pick(candidatos), g.id); gastosCorregidos++; }

    // Los cortes de caja tampoco deberían existir para almacén (no maneja caja).
    const info = db.prepare(`DELETE FROM cortes_caja WHERE usuario_id IN (${placeholders})`).run(...almacenIds);
    cortesEliminados = info.changes;
  }
});

fix();

console.log(`Listo. Ventas reasignadas: ${ventasCorregidas}, Gastos reasignados: ${gastosCorregidos}, Cortes de caja eliminados: ${cortesEliminados}`);
db.close();
