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

  const [nombreNegocio, setNombreNegocio] = useState(negocio?.nombre_negocio || '');
  const [logoPreview, setLogoPreview] = useState(negocio?.logo || null);
  const [negocioMsg, setNegocioMsg] = useState('');
  const [guardandoNegocio, setGuardandoNegocio] = useState(false);

  useEffect(() => {
    setNombreNegocio(negocio?.nombre_negocio || '');
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
    const res = await guardarNegocio({ nombre_negocio: nombreNegocio, logo: logoPreview });
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
              <div className="form-group"><label>Contraseña Actual</label><input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} /></div>
              <div className="form-group"><label>Nueva Contraseña</label><input type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} /></div>
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
