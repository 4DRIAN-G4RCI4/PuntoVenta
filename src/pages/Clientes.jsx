import React, { useEffect, useState } from 'react';
import Modal from '../components/Modal.jsx';
import { money } from '../format.js';

const emptyForm = { id: 0, nombre: '', apellido: '', telefono: '', email: '', calle: '', colonia: '', ciudad: '', estado: '', cp: '', rfc: '', limite_credito: 0, notas: '' };

export default function Clientes() {
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState('');
  const [rows, setRows] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [histModal, setHistModal] = useState(null);
  const [histRows, setHistRows] = useState([]);

  async function load() { setRows(await window.api.clientes.list({ q, filtro })); }
  useEffect(() => { load(); }, [filtro]);

  function openNew() { setForm(emptyForm); setError(''); setModalOpen(true); }
  function openEdit(c) { setForm({ ...emptyForm, ...c }); setError(''); setModalOpen(true); }

  async function save() {
    if (!form.nombre.trim() || !form.apellido.trim()) { setError('Nombre y apellido son requeridos.'); return; }
    const res = await window.api.clientes.save(form);
    if (!res.ok) { setError(res.error); return; }
    setModalOpen(false);
    load();
  }
  async function del(id) { if (!confirm('¿Eliminar este cliente?')) return; await window.api.clientes.delete({ id }); load(); }
  async function verHistorial(c) { setHistModal(c); setHistRows(await window.api.clientes.historial({ id: c.id })); }

  return (
    <div>
      <div className="toolbar">
        <h2 style={{ flex: 1 }}>Clientes</h2>
        <div className="search-bar"><input placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} /></div>
        <select value={filtro} onChange={(e) => setFiltro(e.target.value)} style={{ width: 'auto' }}>
          <option value="">Todos</option>
          <option value="deuda">Con deuda</option>
        </select>
        <button className="btn btn-secondary" onClick={load}>Buscar</button>
        <button className="btn btn-primary" onClick={openNew}>+ Nuevo Cliente</button>
      </div>

      <div className="card" style={{ padding: 0 }} data-tour="cli-tabla">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Nombre</th><th>Teléfono</th><th>Email</th><th>Límite Crédito</th><th>Saldo Deuda</th><th>Acciones</th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan="6" style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>Sin clientes.</td></tr>}
              {rows.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.nombre} {c.apellido}</td>
                  <td>{c.telefono || '—'}</td>
                  <td style={{ color: 'var(--muted)' }}>{c.email || '—'}</td>
                  <td>{money(c.limite_credito)}</td>
                  <td style={{ color: c.saldo_deuda > 0 ? 'var(--red)' : 'var(--muted)', fontWeight: 600 }}>{money(c.saldo_deuda)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-xs" onClick={() => openEdit(c)}>Editar</button>
                      <button className="btn btn-secondary btn-xs" onClick={() => verHistorial(c)}>Historial</button>
                      <button className="btn btn-danger btn-xs" onClick={() => del(c.id)}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} maxWidth={620} title={form.id ? 'Editar Cliente' : 'Nuevo Cliente'}
        footer={<><button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button><button className="btn btn-primary" onClick={save}>Guardar</button></>}>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="form-grid">
          <div className="form-group"><label>Nombre *</label><input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></div>
          <div className="form-group"><label>Apellido *</label><input value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} /></div>
          <div className="form-group"><label>Teléfono</label><input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></div>
          <div className="form-group"><label>Email</label><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="form-group"><label>Calle</label><input value={form.calle} onChange={(e) => setForm({ ...form, calle: e.target.value })} /></div>
          <div className="form-group"><label>Colonia</label><input value={form.colonia} onChange={(e) => setForm({ ...form, colonia: e.target.value })} /></div>
          <div className="form-group"><label>Ciudad</label><input value={form.ciudad} onChange={(e) => setForm({ ...form, ciudad: e.target.value })} /></div>
          <div className="form-group"><label>Estado</label><input value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} /></div>
          <div className="form-group"><label>CP</label><input value={form.cp} onChange={(e) => setForm({ ...form, cp: e.target.value })} /></div>
          <div className="form-group"><label>RFC</label><input value={form.rfc} onChange={(e) => setForm({ ...form, rfc: e.target.value })} /></div>
          <div className="form-group"><label>Límite de Crédito ($)</label><input type="number" value={form.limite_credito} onChange={(e) => setForm({ ...form, limite_credito: Number(e.target.value) })} /></div>
          <div className="form-group span-full"><label>Notas</label><textarea rows={2} value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} /></div>
        </div>
      </Modal>

      <Modal open={!!histModal} onClose={() => setHistModal(null)} title={histModal ? `Historial — ${histModal.nombre} ${histModal.apellido}` : ''}>
        {histRows.length === 0 ? <div className="empty-state">Sin compras registradas.</div> : (
          <table style={{ width: '100%' }}>
            <thead><tr><th>Folio</th><th>Total</th><th>Tipo</th><th>Estado</th></tr></thead>
            <tbody>{histRows.map((v, i) => <tr key={i}><td><code>{v.folio}</code></td><td>{money(v.total)}</td><td>{v.tipo_venta}</td><td><span className="badge-pill">{v.estado}</span></td></tr>)}</tbody>
          </table>
        )}
      </Modal>
    </div>
  );
}
