import React, { useEffect, useState } from 'react';
import Modal from '../components/Modal.jsx';
import { useAuth } from '../App.jsx';
import { useFormConfirm } from '../hooks/useFormConfirm.js';
import { useConfirm } from '../components/ConfirmProvider.jsx';

const emptyForm = { id: 0, nombre: '', email: '', rol: 'vendedor', activo: 1, password: '' };

export default function Usuarios() {
  const { user } = useAuth();
  const { confirmar, avisar } = useConfirm();
  const [rows, setRows] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);

  async function load() { setRows(await window.api.usuarios.list()); }
  useEffect(() => { load(); }, []);

  function openNew() {
    if (!form.id && (form.nombre.trim() || form.email.trim() || form.password.trim())) { setModalOpen(true); return; }
    setForm(emptyForm); setError(''); setMostrarPassword(false); setModalOpen(true);
  }
  function openEdit(u) { setForm({ ...u, password: '' }); setError(''); setMostrarPassword(false); setModalOpen(true); }
  const cerrarModal = useFormConfirm({
    esArticuloNuevo: !form.id,
    tieneDatos: () => form.nombre.trim() !== '' || form.email.trim() !== '' || form.password.trim() !== '',
    onClose: () => setModalOpen(false)
  });

  async function save() {
    if (!form.nombre.trim() || !form.email.trim()) { setError('Nombre y correo son requeridos.'); return; }
    const res = await window.api.usuarios.save(form);
    if (!res.ok) { setError(res.error); return; }
    setForm(emptyForm);
    setModalOpen(false);
    load();
  }
  async function del(id) {
    if (!(await confirmar('¿Eliminar usuario?'))) return;
    const res = await window.api.usuarios.delete({ id, currentUserId: user.id });
    if (!res.ok) await avisar(res.error);
    load();
  }

  return (
    <div>
      <div className="toolbar">
        <h2 style={{ flex: 1 }}>Usuarios del Sistema</h2>
        <button data-tour="usr-nuevo" className="btn btn-primary" onClick={openNew}>+ Nuevo Usuario</button>
      </div>

      <div data-tour="usr-tabla" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 16 }}>
        {rows.map((u) => (
          <div className="card" key={u.id} style={{ opacity: u.activo ? 1 : 0.6 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{u.nombre}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>{u.email}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span className="badge-pill tag-role">{u.rol}</span>
              <span className={'badge-pill ' + (u.activo ? 'badge-ok' : 'badge-danger')}>{u.activo ? 'Activo' : 'Inactivo'}</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => openEdit(u)}>Editar</button>
              {u.id !== user.id && <button className="btn btn-danger btn-sm btn-icon" onClick={() => del(u.id)}>✕</button>}
            </div>
          </div>
        ))}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} confirmarCierre={cerrarModal} title={form.id ? 'Editar Usuario' : 'Nuevo Usuario'}
        footer={<><button className="btn btn-secondary" onClick={cerrarModal}>Cancelar</button><button className="btn btn-primary" onClick={save}>Guardar</button></>}>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="form-group"><label>Nombre Completo *</label><input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></div>
        <div className="form-group"><label>Correo Electrónico *</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div className="form-grid">
          <div className="form-group"><label>Rol</label>
            <select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
              <option value="vendedor">Vendedor</option><option value="almacen">Almacén</option><option value="admin">Administrador</option>
            </select>
          </div>
          <div className="form-group"><label>Estado</label>
            <select value={form.activo} onChange={(e) => setForm({ ...form, activo: Number(e.target.value) })}>
              <option value={1}>Activo</option><option value={0}>Inactivo</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label>Contraseña {form.id ? '(dejar vacío para no cambiar)' : '(requerida)'}</label>
          <input type={mostrarPassword ? 'text' : 'password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, textTransform: 'none', fontSize: 11, fontWeight: 400, cursor: 'pointer' }}>
            <input type="checkbox" checked={mostrarPassword} onChange={() => setMostrarPassword((v) => !v)} style={{ width: 'auto' }} />
            Mostrar contraseña
          </label>
        </div>
      </Modal>
    </div>
  );
}
