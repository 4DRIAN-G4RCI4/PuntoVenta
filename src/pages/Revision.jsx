import React, { useEffect, useState } from 'react';
import { money, dateFmt } from '../format.js';

const ESTADOS_VENTA = { pagada: 'Pagada', pendiente: 'Pendiente', credito: 'Crédito', a_meses: 'A Meses', devuelta: 'Devuelta', cancelada: 'Cancelada' };

export default function Revision() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seleccionado, setSeleccionado] = useState(null);
  const [actividad, setActividad] = useState(null);
  const [tab, setTab] = useState('ventas');
  const [cargandoActividad, setCargandoActividad] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const r = await window.api.usuarios.resumenActividad();
    if (r.ok) setUsuarios(r.usuarios);
    setLoading(false);
  }

  async function abrirUsuario(u) {
    setSeleccionado(u);
    setTab('ventas');
    setCargandoActividad(true);
    const r = await window.api.usuarios.actividad({ usuarioId: u.id });
    if (r.ok) setActividad(r);
    setCargandoActividad(false);
  }

  if (loading) return <p style={{ color: 'var(--muted)' }}>Cargando revisión...</p>;

  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>Revisión de Actividad</h2>
      <p style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 16 }}>
        Perfiles de usuario y su actividad: ventas realizadas, cortes de caja (completados u omitidos) y más.
      </p>

      <div className="stats-grid" data-tour="revision-tarjetas">
        {usuarios.map((u) => (
          <div
            key={u.id}
            className="stat-card"
            style={{ cursor: 'pointer', borderColor: u.cortes_omitidos > 0 ? 'var(--red)' : 'var(--border)' }}
            onClick={() => abrirUsuario(u)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="stat-label" style={{ marginBottom: 0 }}>{u.nombre}</div>
              <span className="tag-role" style={{ fontSize: 11, color: 'var(--muted)' }}>{u.rol}</span>
            </div>
            <div className="stat-value" style={{ fontSize: 18, marginTop: 6 }}>{money(u.ventas_total)}</div>
            <div className="stat-sub">{u.ventas_num} venta(s) · {u.cortes_num} corte(s)</div>
            {u.cortes_omitidos > 0 && (
              <div style={{ marginTop: 6 }}>
                <span className="badge-pill badge-danger">{u.cortes_omitidos} corte(s) omitido(s)</span>
              </div>
            )}
            {u.ultimo_corte && (
              <div className="stat-sub" style={{ marginTop: 4 }}>
                Último corte: {dateFmt(u.ultimo_corte.created_at)} ({u.ultimo_corte.estado})
              </div>
            )}
          </div>
        ))}
        {!usuarios.length && <p style={{ color: 'var(--muted)' }}>Sin usuarios registrados.</p>}
      </div>

      {seleccionado && (
        <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) setSeleccionado(null); }}>
          <div className="modal" style={{ maxWidth: 720 }}>
            <div className="modal-header">
              <div className="modal-title">{seleccionado.nombre} — Actividad</div>
              <button className="modal-close" onClick={() => setSeleccionado(null)}>×</button>
            </div>

            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {[
                { key: 'ventas', label: 'Ventas' },
                { key: 'cortes', label: 'Cortes de Caja' },
                { key: 'gastos', label: 'Gastos' },
                { key: 'devoluciones', label: 'Devoluciones' },
              ].map((t) => (
                <button key={t.key} className={'btn btn-sm ' + (tab === t.key ? 'btn-primary' : 'btn-ghost')} onClick={() => setTab(t.key)}>
                  {t.label}
                </button>
              ))}
            </div>

            {cargandoActividad && <p style={{ color: 'var(--muted)' }}>Cargando actividad...</p>}

            {!cargandoActividad && actividad && (
              <div className="table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
                {tab === 'ventas' && (
                  <table>
                    <thead><tr><th>Folio</th><th>Total</th><th>Forma de pago</th><th>Estado</th><th>Fecha</th></tr></thead>
                    <tbody>
                      {actividad.ventas.map((v) => (
                        <tr key={v.id}>
                          <td><code>{v.folio}</code></td>
                          <td>{money(v.total)}</td>
                          <td style={{ textTransform: 'capitalize' }}>{v.forma_pago}</td>
                          <td><span className="badge-pill">{ESTADOS_VENTA[v.estado] || v.estado}</span></td>
                          <td style={{ color: 'var(--muted)' }}>{dateFmt(v.created_at)}</td>
                        </tr>
                      ))}
                      {!actividad.ventas.length && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)' }}>Sin ventas registradas.</td></tr>}
                    </tbody>
                  </table>
                )}

                {tab === 'cortes' && (
                  <table>
                    <thead><tr><th>Estado</th><th>Esperado</th><th>Contado</th><th>Diferencia</th><th>Detalle</th><th>Fecha</th></tr></thead>
                    <tbody>
                      {actividad.cortes.map((c) => {
                        const esperado = (c.efectivo_esperado || 0) + (c.tarjeta_esperado || 0) + (c.transferencia_esperado || 0);
                        const contado = (c.efectivo_contado || 0) + (c.tarjeta_contado || 0) + (c.transferencia_contado || 0);
                        return (
                          <tr key={c.id}>
                            <td><span className={'badge-pill ' + (c.estado === 'omitido' ? 'badge-danger' : 'badge-ok')}>{c.estado === 'omitido' ? 'Omitido' : 'Completado'}</span></td>
                            <td>{money(esperado)}</td>
                            <td>{c.estado === 'omitido' ? '—' : money(contado)}</td>
                            <td style={{ color: c.estado === 'omitido' ? 'var(--muted)' : (c.diferencia === 0 ? 'var(--green)' : c.diferencia > 0 ? 'var(--blue)' : 'var(--red)') }}>
                              {c.estado === 'omitido' ? '—' : `${c.diferencia > 0 ? '+' : ''}${money(c.diferencia)}`}
                            </td>
                            <td style={{ color: 'var(--muted)', maxWidth: 220 }}>{c.estado === 'omitido' ? (c.motivo_omision || '—') : '—'}</td>
                            <td style={{ color: 'var(--muted)' }}>{dateFmt(c.created_at)}</td>
                          </tr>
                        );
                      })}
                      {!actividad.cortes.length && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)' }}>Sin cortes registrados.</td></tr>}
                    </tbody>
                  </table>
                )}

                {tab === 'gastos' && (
                  <table>
                    <thead><tr><th>Concepto</th><th>Monto</th><th>Fecha</th></tr></thead>
                    <tbody>
                      {actividad.gastos.map((g) => (
                        <tr key={g.id}><td>{g.concepto}</td><td>{money(g.monto)}</td><td style={{ color: 'var(--muted)' }}>{dateFmt(g.created_at)}</td></tr>
                      ))}
                      {!actividad.gastos.length && <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--muted)' }}>Sin gastos registrados.</td></tr>}
                    </tbody>
                  </table>
                )}

                {tab === 'devoluciones' && (
                  <table>
                    <thead><tr><th>Venta</th><th>Monto</th><th>Estado</th><th>Fecha</th></tr></thead>
                    <tbody>
                      {actividad.devoluciones.map((d) => (
                        <tr key={d.id}><td>#{d.venta_id}</td><td>{money(d.monto_total)}</td><td><span className="badge-pill">{d.estado}</span></td><td style={{ color: 'var(--muted)' }}>{dateFmt(d.created_at)}</td></tr>
                      ))}
                      {!actividad.devoluciones.length && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)' }}>Sin devoluciones registradas.</td></tr>}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
