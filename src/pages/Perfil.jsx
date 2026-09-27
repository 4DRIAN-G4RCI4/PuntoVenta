import React, { useEffect, useState } from 'react';
import { useAuth } from '../App.jsx';
import { resizeImageToDataURL } from '../utils/image.js';

export default function Perfil() {
  const { user, negocio, guardarNegocio } = useAuth();
  const [nombre, setNombre] = useState(user.nombre);
  const [email, setEmail] = useState(user.email);
  const [msg, setMsg] = useState('');
  const [current, setCurrent] = useState('');
  const [nueva, setNueva] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);

  const [llavePassword, setLlavePassword] = useState('');
  const [llaveMostrarPassword, setLlaveMostrarPassword] = useState(false);
  const [llaveGenerada, setLlaveGenerada] = useState('');
  const [llaveMsg, setLlaveMsg] = useState('');
  const [llaveCargando, setLlaveCargando] = useState(false);

  async function regenerarLlave() {
    if (!llavePassword) { setLlaveMsg('Ingresa tu contraseña para confirmar.'); return; }
    if (llaveGenerada && !confirm('Esto invalida la llave de recuperación anterior — si la guardaste en algún lado, ya no servirá. ¿Continuar?')) return;
    setLlaveCargando(true);
    setLlaveMsg('');
    const res = await window.api.config.regenerarLlaveRecuperacion({ password: llavePassword });
    setLlaveCargando(false);
    if (!res.ok) { setLlaveMsg(res.error || 'No se pudo generar la llave.'); return; }
    setLlaveGenerada(res.llave);
    setLlavePassword('');
  }

  const [nombreNegocio, setNombreNegocio] = useState(negocio?.nombre_negocio || '');
  const [tipoNegocio, setTipoNegocio] = useState(negocio?.tipo_negocio || 'general');
  const [logoPreview, setLogoPreview] = useState(negocio?.logo || null);
  const [negocioMsg, setNegocioMsg] = useState('');
  const [guardandoNegocio, setGuardandoNegocio] = useState(false);

  useEffect(() => {
    setNombreNegocio(negocio?.nombre_negocio || '');
    setTipoNegocio(negocio?.tipo_negocio || 'general');
    setLogoPreview(negocio?.logo || null);
  }, [negocio]);

  async function updateProfile() {
    const res = await window.api.auth.updateProfile({ userId: user.id, nombre, email });
    setMsg(res.ok ? 'Perfil actualizado.' : res.error);
  }

  async function changePassword() {
    if (!current || !nueva) { setPwMsg('Completa ambos campos.'); return; }
    const res = await window.api.auth.changePassword({ userId: user.id, currentPassword: current, newPassword: nueva });
    setPwMsg(res.ok ? 'Contraseña actualizada.' : res.error);
    if (res.ok) { setCurrent(''); setNueva(''); }
  }

  async function onLogoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageToDataURL(file, 256);
      setLogoPreview(dataUrl);
    } catch (err) {
      setNegocioMsg(err.message || 'No se pudo procesar la imagen.');
    }
  }

  async function guardarIdentidad() {
    setGuardandoNegocio(true);
    setNegocioMsg('');
    const res = await guardarNegocio({ nombre_negocio: nombreNegocio, logo: logoPreview, tipo_negocio: tipoNegocio });
    setNegocioMsg(res.ok ? 'Identidad del negocio actualizada.' : (res.error || 'No se pudo guardar.'));
    setGuardandoNegocio(false);
  }

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Mi Perfil</h2>
      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 380px', maxWidth: 480 }}>
          <div className="card" data-tour="perfil-info">
            <div className="card-title">Información Personal</div>
            {msg && <div className="alert alert-success">{msg}</div>}
            <div className="form-group"><label>Nombre</label><input value={nombre} onChange={(e) => setNombre(e.target.value)} /></div>
            <div className="form-group"><label>Correo</label><input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="form-group"><label>Rol</label><input value={user.rol} disabled /></div>
            <button className="btn btn-primary" onClick={updateProfile}>Guardar Cambios</button>
          </div>

          {user.rol === 'admin' ? (
            <div className="card" data-tour="perfil-password">
              <div className="card-title">Cambiar Contraseña</div>
              {pwMsg && <div className={'alert ' + (pwMsg.includes('actualizada') ? 'alert-success' : 'alert-error')}>{pwMsg}</div>}
              <div className="form-group"><label>Contraseña Actual</label><input type={mostrarPassword ? 'text' : 'password'} value={current} onChange={(e) => setCurrent(e.target.value)} /></div>
              <div className="form-group">
                <label>Nueva Contraseña</label>
                <input type={mostrarPassword ? 'text' : 'password'} value={nueva} onChange={(e) => setNueva(e.target.value)} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, textTransform: 'none', fontSize: 11, fontWeight: 400, cursor: 'pointer' }}>
                  <input type="checkbox" checked={mostrarPassword} onChange={() => setMostrarPassword((v) => !v)} style={{ width: 'auto' }} />
                  Mostrar contraseñas
                </label>
              </div>
              <button className="btn btn-primary" onClick={changePassword}>Actualizar Contraseña</button>
            </div>
          ) : (
            <div className="card" data-tour="perfil-password">
              <div className="card-title">Contraseña</div>
              <p style={{ color: 'var(--muted)', fontSize: 12, margin: 0 }}>
                Por seguridad, solo el administrador puede cambiar contraseñas. Si necesitas actualizar la tuya, pídele a tu administrador que lo haga desde la sección Usuarios.
              </p>
            </div>
          )}
          {user.rol === 'admin' && (
            <div className="card" data-tour="perfil-llave-recuperacion">
              <div className="card-title">Llave de Recuperación de Acceso</div>
              <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: -6, marginBottom: 14 }}>
                Si el administrador olvida su contraseña y no hay otro admin que se la resetee, esta llave permite
                recuperar el acceso desde la pantalla de inicio de sesión ("¿Olvidaste tu contraseña?"). Guárdala en
                un lugar seguro fuera de la computadora — nadie más la va a mostrar por ti.
              </p>
              {llaveMsg && <div className="alert alert-error">{llaveMsg}</div>}
              {llaveGenerada ? (
                <div className="alert alert-success" style={{ marginBottom: 14 }}>
                  <strong>Guarda esta llave ahora — no se vuelve a mostrar:</strong>
                  <div style={{ display: 'block', marginTop: 8, fontSize: 15, fontFamily: 'monospace', letterSpacing: 1, textAlign: 'center', userSelect: 'all' }}>
                    {llaveGenerada}
                  </div>
                </div>
              ) : (
                <div className="form-group">
                  <label>Tu contraseña (para confirmar)</label>
                  <input
                    type={llaveMostrarPassword ? 'text' : 'password'}
                    value={llavePassword}
                    onChange={(e) => setLlavePassword(e.target.value)}
                  />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, textTransform: 'none', fontSize: 11, fontWeight: 400, cursor: 'pointer' }}>
                    <input type="checkbox" checked={llaveMostrarPassword} onChange={() => setLlaveMostrarPassword((v) => !v)} style={{ width: 'auto' }} />
                    Mostrar contraseña
                  </label>
                </div>
              )}
              <button className="btn btn-primary" onClick={regenerarLlave} disabled={llaveCargando}>
                {llaveCargando ? 'Generando...' : (llaveGenerada ? 'Listo' : 'Ver / generar llave de recuperación')}
              </button>
            </div>
          )}
        </div>

        {user.rol === 'admin' && (
          <div style={{ flex: '1 1 380px', maxWidth: 480 }}>
            <div className="card" data-tour="perfil-negocio">
              <div className="card-title">Identidad del Negocio</div>
              <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: -6, marginBottom: 14 }}>
                El nombre y el logo se muestran en el menú, la pantalla de inicio, los tickets y se usan como ícono de la aplicación.
              </p>
              {negocioMsg && <div className={'alert ' + (negocioMsg.includes('actualizada') ? 'alert-success' : 'alert-error')}>{negocioMsg}</div>}

              <div className="form-group">
                <label>Nombre del negocio</label>
                <input value={nombreNegocio} onChange={(e) => setNombreNegocio(e.target.value)} placeholder="Ej. Poblano" />
              </div>

              <div className="form-group">
                <label>Tipo de negocio</label>
                <select value={tipoNegocio} onChange={(e) => setTipoNegocio(e.target.value)}>
                  <option value="general">General</option>
                  <option value="farmacia">Farmacia</option>
                </select>
                <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 4 }}>
                  Cambia qué campos aparecen al agregar un producto (ej. Farmacia muestra caducidad y datos regulados; oculta marca/talla/color).
                </div>
              </div>

              <div className="form-group">
                <label>Logo / Foto de perfil</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: 12, overflow: 'hidden',
                    background: 'var(--surface2)', border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    {logoPreview
                      ? <img src={logoPreview} alt="Previsualización del logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ color: 'var(--muted)', fontSize: 11 }}>Sin logo</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <input type="file" accept="image/*" onChange={onLogoChange} style={{ width: '100%' }} />
                    <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 4 }}>
                      Tamaño recomendado: 256×256px, formato cuadrado (JPG o PNG). Se redimensiona automáticamente.
                    </div>
                  </div>
                </div>
              </div>

              <button className="btn btn-primary" onClick={guardarIdentidad} disabled={guardandoNegocio}>
                {guardandoNegocio ? 'Guardando...' : 'Guardar Identidad'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
