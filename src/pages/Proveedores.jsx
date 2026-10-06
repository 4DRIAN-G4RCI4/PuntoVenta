import React, { useEffect, useState } from 'react';
import Modal from '../components/Modal.jsx';
import { useFormConfirm } from '../hooks/useFormConfirm.js';
import { useConfirm } from '../components/ConfirmProvider.jsx';

const emptyForm = { id: 0, nombre: '', contacto: '', telefono: '', email: '', notas: '' };

export default function Proveedores() {
  const { confirmar, avisar } = useConfirm();
  const [data, setData] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  async function load() { setData(await window.api.proveedores.list()); }
  useEffect(() => { load(); }, []);

  function openNew() {
    if (!form.id && Object.keys(emptyForm).some((k) => k !== 'id' && form[k].trim() !== '')) { setModalOpen(true); return; }
    setForm(emptyForm); setError(''); setModalOpen(true);
  }
  function openEdit(p) { setForm({ id: p.id, nombre: p.nombre, contacto: p.contacto || '', telefono: p.telefono || '', email: p.email || '', notas: p.notas || '' }); setError(''); setModalOpen(true); }
  const cerrarModal = useFormConfirm({
    esArticuloNuevo: !form.id,
    tieneDatos: () => Object.keys(emptyForm).some((k) => k !== 'id' && form[k].trim() !== ''),
    onClose: () => setModalOpen(false)
  });

  async function save() {
    if (!form.nombre.trim()) { setError('El nombre es requerido.'); return; }
    const res = await window.api.proveedores.save(form);
    if (!res.ok) { setError(res.error); return; }
    setForm(emptyForm);
    setModalOpen(false);
    load();
  }

  async function toggle(id) { await window.api.proveedores.toggle({ id }); load(); }
  async function del(id) {
    if (!(await confirmar('¿Eliminar este proveedor?'))) return;
    const res = await window.api.proveedores.delete({ id });
    if (!res.ok) await avisar(res.error);
    load();
  }

  return (
    <div>
      <div className="toolbar">
        <h2 style={{ flex: 1 }}>Proveedores</h2>
        <button data-tour="prov-nuevo" className="btn btn-primary" onClick={openNew}>+ Nuevo Proveedor</button>
      </div>

      <div className="card" style={{ padding: 0 }} data-tour="prov-tabla">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Nombre</th><th>Contacto</th><th>Teléfono</th><th>Email</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              {data.length === 0 && <tr><td colSpan="6" style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>Sin proveedores registrados.</td></tr>}
              {data.map((p) => (
                <tr key={p.id} style={!p.activo ? { opacity: 0.5 } : {}}>
                  <td style={{ fontWeight: 600 }}>{p.nombre}</td>
                  <td>{p.contacto || '—'}</td>
                  <td>{p.telefono || '—'}</td>
                  <td>{p.email || '—'}</td>
                  <td>{p.activo ? <span className="badge-pill badge-ok">Activo</span> : <span className="badge-pill badge-danger">Inactivo</span>}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-xs" onClick={() => openEdit(p)}>Editar</button>
                      <button className="btn btn-secondary btn-xs" onClick={() => toggle(p.id)}>{p.activo ? 'Ocultar' : 'Activar'}</button>
                      <button className="btn btn-danger btn-xs" onClick={() => del(p.id)}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} confirmarCierre={cerrarModal} title={form.id ? 'Editar Proveedor' : 'Nuevo Proveedor'}
        footer={<>
          <button className="btn btn-secondary" onClick={cerrarModal}>Cancelar</button>
          <button className="btn btn-primary" onClick={save}>Guardar</button>
        </>}>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="form-group"><label>Nombre / Razón Social *</label><input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></div>
        <div className="form-group"><label>Persona de Contacto</label><input value={form.contacto} onChange={(e) => setForm({ ...form, contacto: e.target.value })} /></div>
        <div className="form-grid">
          <div className="form-group"><label>Teléfono</label><input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></div>
          <div className="form-group"><label>Email</label><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        </div>
        <div className="form-group"><label>Notas</label><textarea rows={2} value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} /></div>
      </Modal>
    </div>
  );
}
