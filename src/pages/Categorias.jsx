import React, { useEffect, useState } from 'react';
import Modal from '../components/Modal.jsx';
import { useFormConfirm } from '../hooks/useFormConfirm.js';
import { useConfirm } from '../components/ConfirmProvider.jsx';

export default function Categorias() {
  const { confirmar, avisar } = useConfirm();
  const [data, setData] = useState({ principales: [], subcategorias: [], cats_select: [] });
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ id: 0, nombre: '', parent_id: '', descripcion: '' });
  const [error, setError] = useState('');

  async function load() { setData(await window.api.categorias.listAll()); }
  useEffect(() => { load(); }, []);

  function openNew() {
    if (!form.id && (form.nombre.trim() || form.descripcion.trim())) { setModalOpen(true); return; }
    setForm({ id: 0, nombre: '', parent_id: '', descripcion: '' }); setError(''); setModalOpen(true);
  }
  function openEdit(c) { setForm({ id: c.id, nombre: c.nombre, parent_id: c.parent_id || '', descripcion: c.descripcion || '' }); setError(''); setModalOpen(true); }
  const cerrarModal = useFormConfirm({
    esArticuloNuevo: !form.id,
    tieneDatos: () => form.nombre.trim() !== '' || form.descripcion.trim() !== '',
    onClose: () => setModalOpen(false)
  });

  async function save() {
    if (!form.nombre.trim()) { setError('El nombre es requerido.'); return; }
    const res = await window.api.categorias.save({ ...form, parent_id: form.parent_id ? Number(form.parent_id) : null });
    if (!res.ok) { setError(res.error); return; }
    setForm({ id: 0, nombre: '', parent_id: '', descripcion: '' });
    setModalOpen(false);
    load();
  }

  async function toggle(id) { await window.api.categorias.toggle({ id }); load(); }
  async function del(id) {
    if (!(await confirmar('¿Eliminar esta categoría?'))) return;
    const res = await window.api.categorias.delete({ id });
    if (!res.ok) await avisar(res.error);
    load();
  }

  function renderTable(rows, isSubcat) {
    return (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              {isSubcat && <th>Categoría Padre</th>}
              <th>Descripción</th>
              {!isSubcat && <th>Subcats</th>}
              <th>Productos</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan="6" style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>Sin registros.</td></tr>}
            {rows.map((c) => (
              <tr key={c.id} style={!c.activo ? { opacity: 0.5 } : {}}>
                <td style={{ fontWeight: 600 }}>{c.nombre}</td>
                {isSubcat && <td><span className="badge-pill">{c.nombre_padre}</span></td>}
                <td style={{ color: 'var(--muted)' }}>{c.descripcion || '—'}</td>
                {!isSubcat && <td>{c.num_subcats > 0 ? <span className="badge-pill">{c.num_subcats} subcats</span> : '—'}</td>}
                <td>{c.num_productos}</td>
                <td>{c.activo ? <span className="badge-pill badge-ok">Activa</span> : <span className="badge-pill badge-danger">Inactiva</span>}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-secondary btn-xs" onClick={() => openEdit(c)}>Editar</button>
                    <button className="btn btn-secondary btn-xs" onClick={() => toggle(c.id)}>{c.activo ? 'Ocultar' : 'Activar'}</button>
                    <button className="btn btn-danger btn-xs" onClick={() => del(c.id)}>Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div>
      <div className="toolbar">
        <h2 style={{ flex: 1 }}>Categorías</h2>
        <button data-tour="cat-nuevo" className="btn btn-primary" onClick={openNew}>+ Nueva Categoría</button>
      </div>

      <div className="card" data-tour="cat-tabla">
        <div className="card-title">Categorías Principales <span className="badge">{data.principales.length}</span></div>
        {renderTable(data.principales, false)}
      </div>

      <div className="card">
        <div className="card-title">Subcategorías <span className="badge">{data.subcategorias.length}</span></div>
        {renderTable(data.subcategorias, true)}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} confirmarCierre={cerrarModal} title={form.id ? 'Editar Categoría' : 'Nueva Categoría'}
        footer={<>
          <button className="btn btn-secondary" onClick={cerrarModal}>Cancelar</button>
          <button className="btn btn-primary" onClick={save}>Guardar</button>
        </>}>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="form-group">
          <label>Nombre *</label>
          <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Categoría Padre (vacío = principal)</label>
          <select value={form.parent_id} onChange={(e) => setForm({ ...form, parent_id: e.target.value })}>
            <option value="">— Es categoría principal —</option>
            {data.cats_select.filter((c) => c.id !== form.id).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Descripción</label>
          <textarea rows={2} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
        </div>
      </Modal>
    </div>
  );
}
