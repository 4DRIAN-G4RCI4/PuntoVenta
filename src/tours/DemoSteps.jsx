import React, { useState } from 'react';
import { money } from '../format.js';

// ── Producto (rol: almacén) ─────────────────────────────────────
export function CrearProductoDemo({ stepData, setStepData }) {
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState('');
  const creado = stepData.productoDemoId;

  async function crear() {
    setCreando(true); setError('');
    const res = await window.api.productos.save({
      nombre: 'Producto de Demostración (Tutorial)',
      departamento: 'tenis',
      marca: 'Tutorial',
      costo_unitario: 100,
      precio_publico: 199,
      presentaciones: [{ presentacion: 'Única', stock: 5 }]
    });
    setCreando(false);
    if (!res.ok) { setError(res.error); return; }
    setStepData((d) => ({ ...d, productoDemoId: res.id, productoDemoSku: res.sku }));
  }

  return (
    <div>
      {!creado && <button className="btn btn-primary btn-sm" onClick={crear} disabled={creando}>{creando ? 'Creando...' : 'Crear producto de prueba'}</button>}
      {creado && (
        <div className="card" style={{ margin: 0, padding: 10, background: 'var(--surface2)' }}>
          <div style={{ fontWeight: 700 }}>✓ Producto creado</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>SKU: {stepData.productoDemoSku} · Costo: {money(100)} · Precio: {money(199)}</div>
        </div>
      )}
      {error && <div className="alert alert-error" style={{ marginTop: 8 }}>{error}</div>}
    </div>
  );
}

export function EliminarProductoDemo({ stepData, setStepData }) {
  const [eliminando, setEliminando] = useState(false);
  const [listo, setListo] = useState(!stepData.productoDemoId);

  async function eliminar() {
    setEliminando(true);
    await window.api.productos.delete({ id: stepData.productoDemoId });
    setEliminando(false);
    setListo(true);
    setStepData((d) => ({ ...d, productoDemoId: null }));
  }

  return (
    <div>
      {!listo && <button className="btn btn-danger btn-sm" onClick={eliminar} disabled={eliminando}>{eliminando ? 'Eliminando...' : 'Eliminar producto de prueba'}</button>}
      {listo && <div className="alert alert-success">Producto de prueba eliminado — era solo una demostración.</div>}
    </div>
  );
}

// ── Usuario (rol: admin) ─────────────────────────────────────────
export function CrearUsuarioDemo({ stepData, setStepData }) {
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState('');
  const creado = stepData.usuarioDemoId;

  async function crear() {
    setCreando(true); setError('');
    const correo = `demo.tutorial.${Date.now()}@tienda.local`;
    const res = await window.api.usuarios.save({
      nombre: 'Usuario de Demostración',
      email: correo,
      password: 'Demo12345',
      rol: 'vendedor',
      activo: 1
    });
    setCreando(false);
    if (!res.ok) { setError(res.error); return; }
    const lista = await window.api.usuarios.list();
    const u = lista.find((x) => x.email === correo);
    setStepData((d) => ({ ...d, usuarioDemoId: u?.id, usuarioDemoEmail: correo }));
  }

  return (
    <div>
      {!creado && <button className="btn btn-primary btn-sm" onClick={crear} disabled={creando}>{creando ? 'Creando...' : 'Crear usuario de prueba'}</button>}
      {creado && (
        <div className="card" style={{ margin: 0, padding: 10, background: 'var(--surface2)' }}>
          <div style={{ fontWeight: 700 }}>✓ Usuario creado</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{stepData.usuarioDemoEmail} · Rol: vendedor</div>
        </div>
      )}
      {error && <div className="alert alert-error" style={{ marginTop: 8 }}>{error}</div>}
    </div>
  );
}

export function EliminarUsuarioDemo({ stepData, setStepData }) {
  const [eliminando, setEliminando] = useState(false);
  const [listo, setListo] = useState(!stepData.usuarioDemoId);

  async function eliminar() {
    setEliminando(true);
    await window.api.usuarios.delete({ id: stepData.usuarioDemoId });
    setEliminando(false);
    setListo(true);
    setStepData((d) => ({ ...d, usuarioDemoId: null }));
  }

  return (
    <div>
      {!listo && <button className="btn btn-danger btn-sm" onClick={eliminar} disabled={eliminando}>{eliminando ? 'Eliminando...' : 'Eliminar usuario de prueba'}</button>}
      {listo && <div className="alert alert-success">Usuario de prueba eliminado — era solo una demostración.</div>}
    </div>
  );
}

// ── Cliente (rol: vendedor) ───────────────────────────────────────
export function CrearClienteDemo({ stepData, setStepData }) {
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState('');
  const creado = stepData.clienteDemoId;

  async function crear() {
    setCreando(true); setError('');
    const res = await window.api.clientes.crearRapido({ nombre: 'Cliente', apellido: 'De Prueba (Tutorial)', telefono: '5500000000', limite_credito: 1000 });
    setCreando(false);
    if (!res.ok) { setError(res.error); return; }
    setStepData((d) => ({ ...d, clienteDemoId: res.id }));
  }

  return (
    <div>
      {!creado && <button className="btn btn-primary btn-sm" onClick={crear} disabled={creando}>{creando ? 'Creando...' : 'Crear cliente de prueba'}</button>}
      {creado && (
        <div className="card" style={{ margin: 0, padding: 10, background: 'var(--surface2)' }}>
          <div style={{ fontWeight: 700 }}>✓ Cliente creado</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Cliente De Prueba (Tutorial) · Límite de crédito: {money(1000)}</div>
        </div>
      )}
      {error && <div className="alert alert-error" style={{ marginTop: 8 }}>{error}</div>}
    </div>
  );
}

