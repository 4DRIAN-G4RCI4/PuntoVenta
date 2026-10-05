import React, { useEffect, useState } from 'react';
import Modal from '../components/Modal.jsx';
import { money, dateFmt } from '../format.js';
import { useAuth } from '../App.jsx';
import { useFormConfirm } from '../hooks/useFormConfirm.js';

export default function Devoluciones() {
  const { user } = useAuth();
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));
  const [rows, setRows] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [folio, setFolio] = useState('');
  const [venta, setVenta] = useState(null);
  const [seleccion, setSeleccion] = useState({});
  const [tipoDevolucion, setTipoDevolucion] = useState('reembolso');
  const [motivo, setMotivo] = useState('');
  const [notas, setNotas] = useState('');
  const [error, setError] = useState('');

  async function load() { setRows(await window.api.devoluciones.list({ mes })); }
  useEffect(() => { load(); }, [mes]);

  function openNew() { setFolio(''); setVenta(null); setSeleccion({}); setMotivo(''); setNotas(''); setError(''); setModalOpen(true); }
  const cerrarModal = useFormConfirm({
    esArticuloNuevo: true,
    // Lo que de verdad se perdería al cerrar sin querer: haber encontrado la
    // venta (hay que rebuscar el folio) o haber escrito el motivo ya.
    tieneDatos: () => !!venta || motivo.trim() !== '' || Object.values(seleccion).some((q) => q > 0),
    onClose: () => setModalOpen(false)
  });

  async function buscarVenta() {
    setError('');
    const res = await window.api.devoluciones.buscarVenta({ folio });
    if (!res.ok) { setError(res.error); return; }
    setVenta(res.venta);
    const sel = {};
    res.venta.items.forEach((it, idx) => { sel[idx] = 0; });
    setSeleccion(sel);
  }

  function setQty(idx, max, delta) {
    setSeleccion((prev) => {
      const nuevo = Math.max(0, Math.min(max, (prev[idx] || 0) + delta));
      return { ...prev, [idx]: nuevo };
    });
  }

  async function registrar() {
    if (!motivo.trim()) { setError('El motivo es requerido.'); return; }
    const items = venta.items.map((it, idx) => ({ prod_id: it.producto_id, presentacion_id: it.presentacion_id, qty: seleccion[idx] || 0, precio: it.precio_unitario })).filter((i) => i.qty > 0);
    if (!items.length) { setError('Selecciona al menos un artículo.'); return; }
    const res = await window.api.devoluciones.registrar({ venta_id: venta.id, motivo, tipo_devolucion: tipoDevolucion, notas, items, usuario_id: user.id });
    if (!res.ok) { setError(res.error); return; }
    setModalOpen(false);
    load();
  }

  async function del(id) { if (!confirm('¿Eliminar este registro?')) return; await window.api.devoluciones.delete({ id }); load(); }

  return (
    <div>
      <div className="toolbar">
        <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} style={{ width: 'auto' }} />
        <div style={{ flex: 1 }} />
        <button data-tour="dev-nueva" className="btn btn-primary" onClick={openNew}>+ Nueva Devolución</button>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-label">Devoluciones del mes</div><div className="stat-value">{rows.length}</div></div>
        <div className="stat-card"><div className="stat-label">Monto Devuelto</div><div className="stat-value" style={{ color: 'var(--red)' }}>{money(rows.reduce((s, r) => s + r.monto_total, 0))}</div></div>
      </div>

      <div className="card" style={{ padding: 0 }} data-tour="dev-tabla">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Folio</th><th>Cliente</th><th>Tipo</th><th>Motivo</th><th>Atendió</th><th>Fecha</th><th>Monto</th><th></th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan="8" style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>Sin devoluciones.</td></tr>}
              {rows.map((d) => (
                <tr key={d.id}>
                  <td><code>{d.folio || '—'}</code></td>
                  <td>{d.cliente_nombre?.trim() || 'General'}</td>
                  <td><span className="badge-pill">{d.tipo_devolucion}</span></td>
                  <td style={{ color: 'var(--muted)', fontSize: 12 }}>{d.motivo}</td>
                  <td style={{ color: 'var(--muted)', fontSize: 12 }}>{d.usuario_nombre || '—'}</td>
                  <td style={{ color: 'var(--muted)', fontSize: 12 }}>{dateFmt(d.created_at)}</td>
                  <td style={{ fontWeight: 700, color: 'var(--red)' }}>{money(d.monto_total)}</td>
                  <td>{user.rol === 'admin' ? <button className="btn btn-danger btn-xs" onClick={() => del(d.id)}>Eliminar</button> : <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} confirmarCierre={cerrarModal} maxWidth={620} title="Registrar Devolución"
        footer={<>
          <button className="btn btn-secondary" onClick={cerrarModal}>Cancelar</button>
          {venta && <button className="btn btn-primary" onClick={registrar}>Registrar Devolución</button>}
        </>}>
        {error && <div className="alert alert-error">{error}</div>}
        {!venta ? (
          <div>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 10 }}>Ingresa el folio de la venta a devolver:</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <input placeholder="Ej: V20260101ABCDE" value={folio} onChange={(e) => setFolio(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && buscarVenta()} />
              <button className="btn btn-primary" onClick={buscarVenta}>Buscar</button>
            </div>
          </div>
        ) : (
          <div>
            <div className="alert alert-success">Folio: {venta.folio} · Cliente: {venta.cliente_nombre?.trim() || 'General'} · Total: {money(venta.total)}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 8 }}>Selecciona los artículos a devolver</div>
            {venta.items.map((it, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{it.prod_nombre}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{it.presentacion ? `Presentacion: ${it.presentacion} · ` : ''}Cant: {it.cantidad} · {money(it.precio_unitario)} c/u</div>
                </div>
                <button className="qty-btn" onClick={() => setQty(idx, it.cantidad, -1)}>-</button>
                <span>{seleccion[idx] || 0}</span>
                <button className="qty-btn" onClick={() => setQty(idx, it.cantidad, 1)}>+</button>
                <div style={{ fontWeight: 700, color: 'var(--accent)', minWidth: 70, textAlign: 'right' }}>{money((seleccion[idx] || 0) * it.precio_unitario)}</div>
              </div>
            ))}
            <div className="form-grid" style={{ marginTop: 14 }}>
              <div className="form-group">
                <label>Tipo de Devolución</label>
                <select value={tipoDevolucion} onChange={(e) => setTipoDevolucion(e.target.value)}>
                  <option value="reembolso">Reembolso en efectivo</option>
                  <option value="cambio">Cambio de producto</option>
                  <option value="nota_credito">Nota de crédito</option>
                </select>
              </div>
              <div className="form-group"><label>Motivo *</label><input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej: Producto defectuoso" /></div>
              <div className="form-group span-full"><label>Notas adicionales</label><textarea rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} /></div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
