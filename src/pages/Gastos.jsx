import React, { useEffect, useState } from 'react';
import Modal from '../components/Modal.jsx';
import { money } from '../format.js';
import { useAuth } from '../App.jsx';
import { useFormConfirm } from '../hooks/useFormConfirm.js';

const CATEGORIAS = { general: 'General', renta: 'Renta', servicios: 'Servicios', nomina: 'Nómina', proveedores: 'Proveedores', transporte: 'Transporte', mantenimiento: 'Mantenimiento', marketing: 'Marketing', otros: 'Otros' };
const emptyForm = { id: 0, concepto: '', monto: '', categoria: 'general', forma_pago: 'efectivo', fecha: new Date().toISOString().slice(0, 10), proveedor: '', notas: '' };

export default function Gastos() {
  const { user } = useAuth();
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));
  const [cat, setCat] = useState('');
  const [gastos, setGastos] = useState([]);
  const [totCat, setTotCat] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  async function load() {
    const res = await window.api.gastos.list({ mes, cat });
    setGastos(res.gastos); setTotCat(res.totCat);
  }
  useEffect(() => { load(); }, [mes, cat]);

  const totalMes = gastos.reduce((s, g) => s + g.monto, 0);

  const gastoTieneDatos = () => form.concepto.trim() !== '' || String(form.monto).trim() !== '' || form.proveedor.trim() !== '' || form.notas.trim() !== '';
  function openNew() {
    if (!form.id && gastoTieneDatos()) { setModalOpen(true); return; }
    setForm(emptyForm); setError(''); setModalOpen(true);
  }
  function openEdit(g) { setForm({ ...g, monto: g.monto }); setError(''); setModalOpen(true); }
  const cerrarModal = useFormConfirm({ esArticuloNuevo: !form.id, tieneDatos: gastoTieneDatos, onClose: () => setModalOpen(false) });

  async function save() {
    if (!form.concepto.trim() || !(Number(form.monto) > 0)) { setError('Concepto y monto son requeridos.'); return; }
    const res = await window.api.gastos.save({ ...form, monto: Number(form.monto), usuario_id: user.id });
    if (!res.ok) { setError(res.error); return; }
    setForm(emptyForm);
    setModalOpen(false);
    load();
  }
  async function del(id) { if (!confirm('¿Eliminar este gasto?')) return; await window.api.gastos.delete({ id }); load(); }

  return (
    <div>
      <div className="toolbar">
        <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} style={{ width: 'auto' }} />
        <select value={cat} onChange={(e) => setCat(e.target.value)} style={{ width: 'auto' }}>
          <option value="">Todas las categorías</option>
          {Object.entries(CATEGORIAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button data-tour="gastos-nuevo" className="btn btn-primary" onClick={openNew}>+ Nuevo Gasto</button>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-label">Total del Mes</div><div className="stat-value" style={{ color: 'var(--red)' }}>{money(totalMes)}</div><div className="stat-sub">{gastos.length} registros</div></div>
        <div className="stat-card"><div className="stat-label">Categorías activas</div><div className="stat-value">{totCat.length}</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 18, alignItems: 'start' }}>
        <div className="card" data-tour="gastos-tabla">
          <div className="card-title">Gastos <span className="badge">{gastos.length}</span></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Concepto</th><th>Categoría</th><th>Proveedor</th><th>Forma Pago</th><th>Fecha</th><th>Monto</th><th></th></tr></thead>
              <tbody>
                {gastos.length === 0 && <tr><td colSpan="7" style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>Sin gastos.</td></tr>}
                {gastos.map((g) => (
                  <tr key={g.id}>
                    <td style={{ fontWeight: 600 }}>{g.concepto}</td>
                    <td><span className="badge-pill">{CATEGORIAS[g.categoria] || g.categoria}</span></td>
                    <td style={{ color: 'var(--muted)' }}>{g.proveedor || '—'}</td>
                    <td style={{ textTransform: 'capitalize' }}>{g.forma_pago}</td>
                    <td style={{ color: 'var(--muted)' }}>{g.fecha}</td>
                    <td style={{ fontWeight: 700, color: 'var(--red)' }}>{money(g.monto)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-xs" onClick={() => openEdit(g)}>Editar</button>
                        {user.rol === 'admin' && <button className="btn btn-danger btn-xs" onClick={() => del(g.id)}>Eliminar</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Por Categoría</div>
          {totCat.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Sin datos.</p>}
          {totCat.map((tc, i) => {
            const pct = totalMes > 0 ? Math.round((tc.total / totalMes) * 100) : 0;
            return (
              <div key={i} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span>{CATEGORIAS[tc.categoria] || tc.categoria}</span><strong>{money(tc.total)}</strong></div>
                <div className="progress-bar"><div style={{ width: pct + '%' }} /></div>
              </div>
            );
          })}
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} confirmarCierre={cerrarModal} title={form.id ? 'Editar Gasto' : 'Nuevo Gasto'}
        footer={<><button className="btn btn-secondary" onClick={cerrarModal}>Cancelar</button><button className="btn btn-primary" onClick={save}>Guardar</button></>}>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="form-grid">
          <div className="form-group span-full"><label>Concepto *</label><input value={form.concepto} onChange={(e) => setForm({ ...form, concepto: e.target.value })} /></div>
          <div className="form-group"><label>Monto * ($)</label><input type="number" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} /></div>
          <div className="form-group"><label>Fecha</label><input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></div>
          <div className="form-group"><label>Categoría</label>
            <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
              {Object.entries(CATEGORIAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Forma de Pago</label>
            <select value={form.forma_pago} onChange={(e) => setForm({ ...form, forma_pago: e.target.value })}>
              <option value="efectivo">Efectivo</option><option value="tarjeta">Tarjeta</option><option value="transferencia">Transferencia</option>
            </select>
          </div>
          <div className="form-group span-full"><label>Proveedor / Empresa</label><input value={form.proveedor} onChange={(e) => setForm({ ...form, proveedor: e.target.value })} /></div>
          <div className="form-group span-full"><label>Notas</label><textarea rows={2} value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} /></div>
        </div>
      </Modal>
    </div>
  );
}