export function EliminarClienteDemo({ stepData, setStepData }) {
  const [eliminando, setEliminando] = useState(false);
  const [listo, setListo] = useState(!stepData.clienteDemoId);

  async function eliminar() {
    setEliminando(true);
    await window.api.clientes.delete({ id: stepData.clienteDemoId });
    setEliminando(false);
    setListo(true);
    setStepData((d) => ({ ...d, clienteDemoId: null }));
  }

  return (
    <div>
      {!listo && <button className="btn btn-danger btn-sm" onClick={eliminar} disabled={eliminando}>{eliminando ? 'Eliminando...' : 'Eliminar cliente de prueba'}</button>}
      {listo && <div className="alert alert-success">Cliente de prueba eliminado — era solo una demostración.</div>}
    </div>
  );
}

// ── Categoría (roles: admin, almacén) ─────────────────────────────
export function CrearCategoriaDemo({ stepData, setStepData }) {
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState('');
  const creado = stepData.categoriaDemoId;

  async function crear() {
    setCreando(true); setError('');
    const res = await window.api.categorias.save({ nombre: 'Categoría de Demostración (Tutorial)', descripcion: 'Creada por el tutorial, se eliminará al terminar.' });
    setCreando(false);
    if (!res.ok) { setError(res.error); return; }
    const listado = await window.api.categorias.listAll();
    const c = listado.principales.find((x) => x.nombre === 'Categoría de Demostración (Tutorial)');
    setStepData((d) => ({ ...d, categoriaDemoId: c?.id }));
  }

  return (
    <div>
      {!creado && <button className="btn btn-primary btn-sm" onClick={crear} disabled={creando}>{creando ? 'Creando...' : 'Crear categoría de prueba'}</button>}
      {creado && (
        <div className="card" style={{ margin: 0, padding: 10, background: 'var(--surface2)' }}>
          <div style={{ fontWeight: 700 }}>✓ Categoría creada</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Categoría de Demostración (Tutorial)</div>
        </div>
      )}
      {error && <div className="alert alert-error" style={{ marginTop: 8 }}>{error}</div>}
    </div>
  );
}

export function EliminarCategoriaDemo({ stepData, setStepData }) {
  const [eliminando, setEliminando] = useState(false);
  const [listo, setListo] = useState(!stepData.categoriaDemoId);

  async function eliminar() {
    setEliminando(true);
    await window.api.categorias.delete({ id: stepData.categoriaDemoId });
    setEliminando(false);
    setListo(true);
    setStepData((d) => ({ ...d, categoriaDemoId: null }));
  }

  return (
    <div>
      {!listo && <button className="btn btn-danger btn-sm" onClick={eliminar} disabled={eliminando}>{eliminando ? 'Eliminando...' : 'Eliminar categoría de prueba'}</button>}
      {listo && <div className="alert alert-success">Categoría de prueba eliminada — era solo una demostración.</div>}
    </div>
  );
}

// ── Promoción (rol: admin) ─────────────────────────────────────────
export function CrearPromocionDemo({ stepData, setStepData }) {
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState('');
  const creado = stepData.promocionDemoId;

  async function crear() {
    setCreando(true); setError('');
    const res = await window.api.promociones.save({
      nombre: 'Promoción de Demostración (Tutorial)',
      tipo: 'porcentaje',
      valor: 10,
      departamento: 'todos',
      activo: 1
    });
    setCreando(false);
    if (!res.ok) { setError(res.error); return; }
    const lista = await window.api.promociones.list();
    const p = lista.find((x) => x.nombre === 'Promoción de Demostración (Tutorial)');
    setStepData((d) => ({ ...d, promocionDemoId: p?.id }));
  }

  return (
    <div>
      {!creado && <button className="btn btn-primary btn-sm" onClick={crear} disabled={creando}>{creando ? 'Creando...' : 'Crear promoción de prueba'}</button>}
      {creado && (
        <div className="card" style={{ margin: 0, padding: 10, background: 'var(--surface2)' }}>
          <div style={{ fontWeight: 700 }}>✓ Promoción creada</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>10% de descuento, aplicable a todos los departamentos</div>
        </div>
      )}
      {error && <div className="alert alert-error" style={{ marginTop: 8 }}>{error}</div>}
    </div>
  );
}

export function EliminarPromocionDemo({ stepData, setStepData }) {
  const [eliminando, setEliminando] = useState(false);
  const [listo, setListo] = useState(!stepData.promocionDemoId);

  async function eliminar() {
    setEliminando(true);
    await window.api.promociones.delete({ id: stepData.promocionDemoId });
    setEliminando(false);
    setListo(true);
    setStepData((d) => ({ ...d, promocionDemoId: null }));
  }

  return (
    <div>
      {!listo && <button className="btn btn-danger btn-sm" onClick={eliminar} disabled={eliminando}>{eliminando ? 'Eliminando...' : 'Eliminar promoción de prueba'}</button>}
      {listo && <div className="alert alert-success">Promoción de prueba eliminada — era solo una demostración.</div>}
    </div>
  );
}
