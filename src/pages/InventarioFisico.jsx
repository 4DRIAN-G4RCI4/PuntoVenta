import React, { useEffect, useState } from 'react';

export default function InventarioFisico() {
  const [rows, setRows] = useState([]);
  const [ajustes, setAjustes] = useState({});

  async function load() { setRows(await window.api.inventarioFisico.list()); }
  useEffect(() => { load(); }, []);

  function setFisico(id, val) { setAjustes({ ...ajustes, [id]: val }); }

  async function guardar(id) {
    const val = ajustes[id];
    if (val === undefined || val === '') return;
    await window.api.inventarioFisico.ajustar({ presentacion_id: id, stock_fisico: Number(val), motivo: 'Conteo físico' });
    const na = { ...ajustes }; delete na[id]; setAjustes(na);
    load();
  }

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Conteo Físico de Inventario</h2>
      <div className="card" style={{ padding: 0 }} data-tour="invfis-tabla">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Producto</th><th>SKU</th><th>Presentacion</th><th>Stock Sistema</th><th>Stock Físico (contado)</th><th>Diferencia</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const val = ajustes[r.presentacion_id];
                const diff = val !== undefined && val !== '' ? Number(val) - r.stock_sistema : null;
                return (
                  <tr key={r.presentacion_id}>
                    <td>{r.nombre}</td>
                    <td><code>{r.sku}</code></td>
                    <td>{r.presentacion}</td>
                    <td>{r.stock_sistema}</td>
                    <td><input type="number" style={{ width: 100 }} value={val ?? ''} onChange={(e) => setFisico(r.presentacion_id, e.target.value)} placeholder={String(r.stock_sistema)} /></td>
                    <td style={{ color: diff > 0 ? 'var(--green)' : diff < 0 ? 'var(--red)' : 'var(--muted)' }}>{diff !== null ? (diff > 0 ? '+' : '') + diff : '—'}</td>
                    <td><button className="btn btn-primary btn-xs" onClick={() => guardar(r.presentacion_id)} disabled={val === undefined || val === ''}>Aplicar</button></td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan="7" style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>Sin presentaciones registradas.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
