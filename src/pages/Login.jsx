import React, { useState } from 'react';

export default function Login({ onLogin, negocio }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      </div>
    </div>
  );
}
