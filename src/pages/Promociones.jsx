import React, { useEffect, useState } from 'react';
import Modal from '../components/Modal.jsx';
import { useAuth } from '../App.jsx';
import { money } from '../format.js';
import { useFormConfirm } from '../hooks/useFormConfirm.js';

const emptyForm = { id: 0, nombre: '', codigo: '', tipo: 'porcentaje', valor: '', departamento: 'todos', categoria_id: '', producto_id: '', fecha_inicio: '', fecha_fin: '', activo: 1 };

export default function Promociones() {
  const { user } = useAuth();
  const esAdmin = user.rol === 'admin';
  const [rows, setRows] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  async function load() { setRows(await window.api.promociones.list()); }
  useEffect(() => { load(); }, []);

  const promoTieneDatos = () => form.nombre.trim() !== '' || form.codigo.trim() !== '' || String(form.valor).trim() !== '';
  function openNew() {
    if (!form.id && promoTieneDatos()) { setModalOpen(true); return; }
    setForm(emptyForm); setError(''); setModalOpen(true);
  }
  function openEdit(p) { setForm({ ...emptyForm, ...p }); setError(''); setModalOpen(true); }
  const cerrarModal = useFormConfirm({ esArticuloNuevo: !form.id, tieneDatos: promoTieneDatos, onClose: () => setModalOpen(false) });

  async function save() {
    if (!form.nombre.trim() || !form.valor) { setError('Nombre y valor son requeridos.'); return; }
    const res = await window.api.promociones.save({ ...form, valor: Number(form.valor), categoria_id: form.categoria_id || null, producto_id: form.producto_id || null });
    if (!res.ok) { setError(res.error); return; }
    setForm(emptyForm);
    setModalOpen(false);
    load();
  }
  async function toggle(id) { await window.api.promociones.toggle({ id }); load(); }
  async function del(id) { if (!confirm('¿Eliminar esta promoción?')) return; await window.api.promociones.delete({ id }); load(); }

  return (
    <div>
      <div className="toolbar">
        <h2 style={{ flex: 1 }}>Promociones y Descuentos</h2>
        {esAdmin && <button data-tour="promo-nueva" className="btn btn-primary" onClick={openNew}>+ Nueva Promoción</button>}
      </div>
      {!esAdmin && <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: -12, marginBottom: 14 }}>Solo un administrador puede crear, editar o eliminar promociones.</p>}

      <div className="card" style={{ padding: 0 }} data-tour="promo-tabla">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Nombre</th><th>Código</th><th>Tipo</th><th>Valor</th><th>Aplica a</th><th>Vigencia</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan="8" style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>Sin promociones.</td></tr>}
              {rows.map((p) => (
                <tr key={p.id} style={!p.activo ? { opacity: 0.5 } : {}}>
                  <td style={{ fontWeight: 600 }}>{p.nombre}</td>
                  <td>{p.codigo ? <code>{p.codigo}</code> : '—'}</td>
                  <td><span className="badge-pill">{p.tipo === 'porcentaje' ? 'Porcentaje' : 'Monto Fijo'}</span></td>
                  <td style={{ fontWeight: 700 }}>{p.tipo === 'porcentaje' ? `${p.valor}%` : money(p.valor)}</td>
                  <td>{p.prod_nombre || p.cat_nombre || p.departamento}</td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{p.fecha_inicio || '—'}{p.fecha_fin ? ` al ${p.fecha_fin}` : ''}</td>
                  <td>
                    <div className="toggle-track" style={{ display: 'inline-block', pointerEvents: esAdmin ? 'auto' : 'none', opacity: esAdmin ? 1 : 0.6 }} onClick={() => esAdmin && toggle(p.id)}>
                      <div className={'toggle-track' + (p.activo ? ' on' : '')}><div className="toggle-thumb" /></div>
                    </div>
                  </td>
                  <td>
                    {esAdmin ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-xs" onClick={() => openEdit(p)}>Editar</button>
                        <button className="btn btn-danger btn-xs" onClick={() => del(p.id)}>Eliminar</button>
                      </div>
                    ) : <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} confirmarCierre={cerrarModal} maxWidth={640} title={form.id ? 'Editar Promoción' : 'Nueva Promoción'}
        footer={<><button className="btn btn-secondary" onClick={cerrarModal}>Cancelar</button><button className="btn btn-primary" onClick={save}>Guardar</button></>}>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="form-grid">
          <div className="form-group span-full"><label>Nombre *</label><input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></div>
          <div className="form-group"><label>Código (opcional)</label><input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })} /></div>
          <div className="form-group"><label>Tipo de Descuento</label>
            <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              <option value="porcentaje">Porcentaje (%)</option><option value="monto_fijo">Monto Fijo ($)</option>
            </select>
          </div>
          <div className="form-group"><label>Valor *</label><input type="number" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></div>
          <div className="form-group"><label>Aplica a Departamento</label>
            <select value={form.departamento} onChange={(e) => setForm({ ...form, departamento: e.target.value })}>
              <option value="todos">Todos</option><option value="tenis">Tenis</option><option value="joyeria">Joyería</option><option value="ropa">Ropa</option>
            </select>
          </div>
          <div className="form-group"><label>Fecha de Inicio</label><input type="date" value={form.fecha_inicio || ''} onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })} /></div>
          <div className="form-group"><label>Fecha de Fin</label><input type="date" value={form.fecha_fin || ''} onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })} /></div>
          <div className="form-group"><label>Estado</label>
            <select value={form.activo} onChange={(e) => setForm({ ...form, activo: Number(e.target.value) })}>
              <option value={1}>Activa</option><option value={0}>Inactiva</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
