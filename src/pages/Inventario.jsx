import React, { useEffect, useState } from 'react';
import Modal from '../components/Modal.jsx';
import { money } from '../format.js';

function diasParaCaducar(fechaIso) {
  if (!fechaIso) return null;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const fin = new Date(fechaIso + 'T00:00:00');
  return Math.round((fin - hoy) / 86400000);
}

function colorCaducidad(fechaIso) {
  const dias = diasParaCaducar(fechaIso);
  if (dias === null) return 'var(--border)';
  if (dias < 0) return 'var(--red)';
  if (dias <= 30) return '#e8890c';
  return 'var(--green)';
}

export default function Inventario() {
  const [dept, setDept] = useState('');
  const [depts, setDepts] = useState([]);
  const [q, setQ] = useState('');
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [presentacionesModal, setPresentacionesModal] = useState(null);
  const [presentaciones, setPresentaciones] = useState([]);
  const [newPresentacion, setNewPresentacion] = useState({ presentacion: '', stock: 0 });
  const [lotesModal, setLotesModal] = useState(null);
  const [lotes, setLotes] = useState([]);
  const [newLote, setNewLote] = useState({ numero_lote: '', fecha_caducidad: '', cantidad: '' });
  const [error, setError] = useState('');
  const [erroresCampo, setErroresCampo] = useState({});
  const emptyForm = {
    id: 0, nombre: '', descripcion: '', categoria_id: '', departamento: '', marca: '', modelo: '', color: '', material: '', codigo_barras: '',
    costo_unitario: '', precio_publico: '', iva: 16,
    principio_activo: '', laboratorio: '', forma_farmaceutica: '', registro_sanitario: '',
    requiere_receta: false, sustancia_controlada: false, maneja_lotes: false,
    presentaciones: [{ presentacion: '', stock: 0 }]
  };
  const [form, setForm] = useState(emptyForm);

  async function load() {
    const [prods, cats, dp] = await Promise.all([
      window.api.productos.list({ departamento: dept || undefined, q }),
      window.api.categorias.listAll(),
      window.api.productos.departamentos()
    ]);
    setProductos(prods);
    setCategorias(cats.principales.concat(cats.subcategorias));
    setDepts(dp);
  }
  useEffect(() => { load(); }, [dept]);

  function openNew() { setForm({ ...emptyForm, departamento: dept, presentaciones: [{ presentacion: '', stock: 0 }] }); setError(''); setErroresCampo({}); setModalOpen(true); }
  function openEdit(p) {
    setForm({
      id: p.id, nombre: p.nombre, descripcion: p.descripcion || '', categoria_id: p.categoria_id || '', departamento: p.departamento || '',
      marca: p.marca || '', modelo: p.modelo || '', color: p.color || '', material: p.material || '', codigo_barras: p.codigo_barras || '',
      costo_unitario: p.costo_unitario, precio_publico: p.precio_publico, iva: p.iva ?? 16,
      principio_activo: p.principio_activo || '', laboratorio: p.laboratorio || '', forma_farmaceutica: p.forma_farmaceutica || '', registro_sanitario: p.registro_sanitario || '',
      requiere_receta: !!p.requiere_receta, sustancia_controlada: !!p.sustancia_controlada, maneja_lotes: !!p.maneja_lotes,
      presentaciones: []
    });
    setError('');
    setErroresCampo({});
    setModalOpen(true);
  }

  function addPresentacionRow() { setForm({ ...form, presentaciones: [...form.presentaciones, { presentacion: '', stock: 0 }] }); }
  function updatePresentacionRow(i, field, val) {
    const t = [...form.presentaciones]; t[i][field] = val; setForm({ ...form, presentaciones: t });
  }
  function removePresentacionRow(i) { setForm({ ...form, presentaciones: form.presentaciones.filter((_, idx) => idx !== i) }); }

  function validarForm() {
    const errores = {};
    if (!form.nombre.trim()) errores.nombre = 'El nombre del producto es requerido.';
    if (!form.costo_unitario) errores.costo_unitario = 'El costo unitario es requerido.';
    if (!form.precio_publico) errores.precio_publico = 'El precio al público es requerido.';
    return errores;
  }

  async function save() {
    const errores = validarForm();
    if (Object.keys(errores).length) { setErroresCampo(errores); setError(''); return; }
    setErroresCampo({});
    const payload = { ...form, departamento: form.departamento || dept, categoria_id: form.categoria_id ? Number(form.categoria_id) : null, costo_unitario: Number(form.costo_unitario), precio_publico: Number(form.precio_publico) };
    const res = await window.api.productos.save(payload);
    if (!res.ok) { setError(res.error); return; }
    setModalOpen(false);
    load();
  }

  async function del(p) {
    if (!confirm(`¿Eliminar "${p.nombre}"?`)) return;
    await window.api.productos.delete({ id: p.id });
    load();
  }

  async function verPresentaciones(p) {
    setPresentacionesModal(p);
    setPresentaciones(await window.api.productos.presentaciones({ producto_id: p.id }));
  }
  async function updateStock(id, stock) {
    await window.api.productos.updateStock({ presentacion_id: id, stock: Number(stock) });
    setPresentaciones(await window.api.productos.presentaciones({ producto_id: presentacionesModal.id }));
    load();
  }
  async function addPresentacion() {
    if (!newPresentacion.presentacion.trim()) return;
    await window.api.productos.addPresentacion({ producto_id: presentacionesModal.id, presentacion: newPresentacion.presentacion, stock: Number(newPresentacion.stock) || 0 });
    setNewPresentacion({ presentacion: '', stock: 0 });
    setPresentaciones(await window.api.productos.presentaciones({ producto_id: presentacionesModal.id }));
    load();
  }

  async function verLotes(presentacion) {
    setLotesModal(presentacion);
    setLotes(await window.api.lotes.list({ presentacion_id: presentacion.id }));
  }
  async function addLote() {
    if (!newLote.cantidad || Number(newLote.cantidad) <= 0) return;
    const res = await window.api.lotes.add({
      presentacion_id: lotesModal.id, numero_lote: newLote.numero_lote, fecha_caducidad: newLote.fecha_caducidad || null, cantidad: Number(newLote.cantidad)
    });
    if (!res.ok) { alert(res.error); return; }
    setNewLote({ numero_lote: '', fecha_caducidad: '', cantidad: '' });
    setLotes(await window.api.lotes.list({ presentacion_id: lotesModal.id }));
    setPresentaciones(await window.api.productos.presentaciones({ producto_id: presentacionesModal.id }));
    load();
  }
  async function delLote(id) {
    if (!confirm('¿Dar de baja este lote? (ej. se caducó o se dañó — descuenta su stock)')) return;
    await window.api.lotes.delete({ id });
    setLotes(await window.api.lotes.list({ presentacion_id: lotesModal.id }));
    setPresentaciones(await window.api.productos.presentaciones({ producto_id: presentacionesModal.id }));
    load();
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        <button className={'btn ' + (dept === '' ? 'btn-primary' : 'btn-secondary')} onClick={() => setDept('')}>Todos</button>
        {depts.map((d) => (
          <button key={d} className={'btn ' + (dept === d ? 'btn-primary' : 'btn-secondary')} onClick={() => setDept(d)} style={{ textTransform: 'capitalize' }}>{d}</button>
        ))}
      </div>

      <div className="toolbar">
        <div className="search-bar">
          <input placeholder="Buscar por nombre, SKU, código..." value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
        </div>
        <button className="btn btn-secondary" onClick={load}>Filtrar</button>
        <div style={{ flex: 1 }} />
        <button data-tour="inv-nuevo" className="btn btn-primary" onClick={openNew}>+ Nuevo Producto</button>
      </div>

      <div className="card" style={{ padding: 0 }} data-tour="inv-tabla">
        <div className="table-wrap">
          <table>
            <thead><tr><th>SKU</th><th>Nombre</th><th>Categoría</th><th>Color</th><th>Presentaciones/Stock</th><th>Costo</th><th>Precio</th><th>Utilidad</th><th>Acciones</th></tr></thead>
            <tbody>
              {productos.length === 0 && <tr><td colSpan="9" style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>Sin productos.</td></tr>}
              {productos.map((p) => {
                const utilidad = p.precio_publico - p.costo_unitario;
                const margen = p.precio_publico > 0 ? Math.round((utilidad / p.precio_publico) * 100) : 0;
                return (
                  <tr key={p.id}>
                    <td><code style={{ color: 'var(--accent)' }}>{p.sku}</code></td>
                    <td>
                      {p.nombre}
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.marca} {p.modelo}</div>
                      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                        {!!p.requiere_receta && <span className="badge-pill badge-danger">Receta</span>}
                        {!!p.sustancia_controlada && <span className="badge-pill badge-danger">Controlado</span>}
                        {!!p.maneja_lotes && <span className="badge-pill">Lotes</span>}
                      </div>
                    </td>
                    <td>{p.cat_nombre ? <span className="badge-pill">{p.cat_nombre}</span> : '—'}</td>
                    <td>{p.color || '—'}</td>
                    <td><button className="btn btn-secondary btn-xs" onClick={() => verPresentaciones(p)}>{p.num_presentaciones} pres. ({p.stock_total} u)</button></td>
                    <td>{money(p.costo_unitario)}</td>
                    <td style={{ fontWeight: 600 }}>{money(p.precio_publico)}</td>
                    <td style={{ color: utilidad > 0 ? 'var(--green)' : 'var(--red)' }}>{money(utilidad)} ({margen}%)</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-xs" onClick={() => openEdit(p)}>Editar</button>
                        <button className="btn btn-danger btn-xs" onClick={() => del(p)}>Eliminar</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} maxWidth={720} title={form.id ? 'Editar Producto' : 'Nuevo Producto'}
        footer={<>
          <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
          <button className="btn btn-primary" onClick={save}>Guardar</button>
        </>}>
        {!!error && <div className="alert alert-error">{error}</div>}
        <div className="form-grid">
          <div className="form-group span-full">
            <label>Nombre del Producto *</label>
            <input
              value={form.nombre}
              onChange={(e) => { setForm({ ...form, nombre: e.target.value }); if (erroresCampo.nombre) setErroresCampo({ ...erroresCampo, nombre: undefined }); }}
              style={erroresCampo.nombre ? { borderColor: 'var(--red)' } : undefined}
            />
            {erroresCampo.nombre && <div style={{ color: 'var(--red)', fontSize: 11, marginTop: 4 }}>{erroresCampo.nombre}</div>}
          </div>
          <div className="form-group">
            <label>Categoría</label>
            <select value={form.categoria_id} onChange={(e) => setForm({ ...form, categoria_id: e.target.value })}>
              <option value="">Sin categoría</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Departamento</label><input value={form.departamento} onChange={(e) => setForm({ ...form, departamento: e.target.value })} placeholder="Ej. Medicamentos, Ropa..." /></div>
          <div className="form-group"><label>Marca</label><input value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} /></div>
          <div className="form-group"><label>Modelo</label><input value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} /></div>
          <div className="form-group"><label>Color</label><input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></div>
          <div className="form-group"><label>Material</label><input value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value })} /></div>
          <div className="form-group"><label>Código de barras</label><input value={form.codigo_barras} onChange={(e) => setForm({ ...form, codigo_barras: e.target.value })} /></div>
          <div className="form-group">
            <label>Costo Unitario ($) *</label>
            <input
              type="number" step="0.01" value={form.costo_unitario}
              onChange={(e) => { setForm({ ...form, costo_unitario: e.target.value }); if (erroresCampo.costo_unitario) setErroresCampo({ ...erroresCampo, costo_unitario: undefined }); }}
              style={erroresCampo.costo_unitario ? { borderColor: 'var(--red)' } : undefined}
            />
            {erroresCampo.costo_unitario && <div style={{ color: 'var(--red)', fontSize: 11, marginTop: 4 }}>{erroresCampo.costo_unitario}</div>}
          </div>
          <div className="form-group">
            <label>Precio al Público ($) *</label>
            <input
              type="number" step="0.01" value={form.precio_publico}
              onChange={(e) => { setForm({ ...form, precio_publico: e.target.value }); if (erroresCampo.precio_publico) setErroresCampo({ ...erroresCampo, precio_publico: undefined }); }}
              style={erroresCampo.precio_publico ? { borderColor: 'var(--red)' } : undefined}
            />
            {erroresCampo.precio_publico && <div style={{ color: 'var(--red)', fontSize: 11, marginTop: 4 }}>{erroresCampo.precio_publico}</div>}
          </div>
          <div className="form-group">
            <label>IVA</label>
            <select value={form.iva} onChange={(e) => setForm({ ...form, iva: Number(e.target.value) })}>
              <option value={16}>16% (gravado)</option>
              <option value={0}>0% (exento — ej. medicamentos)</option>
            </select>
          </div>
          <div className="form-group span-full"><label>Descripción</label><textarea rows={2} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} /></div>
        </div>

        <div style={{ marginTop: 6, marginBottom: 16 }} data-tour="inv-datos-regulados">
          <div className="card-title" style={{ fontSize: 13 }}>Datos regulados (medicamentos y similares — opcional)</div>
          <div className="form-grid">
            <div className="form-group"><label>Principio activo</label><input value={form.principio_activo} onChange={(e) => setForm({ ...form, principio_activo: e.target.value })} placeholder="Ej. Paracetamol" /></div>
            <div className="form-group"><label>Laboratorio</label><input value={form.laboratorio} onChange={(e) => setForm({ ...form, laboratorio: e.target.value })} /></div>
            <div className="form-group"><label>Forma farmacéutica</label><input value={form.forma_farmaceutica} onChange={(e) => setForm({ ...form, forma_farmaceutica: e.target.value })} placeholder="Tableta, jarabe, cápsula..." /></div>
            <div className="form-group"><label>Registro sanitario (COFEPRIS)</label><input value={form.registro_sanitario} onChange={(e) => setForm({ ...form, registro_sanitario: e.target.value })} /></div>
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 8 }} data-tour="inv-checks-farmacia">
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, textTransform: 'none', fontSize: 12, fontWeight: 400, cursor: 'pointer' }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={form.requiere_receta} onChange={(e) => setForm({ ...form, requiere_receta: e.target.checked })} />
              Requiere receta médica
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, textTransform: 'none', fontSize: 12, fontWeight: 400, cursor: 'pointer' }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={form.sustancia_controlada} onChange={(e) => setForm({ ...form, sustancia_controlada: e.target.checked })} />
              Sustancia controlada
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, textTransform: 'none', fontSize: 12, fontWeight: 400, cursor: 'pointer' }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={form.maneja_lotes} onChange={(e) => setForm({ ...form, maneja_lotes: e.target.checked })} />
              Maneja lotes y caducidad
            </label>
          </div>
        </div>

        {!form.id && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <label style={{ margin: 0 }}>Presentaciones y Stock Inicial</label>
              <button type="button" className="btn btn-secondary btn-xs" onClick={addPresentacionRow}>+ Agregar</button>
            </div>
            {form.presentaciones.map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input placeholder="Ej. 500mg, Caja c/20, Presentacion 26..." value={t.presentacion} onChange={(e) => updatePresentacionRow(i, 'presentacion', e.target.value)} />
                {!form.maneja_lotes && (
                  <input type="number" placeholder="Stock" style={{ width: 100 }} value={t.stock} onChange={(e) => updatePresentacionRow(i, 'stock', Number(e.target.value))} />
                )}
                <button type="button" className="btn btn-danger btn-xs" onClick={() => removePresentacionRow(i)}>✕</button>
              </div>
            ))}
            {form.maneja_lotes && (
              <p style={{ color: 'var(--muted)', fontSize: 11, marginTop: 4 }}>
                Este producto maneja lotes: el stock siempre entra por lote (con su caducidad), nunca como número suelto. Guarda el producto y usa "Ver lotes" en cada presentación para capturarlo.
              </p>
            )}
          </div>
        )}
      </Modal>

      <Modal open={!!presentacionesModal} onClose={() => setPresentacionesModal(null)} title={presentacionesModal ? `${presentacionesModal.nombre} — Presentaciones` : ''}>
        <table style={{ width: '100%', marginBottom: 16 }}>
          <thead><tr><th>Presentación</th><th>Stock</th>{!!presentacionesModal?.maneja_lotes && <th>Lotes</th>}</tr></thead>
          <tbody>
            {presentaciones.map((t) => (
              <tr key={t.id}>
                <td><strong>{t.presentacion}</strong></td>
                <td>
                  {presentacionesModal?.maneja_lotes
                    ? <span title="El stock de productos con lotes se edita desde 'Ver lotes', no aquí.">{t.stock}</span>
                    : <input type="number" style={{ width: 90 }} defaultValue={t.stock} onBlur={(e) => updateStock(t.id, e.target.value)} />}
                </td>
                {!!presentacionesModal?.maneja_lotes && (
                  <td><button className="btn btn-secondary btn-xs" onClick={() => verLotes(t)}>Ver lotes</button></td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: 'flex', gap: 8 }}>
          <input placeholder="Nueva presentación" value={newPresentacion.presentacion} onChange={(e) => setNewPresentacion({ ...newPresentacion, presentacion: e.target.value })} />
          {!presentacionesModal?.maneja_lotes && (
            <input type="number" placeholder="Stock" style={{ width: 100 }} value={newPresentacion.stock} onChange={(e) => setNewPresentacion({ ...newPresentacion, stock: e.target.value })} />
          )}
          <button className="btn btn-primary" onClick={addPresentacion}>+ Agregar</button>
        </div>
        {presentacionesModal?.maneja_lotes && (
          <p style={{ color: 'var(--muted)', fontSize: 11, marginTop: 8 }}>
            Este producto maneja lotes — la presentación se crea sin stock; agrégaselo desde "Ver lotes" con su caducidad.
          </p>
        )}
      </Modal>

      <Modal open={!!lotesModal} onClose={() => setLotesModal(null)} title={lotesModal ? `Lotes — ${lotesModal.presentacion}` : ''}>
        <p style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 12 }}>
          Al vender, el sistema descuenta primero el lote que caduca antes (FEFO). Un lote caducado no se vende — bájalo aquí.
        </p>
        <table style={{ width: '100%', marginBottom: 16 }}>
          <thead><tr><th>Lote</th><th>Caducidad</th><th>Cantidad</th><th></th></tr></thead>
          <tbody>
            {lotes.length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center', color: 'var(--muted)', padding: 14 }}>Sin lotes registrados.</td></tr>}
            {lotes.map((l) => (
              <tr key={l.id}>
                <td>{l.numero_lote || '—'}</td>
                <td style={{ color: colorCaducidad(l.fecha_caducidad), fontWeight: 700 }}>
                  {l.fecha_caducidad || 'Sin caducidad'}
                  {l.fecha_caducidad && diasParaCaducar(l.fecha_caducidad) < 0 && ' (caducado)'}
                </td>
                <td>{l.cantidad}</td>
                <td><button className="btn btn-danger btn-xs" onClick={() => delLote(l.id)}>Dar de baja</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input placeholder="Número de lote" value={newLote.numero_lote} onChange={(e) => setNewLote({ ...newLote, numero_lote: e.target.value })} style={{ flex: 1, minWidth: 120 }} />
          <input type="date" value={newLote.fecha_caducidad} onChange={(e) => setNewLote({ ...newLote, fecha_caducidad: e.target.value })} />
          <input type="number" placeholder="Cantidad" style={{ width: 100 }} value={newLote.cantidad} onChange={(e) => setNewLote({ ...newLote, cantidad: e.target.value })} />
          <button className="btn btn-primary" onClick={addLote}>+ Agregar Lote</button>
        </div>
      </Modal>
    </div>
  );
}
