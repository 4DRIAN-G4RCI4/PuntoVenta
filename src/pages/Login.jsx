import React, { useState } from 'react';
import Modal from '../components/Modal.jsx';

export default function Login({ onLogin, negocio }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [bdEliminada] = useState(() => {
    const fue = sessionStorage.getItem('pvp_bd_eliminada') === '1';
    if (fue) sessionStorage.removeItem('pvp_bd_eliminada');
    return fue;
  });

  const [recuperarOpen, setRecuperarOpen] = useState(false);
  const [recLlave, setRecLlave] = useState('');
  const [recEmail, setRecEmail] = useState('');
  const [recPassword, setRecPassword] = useState('');
  const [recConfirmar, setRecConfirmar] = useState('');
  const [recMostrar, setRecMostrar] = useState(false);
  const [recError, setRecError] = useState('');
  const [recExito, setRecExito] = useState(false);
  const [recCargando, setRecCargando] = useState(false);

  function abrirRecuperar() {
    setRecuperarOpen(true);
    setRecLlave(''); setRecEmail(''); setRecPassword(''); setRecConfirmar('');
    setRecMostrar(false); setRecError(''); setRecExito(false);
  }

  async function handleRecuperar(e) {
    e.preventDefault();
    setRecError('');
    if (recPassword !== recConfirmar) { setRecError('Las contraseñas no coinciden.'); return; }
    setRecCargando(true);
    const res = await window.api.auth.recuperarAcceso({ llave: recLlave, email: recEmail, newPassword: recPassword });
    setRecCargando(false);
    if (!res.ok) { setRecError(res.error || 'No se pudo recuperar el acceso.'); return; }
    setRecExito(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await window.api.auth.login({ email, password });
    setLoading(false);
    if (!res.ok) { setError(res.error || 'Error al iniciar sesión.'); return; }
    onLogin(res.user);
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        {negocio?.logo && (
          <div style={{ textAlign: 'center', marginBottom: 10 }}>
            <img src={negocio.logo} alt="" style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover' }} />
          </div>
        )}
        <div className="login-title">Punto<span>Venta</span></div>
        <div className="login-sub">{negocio?.nombre_negocio || 'Poblano'} — Gestión Integral</div>
        {bdEliminada && (
          <div className="alert alert-info" style={{ marginBottom: 14 }}>
            La base de datos local se eliminó correctamente. Vuelve a iniciar sesión con las credenciales que se te dieron al instalar.
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Correo electrónico</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <div className="form-group">
            <label>Contraseña</label>
            <input
              type={mostrarPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, textTransform: 'none', fontSize: 11, fontWeight: 400, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={mostrarPassword}
                onChange={() => setMostrarPassword((v) => !v)}
                style={{ width: 'auto' }}
              />
              Mostrar contraseña
            </label>
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} disabled={loading}>
            {loading ? 'Ingresando...' : 'Iniciar sesión'}
          </button>
        </form>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}
          onClick={abrirRecuperar}
        >
          ¿Olvidaste tu contraseña? Recuperar acceso
        </button>
      </div>

      <Modal open={recuperarOpen} onClose={() => setRecuperarOpen(false)} title="Recuperar acceso de administrador">
        {recExito ? (
          <>
            <div className="alert alert-success" style={{ marginBottom: 14 }}>
              Contraseña actualizada. Ya puedes iniciar sesión con tu nueva contraseña.
            </div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setRecuperarOpen(false)}>
              Entendido
            </button>
          </>
        ) : (
          <form onSubmit={handleRecuperar}>
            <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: -4, marginBottom: 14 }}>
              Solo funciona para cuentas de <strong>administrador</strong>, y necesitas la llave de recuperación
              que se generó al instalar el sistema (o quien te instaló el sistema).
            </p>
            {recError && <div className="alert alert-error">{recError}</div>}
            <div className="form-group">
              <label>Llave de recuperación</label>
              <input value={recLlave} onChange={(e) => setRecLlave(e.target.value)} placeholder="PVP-XXXX-XXXX-XXXX" required autoFocus />
            </div>
            <div className="form-group">
              <label>Correo del administrador</label>
              <input type="email" value={recEmail} onChange={(e) => setRecEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Nueva contraseña</label>
              <input type={recMostrar ? 'text' : 'password'} value={recPassword} onChange={(e) => setRecPassword(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Confirmar nueva contraseña</label>
              <input type={recMostrar ? 'text' : 'password'} value={recConfirmar} onChange={(e) => setRecConfirmar(e.target.value)} required />
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, textTransform: 'none', fontSize: 11, fontWeight: 400, cursor: 'pointer' }}>
                <input type="checkbox" checked={recMostrar} onChange={() => setRecMostrar((v) => !v)} style={{ width: 'auto' }} />
                Mostrar contraseñas
              </label>
            </div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={recCargando}>
              {recCargando ? 'Verificando...' : 'Restablecer contraseña'}
            </button>
          </form>
        )}
      </Modal>
    </div>
  );
}
