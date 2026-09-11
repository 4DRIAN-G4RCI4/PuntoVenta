import React, { useEffect, useState } from 'react';
import Modal from '../components/Modal.jsx';
import { money, dateFmt } from '../format.js';

export default function Credito() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [resumen, setResumen] = useState({});
  const [abonoModal, setAbonoModal] = useState(null);
  const [monto, setMonto] = useState('');
  const [formaPago, setFormaPago] = useState('efectivo');
  const [referencia, setReferencia] = useState('');
  const [histModal, setHistModal] = useState(null);
  const [histRows, setHistRows] = useState([]);

  async function load() {
    const res = await window.api.credito.list({ q });
    setRows(res.rows); setResumen(res.resumen);
  }
  useEffect(() => { load(); }, []);

  function abrirAbono(v) { setAbonoModal(v); setMonto(''); setReferencia(''); }

  async function confirmarAbono() {
    const m = Number(monto);
    if (!m || m <= 0) { alert('Ingresa un monto válido.'); return; }
    if (m > abonoModal.saldo_pendiente + 0.01) { alert('El abono supera el saldo pendiente.'); return; }
    const res = await window.api.credito.abonar({ venta_id: abonoModal.id, cliente_id: abonoModal.cliente_id, monto: m, forma_pago: formaPago, referencia });
    if (!res.ok) { alert(res.error); return; }
    setAbonoModal(null);
    load();
  }

  async function verHistorial(v) {
    setHistModal(v);
    setHistRows(await window.api.credito.historialAbonos({ venta_id: v.id }));
  }

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-label">Total Cartera</div><div className="stat-value" style={{ color: 'var(--red)' }}>{money(resumen.total_deuda)}</div><div className="stat-sub">{resumen.num_creditos || 0} créditos activos</div></div>
        <div className="stat-card"><div className="stat-label">Clientes con Deuda</div><div className="stat-value">{resumen.clientes_con_deuda || 0}</div></div>
      </div>

      <div className="toolbar">
        <div className="search-bar"><input placeholder="Buscar cliente, folio o teléfono..." value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} /></div>
        <button className="btn btn-secondary" onClick={load}>Buscar</button>
      </div>

      {rows.length === 0 ? (
        <div className="card"><div className="empty-state">¡Sin deudas pendientes! Todos los clientes están al corriente.</div></div>
      ) : (
        <div className="card" style={{ padding: 0 }} data-tour="credito-tabla">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Cliente</th><th>Folio</th><th>Total</th><th>Pagado</th><th>Saldo</th><th>Días</th><th>Progreso</th><th>Acciones</th></tr></thead>
              <tbody>
                {rows.map((v) => {
                  const dias = Math.floor((Date.now() - new Date(v.created_at.replace(' ', 'T'))) / 86400000);
                  const pct = v.total > 0 ? Math.round((v.monto_pagado / v.total) * 100) : 0;
                  return (
                    <tr key={v.id}>
                      <td><div style={{ fontWeight: 600 }}>{v.cliente_nombre}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>{v.telefono}</div></td>
                      <td><code>{v.folio}</code></td>
                      <td>{money(v.total)}</td>
                      <td style={{ color: 'var(--green)' }}>{money(v.monto_pagado)}</td>
                      <td style={{ color: 'var(--red)', fontWeight: 700 }}>{money(v.saldo_pendiente)}</td>
                      <td style={{ color: dias > 30 ? 'var(--red)' : 'var(--muted)' }}>{dias} días</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="progress-bar" style={{ flex: 1 }}><div style={{ width: pct + '%' }} /></div>
                          <span style={{ fontSize: 11 }}>{pct}%</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button data-tour="credito-abonar" className="btn btn-success btn-xs" onClick={() => abrirAbono(v)}>Abonar</button>
                          <button className="btn btn-secondary btn-xs" onClick={() => verHistorial(v)}>Historial</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={!!abonoModal} onClose={() => setAbonoModal(null)} title="Registrar Abono"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setAbonoModal(null)}>Cancelar</button>
          <button className="btn btn-success" onClick={confirmarAbono}>Registrar Abono</button>
        </>}>
        {abonoModal && <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700 }}>{abonoModal.cliente_nombre}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <div><div style={{ fontSize: 10, color: 'var(--muted)' }}>SALDO PENDIENTE</div><div style={{ fontSize: 20, fontWeight: 800, color: 'var(--red)' }}>{money(abonoModal.saldo_pendiente)}</div></div>
              <div style={{ textAlign: 'right' }}><div style={{ fontSize: 10, color: 'var(--muted)' }}>FOLIO</div><div style={{ color: 'var(--accent)' }}>{abonoModal.folio}</div></div>
            </div>
          </div>
          <div className="form-grid">
            <div className="form-group"><label>Monto del Abono ($) *</label><input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} /></div>
            <div className="form-group"><label>Forma de Pago</label>
              <select value={formaPago} onChange={(e) => setFormaPago(e.target.value)}>
                <option value="efectivo">Efectivo</option><option value="tarjeta">Tarjeta</option><option value="transferencia">Transferencia</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {[0.25, 0.5, 0.75, 1].map((p) => (
              <button key={p} className="btn btn-ghost btn-xs" onClick={() => setMonto((abonoModal.saldo_pendiente * p).toFixed(2))}>{p === 1 ? 'Liquidar todo' : `${p * 100}%`}</button>
            ))}
          </div>
          <div className="form-group"><label>Referencia / Nota</label><input value={referencia} onChange={(e) => setReferencia(e.target.value)} /></div>
        </>}
      </Modal>

      <Modal open={!!histModal} onClose={() => setHistModal(null)} title={`Historial de Abonos — ${histModal?.folio || ''}`}>
        {histRows.length === 0 ? <div className="empty-state">Aún no hay abonos registrados.</div> : (
          <table style={{ width: '100%' }}>
            <thead><tr><th>Monto</th><th>Forma</th><th>Referencia</th><th>Fecha</th></tr></thead>
            <tbody>
              {histRows.map((r, i) => (
                <tr key={i}><td style={{ color: 'var(--green)', fontWeight: 700 }}>{money(r.monto)}</td><td>{r.forma_pago}</td><td style={{ color: 'var(--muted)' }}>{r.referencia || '—'}</td><td style={{ color: 'var(--muted)' }}>{dateFmt(r.created_at)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </Modal>
    </div>
  );
}
