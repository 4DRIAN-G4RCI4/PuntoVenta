import React, { useState } from 'react';

// Pantalla que bloquea el resto de la app hasta que el usuario cambie una
// contraseña temporal (primer login de una cuenta nueva, o después de que el
// admin le reseteó la contraseña) — ver auth:cambiarPasswordObligatorio.
export default function CambiarPasswordObligatorio({ user, onCambiada, onCancelar }) {
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (nueva.length < 8) { setError('La nueva contraseña debe tener al menos 8 caracteres.'); return; }
    if (nueva !== confirmar) { setError('Las contraseñas no coinciden.'); return; }
    setGuardando(true);
    const res = await window.api.auth.cambiarPasswordObligatorio({ newPassword: nueva });
    setGuardando(false);
    if (!res.ok) { setError(res.error || 'No se pudo cambiar la contraseña.'); return; }
    onCambiada();
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-title">Punto<span>Venta</span></div>
        <div className="login-sub">Tu contraseña es temporal — cámbiala para continuar</div>
        <p style={{ color: 'var(--muted)', fontSize: 12, textAlign: 'center', margin: '10px 0 18px' }}>
          Hola, <strong>{user.nombre}</strong>. Por seguridad, no puedes usar el sistema hasta que elijas tu propia contraseña.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nueva contraseña</label>
            <input type={mostrar ? 'text' : 'password'} value={nueva} onChange={(e) => setNueva(e.target.value)} required autoFocus />
          </div>
          <div className="form-group">
            <label>Confirmar nueva contraseña</label>
            <input type={mostrar ? 'text' : 'password'} value={confirmar} onChange={(e) => setConfirmar(e.target.value)} required />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, textTransform: 'none', fontSize: 11, fontWeight: 400, cursor: 'pointer' }}>
              <input type="checkbox" checked={mostrar} onChange={() => setMostrar((v) => !v)} style={{ width: 'auto' }} />
              Mostrar contraseñas
            </label>
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} disabled={guardando}>
            {guardando ? 'Guardando...' : 'Cambiar contraseña y entrar'}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} onClick={onCancelar}>
            Cancelar y cerrar sesión
          </button>
        </form>
      </div>
    </div>
  );
}
