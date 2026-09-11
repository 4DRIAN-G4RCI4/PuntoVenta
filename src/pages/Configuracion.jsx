import React, { useEffect, useState } from 'react';
import { ACENTOS, useAcento } from '../hooks/useAcento.js';

export default function Configuracion() {
  const [acento, setAcento] = useAcento();

  const [dbPath, setDbPath] = useState('');
  const [msg, setMsg] = useState('');
  const [logsMsg, setLogsMsg] = useState('');
  const [estadoUpdate, setEstadoUpdate] = useState({ fase: 'inactivo' });

  const [syncEstado, setSyncEstado] = useState(null);
  const [syncEmail, setSyncEmail] = useState('');
  const [syncPassword, setSyncPassword] = useState('');
  const [mostrarSyncPassword, setMostrarSyncPassword] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [syncMsgEsError, setSyncMsgEsError] = useState(false);
  const [conectando, setConectando] = useState(false);
  const [sincronizandoAhora, setSincronizandoAhora] = useState(false);
  const [reenviandoTodo, setReenviandoTodo] = useState(false);
  const [progreso, setProgreso] = useState(null);
  const [cancelando, setCancelando] = useState(false);

  async function cargarEstadoSync() {
    const r = await window.api.sync.estado();
    if (r.ok) setSyncEstado(r);
  }
  useEffect(() => { cargarEstadoSync(); }, []);

  useEffect(() => {
    const unsub = window.api.sync.onProgreso((p) => setProgreso(p));
    return unsub;
  }, []);

  async function conectarSync() {
    setConectando(true);
    setSyncMsg('');
    setProgreso({ total: 0, enviados: 0, restantes: 0 });
    const res = await window.api.sync.configurar({ email: syncEmail, password: syncPassword });
    setConectando(false);
    setProgreso(null);
    setCancelando(false);
    if (!res.ok) { setSyncMsgEsError(true); setSyncMsg(res.error); return; }
    if (res.avisoSubida) {
      setSyncMsgEsError(true);
      setSyncMsg(`Conectado, pero la subida del historial falló: ${res.avisoSubida}. Corrígelo y presiona "Reenviar todo el historial".`);
    } else {
      setSyncMsgEsError(false);
      setSyncMsg(res.cancelado
        ? `Conectado. Cancelaste la subida — se enviaron ${res.procesados} registro(s), el resto seguirá subiendo solo.`
        : `Conectado. Se sincronizaron ${res.procesados} registro(s) pendientes.`);
    }
    setSyncPassword('');
    cargarEstadoSync();
  }

  async function desconectarSync() {
    if (!confirm('¿Desconectar la sincronización con la nube? La app móvil dejará de recibir información nueva.')) return;
    await window.api.sync.desconectar();
    setSyncMsg('');
    cargarEstadoSync();
  }

  async function sincronizarAhora() {
    setSincronizandoAhora(true);
    setSyncMsg('');
    const res = await window.api.sync.forzar();
    setSincronizandoAhora(false);
    setSyncMsgEsError(!res.ok);
    setSyncMsg(res.ok ? `Sincronizado. ${res.procesados} registro(s) enviados.` : res.error);
    cargarEstadoSync();
  }

  async function reenviarTodoElHistorico() {
    if (!confirm('Esto vuelve a subir a Supabase TODAS las ventas, gastos y alertas de stock que ya existen localmente. Puede tardar unos minutos si tienes muchos registros. ¿Continuar?')) return;
    setReenviandoTodo(true);
    setSyncMsg('');
    setProgreso({ total: 0, enviados: 0, restantes: 0 });
    const res = await window.api.sync.reenviarTodo();
    setReenviandoTodo(false);
    setProgreso(null);
    setCancelando(false);
    setSyncMsgEsError(!res.ok);
    setSyncMsg(res.ok
      ? (res.cancelado
        ? `Cancelado. Se alcanzaron a subir ${res.procesados} registro(s) — el resto seguirá subiendo solo más tarde.`
        : `Sincronizado todo el historial: ${res.procesados} registro(s) enviados.`)
      : res.error);
    cargarEstadoSync();
  }

  async function cancelarSubida() {
    setCancelando(true);
    await window.api.sync.cancelar();
  }

  const [impresoras, setImpresoras] = useState([]);
  const [impresoraSel, setImpresoraSel] = useState('');
  const [anchoPapel, setAnchoPapel] = useState('80mm');
  const [msgImpresion, setMsgImpresion] = useState('');
  const [cargandoImpresoras, setCargandoImpresoras] = useState(true);
  const [guardandoImpresion, setGuardandoImpresion] = useState(false);

  useEffect(() => { window.api.config.dbInfo().then((r) => setDbPath(r.path)); }, []);

  useEffect(() => {
    window.api.updates.estado().then((r) => { if (r.ok) setEstadoUpdate(r); });
    const unsub = window.api.updates.onEstado((data) => setEstadoUpdate(data));
    return unsub;
  }, []);

  function buscarUpdate() { window.api.updates.buscar(); }
  function instalarUpdate() { window.api.updates.instalarYReiniciar(); }

  useEffect(() => {
    (async () => {
      const [cfg, listado] = await Promise.all([window.api.config.getImpresion(), window.api.impresoras.list()]);
      if (cfg.ok) { setImpresoraSel(cfg.impresora_ticket || ''); setAnchoPapel(cfg.ancho_papel || '80mm'); }
      if (listado.ok) setImpresoras(listado.impresoras);
      setCargandoImpresoras(false);
    })();
  }, []);

  async function guardarImpresion() {
    setGuardandoImpresion(true);
    setMsgImpresion('');
    const res = await window.api.config.setImpresion({ impresora_ticket: impresoraSel || null, ancho_papel: anchoPapel });
    setMsgImpresion(res.ok ? 'Configuración de impresión guardada.' : (res.error || 'No se pudo guardar.'));
    setGuardandoImpresion(false);
  }

  async function exportar() {
    setMsg('');
    const res = await window.api.config.exportDb();
    setMsg(res.ok ? `Base de datos exportada a: ${res.path}` : res.error);
  }

  async function importar() {
    if (!confirm('Esto reemplazará la base de datos actual con el archivo seleccionado. Esta acción no se puede deshacer. ¿Continuar?')) return;
    setMsg('');
    const res = await window.api.config.importDb();
    if (res.ok) {
      setMsg('Base de datos importada correctamente. Reinicia la aplicación para ver los cambios.');
    } else {
      setMsg(res.error);
    }
  }

  async function abrirLogs() {
    setLogsMsg('');
    const res = await window.api.config.abrirLogs();
    if (!res.ok) setLogsMsg(res.error);
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <h2 style={{ marginBottom: 16 }}>Configuración</h2>

      <div className="card" data-tour="config-personalizacion">
        <div className="card-title">Personalización</div>
        <p style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 14 }}>
          Elige el color de acento de la app — funciona para cualquier tipo de negocio (tienda, restaurante, taller, salón, etc.), no solo para calzado. Se aplica en botones, gráficas y resaltados, en ambas computadoras y en la app móvil.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {ACENTOS.map((t) => (
            <button
              key={t.id}
              onClick={() => setAcento(t.id)}
              title={t.etiqueta}
              style={{
                width: 34, height: 34, borderRadius: '50%', cursor: 'pointer',
                background: t.oscuro,
                border: acento === t.id ? '3px solid var(--text)' : '1px solid var(--border)',
                padding: 0,
              }}
            />
          ))}
        </div>
      </div>

      <div className="card" data-tour="config-impresion">
        <div className="card-title">Impresión de Tickets (Impresoras Térmicas)</div>
        <p style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 14 }}>
          Funciona con cualquier impresora térmica instalada en Windows (Epson, Star, Bixolon, Xprinter, genéricas ESC/POS de 58mm u 80mm, etc.) — se usa el controlador que ya instalaste, no requiere configuración adicional.
        </p>
        {msgImpresion && <div className={'alert ' + (msgImpresion.includes('guardada') ? 'alert-success' : 'alert-error')}>{msgImpresion}</div>}
        {cargandoImpresoras ? (
          <p style={{ color: 'var(--muted)' }}>Buscando impresoras instaladas...</p>
        ) : (
          <>
            <div className="form-grid">
              <div className="form-group">
                <label>Impresora de tickets</label>
                <select value={impresoraSel} onChange={(e) => setImpresoraSel(e.target.value)}>
                  <option value="">— Usar diálogo de impresión normal —</option>
                  {impresoras.map((p) => (
                    <option key={p.name} value={p.name}>{p.displayName}{p.isDefault ? ' (predeterminada)' : ''}</option>
                  ))}
                </select>
                {!impresoras.length && <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 4 }}>No se detectaron impresoras. Instala el driver de tu impresora térmica en Windows y recarga esta página.</div>}
              </div>
              <div className="form-group">
                <label>Ancho de papel</label>
                <select value={anchoPapel} onChange={(e) => setAnchoPapel(e.target.value)}>
                  <option value="80mm">80mm (estándar)</option>
                  <option value="58mm">58mm (compacta)</option>
                </select>
              </div>
            </div>
            <button className="btn btn-primary" onClick={guardarImpresion} disabled={guardandoImpresion}>
              {guardandoImpresion ? 'Guardando...' : 'Guardar Configuración de Impresión'}
            </button>
            <p style={{ color: 'var(--muted)', fontSize: 11, marginTop: 10 }}>
              Si eliges una impresora, el ticket se manda a imprimir directamente sin mostrar el diálogo de impresión. Si dejas "diálogo de impresión normal", se abrirá el selector de Windows para elegir impresora cada vez.
            </p>
          </>
        )}
      </div>

      <div className="card" data-tour="config-sync">
        <div className="card-title">App Móvil (Sincronización con la Nube)</div>
        <p style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 14 }}>
          Conecta esta computadora con tu cuenta de Supabase para que la app móvil de solo lectura pueda mostrar tus ventas, reportes y stock. Todo sigue funcionando igual sin internet — lo pendiente se sube solo cuando vuelve la conexión.
        </p>
        {syncMsg && <div className={'alert ' + (syncMsgEsError ? 'alert-error' : 'alert-success')}>{syncMsg}</div>}

        {syncEstado?.configurado ? (
          <>
            <div className="alert alert-success" style={{ marginBottom: 14 }}>
              Conectado como <strong>{syncEstado.email}</strong>
            </div>
            <div style={{ display: 'flex', gap: 18, fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
              <span>Pendientes por subir: <strong style={{ color: 'var(--text)' }}>{syncEstado.pendientes}</strong></span>
              <span>Última sincronización: <strong style={{ color: 'var(--text)' }}>{syncEstado.ultimoSync || 'aún no'}</strong></span>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={sincronizarAhora} disabled={sincronizandoAhora}>
                {sincronizandoAhora ? 'Sincronizando...' : 'Sincronizar ahora'}
              </button>
              <button className="btn btn-secondary" onClick={reenviarTodoElHistorico} disabled={reenviandoTodo}>
                {reenviandoTodo ? 'Subiendo historial...' : 'Reenviar todo el historial'}
              </button>
              <button className="btn btn-danger" onClick={desconectarSync}>Desconectar</button>
            </div>
          </>
        ) : (
          <>
            <div className="form-grid">
              <div className="form-group">
                <label>Correo (el mismo que usarás en la app móvil)</label>
                <input type="email" value={syncEmail} onChange={(e) => setSyncEmail(e.target.value)} placeholder="tucorreo@ejemplo.com" />
              </div>
              <div className="form-group">
                <label>Contraseña de Supabase</label>
                <input
                  type={mostrarSyncPassword ? 'text' : 'password'}
                  value={syncPassword}
                  onChange={(e) => setSyncPassword(e.target.value)}
                  autoComplete="off"
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, textTransform: 'none', fontSize: 11, fontWeight: 400, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={mostrarSyncPassword}
                    onChange={() => setMostrarSyncPassword((v) => !v)}
                    style={{ width: 'auto' }}
                  />
                  Mostrar contraseña
                </label>
              </div>
            </div>
            <button className="btn btn-primary" onClick={conectarSync} disabled={conectando || !syncEmail || !syncPassword}>
              {conectando ? 'Conectando...' : 'Conectar'}
            </button>
            <p style={{ color: 'var(--muted)', fontSize: 11, marginTop: 10 }}>
              Este usuario debe existir en tu proyecto de Supabase (Authentication → Users). No se guarda tu contraseña — solo un token de acceso que se puede revocar desconectando.
            </p>
          </>
        )}
      </div>

      <div className="card" data-tour="config-db">
        <div className="card-title">Base de Datos</div>
        <p style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 14 }}>Ubicación actual del archivo SQLite:</p>
        <code style={{ display: 'block', padding: 10, background: 'var(--surface2)', borderRadius: 8, marginBottom: 18, wordBreak: 'break-all', fontSize: 12 }}>{dbPath}</code>

        {msg && <div className="alert alert-info">{msg}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" onClick={exportar}>Exportar base de datos</button>
          <button className="btn btn-danger" onClick={importar}>Importar base de datos</button>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: 11, marginTop: 14 }}>
          Exportar crea una copia del archivo .db actual en la ubicación que elijas.
          Importar reemplaza la base de datos activa con un archivo .db seleccionado — esta acción es destructiva y no se puede deshacer.
        </p>
      </div>

      <div className="card" data-tour="config-updates">
        <div className="card-title">Actualizaciones</div>
        <p style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 14 }}>
          La app revisa sola si hay una versión nueva al abrirla. Cuando termina de descargarla, se instala la próxima vez que la cierres — o puedes reiniciar ahora mismo desde aquí.
        </p>
        {estadoUpdate.fase === 'buscando' && <div className="alert alert-info">Buscando actualizaciones...</div>}
        {estadoUpdate.fase === 'al_dia' && <div className="alert alert-success">Ya tienes la última versión.</div>}
        {estadoUpdate.fase === 'disponible' && <div className="alert alert-info">Hay una versión nueva ({estadoUpdate.version}) — descargando...</div>}
        {estadoUpdate.fase === 'descargando' && <div className="alert alert-info">Descargando actualización... {estadoUpdate.porcentaje}%</div>}
        {estadoUpdate.fase === 'error' && <div className="alert alert-error">No se pudo revisar actualizaciones: {estadoUpdate.error}</div>}
        {estadoUpdate.fase === 'lista' ? (
          <button className="btn btn-primary" onClick={instalarUpdate}>Reiniciar e instalar versión {estadoUpdate.version}</button>
        ) : (
          <button className="btn btn-secondary" onClick={buscarUpdate} disabled={estadoUpdate.fase === 'buscando' || estadoUpdate.fase === 'descargando'}>
            Buscar actualizaciones
          </button>
        )}
      </div>

      <div className="card" data-tour="config-soporte">
        <div className="card-title">Soporte y Diagnóstico</div>
        <p style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 14 }}>
          Si algo falla, aquí queda un registro con la fecha, el error exacto y qué se intentaba hacer — ábrelo y envía el archivo más reciente a soporte para diagnosticar sin tener que estar presente.
        </p>
        {logsMsg && <div className={'alert ' + (logsMsg.includes('No se pudo') ? 'alert-error' : 'alert-success')}>{logsMsg}</div>}
        <button className="btn btn-secondary" onClick={abrirLogs}>Abrir carpeta de registros</button>
      </div>

      {(reenviandoTodo || conectando) && (
        <div className="modal-overlay open">
          <div className="modal" style={{ maxWidth: 380, textAlign: 'center' }}>
            <div className="modal-title" style={{ marginBottom: 18 }}>
              {conectando ? 'Conectando y subiendo historial' : 'Subiendo historial a la nube'}
            </div>

            <div className="spinner" />

            {progreso && progreso.total > 0 ? (
              <>
                <div className="progress-bar" style={{ marginTop: 20 }}>
                  <div style={{ width: `${Math.min(100, Math.round((progreso.enviados / progreso.total) * 100))}%` }} />
                </div>
                <div style={{ marginTop: 12, fontSize: 14, fontWeight: 700 }}>
                  {progreso.enviados} de {progreso.total} registros enviados
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  {progreso.restantes} restante(s)
                </div>
              </>
            ) : (
              <div style={{ marginTop: 16, fontSize: 13, color: 'var(--muted)' }}>
                Calculando cuántos registros hay que subir...
              </div>
            )}

            <button
              className="btn btn-secondary"
              style={{ width: '100%', marginTop: 22 }}
              onClick={cancelarSubida}
              disabled={cancelando}
            >
              {cancelando ? 'Cancelando...' : 'Cancelar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
