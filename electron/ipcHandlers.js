// ================================================================
// ipcHandlers.js — Toda la lógica de negocio expuesta vía IPC.
//
// Modelo de seguridad:
//  - Cada ventana (webContents) obtiene una "sesión" en memoria del
//    proceso principal SOLO tras validar usuario/contraseña en
//    auth:login. Ningún otro canal confía en el "usuario_id" o "rol"
//    que mande el renderer — siempre se usa la sesión del servidor.
//  - Cada canal sensible está protegido con proteger(ROLES.X, fn):
//    si no hay sesión o el rol no está autorizado, se rechaza antes
//    de tocar la base de datos.
//  - Todo campo de entrada del usuario se valida (tipo, longitud,
//    rango) antes de usarse en una consulta. Las consultas siempre
//    usan sentencias preparadas (better-sqlite3), nunca concatenación
//    de strings, para eliminar inyección SQL.
//  - En Ventas y Devoluciones, el precio/costo SIEMPRE se recalcula
//    del lado del servidor a partir de la base de datos — nunca se
//    confía en el precio que mande el renderer — para que un cliente
//    modificado no pueda alterar el monto real de una venta o de un
//    reembolso.
// ================================================================
const { ipcMain, dialog, app, nativeImage, BrowserWindow, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const bcrypt = require('bcryptjs');
const { getDb, getDbPath, reopenDatabase, generateFolio } = require('./db');
const sync = require('./supabaseSync');
const { seleccionarLotesFEFO, aplicarDeducciones, reconciliarStockPresentacion, calcularReversionDevolucion } = require('./logicaFarmacia');

const ROL_PERMISOS = {
  admin: '*',
  vendedor: ['index', 'ventas', 'historial_ventas', 'clientes', 'credito', 'devoluciones', 'ticket', 'perfil', 'gastos', 'reportes', 'promociones'],
  almacen: ['index', 'inventario', 'inventario_fisico', 'categorias', 'perfil', 'devoluciones']
};

const ROLES = {
  ANY: ['admin', 'vendedor', 'almacen'],
  VENTAS: ['admin', 'vendedor'],
  ALMACEN: ['admin', 'almacen'],
  ADMIN: ['admin']
};

function ok(data) { return { ok: true, ...(data || {}) }; }
function err(message) { return { ok: false, error: message }; }
function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

function esTextoValido(v, { min = 1, max = 255 } = {}) {
  return typeof v === 'string' && v.trim().length >= min && v.trim().length <= max;
}
function esEmailValido(v) {
  return typeof v === 'string' && v.trim().length <= 190 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}
function esNumeroValido(v, { min = -Infinity, max = Infinity } = {}) {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max;
}
function esEnteroValido(v, { min = -Infinity, max = Infinity } = {}) {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max;
}
function limpiar(v, max = 500) { return String(v == null ? '' : v).slice(0, max); }

// ── SESIONES (autenticación de servidor, por ventana) ───────────
const sesiones = new Map(); // webContents.id -> { id, nombre, email, rol }

// ── Límite de intentos de inicio de sesión (fuerza bruta) ───────
const intentosLogin = new Map(); // email -> { fallos, bloqueadoHasta }
const MAX_INTENTOS = 5;
const BLOQUEO_MS = 10 * 60 * 1000;

function loginPermitido(email) {
  const info = intentosLogin.get(email);
  if (!info || !info.bloqueadoHasta) return true;
  return Date.now() >= info.bloqueadoHasta;
}
function registrarIntentoFallido(email) {
  const info = intentosLogin.get(email) || { fallos: 0, bloqueadoHasta: 0 };
  info.fallos += 1;
  if (info.fallos >= MAX_INTENTOS) {
    info.bloqueadoHasta = Date.now() + BLOQUEO_MS;
    info.fallos = 0;
  }
  intentosLogin.set(email, info);
}
function limpiarIntentos(email) { intentosLogin.delete(email); }

function register(mainWindow, actualizaciones = {}) {
  const db = getDb;
  const { autoUpdater, buscarActualizaciones, obtenerEstadoActualizacion } = actualizaciones;

  // Envuelve TODOS los canales (sin tocar cada uno de los ~75 handlers): si
  // algo truena de forma inesperada, se registra en el log en vez de perderse
  // en silencio, y el renderer recibe un error legible en lugar de una promesa
  // rechazada sin explicación.
  const handleOriginal = ipcMain.handle.bind(ipcMain);
  ipcMain.handle = (canal, listener) => {
    handleOriginal(canal, async (event, ...args) => {
      try {
        return await listener(event, ...args);
      } catch (e) {
        console.error(`[IPC:${canal}]`, e);
        return { ok: false, error: 'Ocurrió un error inesperado. Se guardó un registro para soporte técnico.' };
      }
    });
  };

  function sesionDe(event) {
    return sesiones.get(event.sender.id) || null;
  }

  // Envuelve un handler exigiendo sesión activa y rol autorizado.
  // fn recibe (event, payload, sesion) — nunca confiar en ids/roles del payload.
  function proteger(rolesPermitidos, fn) {
    return (event, payload) => {
      const s = sesionDe(event);
      if (!s) return err('Tu sesión expiró o no es válida. Inicia sesión de nuevo.');
      if (!rolesPermitidos.includes(s.rol)) return err('No tienes permisos para realizar esta acción.');
      return fn(event, payload, s);
    };
  }

  mainWindow?.webContents?.on('destroyed', () => sesiones.delete(mainWindow.webContents.id));

  // ── AUTH ─────────────────────────────────────────────────────
  ipcMain.handle('auth:login', (event, { email, password } = {}) => {
    const correo = String(email || '').trim().toLowerCase();
    if (!correo || !password) return err('Usuario o contraseña incorrectos.');
    if (!loginPermitido(correo)) return err('Demasiados intentos fallidos. Intenta de nuevo en unos minutos.');

    const user = db().prepare('SELECT * FROM usuarios WHERE lower(email) = ? AND activo = 1').get(correo);
    if (!user || !bcrypt.compareSync(password, user.password)) {
      registrarIntentoFallido(correo);
      return err('Usuario o contraseña incorrectos.');
    }
    limpiarIntentos(correo);
    const { password: _pw, ...safe } = user;
    sesiones.set(event.sender.id, { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol });
    return ok({ user: safe, permisos: ROL_PERMISOS[user.rol] || [] });
  });

  ipcMain.handle('auth:logout', (event) => {
    sesiones.delete(event.sender.id);
    return ok();
  });

  // Cambio de contraseña obligatorio (primer login, o después de que el admin
  // resetea una cuenta): a propósito NO requiere rol admin — es la única
  // excepción a "solo el admin cambia contraseñas", porque de otro modo un
  // vendedor/almacén con debe_cambiar_password=1 quedaría bloqueado sin poder
  // resolverlo él mismo. Solo puede cambiar LA SUYA, y solo si de verdad está
  // marcada como pendiente — no es una puerta trasera para cambiar cualquier otra.
  ipcMain.handle('auth:cambiarPasswordObligatorio', (event, { newPassword } = {}) => {
    const s = sesiones.get(event.sender.id);
    if (!s) return err('Tu sesión expiró o no es válida. Inicia sesión de nuevo.');
    if (!esTextoValido(newPassword, { min: 8, max: 200 })) return err('La nueva contraseña debe tener al menos 8 caracteres.');
    const user = db().prepare('SELECT debe_cambiar_password FROM usuarios WHERE id=?').get(s.id);
    if (!user || !user.debe_cambiar_password) return err('No tienes un cambio de contraseña pendiente.');
    db().prepare('UPDATE usuarios SET password=?, debe_cambiar_password=0 WHERE id=?').run(bcrypt.hashSync(newPassword, 10), s.id);
    return ok();
  });

  // Solo el administrador puede cambiar contraseñas. Vendedores y almacén
  // deben pedirle al administrador que se la cambie desde la sección Usuarios.
  ipcMain.handle('auth:changePassword', proteger(ROLES.ADMIN, (event, { currentPassword, newPassword } = {}, s) => {
    if (!esTextoValido(newPassword, { min: 8, max: 200 })) return err('La nueva contraseña debe tener al menos 8 caracteres.');
    const user = db().prepare('SELECT * FROM usuarios WHERE id=?').get(s.id);
    if (!user) return err('Usuario no encontrado.');
    if (!bcrypt.compareSync(currentPassword || '', user.password)) return err('Contraseña actual incorrecta.');
    db().prepare('UPDATE usuarios SET password=? WHERE id=?').run(bcrypt.hashSync(newPassword, 10), s.id);
    return ok();
  }));

  ipcMain.handle('auth:updateProfile', proteger(ROLES.ANY, (event, { nombre, email } = {}, s) => {
    if (!esTextoValido(nombre, { min: 2, max: 120 })) return err('Nombre inválido.');
    if (!esEmailValido(email)) return err('Correo electrónico inválido.');
    try {
      const correo = email.trim().toLowerCase();
      const existente = db().prepare('SELECT id FROM usuarios WHERE lower(email)=? AND id!=?').get(correo, s.id);
      if (existente) return err('Ese correo ya está en uso por otro usuario.');
      db().prepare('UPDATE usuarios SET nombre=?, email=? WHERE id=?').run(nombre.trim(), email.trim(), s.id);
      const u = db().prepare('SELECT id,nombre,email,rol,activo FROM usuarios WHERE id=?').get(s.id);
      sesiones.set(event.sender.id, { ...s, nombre: u.nombre, email: u.email });
      return ok({ user: u });
    } catch (e) { return err(e.message); }
  }));

  // ── CORTES DE CAJA ───────────────────────────────────────────
  function fechaInicioCorte(usuarioId) {
    const ultimo = db().prepare(`SELECT fecha_fin FROM cortes_caja WHERE usuario_id=? ORDER BY fecha_fin DESC LIMIT 1`).get(usuarioId);
    if (ultimo) return ultimo.fecha_fin;
    const u = db().prepare('SELECT created_at FROM usuarios WHERE id=?').get(usuarioId);
    return u ? u.created_at : '1970-01-01 00:00:00';
  }

  function calcularEsperado(usuarioId, fechaInicio) {
    const rows = db().prepare(`SELECT forma_pago, COALESCE(SUM(total),0) as total, COUNT(*) as num FROM ventas
      WHERE usuario_id=? AND created_at > ? AND estado NOT IN ('cancelada','devuelta') GROUP BY forma_pago`).all(usuarioId, fechaInicio);
    const porForma = { efectivo: 0, tarjeta: 0, transferencia: 0 };
    let numVentas = 0;
    for (const r of rows) {
      if (porForma[r.forma_pago] !== undefined) porForma[r.forma_pago] += r.total;
      else porForma.efectivo += r.total;
      numVentas += r.num;
    }
    return { ...porForma, numVentas };
  }

  ipcMain.handle('corte:resumen', proteger(ROLES.VENTAS, (event, _payload, s) => {
    const fechaInicio = fechaInicioCorte(s.id);
    const { efectivo, tarjeta, transferencia, numVentas } = calcularEsperado(s.id, fechaInicio);
    return ok({ fecha_inicio: fechaInicio, efectivo_esperado: efectivo, tarjeta_esperado: tarjeta, transferencia_esperado: transferencia, num_ventas: numVentas });
  }));

  ipcMain.handle('corte:registrar', proteger(ROLES.VENTAS, (event, { estado, motivoOmision, efectivoContado, tarjetaContado, transferenciaContado } = {}, s) => {
    if (!['completado', 'omitido'].includes(estado)) return err('Estado de corte inválido.');
    if (estado === 'omitido' && !esTextoValido(motivoOmision, { min: 3, max: 400 })) return err('Escribe un motivo válido para omitir el corte.');
    try {
      const fechaInicio = fechaInicioCorte(s.id);
      const { efectivo, tarjeta, transferencia, numVentas } = calcularEsperado(s.id, fechaInicio);
      const esCompletado = estado === 'completado';
      let diferencia = 0;
      if (esCompletado) {
        const contadoTotal = round2(efectivoContado) + round2(tarjetaContado) + round2(transferenciaContado);
        const esperadoTotal = round2(efectivo + tarjeta + transferencia);
        diferencia = round2(contadoTotal - esperadoTotal);
      }
      const info = db().prepare(`INSERT INTO cortes_caja
        (usuario_id, fecha_inicio, fecha_fin, estado, motivo_omision, efectivo_esperado, efectivo_contado, tarjeta_esperado, tarjeta_contado, transferencia_esperado, transferencia_contado, diferencia, num_ventas)
        VALUES (?,?,datetime('now'),?,?,?,?,?,?,?,?,?,?)`).run(
        s.id, fechaInicio, estado, esCompletado ? null : limpiar(motivoOmision, 400),
        efectivo, esCompletado ? round2(efectivoContado) : null,
        tarjeta, esCompletado ? round2(tarjetaContado) : null,
        transferencia, esCompletado ? round2(transferenciaContado) : null,
        diferencia, numVentas
      );
      sync.encolarCorte(info.lastInsertRowid);
      return ok({ id: info.lastInsertRowid, diferencia });
    } catch (e) { return err(e.message); }
  }));

  ipcMain.handle('corte:list', proteger(ROLES.VENTAS, (event, _payload, s) => {
    if (s.rol !== 'admin') {
      return db().prepare(`SELECT c.*, u.nombre as usuario_nombre FROM cortes_caja c
        LEFT JOIN usuarios u ON u.id=c.usuario_id WHERE c.usuario_id=? ORDER BY c.created_at DESC`).all(s.id);
    }
    return db().prepare(`SELECT c.*, u.nombre as usuario_nombre, u.rol as usuario_rol FROM cortes_caja c
      LEFT JOIN usuarios u ON u.id=c.usuario_id ORDER BY c.created_at DESC`).all();
  }));

  // ── USUARIOS (solo admin) ────────────────────────────────────
  ipcMain.handle('usuarios:list', proteger(ROLES.ADMIN, () =>
    db().prepare('SELECT id,nombre,email,rol,activo,created_at FROM usuarios ORDER BY rol, nombre').all()
  ));

  ipcMain.handle('usuarios:resumenActividad', proteger(ROLES.ADMIN, () => {
    const usuarios = db().prepare('SELECT id,nombre,email,rol,activo,created_at FROM usuarios ORDER BY rol, nombre').all();
    const resumen = usuarios.map((u) => {
      const ventas = db().prepare(`SELECT COUNT(*) num, COALESCE(SUM(total),0) total FROM ventas WHERE usuario_id=? AND estado NOT IN ('cancelada','devuelta')`).get(u.id);
      const cortesNum = db().prepare('SELECT COUNT(*) num FROM cortes_caja WHERE usuario_id=?').get(u.id).num;
      const cortesOmitidos = db().prepare(`SELECT COUNT(*) num FROM cortes_caja WHERE usuario_id=? AND estado='omitido'`).get(u.id).num;
      const ultimoCorte = db().prepare('SELECT estado, created_at, diferencia FROM cortes_caja WHERE usuario_id=? ORDER BY created_at DESC LIMIT 1').get(u.id) || null;
      return { ...u, ventas_num: ventas.num, ventas_total: ventas.total, cortes_num: cortesNum, cortes_omitidos: cortesOmitidos, ultimo_corte: ultimoCorte };
    });
    return ok({ usuarios: resumen });
  }));

  ipcMain.handle('usuarios:actividad', proteger(ROLES.ADMIN, (event, { usuarioId } = {}) => {
    if (!esEnteroValido(usuarioId, { min: 1 })) return err('Usuario inválido.');
    const ventas = db().prepare(`SELECT id, folio, total, forma_pago, estado, created_at FROM ventas WHERE usuario_id=? ORDER BY created_at DESC LIMIT 200`).all(usuarioId);
    const cortes = db().prepare(`SELECT id, estado, motivo_omision, diferencia, efectivo_esperado, efectivo_contado, tarjeta_esperado, tarjeta_contado, transferencia_esperado, transferencia_contado, created_at FROM cortes_caja WHERE usuario_id=? ORDER BY created_at DESC LIMIT 100`).all(usuarioId);
    const gastos = db().prepare(`SELECT id, concepto, monto, fecha, created_at FROM gastos WHERE usuario_id=? ORDER BY created_at DESC LIMIT 100`).all(usuarioId);
    const devoluciones = db().prepare(`SELECT id, venta_id, monto_total, estado, created_at FROM devoluciones WHERE usuario_id=? ORDER BY created_at DESC LIMIT 100`).all(usuarioId);
    return ok({ ventas, cortes, gastos, devoluciones });
  }));

  ipcMain.handle('usuarios:save', proteger(ROLES.ADMIN, (event, u = {}) => {
    if (!esTextoValido(u.nombre, { min: 2, max: 120 })) return err('Nombre inválido.');
    if (!esEmailValido(u.email)) return err('Correo electrónico inválido.');
    if (!['admin', 'vendedor', 'almacen'].includes(u.rol)) return err('Rol inválido.');
    const correo = u.email.trim().toLowerCase();
    try {
      if (u.id) {
        if (!esEnteroValido(u.id, { min: 1 })) return err('Usuario inválido.');
        if (u.password && !esTextoValido(u.password, { min: 8, max: 200 })) return err('La contraseña debe tener al menos 8 caracteres.');
        const actual = db().prepare('SELECT rol, activo FROM usuarios WHERE id=?').get(u.id);
        if (!actual) return err('Usuario no encontrado.');
        const dejaDeSerAdmin = actual.rol === 'admin' && actual.activo && (u.rol !== 'admin' || !u.activo);
        if (dejaDeSerAdmin) {
          const otrosAdmins = db().prepare("SELECT COUNT(*) c FROM usuarios WHERE rol='admin' AND activo=1 AND id!=?").get(u.id).c;
          if (otrosAdmins === 0) return err('Debe existir al menos un administrador activo.');
        }
        const existente = db().prepare('SELECT id FROM usuarios WHERE lower(email)=? AND id!=?').get(correo, u.id);
        if (existente) return err('Ese correo ya está en uso por otro usuario.');
        if (u.password) {
          // Una contraseña puesta por el admin (alta o reseteo) siempre queda
          // temporal — el dueño de la cuenta debe cambiarla en su próximo login.
          db().prepare('UPDATE usuarios SET nombre=?,email=?,rol=?,activo=?,password=?,debe_cambiar_password=1 WHERE id=?')
            .run(u.nombre.trim(), u.email.trim(), u.rol, u.activo ? 1 : 0, bcrypt.hashSync(u.password, 10), u.id);
        } else {
          db().prepare('UPDATE usuarios SET nombre=?,email=?,rol=?,activo=? WHERE id=?')
            .run(u.nombre.trim(), u.email.trim(), u.rol, u.activo ? 1 : 0, u.id);
        }
      } else {
        if (!esTextoValido(u.password, { min: 8, max: 200 })) return err('Ingresa una contraseña de al menos 8 caracteres para el nuevo usuario.');
        const existente = db().prepare('SELECT id FROM usuarios WHERE lower(email)=?').get(correo);
        if (existente) return err('Ese correo ya está registrado.');
        db().prepare('INSERT INTO usuarios (nombre,email,password,rol,activo,debe_cambiar_password) VALUES (?,?,?,?,?,1)')
          .run(u.nombre.trim(), u.email.trim(), bcrypt.hashSync(u.password, 10), u.rol, u.activo ? 1 : 0);
      }
      return ok();
    } catch (e) { return err(e.message); }
  }));

  ipcMain.handle('usuarios:delete', proteger(ROLES.ADMIN, (event, { id } = {}, s) => {
    if (!esEnteroValido(id, { min: 1 })) return err('Usuario inválido.');
    if (id === s.id) return err('No puedes eliminarte a ti mismo.');
    const objetivo = db().prepare('SELECT rol, activo FROM usuarios WHERE id=?').get(id);
    if (!objetivo) return err('Usuario no encontrado.');
    if (objetivo.rol === 'admin' && objetivo.activo) {
      const otrosAdmins = db().prepare("SELECT COUNT(*) c FROM usuarios WHERE rol='admin' AND activo=1 AND id!=?").get(id).c;
      if (otrosAdmins === 0) return err('Debe existir al menos un administrador activo.');
    }
    db().prepare('UPDATE usuarios SET activo=0 WHERE id=?').run(id);
    return ok();
  }));

  // ── CATEGORIAS (admin, almacén) ──────────────────────────────
  ipcMain.handle('categorias:listAll', proteger(ROLES.ALMACEN, () => {
    const principales = db().prepare(`
      SELECT c.*,
        (SELECT COUNT(*) FROM productos p WHERE p.categoria_id=c.id AND p.activo=1) AS num_productos,
        (SELECT COUNT(*) FROM categorias s WHERE s.parent_id=c.id) AS num_subcats
      FROM categorias c WHERE c.parent_id IS NULL ORDER BY c.nombre
    `).all();
    const subcategorias = db().prepare(`
      SELECT c.*, par.nombre AS nombre_padre,
        (SELECT COUNT(*) FROM productos p WHERE p.categoria_id=c.id AND p.activo=1) AS num_productos
      FROM categorias c JOIN categorias par ON par.id=c.parent_id
      WHERE c.parent_id IS NOT NULL ORDER BY par.nombre, c.nombre
    `).all();
    const cats_select = db().prepare('SELECT id,nombre FROM categorias WHERE parent_id IS NULL AND activo=1 ORDER BY nombre').all();
    return { principales, subcategorias, cats_select };
  }));

  ipcMain.handle('categorias:save', proteger(ROLES.ALMACEN, (event, c = {}) => {
    if (!esTextoValido(c.nombre, { min: 1, max: 120 })) return err('El nombre es requerido.');
    if (c.id && c.parent_id === c.id) return err('Una categoría no puede ser su propio padre.');
    try {
      if (c.id) {
        if (!esEnteroValido(c.id, { min: 1 })) return err('Categoría inválida.');
        db().prepare('UPDATE categorias SET nombre=?, parent_id=?, descripcion=? WHERE id=?')
          .run(c.nombre.trim(), c.parent_id || null, limpiar(c.descripcion, 400), c.id);
      } else {
        db().prepare('INSERT INTO categorias (nombre, parent_id, descripcion) VALUES (?,?,?)')
          .run(c.nombre.trim(), c.parent_id || null, limpiar(c.descripcion, 400));
      }
      return ok();
    } catch (e) { return err(e.message); }
  }));

  ipcMain.handle('categorias:toggle', proteger(ROLES.ALMACEN, (event, { id } = {}) => {
    if (!esEnteroValido(id, { min: 1 })) return err('Categoría inválida.');
    db().prepare('UPDATE categorias SET activo = NOT activo WHERE id=?').run(id);
    return ok();
  }));

  ipcMain.handle('categorias:delete', proteger(ROLES.ALMACEN, (event, { id } = {}) => {
    if (!esEnteroValido(id, { min: 1 })) return err('Categoría inválida.');
    const prods = db().prepare('SELECT COUNT(*) c FROM productos WHERE categoria_id=? AND activo=1').get(id).c;
    if (prods > 0) return err('Tiene productos activos. Muévelos primero.');
    const subs = db().prepare('SELECT COUNT(*) c FROM categorias WHERE parent_id=? AND activo=1').get(id).c;
    if (subs > 0) return err('Tiene subcategorías activas. Elimínalas primero.');
    db().prepare('DELETE FROM categorias WHERE id=?').run(id);
    return ok();
  }));

  // ── PRODUCTOS / INVENTARIO (admin, almacén) ─────────────────
  ipcMain.handle('productos:list', proteger(ROLES.ALMACEN, (event, { departamento, q, categoria_id } = {}) => {
    let sql = `SELECT p.*, c.nombre as cat_nombre,
        COALESCE((SELECT SUM(stock) FROM presentaciones t WHERE t.producto_id=p.id),0) as stock_total,
        (SELECT COUNT(*) FROM presentaciones t WHERE t.producto_id=p.id) as num_presentaciones
      FROM productos p LEFT JOIN categorias c ON c.id=p.categoria_id WHERE p.activo=1`;
    const params = [];
    if (departamento) { sql += ' AND p.departamento=?'; params.push(limpiar(departamento, 80)); }
    if (categoria_id) { sql += ' AND p.categoria_id=?'; params.push(categoria_id); }
    if (q) { sql += ' AND (p.nombre LIKE ? OR p.sku LIKE ? OR p.codigo_barras LIKE ?)'; const t = `%${limpiar(q, 80)}%`; params.push(t, t, t); }
    sql += ' ORDER BY p.nombre';
    return db().prepare(sql).all(...params);
  }));

  ipcMain.handle('productos:departamentos', proteger(ROLES.ALMACEN, () =>
    db().prepare("SELECT DISTINCT departamento FROM productos WHERE activo=1 AND departamento IS NOT NULL AND departamento != '' ORDER BY departamento").all().map(r => r.departamento)
  ));

  ipcMain.handle('productos:presentaciones', proteger(ROLES.ALMACEN, (event, { producto_id } = {}) => {
    if (!esEnteroValido(producto_id, { min: 1 })) return [];
    return db().prepare('SELECT * FROM presentaciones WHERE producto_id=?').all(producto_id);
  }));

  ipcMain.handle('productos:save', proteger(ROLES.ALMACEN, (event, p = {}) => {
    if (!esTextoValido(p.nombre, { min: 1, max: 160 })) return err('El nombre del producto es requerido.');
    if (!esNumeroValido(p.costo_unitario, { min: 0, max: 10000000 })) return err('Costo unitario inválido.');
    if (!esNumeroValido(p.precio_publico, { min: 0, max: 10000000 })) return err('Precio público inválido.');
    try {
      const iva = [0, 16].includes(Number(p.iva)) ? Number(p.iva) : 16;
      const requiereReceta = p.requiere_receta ? 1 : 0;
      const sustanciaControlada = p.sustancia_controlada ? 1 : 0;
      const manejaLotes = p.maneja_lotes ? 1 : 0;
      if (p.id) {
        if (!esEnteroValido(p.id, { min: 1 })) return err('Producto inválido.');
        db().prepare(`UPDATE productos SET nombre=?,descripcion=?,categoria_id=?,departamento=?,marca=?,modelo=?,color=?,material=?,costo_unitario=?,precio_publico=?,codigo_barras=?,
            principio_activo=?,laboratorio=?,forma_farmaceutica=?,registro_sanitario=?,requiere_receta=?,sustancia_controlada=?,iva=?,maneja_lotes=? WHERE id=?`)
          .run(p.nombre.trim(), limpiar(p.descripcion, 500), p.categoria_id || null, limpiar(p.departamento, 80), limpiar(p.marca, 80), limpiar(p.modelo, 80), limpiar(p.color, 60), limpiar(p.material, 60), p.costo_unitario || 0, p.precio_publico || 0, p.codigo_barras ? limpiar(p.codigo_barras, 64) : null,
            limpiar(p.principio_activo, 160) || null, limpiar(p.laboratorio, 120) || null, limpiar(p.forma_farmaceutica, 80) || null, limpiar(p.registro_sanitario, 80) || null,
            requiereReceta, sustanciaControlada, iva, manejaLotes, p.id);
        return ok({ id: p.id });
      } else {
        const prefix = limpiar(p.departamento || 'GEN', 3).slice(0, 3).toUpperCase() || 'GEN';
        const last = db().prepare("SELECT sku FROM productos WHERE sku LIKE ? ORDER BY id DESC LIMIT 1").get(`${prefix}-%`);
        let next = 1;
        if (last) { const m = last.sku.match(/-(\d+)$/); if (m) next = parseInt(m[1], 10) + 1; }
        let sku = `${prefix}-${String(next).padStart(3, '0')}`;
        while (db().prepare('SELECT COUNT(*) c FROM productos WHERE sku=?').get(sku).c > 0) { next++; sku = `${prefix}-${String(next).padStart(3, '0')}`; }
        const info = db().prepare(`INSERT INTO productos (sku,codigo_barras,nombre,descripcion,categoria_id,departamento,marca,modelo,color,material,costo_unitario,precio_publico,activo,
            principio_activo,laboratorio,forma_farmaceutica,registro_sanitario,requiere_receta,sustancia_controlada,iva,maneja_lotes)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?,?,?,?,?,?)`)
          .run(sku, p.codigo_barras ? limpiar(p.codigo_barras, 64) : null, p.nombre.trim(), limpiar(p.descripcion, 500), p.categoria_id || null, limpiar(p.departamento, 80), limpiar(p.marca, 80), limpiar(p.modelo, 80), limpiar(p.color, 60), limpiar(p.material, 60), p.costo_unitario || 0, p.precio_publico || 0,
            limpiar(p.principio_activo, 160) || null, limpiar(p.laboratorio, 120) || null, limpiar(p.forma_farmaceutica, 80) || null, limpiar(p.registro_sanitario, 80) || null,
            requiereReceta, sustanciaControlada, iva, manejaLotes);
        const newId = info.lastInsertRowid;
        if (Array.isArray(p.presentaciones)) {
          for (const t of p.presentaciones.slice(0, 100)) {
            if (!esTextoValido(t.presentacion, { min: 1, max: 20 })) continue;
            // Si el producto maneja lotes, el stock SIEMPRE debe entrar por un lote
            // (con su caducidad) — nunca como número suelto, para que presentaciones.stock
            // y SUM(lotes.cantidad) nunca puedan desincronizarse desde el origen.
            const stockInicial = manejaLotes ? 0 : (esEnteroValido(t.stock, { min: 0, max: 1000000 }) ? t.stock : 0);
            db().prepare('INSERT INTO presentaciones (producto_id, presentacion, stock) VALUES (?,?,?)').run(newId, t.presentacion.trim(), stockInicial);
            if (stockInicial > 0) {
              db().prepare('INSERT INTO inventario_movimientos (producto_id, tipo, cantidad, motivo) VALUES (?,?,?,?)').run(newId, 'entrada', stockInicial, 'Registro inicial');
            }
          }
        }
        return ok({ id: newId, sku });
      }
    } catch (e) {
      if (String(e.message).includes('UNIQUE') && String(e.message).includes('codigo_barras')) return err('El código de barras ya existe en otro producto.');
      return err(e.message);
    }
  }));

  ipcMain.handle('productos:delete', proteger(ROLES.ALMACEN, (event, { id } = {}) => {
    if (!esEnteroValido(id, { min: 1 })) return err('Producto inválido.');
    db().prepare('UPDATE productos SET activo=0 WHERE id=?').run(id);
    return ok();
  }));

  ipcMain.handle('productos:updateStock', proteger(ROLES.ALMACEN, (event, { presentacion_id, stock } = {}, s) => {
    if (!esEnteroValido(presentacion_id, { min: 1 })) return err('Presentacion inválida.');
    if (!esEnteroValido(stock, { min: 0, max: 1000000 })) return err('Stock inválido.');
    const r = db().transaction(() => reconciliarStockPresentacion(db(), presentacion_id, stock, { usuarioId: s.id, motivo: 'Edición manual de stock' }))();
    if (!r.ok) return err(r.error);
    sync.evaluarYEncolarStock(presentacion_id);
    return ok();
  }));

  ipcMain.handle('productos:addPresentacion', proteger(ROLES.ALMACEN, (event, { producto_id, presentacion, stock } = {}, s) => {
    if (!esEnteroValido(producto_id, { min: 1 })) return err('Producto inválido.');
    if (!esTextoValido(presentacion, { min: 1, max: 20 })) return err('Presentacion inválida.');
    const producto = db().prepare('SELECT maneja_lotes FROM productos WHERE id=?').get(producto_id);
    if (!producto) return err('Producto inválido.');
    // Igual que al crear el producto: si maneja lotes, el stock entra por "Ver lotes", nunca suelto.
    const stockInicial = producto.maneja_lotes ? 0 : (esEnteroValido(stock, { min: 0, max: 1000000 }) ? stock : 0);
    const info = db().prepare('INSERT INTO presentaciones (producto_id, presentacion, stock) VALUES (?,?,?)').run(producto_id, presentacion.trim(), stockInicial);
    if (stockInicial > 0) db().prepare('INSERT INTO inventario_movimientos (producto_id, tipo, cantidad, motivo, usuario_id) VALUES (?,?,?,?,?)').run(producto_id, 'entrada', stockInicial, 'Ajuste de inventario', s.id);
    sync.evaluarYEncolarStock(info.lastInsertRowid);
    return ok();
  }));

  // ── LOTES (caducidad — para medicamentos y otros productos perecederos) ──
  ipcMain.handle('lotes:list', proteger(ROLES.ALMACEN, (event, { presentacion_id } = {}) => {
    if (!esEnteroValido(presentacion_id, { min: 1 })) return [];
    return db().prepare('SELECT * FROM lotes WHERE presentacion_id=? AND cantidad > 0 ORDER BY fecha_caducidad IS NULL, fecha_caducidad ASC').all(presentacion_id);
  }));

  ipcMain.handle('lotes:add', proteger(ROLES.ALMACEN, (event, { presentacion_id, numero_lote, fecha_caducidad, cantidad } = {}, s) => {
    if (!esEnteroValido(presentacion_id, { min: 1 })) return err('Presentación/presentacion inválida.');
    if (!esEnteroValido(cantidad, { min: 1, max: 1000000 })) return err('La cantidad debe ser mayor a cero.');
    if (fecha_caducidad && isNaN(Date.parse(fecha_caducidad))) return err('Fecha de caducidad inválida.');
    const presentacion = db().prepare('SELECT id, producto_id FROM presentaciones WHERE id=?').get(presentacion_id);
    if (!presentacion) return err('Presentación/presentacion no encontrada.');
    db().transaction(() => {
      db().prepare('INSERT INTO lotes (presentacion_id, numero_lote, fecha_caducidad, cantidad) VALUES (?,?,?,?)')
        .run(presentacion_id, limpiar(numero_lote, 60) || null, fecha_caducidad || null, cantidad);
      db().prepare('UPDATE presentaciones SET stock = stock + ? WHERE id=?').run(cantidad, presentacion_id);
      db().prepare('INSERT INTO inventario_movimientos (producto_id, presentacion_id, tipo, cantidad, motivo, usuario_id) VALUES (?,?,?,?,?,?)')
        .run(presentacion.producto_id, presentacion_id, 'entrada', cantidad, numero_lote ? `Entrada de lote ${numero_lote}` : 'Entrada de lote', s.id);
    })();
    sync.evaluarYEncolarStock(presentacion_id);
    return ok();
  }));

  ipcMain.handle('lotes:delete', proteger(ROLES.ALMACEN, (event, { id } = {}, s) => {
    if (!esEnteroValido(id, { min: 1 })) return err('Lote inválido.');
    const lote = db().prepare('SELECT * FROM lotes WHERE id=?').get(id);
    if (!lote) return err('Lote no encontrado.');
    db().transaction(() => {
      db().prepare('UPDATE presentaciones SET stock = MAX(0, stock - ?) WHERE id=?').run(lote.cantidad, lote.presentacion_id);
      db().prepare('DELETE FROM lotes WHERE id=?').run(id);
      const presentacion = db().prepare('SELECT producto_id FROM presentaciones WHERE id=?').get(lote.presentacion_id);
      if (presentacion) db().prepare('INSERT INTO inventario_movimientos (producto_id, presentacion_id, tipo, cantidad, motivo, usuario_id) VALUES (?,?,?,?,?,?)')
        .run(presentacion.producto_id, lote.presentacion_id, 'salida', lote.cantidad, 'Baja de lote (caducado/merma)', s.id);
    })();
    sync.evaluarYEncolarStock(lote.presentacion_id);
    return ok();
  }));

  // Semáforo de caducidad: caducados y por caducar en los próximos 30 días.
  ipcMain.handle('lotes:alertas', proteger(ROLES.ALMACEN, () => {
    const hoyIso = new Date().toISOString().slice(0, 10);
    const limiteIso = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const rows = db().prepare(`
      SELECT l.id, l.numero_lote, l.fecha_caducidad, l.cantidad, t.presentacion, p.nombre, p.sku, p.departamento
      FROM lotes l JOIN presentaciones t ON t.id=l.presentacion_id JOIN productos p ON p.id=t.producto_id
      WHERE l.cantidad > 0 AND l.fecha_caducidad IS NOT NULL AND l.fecha_caducidad <= ? AND p.activo=1
      ORDER BY l.fecha_caducidad ASC
    `).all(limiteIso);
    const caducados = rows.filter((r) => r.fecha_caducidad < hoyIso);
    const porCaducar = rows.filter((r) => r.fecha_caducidad >= hoyIso);
    return { caducados, porCaducar };
  }));

  // Conteo físico de inventario
  ipcMain.handle('inventarioFisico:list', proteger(ROLES.ANY, () => db().prepare(`
    SELECT t.id as presentacion_id, t.presentacion, t.stock as stock_sistema, t.stock_minimo, p.id as producto_id, p.nombre, p.sku, p.departamento,
           p.costo_unitario, p.precio_publico
    FROM presentaciones t JOIN productos p ON p.id=t.producto_id WHERE p.activo=1 ORDER BY p.nombre, t.presentacion
  `).all()));

  ipcMain.handle('inventarioFisico:ajustar', proteger(ROLES.ALMACEN, (event, { presentacion_id, stock_fisico, motivo } = {}, s) => {
    if (!esEnteroValido(presentacion_id, { min: 1 })) return err('Presentacion inválida.');
    if (!esEnteroValido(stock_fisico, { min: 0, max: 1000000 })) return err('El stock físico debe ser un número entero no negativo.');
    const r = db().transaction(() =>
      reconciliarStockPresentacion(db(), presentacion_id, stock_fisico, { usuarioId: s.id, motivo: limpiar(motivo, 200) || 'Conteo físico' })
    )();
    if (!r.ok) return err(r.error);
    sync.evaluarYEncolarStock(presentacion_id);
    return ok({ diff: r.diff });
  }));

  // ── VENTAS / POS (admin, vendedor) ──────────────────────────
  ipcMain.handle('ventas:buscarProducto', proteger(ROLES.VENTAS, (event, { q } = {}) => {
    if (!q) return [];
    const t = `%${limpiar(q, 80)}%`;
    return db().prepare(`
      SELECT p.id, p.nombre, p.sku, p.codigo_barras, p.departamento, p.precio_publico, p.costo_unitario, p.imagen,
             p.requiere_receta, p.sustancia_controlada, p.maneja_lotes,
             t.id as presentacion_id, t.presentacion, t.stock
      FROM productos p LEFT JOIN presentaciones t ON t.producto_id=p.id
      WHERE p.activo=1 AND (p.nombre LIKE ? OR p.sku LIKE ? OR p.codigo_barras = ?)
      ORDER BY p.nombre LIMIT 40
    `).all(t, t, limpiar(q, 80));
  }));

  ipcMain.handle('ventas:catalogo', proteger(ROLES.VENTAS, (event, { cat } = {}) => {
    let sql = `SELECT p.id, p.nombre, p.sku, p.departamento, p.precio_publico, p.costo_unitario, p.requiere_receta, p.sustancia_controlada, p.maneja_lotes,
               t.id as presentacion_id, t.presentacion, t.stock FROM productos p LEFT JOIN presentaciones t ON t.producto_id=p.id WHERE p.activo=1`;
    const params = [];
    if (cat) { sql += ' AND p.departamento=?'; params.push(limpiar(cat, 80)); }
    sql += ' ORDER BY p.nombre LIMIT 300';
    return db().prepare(sql).all(...params);
  }));

  ipcMain.handle('ventas:departamentos', proteger(ROLES.VENTAS, () =>
    db().prepare("SELECT DISTINCT departamento FROM productos WHERE activo=1 AND departamento IS NOT NULL AND departamento != '' ORDER BY departamento").all().map(r => r.departamento)
  ));

  ipcMain.handle('ventas:buscarCliente', proteger(ROLES.VENTAS, (event, { q } = {}) => {
    const t = `%${limpiar(q, 80)}%`;
    return db().prepare(`
      SELECT id,nombre,apellido,telefono,saldo_deuda,limite_credito FROM clientes
      WHERE activo=1 AND (nombre LIKE ? OR apellido LIKE ? OR telefono LIKE ?) LIMIT 10
    `).all(t, t, t);
  }));

  ipcMain.handle('ventas:procesar', proteger(ROLES.VENTAS, (event, payload = {}, s) => {
    const {
      items, cliente_id, tipo_venta, forma_pago, desc_monto = 0,
      monto_pagado = 0, notas = '', num_meses = 0, tasa_interes = 0, enganche = 0, cuota_mensual = 0
    } = payload;

    if (!Array.isArray(items) || !items.length || items.length > 200) return err('Carrito inválido.');
    if (!['contado', 'credito', 'a_meses'].includes(tipo_venta)) return err('Tipo de venta inválido.');
    if (!['efectivo', 'tarjeta', 'transferencia'].includes(forma_pago)) return err('Forma de pago inválida.');
    if (['credito', 'a_meses'].includes(tipo_venta) && !cliente_id) return err('Selecciona un cliente para venta a crédito o a meses.');

    try {
      const result = db().transaction(() => {
        let subtotal = 0;
        const resueltos = [];
        const loteDeducciones = [];
        for (const item of items) {
          const cantidad = parseInt(item.qty, 10);
          if (!Number.isInteger(cantidad) || cantidad <= 0 || cantidad > 10000) throw new Error('Cantidad inválida en un producto.');
          const producto = db().prepare('SELECT id, nombre, precio_publico, costo_unitario, activo, requiere_receta, sustancia_controlada, maneja_lotes FROM productos WHERE id=?').get(item.prod_id);
          if (!producto || !producto.activo) throw new Error('Uno de los productos ya no está disponible.');

          if (producto.requiere_receta && !esTextoValido(item.receta_folio, { min: 1, max: 60 })) {
            throw new Error(`"${producto.nombre}" requiere folio de receta médica para venderse.`);
          }
          if (producto.sustancia_controlada && !esTextoValido(item.identificacion_comprador, { min: 1, max: 120 })) {
            throw new Error(`"${producto.nombre}" es sustancia controlada — se requiere nombre e identificación del comprador para venderse.`);
          }

          let presentacionId = null;
          if (item.presentacion_id) {
            const presentacion = db().prepare('SELECT id, stock FROM presentaciones WHERE id=? AND producto_id=?').get(item.presentacion_id, item.prod_id);
            if (!presentacion) throw new Error('Presentación inválida para uno de los productos.');
            if (presentacion.stock < cantidad) throw new Error(`Stock insuficiente de "${producto.nombre}".`);
            presentacionId = presentacion.id;

            if (producto.maneja_lotes) {
              const sel = seleccionarLotesFEFO(db(), presentacionId, cantidad);
              if (!sel.ok) {
                if (sel.sinLotesCapturados) {
                  throw new Error(`"${producto.nombre}" maneja lotes pero no tiene ningún lote capturado — ve a Inventario → Ver Presentaciones → Ver lotes y captúralos antes de poder venderlo.`);
                }
                throw new Error(`"${producto.nombre}" no tiene suficiente stock vigente (sin caducar) — revisa sus lotes en Inventario.`);
              }
              loteDeducciones.push(...sel.deducciones);
            }
          }
          // Precio y costo SIEMPRE se toman de la base de datos, nunca del cliente.
          const precio = producto.precio_publico;
          const costo = producto.costo_unitario;
          const itemSubtotal = round2(precio * cantidad);
          subtotal += itemSubtotal;
          resueltos.push({
            producto_id: producto.id, presentacion_id: presentacionId, cantidad, precio, costo, subtotal: itemSubtotal,
            receta_folio: limpiar(item.receta_folio, 60) || null,
            identificacion_comprador: limpiar(item.identificacion_comprador, 120) || null
          });
        }
        subtotal = round2(subtotal);
        const descuentoMonto = round2(Math.max(0, Math.min(Number(desc_monto) || 0, subtotal)));
        const total = round2(Math.max(0, subtotal - descuentoMonto));
        const descuentoPct = subtotal > 0 ? round2((descuentoMonto / subtotal) * 100) : 0;
        const pagado = round2(Math.max(0, Math.min(Number(monto_pagado) || 0, total)));
        const saldo_pendiente = round2(Math.max(0, total - pagado));
        const folio = generateFolio();
        const estado = ['credito', 'a_meses'].includes(tipo_venta) ? tipo_venta : (saldo_pendiente > 0 ? 'pendiente' : 'pagada');

        const info = db().prepare(`INSERT INTO ventas
          (folio,cliente_id,tipo_venta,forma_pago,subtotal,descuento_monto,descuento_porcentaje,total,monto_pagado,saldo_pendiente,estado,notas,usuario_id,num_meses,tasa_interes,enganche,cuota_mensual)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
          .run(folio, cliente_id || null, tipo_venta, forma_pago, subtotal, descuentoMonto, descuentoPct, total, pagado, saldo_pendiente, estado, limpiar(notas, 500), s.id,
            esEnteroValido(num_meses, { min: 0, max: 360 }) ? num_meses : 0,
            esNumeroValido(tasa_interes, { min: 0, max: 1000 }) ? tasa_interes : 0,
            esNumeroValido(enganche, { min: 0, max: 100000000 }) ? enganche : 0,
            esNumeroValido(cuota_mensual, { min: 0, max: 100000000 }) ? cuota_mensual : 0);
        const venta_id = info.lastInsertRowid;

        for (const item of resueltos) {
          db().prepare(`INSERT INTO ventas_detalle (venta_id,producto_id,presentacion_id,cantidad,precio_unitario,costo_unitario,subtotal,receta_folio,identificacion_comprador) VALUES (?,?,?,?,?,?,?,?,?)`)
            .run(venta_id, item.producto_id, item.presentacion_id, item.cantidad, item.precio, item.costo, item.subtotal, item.receta_folio, item.identificacion_comprador);
          if (item.presentacion_id) db().prepare('UPDATE presentaciones SET stock=stock-? WHERE id=?').run(item.cantidad, item.presentacion_id);
        }
        aplicarDeducciones(db(), loteDeducciones);
        if (cliente_id && saldo_pendiente > 0) db().prepare('UPDATE clientes SET saldo_deuda=saldo_deuda+? WHERE id=?').run(saldo_pendiente, cliente_id);
        if (pagado > 0 && cliente_id) db().prepare('INSERT INTO pagos (venta_id,cliente_id,monto,forma_pago) VALUES (?,?,?,?)').run(venta_id, cliente_id, pagado, forma_pago);

        const presentacionesAfectadas = resueltos.filter((i) => i.presentacion_id).map((i) => i.presentacion_id);
        return { venta_id, folio, total, saldo: saldo_pendiente, presentacionesAfectadas };
      })();

      sync.encolarVenta(result.venta_id);
      for (const presentacionId of result.presentacionesAfectadas) sync.evaluarYEncolarStock(presentacionId);
      if (result.saldo > 0) sync.encolarCredito(result.venta_id);
      delete result.presentacionesAfectadas;

      return ok(result);
    } catch (e) { return err(e.message); }
  }));

  ipcMain.handle('clientes:crearRapido', proteger(ROLES.VENTAS, (event, { nombre, apellido, telefono, limite_credito = 0 } = {}) => {
    if (!esTextoValido(nombre, { min: 1, max: 80 }) || !esTextoValido(apellido, { min: 1, max: 80 })) return err('Nombre y apellido requeridos.');
    if (!esNumeroValido(limite_credito, { min: 0, max: 100000000 })) return err('Límite de crédito inválido.');
    const info = db().prepare('INSERT INTO clientes (nombre,apellido,telefono,limite_credito) VALUES (?,?,?,?)').run(nombre.trim(), apellido.trim(), limpiar(telefono, 30), limite_credito);
    return ok({ id: info.lastInsertRowid, nombre, apellido, telefono, saldo_deuda: 0, limite_credito });
  }));

  ipcMain.handle('promociones:activas', proteger(ROLES.VENTAS, () =>
    db().prepare(`SELECT * FROM promociones WHERE activo=1 AND (fecha_inicio IS NULL OR fecha_inicio<=date('now')) AND (fecha_fin IS NULL OR fecha_fin>=date('now'))`).all()
  ));

  // ── HISTORIAL DE VENTAS ──────────────────────────────────────
  ipcMain.handle('historial:list', proteger(ROLES.ANY, (event, { q, estado, fi, ff } = {}) => {
    let sql = `SELECT v.*, IFNULL(c.nombre,'') as nombre, IFNULL(c.apellido,'') as apellido,
      (IFNULL(c.nombre,'') || ' ' || IFNULL(c.apellido,'')) as cliente_nombre
      FROM ventas v LEFT JOIN clientes c ON c.id=v.cliente_id WHERE 1=1`;
    const params = [];
    if (q) { const t = `%${limpiar(q, 80)}%`; sql += ' AND (v.folio LIKE ? OR c.nombre LIKE ? OR c.apellido LIKE ?)'; params.push(t, t, t); }
    if (estado) { sql += ' AND v.estado=?'; params.push(limpiar(estado, 30)); }
    if (fi) { sql += ' AND date(v.created_at) >= ?'; params.push(fi); }
    if (ff) { sql += ' AND date(v.created_at) <= ?'; params.push(ff); }
    sql += ' ORDER BY v.created_at DESC LIMIT 500';
    return db().prepare(sql).all(...params);
  }));

  ipcMain.handle('ventas:detalle', proteger(ROLES.VENTAS, (event, { id } = {}) => {
    if (!esEnteroValido(id, { min: 1 })) return err('Venta inválida.');
    const venta = db().prepare(`SELECT v.*, IFNULL(c.nombre,'') || ' ' || IFNULL(c.apellido,'') as cliente_nombre, c.telefono as cliente_tel, u.nombre as vendedor_nombre
      FROM ventas v LEFT JOIN clientes c ON c.id=v.cliente_id LEFT JOIN usuarios u ON u.id=v.usuario_id WHERE v.id=?`).get(id);
    if (!venta) return err('Venta no encontrada.');
    const items = db().prepare(`SELECT vd.*, p.nombre as prod_nombre, p.sku, t.presentacion FROM ventas_detalle vd
      JOIN productos p ON p.id=vd.producto_id LEFT JOIN presentaciones t ON t.id=vd.presentacion_id WHERE vd.venta_id=?`).all(id);
    const pagos = db().prepare('SELECT * FROM pagos WHERE venta_id=? ORDER BY created_at ASC').all(id);
    return ok({ venta, items, pagos });
  }));

  // ── CREDITO ──────────────────────────────────────────────────
  ipcMain.handle('credito:list', proteger(ROLES.VENTAS, (event, { q, orden } = {}) => {
    let sql = `SELECT v.id, v.folio, v.total, v.monto_pagado, v.saldo_pendiente, v.tipo_venta, v.forma_pago, v.estado, v.created_at, v.notas,
      c.id AS cliente_id, IFNULL(c.nombre,'') || ' ' || IFNULL(c.apellido,'') AS cliente_nombre, c.telefono, c.saldo_deuda AS total_deuda_cliente
      FROM ventas v JOIN clientes c ON c.id=v.cliente_id WHERE v.saldo_pendiente > 0 AND v.estado != 'cancelada'`;
    const params = [];
    if (q) { const t = `%${limpiar(q, 80)}%`; sql += ' AND (c.nombre LIKE ? OR c.apellido LIKE ? OR v.folio LIKE ? OR c.telefono LIKE ?)'; params.push(t, t, t, t); }
    sql += orden === 'monto_desc' ? ' ORDER BY v.saldo_pendiente DESC' : ' ORDER BY v.created_at ASC';
    const rows = db().prepare(sql).all(...params);
    const resumen = db().prepare(`SELECT COUNT(*) num_creditos, COALESCE(SUM(saldo_pendiente),0) total_deuda,
      COUNT(DISTINCT cliente_id) clientes_con_deuda FROM ventas WHERE saldo_pendiente>0 AND estado NOT IN ('cancelada','devuelta')`).get();
    return { rows, resumen };
  }));

  ipcMain.handle('credito:abonar', proteger(ROLES.VENTAS, (event, { venta_id, cliente_id, monto, forma_pago, referencia } = {}) => {
    if (!esEnteroValido(venta_id, { min: 1 })) return err('Venta inválida.');
    if (!esEnteroValido(cliente_id, { min: 1 })) return err('Cliente inválido.');
    if (!esNumeroValido(monto, { min: 0.01, max: 100000000 })) return err('Monto inválido.');
    if (!['efectivo', 'tarjeta', 'transferencia'].includes(forma_pago)) return err('Forma de pago inválida.');
    try {
      const venta = db().prepare('SELECT saldo_pendiente, cliente_id FROM ventas WHERE id=?').get(venta_id);
      if (!venta) return err('Venta no encontrada.');
      if (venta.cliente_id !== cliente_id) return err('El cliente no coincide con la venta.');
      const abono = round2(Math.min(round2(monto), venta.saldo_pendiente));
      if (abono <= 0) return err('Esta venta ya no tiene saldo pendiente.');
      const saldoNuevo = db().transaction(() => {
        db().prepare('INSERT INTO pagos (venta_id,cliente_id,monto,forma_pago,referencia) VALUES (?,?,?,?,?)').run(venta_id, cliente_id, abono, forma_pago, limpiar(referencia, 120));
        db().prepare('UPDATE ventas SET monto_pagado=monto_pagado+?, saldo_pendiente=MAX(0,saldo_pendiente-?) WHERE id=?').run(abono, abono, venta_id);
        db().prepare("UPDATE ventas SET estado='pagada' WHERE id=? AND saldo_pendiente<=0").run(venta_id);
        db().prepare('UPDATE clientes SET saldo_deuda=MAX(0,saldo_deuda-?) WHERE id=?').run(abono, cliente_id);
        return db().prepare('SELECT saldo_pendiente FROM ventas WHERE id=?').get(venta_id).saldo_pendiente;
      })();
      sync.encolarCredito(venta_id);
      return ok({ saldo_nuevo: saldoNuevo });
    } catch (e) { return err(e.message); }
  }));

  ipcMain.handle('credito:historialAbonos', proteger(ROLES.VENTAS, (event, { venta_id } = {}) => {
    if (!esEnteroValido(venta_id, { min: 1 })) return [];
    return db().prepare('SELECT monto, forma_pago, referencia, created_at FROM pagos WHERE venta_id=? ORDER BY created_at ASC').all(venta_id);
  }));

  // ── CLIENTES ─────────────────────────────────────────────────
  ipcMain.handle('clientes:list', proteger(ROLES.ANY, (event, { q, filtro } = {}) => {
    let sql = "SELECT *, nombre || ' ' || apellido as nombre_completo FROM clientes WHERE activo=1";
    const params = [];
    if (q) { const t = `%${limpiar(q, 80)}%`; sql += ' AND (nombre LIKE ? OR apellido LIKE ? OR telefono LIKE ? OR email LIKE ?)'; params.push(t, t, t, t); }
    if (filtro === 'deuda') sql += ' AND saldo_deuda > 0';
    sql += ' ORDER BY nombre';
    return db().prepare(sql).all(...params);
  }));

  ipcMain.handle('clientes:historial', proteger(ROLES.VENTAS, (event, { id } = {}) => {
    if (!esEnteroValido(id, { min: 1 })) return [];
    return db().prepare('SELECT folio, total, tipo_venta, estado, saldo_pendiente, created_at FROM ventas WHERE cliente_id=? ORDER BY created_at DESC LIMIT 20').all(id);
  }));

  ipcMain.handle('clientes:save', proteger(ROLES.VENTAS, (event, c = {}) => {
    if (!esTextoValido(c.nombre, { min: 1, max: 80 }) || !esTextoValido(c.apellido, { min: 1, max: 80 })) return err('Nombre y apellido son requeridos.');
    if (c.email && !esEmailValido(c.email)) return err('Correo electrónico inválido.');
    if (!esNumeroValido(c.limite_credito || 0, { min: 0, max: 100000000 })) return err('Límite de crédito inválido.');
    try {
      if (c.id) {
        if (!esEnteroValido(c.id, { min: 1 })) return err('Cliente inválido.');
        db().prepare(`UPDATE clientes SET nombre=?,apellido=?,telefono=?,email=?,calle=?,colonia=?,ciudad=?,estado=?,cp=?,rfc=?,limite_credito=?,notas=? WHERE id=?`)
          .run(c.nombre.trim(), c.apellido.trim(), limpiar(c.telefono, 30), limpiar(c.email, 190), limpiar(c.calle, 150), limpiar(c.colonia, 100), limpiar(c.ciudad, 100), limpiar(c.estado, 100), limpiar(c.cp, 12), limpiar(c.rfc, 20), c.limite_credito || 0, limpiar(c.notas, 500), c.id);
      } else {
        db().prepare(`INSERT INTO clientes (nombre,apellido,telefono,email,calle,colonia,ciudad,estado,cp,rfc,limite_credito,notas) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
          .run(c.nombre.trim(), c.apellido.trim(), limpiar(c.telefono, 30), limpiar(c.email, 190), limpiar(c.calle, 150), limpiar(c.colonia, 100), limpiar(c.ciudad, 100), limpiar(c.estado, 100), limpiar(c.cp, 12), limpiar(c.rfc, 20), c.limite_credito || 0, limpiar(c.notas, 500));
      }
      return ok();
    } catch (e) { return err(e.message); }
  }));

  ipcMain.handle('clientes:delete', proteger(ROLES.VENTAS, (event, { id } = {}) => {
    if (!esEnteroValido(id, { min: 1 })) return err('Cliente inválido.');
    db().prepare('UPDATE clientes SET activo=0 WHERE id=?').run(id);
    return ok();
  }));

  // ── DEVOLUCIONES (admin, vendedor, almacén) ─────────────────
  ipcMain.handle('devoluciones:buscarVenta', proteger(ROLES.ANY, (event, { folio } = {}) => {
    if (!esTextoValido(folio, { min: 1, max: 60 })) return err('Folio inválido.');
    const venta = db().prepare(`SELECT v.*, IFNULL(c.nombre,'') || ' ' || IFNULL(c.apellido,'') as cliente_nombre FROM ventas v LEFT JOIN clientes c ON c.id=v.cliente_id WHERE v.folio=?`).get(folio.trim());
    if (!venta) return err('Venta no encontrada.');
    const items = db().prepare(`SELECT vd.*, p.nombre as prod_nombre, t.presentacion FROM ventas_detalle vd JOIN productos p ON p.id=vd.producto_id LEFT JOIN presentaciones t ON t.id=vd.presentacion_id WHERE vd.venta_id=?`).all(venta.id);
    return ok({ venta: { ...venta, items } });
  }));

  ipcMain.handle('devoluciones:registrar', proteger(ROLES.ANY, (event, { venta_id, motivo, tipo_devolucion, notas, items } = {}, s) => {
    if (!esEnteroValido(venta_id, { min: 1 })) return err('Venta inválida.');
    if (!Array.isArray(items) || !items.length || items.length > 200) return err('Selecciona al menos un artículo.');
    if (!['reembolso', 'cambio', 'nota_credito'].includes(tipo_devolucion)) return err('Tipo de devolución inválido.');
    try {
      const result = db().transaction(() => {
        const venta = db().prepare('SELECT id, folio, total, saldo_pendiente, monto_pagado, cliente_id, estado, forma_pago FROM ventas WHERE id=?').get(venta_id);
        if (!venta) throw new Error('Venta no encontrada.');
        const detalleOriginal = db().prepare('SELECT producto_id, presentacion_id, cantidad, precio_unitario FROM ventas_detalle WHERE venta_id=?').all(venta_id);
        if (!detalleOriginal.length) throw new Error('Venta no encontrada.');
        let monto_total = 0;
        const resueltos = [];
        for (const item of items) {
          const cantidad = parseInt(item.qty, 10);
          if (!Number.isInteger(cantidad) || cantidad <= 0) throw new Error('Cantidad inválida.');
          const presentacionId = item.presentacion_id || null;
          const original = detalleOriginal.find((d) => d.producto_id === item.prod_id && (d.presentacion_id || null) === presentacionId);
          if (!original) throw new Error('El producto seleccionado no pertenece a esa venta.');
          const yaDevuelto = db().prepare(`
            SELECT COALESCE(SUM(dd.cantidad),0) c FROM devoluciones_detalle dd
            JOIN devoluciones d ON d.id=dd.devolucion_id
            WHERE d.venta_id=? AND dd.producto_id=? AND IFNULL(dd.presentacion_id,-1)=IFNULL(?,-1)
          `).get(venta_id, item.prod_id, presentacionId).c;
          if (yaDevuelto + cantidad > original.cantidad) throw new Error('La cantidad excede lo disponible para devolver de ese producto.');
          // El precio SIEMPRE se toma de lo realmente vendido, nunca del cliente.
          const precio = original.precio_unitario;
          monto_total += precio * cantidad;
          resueltos.push({ prod_id: item.prod_id, presentacion_id: presentacionId, qty: cantidad, precio });
        }
        monto_total = round2(monto_total);
        const info = db().prepare(`INSERT INTO devoluciones (venta_id, motivo, tipo_devolucion, monto_total, notas, usuario_id, estado) VALUES (?,?,?,?,?,?,'procesada')`)
          .run(venta_id, limpiar(motivo, 300), tipo_devolucion, monto_total, limpiar(notas, 500), s.id);
        const dev_id = info.lastInsertRowid;
        for (const item of resueltos) {
          db().prepare('INSERT INTO devoluciones_detalle (devolucion_id, producto_id, presentacion_id, cantidad, precio_unitario) VALUES (?,?,?,?,?)')
            .run(dev_id, item.prod_id, item.presentacion_id, item.qty, item.precio);
          if (item.presentacion_id) {
            // Regresa el stock pasando SIEMPRE por reconciliarStockPresentacion, para
            // que en productos con maneja_lotes=1 el alta quede como un lote real
            // ("DEV-VENTA") y nunca se rompa la invariante stock = SUM(lotes.cantidad).
            const pres = db().prepare('SELECT stock FROM presentaciones WHERE id=?').get(item.presentacion_id);
            if (pres) {
              reconciliarStockPresentacion(db(), item.presentacion_id, pres.stock + item.qty, {
                usuarioId: s.id, motivo: `Devolución de venta ${venta.folio}`, etiquetaLoteAlta: 'DEV-VENTA', tipoMovimiento: 'entrada'
              });
            }
          }
        }

        // ── Dinero: revertir deuda y/o registrar el egreso real de caja ──
        const totalDevueltoAcumulado = round2(
          (db().prepare("SELECT COALESCE(SUM(monto_total),0) t FROM devoluciones WHERE venta_id=? AND estado='procesada'").get(venta_id).t)
        );
        const {
          montoAbsorbidoPorDeuda, montoARegresarEnEfectivo, nuevoSaldoPendiente, nuevoMontoPagado, nuevoEstado
        } = calcularReversionDevolucion({
          ventaTotal: venta.total, ventaSaldoPendiente: venta.saldo_pendiente, ventaMontoPagado: venta.monto_pagado,
          ventaEstado: venta.estado, tipoDevolucion: tipo_devolucion, montoDevuelto: monto_total, totalDevueltoAcumulado
        });

        if (montoAbsorbidoPorDeuda > 0 && venta.cliente_id) {
          db().prepare('UPDATE clientes SET saldo_deuda = MAX(0, saldo_deuda - ?) WHERE id=?').run(montoAbsorbidoPorDeuda, venta.cliente_id);
        }

        let gastoId = null;
        if (montoARegresarEnEfectivo > 0) {
          const fechaHoy = new Date().toISOString().slice(0, 10);
          const infoGasto = db().prepare(`INSERT INTO gastos (concepto, monto, categoria, forma_pago, fecha, notas, usuario_id) VALUES (?,?,?,?,?,?,?)`)
            .run(`Reembolso — devolución de venta ${venta.folio}`, montoARegresarEnEfectivo, 'devoluciones', venta.forma_pago, fechaHoy, limpiar(notas, 500), s.id);
          gastoId = infoGasto.lastInsertRowid;
        }

        db().prepare('UPDATE ventas SET estado=?, saldo_pendiente=?, monto_pagado=? WHERE id=?')
          .run(nuevoEstado, nuevoSaldoPendiente, nuevoMontoPagado, venta_id);

        const presentacionesAfectadas = resueltos.filter((i) => i.presentacion_id).map((i) => i.presentacion_id);
        return { dev_id, monto_total, presentacionesAfectadas, gastoId };
      })();
      sync.encolarDevolucion(result.dev_id);
      sync.encolarVenta(venta_id);
      sync.encolarCredito(venta_id);
      if (result.gastoId) sync.encolarGasto(result.gastoId);
      for (const presentacionId of result.presentacionesAfectadas) sync.evaluarYEncolarStock(presentacionId);
      return ok({ devolucion_id: result.dev_id, monto: result.monto_total });
    } catch (e) { return err(e.message); }
  }));

  ipcMain.handle('devoluciones:list', proteger(ROLES.ANY, (event, { mes } = {}) => {
    let sql = `SELECT d.*, v.folio, IFNULL(c.nombre,'') || ' ' || IFNULL(c.apellido,'') as cliente_nombre, u.nombre as usuario_nombre
      FROM devoluciones d LEFT JOIN ventas v ON v.id=d.venta_id LEFT JOIN clientes c ON c.id=v.cliente_id LEFT JOIN usuarios u ON u.id=d.usuario_id WHERE 1=1`;
    const params = [];
    if (mes) { sql += " AND strftime('%Y-%m', d.created_at) = ?"; params.push(limpiar(mes, 7)); }
    sql += ' ORDER BY d.created_at DESC';
    return db().prepare(sql).all(...params);
  }));

  ipcMain.handle('devoluciones:delete', proteger(ROLES.ADMIN, (event, { id } = {}) => {
    if (!esEnteroValido(id, { min: 1 })) return err('Devolución inválida.');
    db().prepare('DELETE FROM devoluciones WHERE id=?').run(id);
    return ok();
  }));

  // ── PROVEEDORES ──────────────────────────────────────────────
  ipcMain.handle('proveedores:list', proteger(ROLES.ALMACEN, () =>
    db().prepare('SELECT * FROM proveedores ORDER BY activo DESC, nombre').all()
  ));

  ipcMain.handle('proveedores:save', proteger(ROLES.ALMACEN, (event, p = {}) => {
    if (!esTextoValido(p.nombre, { min: 1, max: 160 })) return err('El nombre es requerido.');
    try {
      if (p.id) {
        if (!esEnteroValido(p.id, { min: 1 })) return err('Proveedor inválido.');
        db().prepare('UPDATE proveedores SET nombre=?, contacto=?, telefono=?, email=?, notas=? WHERE id=?')
          .run(p.nombre.trim(), limpiar(p.contacto, 120), limpiar(p.telefono, 30), limpiar(p.email, 160), limpiar(p.notas, 500), p.id);
      } else {
        db().prepare('INSERT INTO proveedores (nombre, contacto, telefono, email, notas) VALUES (?,?,?,?,?)')
          .run(p.nombre.trim(), limpiar(p.contacto, 120), limpiar(p.telefono, 30), limpiar(p.email, 160), limpiar(p.notas, 500));
      }
      return ok();
    } catch (e) { return err(e.message); }
  }));

  ipcMain.handle('proveedores:toggle', proteger(ROLES.ALMACEN, (event, { id } = {}) => {
    if (!esEnteroValido(id, { min: 1 })) return err('Proveedor inválido.');
    db().prepare('UPDATE proveedores SET activo = NOT activo WHERE id=?').run(id);
    return ok();
  }));

  ipcMain.handle('proveedores:delete', proteger(ROLES.ALMACEN, (event, { id } = {}) => {
    if (!esEnteroValido(id, { min: 1 })) return err('Proveedor inválido.');
    const usados = db().prepare('SELECT COUNT(*) c FROM gastos WHERE proveedor_id=?').get(id).c;
    if (usados > 0) return err('Este proveedor tiene gastos/compras registradas. Desactívalo en vez de eliminarlo.');
    db().prepare('DELETE FROM proveedores WHERE id=?').run(id);
    return ok();
  }));

  // ── GASTOS (solo admin — el vendedor no ve gastos ni ganancias) ──
  ipcMain.handle('gastos:list', proteger(ROLES.ADMIN, (event, { mes, cat } = {}) => {
    let sql = 'SELECT g.*, u.nombre as usuario_nombre FROM gastos g LEFT JOIN usuarios u ON u.id=g.usuario_id WHERE 1=1';
    const params = [];
    if (mes) { sql += " AND strftime('%Y-%m', fecha) = ?"; params.push(limpiar(mes, 7)); }
    if (cat) { sql += ' AND categoria=?'; params.push(limpiar(cat, 60)); }
    sql += ' ORDER BY fecha DESC, g.id DESC';
    const gastos = db().prepare(sql).all(...params);
    const totCat = db().prepare("SELECT categoria, SUM(monto) as total FROM gastos WHERE strftime('%Y-%m',fecha)=? GROUP BY categoria ORDER BY total DESC").all(mes || new Date().toISOString().slice(0, 7));
    return { gastos, totCat };
  }));

  ipcMain.handle('gastos:save', proteger(ROLES.ADMIN, (event, g = {}, s) => {
    if (!esTextoValido(g.concepto, { min: 1, max: 160 })) return err('El concepto es requerido.');
    if (!esNumeroValido(g.monto, { min: 0.01, max: 100000000 })) return err('El monto debe ser mayor a cero.');
    if (!g.fecha || isNaN(Date.parse(g.fecha))) return err('Fecha inválida.');
    try {
      let gastoId = g.id;
      if (g.id) {
        if (!esEnteroValido(g.id, { min: 1 })) return err('Gasto inválido.');
        db().prepare('UPDATE gastos SET concepto=?,monto=?,categoria=?,forma_pago=?,fecha=?,notas=?,proveedor=? WHERE id=?')
          .run(g.concepto.trim(), g.monto, limpiar(g.categoria, 60) || 'general', limpiar(g.forma_pago, 30) || 'efectivo', g.fecha, limpiar(g.notas, 500), limpiar(g.proveedor, 120), g.id);
      } else {
        const info = db().prepare('INSERT INTO gastos (concepto,monto,categoria,forma_pago,fecha,notas,proveedor,usuario_id) VALUES (?,?,?,?,?,?,?,?)')
          .run(g.concepto.trim(), g.monto, limpiar(g.categoria, 60) || 'general', limpiar(g.forma_pago, 30) || 'efectivo', g.fecha, limpiar(g.notas, 500), limpiar(g.proveedor, 120), s.id);
        gastoId = info.lastInsertRowid;
      }
      sync.encolarGasto(gastoId);
      return ok();
    } catch (e) { return err(e.message); }
  }));

  ipcMain.handle('gastos:delete', proteger(ROLES.ADMIN, (event, { id } = {}) => {
    if (!esEnteroValido(id, { min: 1 })) return err('Gasto inválido.');
    db().prepare('DELETE FROM gastos WHERE id=?').run(id);
    return ok();
  }));

  // ── PROMOCIONES (lectura: admin/vendedor · gestión: solo admin) ─
  ipcMain.handle('promociones:list', proteger(ROLES.VENTAS, () => db().prepare(`
    SELECT p.*, c.nombre as cat_nombre, pr.nombre as prod_nombre
    FROM promociones p LEFT JOIN categorias c ON c.id=p.categoria_id LEFT JOIN productos pr ON pr.id=p.producto_id ORDER BY p.activo DESC, p.id DESC
  `).all()));

  ipcMain.handle('promociones:save', proteger(ROLES.ADMIN, (event, p = {}) => {
    if (!esTextoValido(p.nombre, { min: 1, max: 120 })) return err('El nombre es requerido.');
    if (!['porcentaje', 'monto_fijo'].includes(p.tipo)) return err('Tipo de promoción inválido.');
    if (!esNumeroValido(p.valor, { min: 0, max: p.tipo === 'porcentaje' ? 100 : 100000000 })) return err('Valor de promoción inválido.');
    try {
      if (p.id) {
        if (!esEnteroValido(p.id, { min: 1 })) return err('Promoción inválida.');
        db().prepare('UPDATE promociones SET nombre=?,codigo=?,tipo=?,valor=?,departamento=?,categoria_id=?,producto_id=?,fecha_inicio=?,fecha_fin=?,activo=? WHERE id=?')
          .run(p.nombre.trim(), p.codigo ? limpiar(p.codigo, 40) : null, p.tipo, p.valor, limpiar(p.departamento, 80) || 'todos', p.categoria_id || null, p.producto_id || null, p.fecha_inicio || null, p.fecha_fin || null, p.activo ? 1 : 0, p.id);
      } else {
        db().prepare('INSERT INTO promociones (nombre,codigo,tipo,valor,departamento,categoria_id,producto_id,fecha_inicio,fecha_fin,activo) VALUES (?,?,?,?,?,?,?,?,?,?)')
          .run(p.nombre.trim(), p.codigo ? limpiar(p.codigo, 40) : null, p.tipo, p.valor, limpiar(p.departamento, 80) || 'todos', p.categoria_id || null, p.producto_id || null, p.fecha_inicio || null, p.fecha_fin || null, p.activo ? 1 : 0);
      }
      return ok();
    } catch (e) { return err(e.message); }
  }));

  ipcMain.handle('promociones:toggle', proteger(ROLES.ADMIN, (event, { id } = {}) => {
    if (!esEnteroValido(id, { min: 1 })) return err('Promoción inválida.');
    db().prepare('UPDATE promociones SET activo=NOT activo WHERE id=?').run(id);
    return ok();
  }));
  ipcMain.handle('promociones:delete', proteger(ROLES.ADMIN, (event, { id } = {}) => {
    if (!esEnteroValido(id, { min: 1 })) return err('Promoción inválida.');
    db().prepare('DELETE FROM promociones WHERE id=?').run(id);
    return ok();
  }));

  // ── REPORTES (solo admin — el vendedor no ve reportes) ──────────
  ipcMain.handle('reportes:exportarPdf', proteger(ROLES.ADMIN, async (event, { html, filename } = {}) => {
    if (!esTextoValido(html, { min: 1, max: 5_000_000 })) return err('Contenido de reporte inválido.');
    const nombreArchivo = limpiar(filename, 100).replace(/[\\/:*?"<>|]/g, '_') || 'reporte';

    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Exportar reporte a PDF',
      defaultPath: `${nombreArchivo}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    });
    if (canceled || !filePath) return err('Exportación cancelada.');

    const tmpHtml = path.join(os.tmpdir(), `pvp-reporte-${Date.now()}-${Math.random().toString(36).slice(2)}.html`);
    let win = null;
    try {
      fs.writeFileSync(tmpHtml, html, 'utf-8');
      win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
      await win.loadFile(tmpHtml);
      const pdfBuffer = await win.webContents.printToPDF({ printBackground: true, pageSize: 'Letter' });
      fs.writeFileSync(filePath, pdfBuffer);
      return ok({ path: filePath });
    } catch (e) {
      return err(e.message);
    } finally {
      if (win) win.destroy();
      try { fs.unlinkSync(tmpHtml); } catch (_e) {}
    }
  }));

  // Solo admin — ni vendedor ni almacén tienen Dashboard/ganancias.
  ipcMain.handle('reportes:generar', proteger(ROLES.ADMIN, (event, { fecha_inicio, fecha_fin } = {}) => {
    const fi = /^\d{4}-\d{2}-\d{2}$/.test(fecha_inicio || '') ? fecha_inicio : '1970-01-01';
    const ff = /^\d{4}-\d{2}-\d{2}$/.test(fecha_fin || '') ? fecha_fin : '2999-12-31';
    const ventas_total = db().prepare(`SELECT COUNT(*) as num, COALESCE(SUM(total),0) as total, COALESCE(SUM(descuento_monto),0) as descuentos FROM ventas WHERE date(created_at) BETWEEN ? AND ? AND estado NOT IN ('cancelada','devuelta')`).get(fi, ff);
    const costo_ventas = db().prepare(`SELECT COALESCE(SUM(vd.costo_unitario*vd.cantidad),0) as costo FROM ventas_detalle vd JOIN ventas v ON v.id=vd.venta_id WHERE date(v.created_at) BETWEEN ? AND ? AND v.estado NOT IN ('cancelada','devuelta')`).get(fi, ff).costo;
    const utilidad_bruta = ventas_total.total - costo_ventas;
    const gastos_total = db().prepare('SELECT COALESCE(SUM(monto),0) as total FROM gastos WHERE fecha BETWEEN ? AND ?').get(fi, ff).total;
    const utilidad_neta = utilidad_bruta - gastos_total;
    const por_dept = db().prepare(`SELECT p.departamento, SUM(vd.cantidad) as unidades, SUM(vd.subtotal) as total, SUM(vd.costo_unitario*vd.cantidad) as costo, SUM(vd.subtotal)-SUM(vd.costo_unitario*vd.cantidad) as utilidad
      FROM ventas_detalle vd JOIN productos p ON p.id=vd.producto_id JOIN ventas v ON v.id=vd.venta_id WHERE date(v.created_at) BETWEEN ? AND ? AND v.estado NOT IN ('cancelada','devuelta') GROUP BY p.departamento`).all(fi, ff);
    const por_forma_pago = db().prepare(`SELECT forma_pago, COUNT(*) as num, SUM(total) as total
      FROM ventas WHERE date(created_at) BETWEEN ? AND ? AND estado NOT IN ('cancelada','devuelta') GROUP BY forma_pago`).all(fi, ff);
    const por_dia = db().prepare(`SELECT date(v.created_at) as dia, SUM(v.total) as total, COUNT(*) as num, SUM(COALESCE(c.costo,0)) as costo, SUM(v.total)-SUM(COALESCE(c.costo,0)) as utilidad
      FROM ventas v
      LEFT JOIN (SELECT vd.venta_id, SUM(vd.costo_unitario*vd.cantidad) as costo FROM ventas_detalle vd GROUP BY vd.venta_id) c ON c.venta_id=v.id
      WHERE date(v.created_at) BETWEEN ? AND ? AND v.estado NOT IN ('cancelada','devuelta') GROUP BY dia ORDER BY dia`).all(fi, ff);
    const top_prods = db().prepare(`SELECT p.nombre, p.departamento, SUM(vd.cantidad) as qty, SUM(vd.subtotal) as total, SUM(vd.subtotal)-SUM(vd.costo_unitario*vd.cantidad) as utilidad
      FROM ventas_detalle vd JOIN productos p ON p.id=vd.producto_id JOIN ventas v ON v.id=vd.venta_id WHERE date(v.created_at) BETWEEN ? AND ? AND v.estado NOT IN ('cancelada','devuelta') GROUP BY p.id ORDER BY qty DESC LIMIT 10`).all(fi, ff);
    // Todos los productos activos, con sus unidades vendidas en el periodo (0 si
    // no tuvo ninguna venta) y su stock actual — para el reporte de "menos
    // vendidos", que a diferencia de top_prods sí debe incluir los que no
    // vendieron nada, y trae todo el catálogo para poder filtrar en pantalla.
    const menos_vendidos = db().prepare(`
      SELECT p.id, p.nombre, p.sku, p.departamento, c.nombre as categoria,
        COALESCE((SELECT SUM(t.stock) FROM presentaciones t WHERE t.producto_id=p.id),0) as stock_total,
        COALESCE(v.qty,0) as qty, COALESCE(v.total,0) as total
      FROM productos p
      LEFT JOIN categorias c ON c.id = p.categoria_id
      LEFT JOIN (
        SELECT vd.producto_id, SUM(vd.cantidad) as qty, SUM(vd.subtotal) as total
        FROM ventas_detalle vd JOIN ventas vv ON vv.id=vd.venta_id
        WHERE date(vv.created_at) BETWEEN ? AND ? AND vv.estado NOT IN ('cancelada','devuelta')
        GROUP BY vd.producto_id
      ) v ON v.producto_id = p.id
      WHERE p.activo = 1
      ORDER BY qty ASC, p.nombre ASC
    `).all(fi, ff);
    const clientes_deuda = db().prepare(`SELECT nombre, apellido, telefono, saldo_deuda FROM clientes WHERE saldo_deuda>0 AND activo=1 ORDER BY saldo_deuda DESC LIMIT 20`).all();
    return ok({ ventas_total, costo_ventas, utilidad_bruta, gastos_total, utilidad_neta, por_dept, por_forma_pago, por_dia, top_prods, menos_vendidos, clientes_deuda });
  }));

  // ── CONFIGURACIÓN: PROYECTO DE SUPABASE (URL + clave publishable) ──
  // Permite que cada instalación (cada negocio/cliente) apunte a SU PROPIO
  // proyecto de Supabase sin tocar código — antes estaba fijo en supabaseSync.js.
  ipcMain.handle('config:getSupabaseConfig', proteger(ROLES.ADMIN, () => {
    const row = db().prepare('SELECT supabase_url, supabase_anon_key FROM app_config WHERE id=1').get();
    return ok({ supabase_url: row?.supabase_url || '', supabase_anon_key: row?.supabase_anon_key || '' });
  }));

  ipcMain.handle('config:setSupabaseConfig', proteger(ROLES.ADMIN, (event, { supabase_url, supabase_anon_key } = {}) => {
    if (sync.estaConfigurado()) return err('Primero desconecta la sincronización actual antes de cambiar de proyecto de Supabase.');
    if (!esTextoValido(supabase_url, { min: 8, max: 300 }) || !/^https:\/\/.+\.supabase\.co\/?$/.test(supabase_url.trim())) {
      return err('La URL debe verse como https://tuproyecto.supabase.co');
    }
    if (!esTextoValido(supabase_anon_key, { min: 10, max: 500 })) return err('La clave anónima/publishable es requerida.');
    db().prepare('UPDATE app_config SET supabase_url=?, supabase_anon_key=? WHERE id=1')
      .run(supabase_url.trim().replace(/\/$/, ''), supabase_anon_key.trim());
    return ok();
  }));

  // ── CONFIGURACIÓN: IDENTIDAD DEL NEGOCIO (nombre + logo/ícono) ──
  // Lectura pública (se necesita en la pantalla de login, antes de autenticar).
  ipcMain.handle('config:getNegocio', () => {
    const row = db().prepare('SELECT nombre_negocio, logo FROM app_config WHERE id=1').get();
    return ok(row || { nombre_negocio: 'Poblano', logo: null });
  });

  ipcMain.handle('config:setNegocio', proteger(ROLES.ADMIN, (event, { nombre_negocio, logo } = {}) => {
    if (nombre_negocio != null && !esTextoValido(nombre_negocio, { min: 1, max: 80 })) return err('El nombre del negocio debe tener entre 1 y 80 caracteres.');
    if (logo != null) {
      if (typeof logo !== 'string' || !logo.startsWith('data:image/')) return err('Formato de imagen inválido.');
      if (logo.length > 3_000_000) return err('La imagen es demasiado grande (máximo ~2MB).');
    }
    try {
      if (nombre_negocio != null) {
        db().prepare('UPDATE app_config SET nombre_negocio=? WHERE id=1').run(nombre_negocio.trim());
      }
      if (logo != null) {
        db().prepare('UPDATE app_config SET logo=? WHERE id=1').run(logo);
        if (mainWindow) {
          try {
            const img = nativeImage.createFromDataURL(logo);
            if (!img.isEmpty()) mainWindow.setIcon(img);
          } catch (_e) {}
        }
      }
      const row = db().prepare('SELECT nombre_negocio, logo FROM app_config WHERE id=1').get();
      sync.encolarNegocio();
      return ok(row);
    } catch (e) { return err(e.message); }
  }));

  // ── SINCRONIZACIÓN CON LA NUBE (Supabase) — solo admin ──────
  ipcMain.handle('sync:estado', proteger(ROLES.ADMIN, () => ok(sync.obtenerEstado())));

  function enviarProgresoSync(payload) {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('sync:progreso', payload);
  }

  ipcMain.handle('sync:configurar', proteger(ROLES.ADMIN, async (event, { email, password } = {}) => {
    if (!esEmailValido(email)) return err('Correo inválido.');
    if (!esTextoValido(password, { min: 1, max: 200 })) return err('Ingresa tu contraseña de Supabase.');
    const r = await sync.configurarSync({ email: email.trim(), password });
    if (!r.ok) return err(r.error);
    // Al conectar por primera vez, sube TODO lo que ya existe localmente
    // (si no, Supabase se quedaría vacío hasta la próxima venta nueva).
    sync.encolarTodoHistorico();
    const resultado = await sync.vaciarColaCompleta(enviarProgresoSync);
    return ok({
      ...sync.obtenerEstado(),
      procesados: resultado.procesados || 0,
      cancelado: !!resultado.cancelado,
      avisoSubida: !resultado.ok ? resultado.error : null
    });
  }));

  ipcMain.handle('sync:desconectar', proteger(ROLES.ADMIN, () => { sync.desconectarSync(); return ok(); }));

  ipcMain.handle('sync:forzar', proteger(ROLES.ADMIN, async () => {
    const r = await sync.procesarCola();
    if (!r.ok && r.error) return err(r.error);
    return ok({ ...sync.obtenerEstado(), procesados: r.procesados || 0 });
  }));

  ipcMain.handle('sync:cancelar', proteger(ROLES.ADMIN, () => { sync.solicitarCancelacion(); return ok(); }));

  ipcMain.handle('sync:reenviarTodo', proteger(ROLES.ADMIN, async () => {
    if (!sync.estaConfigurado()) return err('Primero conecta la sincronización.');
    const conteo = sync.encolarTodoHistorico();
    const r = await sync.vaciarColaCompleta(enviarProgresoSync);
    if (!r.ok && r.error) return err(r.error);
    return ok({ ...sync.obtenerEstado(), ...conteo, procesados: r.procesados || 0, cancelado: !!r.cancelado });
  }));

  // ── CONFIGURACIÓN: EXPORTAR / IMPORTAR BASE DE DATOS (solo admin) ─
  ipcMain.handle('config:dbInfo', proteger(ROLES.ADMIN, () => ({ path: getDbPath() })));

  ipcMain.handle('config:abrirLogs', proteger(ROLES.ADMIN, async () => {
    const carpeta = path.join(app.getPath('userData'), 'logs');
    const error = await shell.openPath(carpeta);
    if (error) return err('No se pudo abrir la carpeta de registros: ' + error);
    return ok({ path: carpeta });
  }));

  // ── ACTUALIZACIONES (GitHub Releases, ver "publish" en package.json) ──
  // Cualquier rol autenticado puede VER el estado y reiniciar para instalar
  // (es información inofensiva y una acción que no expone datos del negocio) —
  // así el aviso de "actualización lista" se puede mostrar a todos, no solo admin.
  ipcMain.handle('updates:estado', proteger(ROLES.ANY, () => ok(obtenerEstadoActualizacion ? obtenerEstadoActualizacion() : { fase: 'inactivo' })));

  ipcMain.handle('updates:buscar', proteger(ROLES.ADMIN, () => {
    if (!buscarActualizaciones) return err('La búsqueda de actualizaciones no está disponible.');
    buscarActualizaciones();
    return ok();
  }));

  ipcMain.handle('updates:instalarYReiniciar', proteger(ROLES.ANY, () => {
    if (!autoUpdater) return err('No disponible.');
    autoUpdater.quitAndInstall();
    return ok();
  }));

  ipcMain.handle('config:exportDb', proteger(ROLES.ADMIN, async () => {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Exportar base de datos',
      defaultPath: `punto-venta-backup-${new Date().toISOString().slice(0, 10)}.db`,
      filters: [{ name: 'Base de datos SQLite', extensions: ['db'] }]
    });
    if (canceled || !filePath) return err('Exportación cancelada.');
    try {
      // NUNCA copiar el archivo .db "vivo" con fs.copyFileSync: en modo WAL, los
      // cambios ya confirmados (ventas recientes) pueden seguir en data.db-wal
      // sin haberse volcado todavía al archivo principal — una copia directa del
      // archivo puede quedar incompleta sin que nadie se entere hasta que ya es
      // tarde. VACUUM INTO genera una copia consistente y completa en un solo
      // paso, tomando en cuenta el WAL, sin afectar la base de datos en uso.
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      db().prepare('VACUUM INTO ?').run(filePath);
      return ok({ path: filePath });
    } catch (e) { return err(e.message); }
  }));

  ipcMain.handle('config:importDb', proteger(ROLES.ADMIN, async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Importar base de datos',
      properties: ['openFile'],
      filters: [{ name: 'Base de datos SQLite', extensions: ['db'] }]
    });
    if (canceled || !filePaths?.length) return err('Importación cancelada.');
    try {
      const src = filePaths[0];
      const header = Buffer.alloc(16);
      const fd = fs.openSync(src, 'r');
      fs.readSync(fd, header, 0, 16, 0);
      fs.closeSync(fd);
      if (header.toString('utf8', 0, 15) !== 'SQLite format 3') return err('El archivo seleccionado no es una base de datos SQLite válida.');
      const dest = getDbPath();
      fs.copyFileSync(src, dest);
      reopenDatabase(dest);
      return ok();
    } catch (e) { return err(e.message); }
  }));

  // Borra por completo la base de datos LOCAL (SQLite) y la reemplaza por una
  // vacía recién sembrada — nunca toca Supabase/la nube. Exige la contraseña
  // del admin que lo pide (defensa extra más allá de los dos pasos que ya
  // hace la pantalla en el renderer: escribir "ELIMINAR" + una segunda
  // pantalla de confirmación) — irreversible, no hay deshacer.
  ipcMain.handle('config:eliminarBaseDatos', proteger(ROLES.ADMIN, (event, { password } = {}, s) => {
    const user = db().prepare('SELECT password FROM usuarios WHERE id=?').get(s.id);
    if (!user || !bcrypt.compareSync(password || '', user.password)) return err('Contraseña incorrecta.');
    try {
      const dbPath = getDbPath();
      const dbInstanceActual = db();
      try { dbInstanceActual.close(); } catch (_e) {}
      for (const suf of ['', '-wal', '-shm']) {
        try { fs.unlinkSync(dbPath + suf); } catch (_e) {}
      }
      reopenDatabase(dbPath);
      sesiones.clear();
      return ok();
    } catch (e) { return err(e.message); }
  }));

  // ── IMPRESORAS TÉRMICAS Y ESCÁNERES ──────────────────────────
  // Los escáneres de código de barras (USB/Bluetooth "keyboard wedge") no
  // requieren driver ni integración especial: se comportan como un teclado
  // y "escriben" el código + Enter en el campo con foco — el frontend ya
  // maneja esto (ver Ventas.jsx). Aquí solo se resuelve la impresión.
  //
  // Para impresoras térmicas (Epson, Star, Bixolon, Xprinter, POS-58/80,
  // genéricas ESC/POS, etc.) se usa el driver de Windows tal cual lo
  // instala el fabricante — no se generan comandos ESC/POS a mano, así
  // es compatible con cualquier impresora que aparezca como impresora del
  // sistema. Solo se ajusta el tamaño de página al ancho real del rollo.
  ipcMain.handle('impresoras:list', proteger(ROLES.VENTAS, async () => {
    try {
      const impresoras = await mainWindow.webContents.getPrintersAsync();
      return ok({ impresoras: impresoras.map((p) => ({ name: p.name, displayName: p.displayName || p.name, isDefault: !!p.isDefault })) });
    } catch (e) { return err(e.message); }
  }));

  ipcMain.handle('config:getImpresion', proteger(ROLES.VENTAS, () => {
    const row = db().prepare('SELECT impresora_ticket, ancho_papel FROM app_config WHERE id=1').get();
    return ok(row || { impresora_ticket: null, ancho_papel: '80mm' });
  }));

  ipcMain.handle('config:setImpresion', proteger(ROLES.ADMIN, (event, { impresora_ticket, ancho_papel } = {}) => {
    if (ancho_papel && !['58mm', '80mm'].includes(ancho_papel)) return err('Ancho de papel inválido.');
    if (impresora_ticket != null && !esTextoValido(impresora_ticket, { min: 0, max: 200 }) && impresora_ticket !== '') return err('Impresora inválida.');
    try {
      db().prepare('UPDATE app_config SET impresora_ticket=?, ancho_papel=? WHERE id=1')
        .run(impresora_ticket || null, ['58mm', '80mm'].includes(ancho_papel) ? ancho_papel : '80mm');
      const row = db().prepare('SELECT impresora_ticket, ancho_papel FROM app_config WHERE id=1').get();
      return ok(row);
    } catch (e) { return err(e.message); }
  }));

  const ANCHOS_PAPEL_MICRONES = { '58mm': 58000, '80mm': 80000 };

  ipcMain.handle('ticket:imprimir', proteger(ROLES.VENTAS, async (event, { html } = {}) => {
    if (!esTextoValido(html, { min: 1, max: 2_000_000 })) return err('Contenido de ticket inválido.');
    const cfg = db().prepare('SELECT impresora_ticket, ancho_papel FROM app_config WHERE id=1').get();
    if (!cfg?.impresora_ticket) return err('No hay una impresora de tickets configurada. Ve a Configuración.');

    const tmpHtml = path.join(os.tmpdir(), `pvp-ticket-${Date.now()}-${Math.random().toString(36).slice(2)}.html`);
    let win = null;
    try {
      fs.writeFileSync(tmpHtml, html, 'utf-8');
      win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
      await win.loadFile(tmpHtml);
      const resultado = await new Promise((resolve) => {
        win.webContents.print({
          silent: true,
          deviceName: cfg.impresora_ticket,
          printBackground: true,
          margins: { marginType: 'none' },
          pageSize: { width: ANCHOS_PAPEL_MICRONES[cfg.ancho_papel] || 80000, height: 297000 }
        }, (success, errorType) => resolve({ success, errorType }));
      });
      if (!resultado.success) return err('No se pudo imprimir el ticket: ' + (resultado.errorType || 'error desconocido'));
      return ok();
    } catch (e) {
      return err(e.message);
    } finally {
      if (win) win.destroy();
      try { fs.unlinkSync(tmpHtml); } catch (_e) {}
    }
  }));
}

module.exports = { register };
