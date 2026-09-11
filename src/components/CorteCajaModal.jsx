import React, { useEffect, useState } from 'react';
import { money, dateFmt } from '../format.js';

export default function CorteCajaModal({ usuarioId, onFinish, onCancel }) {
  const [resumen, setResumen] = useState(null);
  const [efectivo, setEfectivo] = useState('');
  const [tarjeta, setTarjeta] = useState('');
  const [transferencia, setTransferencia] = useState('');
  const [modo, setModo] = useState('contar'); // contar | omitir
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    window.api.corte.resumen({ usuarioId }).then((r) => {
      if (r.ok) {
        setResumen(r);
        setEfectivo(String(r.efectivo_esperado || 0));
        setTarjeta(String(r.tarjeta_esperado || 0));
        setTransferencia(String(r.transferencia_esperado || 0));
      }
    });
  }, [usuarioId]);

  const esperadoTotal = (resumen?.efectivo_esperado || 0) + (resumen?.tarjeta_esperado || 0) + (resumen?.transferencia_esperado || 0);
  const contadoTotal = (Number(efectivo) || 0) + (Number(tarjeta) || 0) + (Number(transferencia) || 0);
  const diferencia = Math.round((contadoTotal - esperadoTotal) * 100) / 100;

  async function registrarCorte() {
    setGuardando(true);
    setError('');
    const r = await window.api.corte.registrar({
      usuarioId, estado: 'completado',
      efectivoContado: Number(efectivo) || 0,
      tarjetaContado: Number(tarjeta) || 0,
      transferenciaContado: Number(transferencia) || 0
    });
    setGuardando(false);
    if (!r.ok) { setError(r.error || 'No se pudo registrar el corte.'); return; }
    onFinish();
  }

  async function omitirCorte() {
    if (!motivo.trim()) { setError('Escribe un motivo para omitir el corte.'); return; }
    setGuardando(true);
    setError('');
    const r = await window.api.corte.registrar({ usuarioId, estado: 'omitido', motivoOmision: motivo.trim() });
    setGuardando(false);
    if (!r.ok) { setError(r.error || 'No se pudo registrar la omisión.'); return; }
    onFinish();
  }

  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <div className="modal-title">Corte de Caja</div>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>

        {!resumen && <p style={{ color: 'var(--muted)' }}>Calculando ventas del turno...</p>}

        {resumen && (
          <>
            <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: -8, marginBottom: 14 }}>
              Turno desde {dateFmt(resumen.fecha_inicio)} · {resumen.num_ventas} venta(s)
            </p>

            {error && <div className="alert alert-error">{error}</div>}

            {modo === 'contar' && (
              <>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Efectivo esperado</label>
                    <input value={money(resumen.efectivo_esperado)} disabled />
                  </div>
                  <div className="form-group">
                    <label>Efectivo contado</label>
                    <input type="number" step="0.01" value={efectivo} onChange={(e) => setEfectivo(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Tarjeta esperado</label>
                    <input value={money(resumen.tarjeta_esperado)} disabled />
                  </div>
                  <div className="form-group">
                    <label>Tarjeta contado</label>
                    <input type="number" step="0.01" value={tarjeta} onChange={(e) => setTarjeta(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Transferencia esperado</label>
                    <input value={money(resumen.transferencia_esperado)} disabled />
                  </div>
                  <div className="form-group">
                    <label>Transferencia contado</label>
                    <input type="number" step="0.01" value={transferencia} onChange={(e) => setTransferencia(e.target.value)} />
                  </div>
                </div>

                <div className="total-row big" style={{ marginTop: 10 }}>
                  <span>Diferencia</span>
                  <span style={{ color: diferencia === 0 ? 'var(--green)' : diferencia > 0 ? 'var(--blue)' : 'var(--red)' }}>
                    {diferencia > 0 ? '+' : ''}{money(diferencia)}
                  </span>
                </div>

                <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
                  <button className="btn btn-ghost" onClick={() => setModo('omitir')} disabled={guardando}>Omitir corte</button>
                  <button className="btn btn-primary" onClick={registrarCorte} disabled={guardando}>
                    {guardando ? 'Guardando...' : 'Registrar Corte y Cerrar Sesión'}
                  </button>
                </div>
              </>
            )}

            {modo === 'omitir' && (
              <>
                <div className="alert alert-error" style={{ marginBottom: 12 }}>
                  Omitir el corte queda registrado y visible para el administrador.
                </div>
                <div className="form-group">
                  <label>Motivo de la omisión</label>
                  <textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Explica por qué no se realiza el corte ahora..." />
                </div>
                <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
                  <button className="btn btn-ghost" onClick={() => setModo('contar')} disabled={guardando}>Volver</button>
                  <button className="btn btn-danger" onClick={omitirCorte} disabled={guardando}>
                    {guardando ? 'Guardando...' : 'Confirmar Omisión y Cerrar Sesión'}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
