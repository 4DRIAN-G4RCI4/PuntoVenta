import React, { useEffect, useState } from 'react';
import { money, dateFmt } from '../format.js';
import Ticket from './Ticket.jsx';

const ESTADO_COLOR = { pagada: 'badge-ok', pendiente: 'badge-danger', credito: '', a_meses: '', devuelta: 'badge-danger', cancelada: 'badge-danger' };

export default function HistorialVentas() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [ticketData, setTicketData] = useState(null);

  async function load() { setRows(await window.api.historial.list({ q })); }
  useEffect(() => { load(); }, []);

  async function verTicket(id) {
    const res = await window.api.ventas.detalle({ id });
    if (res.ok) setTicketData(res);
  }

  return (
    <div>
      <div className="toolbar">
        <h2 style={{ flex: 1 }}>Historial de Ventas</h2>
        <div className="search-bar">
          <input placeholder="Folio o cliente..." value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
        </div>
        <button className="btn btn-secondary" onClick={load}>Buscar</button>
      </div>

      <div className="card" style={{ padding: 0 }} data-tour="historial-tabla">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Folio</th><th>Cliente</th><th>Tipo</th><th>Total</th><th>Saldo</th><th>Estado</th><th>Fecha</th><th></th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan="8" style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>Sin ventas.</td></tr>}
              {rows.map((v) => (
                <tr key={v.id}>
                  <td><code>{v.folio}</code></td>
                  <td>{v.cliente_nombre?.trim() || 'General'}</td>
                  <td style={{ textTransform: 'capitalize' }}>{v.tipo_venta}</td>
                  <td style={{ fontWeight: 600 }}>{money(v.total)}</td>
                  <td style={{ color: v.saldo_pendiente > 0 ? 'var(--red)' : 'var(--muted)' }}>{money(v.saldo_pendiente)}</td>
                  <td><span className={'badge-pill ' + (ESTADO_COLOR[v.estado] || '')}>{v.estado}</span></td>
                  <td style={{ color: 'var(--muted)', fontSize: 12 }}>{dateFmt(v.created_at)}</td>
                  <td><button className="btn btn-secondary btn-xs" onClick={() => verTicket(v.id)}>Ver ticket</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {ticketData && <Ticket data={ticketData} onClose={() => setTicketData(null)} />}
    </div>
  );
}
