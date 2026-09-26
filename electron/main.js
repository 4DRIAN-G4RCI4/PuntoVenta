const { app, BrowserWindow, nativeImage } = require('electron');
const path = require('node:path');
const log = require('electron-log/main');
const { autoUpdater } = require('electron-updater');
const { openDatabase, getDb } = require('./db');
const { register } = require('./ipcHandlers');
const sync = require('./supabaseSync');

// Registro de errores para soporte remoto: sin esto, si algo falla en la
// máquina del cliente no queda ningún rastro que se pueda revisar a distancia.
// Se guarda en disco (con rotación automática) en la carpeta de datos de la
// app — ver Configuración → "Abrir carpeta de registros" para encontrarlo.
log.initialize();
log.transports.file.level = 'info';
log.transports.file.maxSize = 5 * 1024 * 1024; // 5MB por archivo, luego rota
log.transports.console.level = app.isPackaged ? false : 'debug';
// console.log/warn/error de todo el proceso principal (incluido cualquier
// throw no atrapado) queda espejado al archivo de log automáticamente.
Object.assign(console, log.functions);

process.on('uncaughtException', (e) => {
  log.error('[uncaughtException]', e);
});
process.on('unhandledRejection', (e) => {
  log.error('[unhandledRejection]', e);
});

let mainWindow = null;
const isDev = !app.isPackaged;

// Actualizaciones automáticas vía GitHub Releases (ver "publish" en package.json).
// En desarrollo no hay nada publicado que revisar, así que se desactiva solo.
autoUpdater.logger = log;
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

let ultimoEstadoActualizacion = { fase: 'inactivo' };
function avisarEstadoActualizacion(estado) {
  ultimoEstadoActualizacion = estado;
  mainWindow?.webContents?.send('updates:estado', estado);
}

autoUpdater.on('checking-for-update', () => avisarEstadoActualizacion({ fase: 'buscando' }));
autoUpdater.on('update-available', (info) => avisarEstadoActualizacion({ fase: 'disponible', version: info.version }));
autoUpdater.on('update-not-available', () => avisarEstadoActualizacion({ fase: 'al_dia' }));
autoUpdater.on('download-progress', (p) => avisarEstadoActualizacion({ fase: 'descargando', porcentaje: Math.round(p.percent) }));
autoUpdater.on('update-downloaded', (info) => avisarEstadoActualizacion({ fase: 'lista', version: info.version }));
autoUpdater.on('error', (e) => {
  log.error('[autoUpdater]', e);
  avisarEstadoActualizacion({ fase: 'error', error: mensajeAmigableUpdate(e) });
});

// electron-updater manda el texto crudo de la respuesta de GitHub (incluye
// encabezados HTTP, cookies, todo) — nunca se lo mostramos así al usuario.
function mensajeAmigableUpdate(e) {
  const msg = String(e?.message || e || '');
  if (msg.includes('releases.atom') || msg.includes('HttpError: 404')) {
    return 'Todavía no hay ninguna versión publicada en GitHub Releases para revisar. Esto es normal si nunca has corrido "npm run release" — no afecta el uso normal de la app.';
  }
  if (msg.includes('net::ERR_INTERNET_DISCONNECTED') || msg.includes('ENOTFOUND') || msg.includes('ETIMEDOUT')) {
    return 'No hay conexión a internet en este momento — se volverá a revisar la próxima vez que abras la app.';
  }
  return 'No se pudo revisar actualizaciones. Se guardó el detalle técnico en el registro (Configuración → Soporte y Diagnóstico).';
}

function buscarActualizaciones() {
  if (isDev) return;
  autoUpdater.checkForUpdates().catch((e) => log.error('[autoUpdater] checkForUpdates falló:', e));
}

log.info(`Iniciando Punto Venta — versión ${app.getVersion()}, empaquetado: ${app.isPackaged}`);

const ORIGENES_PERMITIDOS = isDev ? ['http://localhost:5173'] : ['file://'];

function origenPermitido(url) {
  return ORIGENES_PERMITIDOS.some((o) => url.startsWith(o));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0a0a0a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: isDev
    }
  });

  // Nunca permitir abrir ventanas nuevas (target=_blank, window.open, etc.)
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // Nunca permitir navegar fuera del propio contenido de la app.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!origenPermitido(url)) event.preventDefault();
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  // Carpeta de datos: `data/data.db` dentro del userData de Electron
  // (portable dentro del perfil de la app; ver README).
  const dbPath = path.join(app.getPath('userData'), 'data', 'data.db');
  openDatabase(dbPath);
  createWindow();
  register(mainWindow, {
    autoUpdater,
    buscarActualizaciones,
    obtenerEstadoActualizacion: () => ultimoEstadoActualizacion
  });

  try {
    const cfg = getDb().prepare('SELECT logo FROM app_config WHERE id=1').get();
    if (cfg?.logo) {
      const img = nativeImage.createFromDataURL(cfg.logo);
      if (!img.isEmpty()) mainWindow.setIcon(img);
    }
  } catch (_e) {}

  sync.iniciarLoop();
  buscarActualizaciones();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  try { getDb() && getDb().close(); } catch (_e) {}
  if (process.platform !== 'darwin') app.quit();
});
