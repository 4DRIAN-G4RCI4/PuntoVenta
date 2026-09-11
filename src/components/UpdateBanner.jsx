import React, { useEffect, useState } from 'react';

// Aviso visible para CUALQUIER rol (no solo admin) cuando ya hay una versión
// nueva descargada y lista — sin esto, la actualización se instala sola al
// cerrar la app sin que nadie que no entre a Configuración se entere.
export default function UpdateBanner() {
  const [estado, setEstado] = useState({ fase: 'inactivo' });
  const [oculto, setOculto] = useState(false);

  useEffect(() => {
    window.api.updates.estado().then((r) => { if (r.ok) setEstado(r); });
    const unsub = window.api.updates.onEstado((data) => { setEstado(data); setOculto(false); });
    return unsub;
  }, []);

  if (oculto || estado.fase !== 'lista') return null;

  return (
    <div style={{
      background: 'var(--accent-dim)', border: '1px solid var(--accent)', color: 'var(--text)',
      borderRadius: 8, padding: '10px 14px', marginBottom: 16,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 13
    }}>
      <span>✓ Hay una actualización lista (versión {estado.version}) — se instalará sola al cerrar la app.</span>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button className="btn btn-primary btn-sm" onClick={() => window.api.updates.instalarYReiniciar()}>Reiniciar ahora</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setOculto(true)}>Después</button>
      </div>
    </div>
  );
}
