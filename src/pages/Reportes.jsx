import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../App.jsx';
import { money, dateFmt, todayISO, firstDayOfMonthISO } from '../format.js';
import { exportarCSV } from '../utils/csv.js';
import { exportarPDF } from '../utils/pdf.js';

const TITULOS = {
  financiero: 'Reporte Financiero',
  ventas: 'Reporte de Ventas',
  inventario: 'Reporte de Inventario',
  cortes: 'Reporte de Cortes de Caja',
  gastos: 'Reporte de Gastos',
  creditos: 'Reporte de Créditos',
  devoluciones: 'Reporte de Devoluciones',
  caducidades: 'Reporte de Caducidades',
};

const ESTADOS_VENTA = { pagada: 'Pagada', pendiente: 'Pendiente', credito: 'Crédito', a_meses: 'A Meses', devuelta: 'Devuelta', cancelada: 'Cancelada' };

const TABS = [
  { key: 'financiero', label: 'Financiero' },
  { key: 'ventas', label: 'Ventas' },
  { key: 'inventario', label: 'Inventario' },
  { key: 'cortes', label: 'Cortes de Caja' },
  { key: 'gastos', label: 'Gastos' },
  { key: 'creditos', label: 'Créditos' },
  { key: 'devoluciones', label: 'Devoluciones' },
  { key: 'caducidades', label: 'Caducidades' },
];

function enRango(fechaISO, fi, ff) {
  const d = (fechaISO || '').slice(0, 10);
  return d >= fi && d <= ff;
}

export default function Reportes() {
  const { negocio } = useAuth();
  const [fi, setFi] = useState(firstDayOfMonthISO());
  const [ff, setFf] = useState(todayISO());
  const [tab, setTab] = useState('financiero');
  const [loading, setLoading] = useState(true);
  const [exportandoPdf, setExportandoPdf] = useState(false);

  const [financiero, setFinanciero] = useState(null);
  const [ventas, setVentas] = useState([]);
  const [inventario, setInventario] = useState([]);
  const [cortes, setCortes] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [creditos, setCreditos] = useState(null);
  const [devoluciones, setDevoluciones] = useState([]);
  const [filtroDeptoMV, setFiltroDeptoMV] = useState('');
  const [filtroCategoriaMV, setFiltroCategoriaMV] = useState('');
  const [stockMinMV, setStockMinMV] = useState('');
  const [stockMaxMV, setStockMaxMV] = useState('');
  const [caducidades, setCaducidades] = useState({ caducados: [], porCaducar: [] });

  function setPeriodo(p) {
    const t = todayISO();
    if (p === 'hoy') { setFi(t); setFf(t); }
    else if (p === 'semana') { const d = new Date(); const day = d.getDay() || 7; d.setDate(d.getDate() - day + 1); setFi(d.toISOString().slice(0, 10)); setFf(t); }
    else if (p === 'mes') { setFi(firstDayOfMonthISO()); setFf(t); }
    else if (p === 'anio') { setFi(t.slice(0, 4) + '-01-01'); setFf(t); }
  }

  useEffect(() => { load(tab); }, [tab, fi, ff]);

  async function load(t) {
    setLoading(true);
    if (t === 'financiero') {
      const r = await window.api.reportes.generar({ fecha_inicio: fi, fecha_fin: ff });
      if (r.ok) setFinanciero(r);
    } else if (t === 'ventas') {
      const r = await window.api.historial.list({ fi, ff });
      if (Array.isArray(r)) setVentas(r);
    } else if (t === 'inventario') {
      const r = await window.api.inventarioFisico.list();
      if (Array.isArray(r)) setInventario(r);
    } else if (t === 'cortes') {
      const r = await window.api.corte.list({});
      if (Array.isArray(r)) setCortes(r.filter((c) => enRango(c.created_at, fi, ff)));
    } else if (t === 'gastos') {
      const r = await window.api.gastos.list({});
      if (r?.gastos) setGastos(r.gastos.filter((g) => enRango(g.fecha, fi, ff)));
    } else if (t === 'creditos') {
      const r = await window.api.credito.list({});
      if (r) setCreditos(r);
    } else if (t === 'devoluciones') {
      const r = await window.api.devoluciones.list({});
      if (Array.isArray(r)) setDevoluciones(r.filter((d) => enRango(d.created_at, fi, ff)));
    } else if (t === 'caducidades') {
      const r = await window.api.lotes.alertas();
      if (r) setCaducidades(r);
    }
    setLoading(false);
  }

  const menosVendidos = financiero?.menos_vendidos || [];
  const deptosMV = useMemo(() => [...new Set(menosVendidos.map((p) => p.departamento).filter(Boolean))].sort(), [menosVendidos]);
  const categoriasMV = useMemo(() => [...new Set(menosVendidos.map((p) => p.categoria).filter(Boolean))].sort(), [menosVendidos]);
  const menosVendidosFiltrados = useMemo(() => menosVendidos.filter((p) => {
    if (filtroDeptoMV && p.departamento !== filtroDeptoMV) return false;
    if (filtroCategoriaMV && p.categoria !== filtroCategoriaMV) return false;
    if (stockMinMV !== '' && p.stock_total < Number(stockMinMV)) return false;
    if (stockMaxMV !== '' && p.stock_total > Number(stockMaxMV)) return false;
    return true;
  }), [menosVendidos, filtroDeptoMV, filtroCategoriaMV, stockMinMV, stockMaxMV]);

  const inventarioResumen = useMemo(() => {
    const valorCosto = inventario.reduce((s, i) => s + (i.costo_unitario || 0) * (i.stock_sistema || 0), 0);
    const valorVenta = inventario.reduce((s, i) => s + (i.precio_publico || 0) * (i.stock_sistema || 0), 0);
    const unidades = inventario.reduce((s, i) => s + (i.stock_sistema || 0), 0);
    const bajoStock = inventario.filter((i) => i.stock_sistema > 0 && i.stock_sistema <= (i.stock_minimo || 3)).length;
    const sinStock = inventario.filter((i) => i.stock_sistema === 0).length;
    return { valorCosto, valorVenta, unidades, bajoStock, sinStock };
  }, [inventario]);

  const caducidadesRows = useMemo(() => [...caducidades.caducados, ...caducidades.porCaducar], [caducidades]);
  const gastosTotal = useMemo(() => gastos.reduce((s, g) => s + (g.monto || 0), 0), [gastos]);
  const cortesResumen = useMemo(() => {
    const omitidos = cortes.filter((c) => c.estado === 'omitido').length;
    const diferenciaTotal = cortes.filter((c) => c.estado === 'completado').reduce((s, c) => s + (c.diferencia || 0), 0);
    return { total: cortes.length, omitidos, diferenciaTotal };
  }, [cortes]);

  function getExportModel() {
    const rango = `Periodo: ${fi} a ${ff}`;
    if (tab === 'financiero' && financiero) {
      return {
        filename: `reporte-financiero-${fi}_a_${ff}`,
        subtitulo: rango,
        resumen: [
          { label: 'Ingresos', value: money(financiero.ventas_total.total) },
          { label: 'Costo de Ventas', value: money(financiero.costo_ventas) },
          { label: 'Utilidad Neta', value: money(financiero.utilidad_neta) },
        ],
        columnas: [{ label: 'Concepto', value: 'concepto' }, { label: 'Monto', value: (r) => money(r.monto) }],
        filas: [
          { concepto: 'Ingresos (ventas)', monto: financiero.ventas_total.total },
          { concepto: 'Costo de ventas', monto: financiero.costo_ventas },
          { concepto: 'Utilidad bruta', monto: financiero.utilidad_bruta },
          { concepto: 'Gastos', monto: financiero.gastos_total },
          { concepto: 'Utilidad neta', monto: financiero.utilidad_neta },
        ],
      };
    }
    if (tab === 'ventas') {
      return {
        filename: `reporte-ventas-${fi}_a_${ff}`,
        subtitulo: `${rango} · ${ventas.length} venta(s)`,
        resumen: [{ label: 'Ventas', value: ventas.length }, { label: 'Total', value: money(ventas.reduce((s, v) => s + v.total, 0)) }],
        columnas: [
          { label: 'Folio', value: 'folio' }, { label: 'Cliente', value: (v) => `${v.nombre || ''} ${v.apellido || ''}`.trim() || 'General' },
          { label: 'Forma de Pago', value: 'forma_pago' }, { label: 'Estado', value: (v) => ESTADOS_VENTA[v.estado] || v.estado },
          { label: 'Total', value: (v) => money(v.total) }, { label: 'Fecha', value: (v) => dateFmt(v.created_at) },
        ],
        filas: ventas,
      };
    }
    if (tab === 'inventario') {
      return {
        filename: 'reporte-inventario',
        subtitulo: `Corte al ${dateFmt(new Date().toISOString())}`,
        resumen: [
          { label: 'Unidades', value: inventarioResumen.unidades },
          { label: 'Valor a Costo', value: money(inventarioResumen.valorCosto) },
          { label: 'Valor a Venta', value: money(inventarioResumen.valorVenta) },
        ],
        columnas: [
          { label: 'SKU', value: 'sku' }, { label: 'Producto', value: 'nombre' }, { label: 'Presentacion', value: 'presentacion' },
          { label: 'Departamento', value: 'departamento' }, { label: 'Stock', value: 'stock_sistema' },
          { label: 'Costo Unit.', value: (i) => money(i.costo_unitario) }, { label: 'Precio Unit.', value: (i) => money(i.precio_publico) },
          { label: 'Valor Costo', value: (i) => money(i.costo_unitario * i.stock_sistema) },
          { label: 'Valor Venta', value: (i) => money(i.precio_publico * i.stock_sistema) },
        ],
        filas: inventario,
      };
    }
    if (tab === 'cortes') {
      return {
        filename: `reporte-cortes-${fi}_a_${ff}`,
        subtitulo: rango,
        resumen: [
          { label: 'Cortes', value: cortesResumen.total }, { label: 'Omitidos', value: cortesResumen.omitidos },
          { label: 'Diferencia Acumulada', value: money(cortesResumen.diferenciaTotal) },
        ],
        columnas: [
          { label: 'Usuario', value: 'usuario_nombre' }, { label: 'Estado', value: (c) => c.estado === 'omitido' ? 'Omitido' : 'Completado' },
          { label: 'Esperado', value: (c) => money((c.efectivo_esperado || 0) + (c.tarjeta_esperado || 0) + (c.transferencia_esperado || 0)) },
          { label: 'Contado', value: (c) => c.estado === 'omitido' ? '—' : money((c.efectivo_contado || 0) + (c.tarjeta_contado || 0) + (c.transferencia_contado || 0)) },
          { label: 'Diferencia', value: (c) => c.estado === 'omitido' ? '—' : money(c.diferencia) }, { label: 'Motivo Omisión', value: 'motivo_omision' },
          { label: 'Fecha', value: (c) => dateFmt(c.created_at) },
        ],
        filas: cortes,
      };
    }
    if (tab === 'gastos') {
      return {
        filename: `reporte-gastos-${fi}_a_${ff}`,
        subtitulo: rango,
        resumen: [{ label: 'Registros', value: gastos.length }, { label: 'Total', value: money(gastosTotal) }],
        columnas: [
          { label: 'Concepto', value: 'concepto' }, { label: 'Categoría', value: 'categoria' },
          { label: 'Monto', value: (g) => money(g.monto) }, { label: 'Forma de Pago', value: 'forma_pago' },
          { label: 'Proveedor', value: 'proveedor' }, { label: 'Registrado por', value: 'usuario_nombre' },
          { label: 'Fecha', value: (g) => dateFmt(g.fecha) },
        ],
        filas: gastos,
      };
    }
    if (tab === 'creditos' && creditos) {
      return {
        filename: 'reporte-creditos',
        subtitulo: 'Estado actual',
        resumen: [
          { label: 'Créditos Activos', value: creditos.resumen.num_creditos },
          { label: 'Deuda Total', value: money(creditos.resumen.total_deuda) },
          { label: 'Clientes con Deuda', value: creditos.resumen.clientes_con_deuda },
        ],
        columnas: [
          { label: 'Folio', value: 'folio' }, { label: 'Cliente', value: 'cliente_nombre' }, { label: 'Teléfono', value: 'telefono' },
          { label: 'Total', value: (c) => money(c.total) }, { label: 'Pagado', value: (c) => money(c.monto_pagado) }, { label: 'Saldo', value: (c) => money(c.saldo_pendiente) },
          { label: 'Fecha', value: (c) => dateFmt(c.created_at) },
        ],
        filas: creditos.rows || [],
      };
    }
    if (tab === 'devoluciones') {
      return {
        filename: `reporte-devoluciones-${fi}_a_${ff}`,
        subtitulo: `${rango} · ${devoluciones.length} devolución(es)`,
        resumen: [{ label: 'Devoluciones', value: devoluciones.length }, { label: 'Monto Total', value: money(devoluciones.reduce((s, d) => s + d.monto_total, 0)) }],
        columnas: [
          { label: 'Folio Venta', value: 'folio' }, { label: 'Cliente', value: 'cliente_nombre' },
          { label: 'Tipo', value: 'tipo_devolucion' }, { label: 'Monto', value: (d) => money(d.monto_total) },
          { label: 'Estado', value: 'estado' }, { label: 'Registrado por', value: 'usuario_nombre' },
          { label: 'Fecha', value: (d) => dateFmt(d.created_at) },
        ],
        filas: devoluciones,
      };
    }
    if (tab === 'caducidades') {
      return {
        filename: 'reporte-caducidades',
        subtitulo: `Corte al ${dateFmt(new Date().toISOString())}`,
        resumen: [
          { label: 'Caducados', value: caducidades.caducados.length },
          { label: 'Por Caducar (30 días)', value: caducidades.porCaducar.length },
        ],
        columnas: [
          { label: 'SKU', value: 'sku' }, { label: 'Producto', value: 'nombre' }, { label: 'Presentación', value: 'presentacion' },
          { label: 'Lote', value: (l) => l.numero_lote || '—' }, { label: 'Cantidad', value: 'cantidad' },
          { label: 'Caducidad', value: (l) => l.fecha_caducidad + (l.fecha_caducidad < todayISO() ? ' (CADUCADO)' : '') },
          { label: 'Departamento', value: 'departamento' },
        ],
        filas: caducidadesRows,
      };
    }
    return null;
  }

  function handleExportarCSV() {
    const m = getExportModel();
    if (!m) return;
    const columnasCSV = m.columnas.map((c) => ({ label: c.label, value: c.value }));
    exportarCSV(m.filename, columnasCSV, m.filas);
  }

  async function handleExportarPDF() {
    const m = getExportModel();
    if (!m) return;
    setExportandoPdf(true);
    const r = await exportarPDF({
      filename: m.filename, titulo: TITULOS[tab], subtitulo: m.subtitulo,
      resumen: m.resumen, columnas: m.columnas, filas: m.filas, negocio,
    });
    setExportandoPdf(false);
    if (!r.ok && r.error && !r.error.includes('cancelada')) alert(r.error);
  }

  return (
    <div>
      <div className="card">
        <div className="toolbar" style={{ marginBottom: 0 }}>
          {['hoy', 'semana', 'mes', 'anio'].map((p) => <button key={p} className="btn btn-secondary btn-sm" onClick={() => setPeriodo(p)} style={{ textTransform: 'capitalize' }}>{p}</button>)}
          <input type="date" value={fi} onChange={(e) => setFi(e.target.value)} style={{ width: 'auto' }} />
          <span style={{ color: 'var(--muted)' }}>—</span>
          <input type="date" value={ff} onChange={(e) => setFf(e.target.value)} style={{ width: 'auto' }} />
          <span style={{ marginLeft: 'auto', color: 'var(--muted)', fontSize: 12 }}>Exportar «{TITULOS[tab]}»:</span>
          <button data-tour="reportes-exportar" className="btn btn-secondary btn-sm" onClick={handleExportarCSV}>Exportar CSV</button>
          <button className="btn btn-primary btn-sm" onClick={handleExportarPDF} disabled={exportandoPdf}>
            {exportandoPdf ? 'Generando PDF...' : 'Exportar PDF'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }} data-tour="reportes-tabs">
        {TABS.map((t) => (
          <button key={t.key} className={'btn btn-sm ' + (tab === t.key ? 'btn-primary' : 'btn-ghost')} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {loading && <p style={{ color: 'var(--muted)' }}>Cargando reporte...</p>}

      {!loading && tab === 'financiero' && financiero && (
        <>
          <div className="stats-grid">
            <div className="stat-card"><div className="stat-label">Ingresos (Ventas)</div><div className="stat-value" style={{ color: 'var(--accent)' }}>{money(financiero.ventas_total.total)}</div><div className="stat-sub">{financiero.ventas_total.num} transacciones</div></div>
            <div className="stat-card"><div className="stat-label">Costo de Ventas</div><div className="stat-value" style={{ color: 'var(--red)' }}>{money(financiero.costo_ventas)}</div></div>
            <div className="stat-card"><div className="stat-label">Utilidad Bruta</div><div className="stat-value" style={{ color: 'var(--green)' }}>{money(financiero.utilidad_bruta)}</div></div>
            <div className="stat-card"><div className="stat-label">Utilidad Neta</div><div className="stat-value" style={{ color: financiero.utilidad_neta >= 0 ? 'var(--green)' : 'var(--red)' }}>{money(financiero.utilidad_neta)}</div><div className="stat-sub">Gastos: {money(financiero.gastos_total)}</div></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            <div className="card">
              <div className="card-title">Ventas por Departamento</div>
              {financiero.por_dept.length === 0 && <p style={{ color: 'var(--muted)' }}>Sin datos.</p>}
              {financiero.por_dept.map((d, i) => (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span style={{ textTransform: 'capitalize' }}>{d.departamento || 'Sin depto.'}</span><strong>{money(d.total)}</strong></div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{d.unidades} u. · Utilidad: {money(d.utilidad)}</div>
                </div>
              ))}
            </div>
            <div className="card">
              <div className="card-title">Top Productos</div>
              <table style={{ width: '100%' }}>
                <thead><tr><th>#</th><th>Producto</th><th>Uds</th><th>Utilidad</th></tr></thead>
                <tbody>
                  {financiero.top_prods.length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center', color: 'var(--muted)' }}>Sin datos</td></tr>}
                  {financiero.top_prods.map((p, i) => <tr key={i}><td>{i + 1}</td><td>{p.nombre}</td><td>{p.qty}</td><td style={{ color: 'var(--green)' }}>{money(p.utilidad)}</td></tr>)}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Clientes con Saldo Pendiente</div>
            <table style={{ width: '100%' }}>
              <thead><tr><th>Cliente</th><th>Teléfono</th><th>Saldo</th></tr></thead>
              <tbody>
                {financiero.clientes_deuda.length === 0 && <tr><td colSpan="3" style={{ textAlign: 'center', color: 'var(--muted)' }}>Sin clientes con deuda ✓</td></tr>}
                {financiero.clientes_deuda.map((c, i) => <tr key={i}><td>{c.nombre} {c.apellido}</td><td style={{ color: 'var(--muted)' }}>{c.telefono}</td><td style={{ color: 'var(--red)', fontWeight: 700 }}>{money(c.saldo_deuda)}</td></tr>)}
              </tbody>
            </table>
          </div>

          <div className="card">
            <div className="card-title">Productos Menos Vendidos</div>
            <p style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 14 }}>
              Incluye productos sin ninguna venta en el periodo elegido arriba. Filtra por departamento, categoría o cantidad de stock para encontrar qué te conviene promocionar, descontinuar o dejar de reabastecer.
            </p>
            <div className="toolbar" style={{ marginBottom: 14 }}>
              <select value={filtroDeptoMV} onChange={(e) => setFiltroDeptoMV(e.target.value)} style={{ width: 'auto' }}>
                <option value="">Todos los departamentos</option>
                {deptosMV.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <select value={filtroCategoriaMV} onChange={(e) => setFiltroCategoriaMV(e.target.value)} style={{ width: 'auto' }}>
                <option value="">Todas las categorías</option>
                {categoriasMV.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input type="number" placeholder="Stock mín." value={stockMinMV} onChange={(e) => setStockMinMV(e.target.value)} style={{ width: 110 }} />
              <input type="number" placeholder="Stock máx." value={stockMaxMV} onChange={(e) => setStockMaxMV(e.target.value)} style={{ width: 110 }} />
              {(filtroDeptoMV || filtroCategoriaMV || stockMinMV !== '' || stockMaxMV !== '') && (
                <button className="btn btn-ghost btn-sm" onClick={() => { setFiltroDeptoMV(''); setFiltroCategoriaMV(''); setStockMinMV(''); setStockMaxMV(''); }}>
                  Limpiar filtros
                </button>
              )}
              <div style={{ flex: 1 }} />
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>{menosVendidosFiltrados.length} de {menosVendidos.length} producto(s)</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>SKU</th><th>Producto</th><th>Departamento</th><th>Categoría</th><th>Stock</th><th>Unidades Vendidas</th><th>Total Vendido</th></tr></thead>
                <tbody>
                  {menosVendidosFiltrados.slice(0, 50).map((p) => (
                    <tr key={p.id}>
                      <td><code>{p.sku}</code></td>
                      <td>{p.nombre}</td>
                      <td style={{ textTransform: 'capitalize', color: 'var(--muted)' }}>{p.departamento || '—'}</td>
                      <td style={{ color: 'var(--muted)' }}>{p.categoria || '—'}</td>
                      <td style={{ color: p.stock_total === 0 ? 'var(--red)' : 'var(--text)' }}>{p.stock_total}</td>
                      <td style={{ color: p.qty === 0 ? 'var(--red)' : 'var(--text)', fontWeight: p.qty === 0 ? 700 : 400 }}>{p.qty}</td>
                      <td>{money(p.total)}</td>
                    </tr>
                  ))}
                  {!menosVendidosFiltrados.length && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)' }}>Ningún producto coincide con estos filtros.</td></tr>}
                </tbody>
              </table>
              {menosVendidosFiltrados.length > 50 && (
                <p style={{ color: 'var(--muted)', fontSize: 11, marginTop: 8 }}>Mostrando los primeros 50 de {menosVendidosFiltrados.length} — ajusta los filtros para acotar la lista.</p>
              )}
            </div>
          </div>
        </>
      )}

      {!loading && tab === 'ventas' && (
        <div className="card">
          <div className="card-title">Ventas del Periodo ({ventas.length})</div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Folio</th><th>Cliente</th><th>Forma de Pago</th><th>Estado</th><th>Total</th><th>Fecha</th></tr></thead>
              <tbody>
                {ventas.map((v) => (
                  <tr key={v.id}>
                    <td><code>{v.folio}</code></td>
                    <td>{(v.nombre || '') + ' ' + (v.apellido || '') || 'General'}</td>
                    <td style={{ textTransform: 'capitalize' }}>{v.forma_pago}</td>
                    <td><span className="badge-pill">{ESTADOS_VENTA[v.estado] || v.estado}</span></td>
                    <td>{money(v.total)}</td>
                    <td style={{ color: 'var(--muted)' }}>{dateFmt(v.created_at)}</td>
                  </tr>
                ))}
                {!ventas.length && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)' }}>Sin ventas en este periodo.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && tab === 'inventario' && (
        <>
          <div className="stats-grid">
            <div className="stat-card"><div className="stat-label">Unidades en Stock</div><div className="stat-value">{inventarioResumen.unidades}</div></div>
            <div className="stat-card"><div className="stat-label">Valor a Costo</div><div className="stat-value" style={{ color: 'var(--accent)' }}>{money(inventarioResumen.valorCosto)}</div></div>
            <div className="stat-card"><div className="stat-label">Valor a Precio Público</div><div className="stat-value" style={{ color: 'var(--green)' }}>{money(inventarioResumen.valorVenta)}</div></div>
            <div className="stat-card" style={{ borderColor: inventarioResumen.sinStock > 0 ? 'var(--red)' : 'var(--border)' }}><div className="stat-label">Stock Bajo / Sin Stock</div><div className="stat-value">{inventarioResumen.bajoStock} / {inventarioResumen.sinStock}</div></div>
          </div>
          <div className="card">
            <div className="card-title">Valorización de Inventario ({inventario.length} presentaciones)</div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>SKU</th><th>Producto</th><th>Presentacion</th><th>Depto.</th><th>Stock</th><th>Valor Costo</th><th>Valor Venta</th></tr></thead>
                <tbody>
                  {inventario.map((i) => (
                    <tr key={i.presentacion_id}>
                      <td><code>{i.sku}</code></td>
                      <td>{i.nombre}</td>
                      <td>{i.presentacion}</td>
                      <td style={{ textTransform: 'capitalize', color: 'var(--muted)' }}>{i.departamento}</td>
                      <td style={{ color: i.stock_sistema === 0 ? 'var(--red)' : i.stock_sistema <= (i.stock_minimo || 3) ? 'var(--accent)' : 'var(--text)' }}>{i.stock_sistema}</td>
                      <td>{money(i.costo_unitario * i.stock_sistema)}</td>
                      <td>{money(i.precio_publico * i.stock_sistema)}</td>
                    </tr>
                  ))}
                  {!inventario.length && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)' }}>Sin productos.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!loading && tab === 'cortes' && (
        <>
          <div className="stats-grid">
            <div className="stat-card"><div className="stat-label">Cortes en el Periodo</div><div className="stat-value">{cortesResumen.total}</div></div>
            <div className="stat-card" style={{ borderColor: cortesResumen.omitidos > 0 ? 'var(--red)' : 'var(--border)' }}><div className="stat-label">Cortes Omitidos</div><div className="stat-value" style={{ color: cortesResumen.omitidos > 0 ? 'var(--red)' : 'var(--text)' }}>{cortesResumen.omitidos}</div></div>
            <div className="stat-card"><div className="stat-label">Diferencia Acumulada</div><div className="stat-value" style={{ color: cortesResumen.diferenciaTotal === 0 ? 'var(--green)' : cortesResumen.diferenciaTotal > 0 ? 'var(--blue)' : 'var(--red)' }}>{money(cortesResumen.diferenciaTotal)}</div></div>
          </div>
          <div className="card">
            <div className="card-title">Cortes de Caja del Periodo</div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Usuario</th><th>Estado</th><th>Esperado</th><th>Contado</th><th>Diferencia</th><th>Motivo</th><th>Fecha</th></tr></thead>
                <tbody>
                  {cortes.map((c) => {
                    const esperado = (c.efectivo_esperado || 0) + (c.tarjeta_esperado || 0) + (c.transferencia_esperado || 0);
                    const contado = (c.efectivo_contado || 0) + (c.tarjeta_contado || 0) + (c.transferencia_contado || 0);
                    return (
                      <tr key={c.id}>
                        <td>{c.usuario_nombre || '—'}</td>
                        <td><span className={'badge-pill ' + (c.estado === 'omitido' ? 'badge-danger' : 'badge-ok')}>{c.estado === 'omitido' ? 'Omitido' : 'Completado'}</span></td>
                        <td>{money(esperado)}</td>
                        <td>{c.estado === 'omitido' ? '—' : money(contado)}</td>
                        <td style={{ color: c.estado === 'omitido' ? 'var(--muted)' : (c.diferencia === 0 ? 'var(--green)' : c.diferencia > 0 ? 'var(--blue)' : 'var(--red)') }}>
                          {c.estado === 'omitido' ? '—' : `${c.diferencia > 0 ? '+' : ''}${money(c.diferencia)}`}
                        </td>
                        <td style={{ color: 'var(--muted)' }}>{c.motivo_omision || '—'}</td>
                        <td style={{ color: 'var(--muted)' }}>{dateFmt(c.created_at)}</td>
                      </tr>
                    );
                  })}
                  {!cortes.length && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)' }}>Sin cortes en este periodo.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!loading && tab === 'gastos' && (
        <>
          <div className="stats-grid">
            <div className="stat-card"><div className="stat-label">Total de Gastos</div><div className="stat-value" style={{ color: 'var(--red)' }}>{money(gastosTotal)}</div><div className="stat-sub">{gastos.length} registro(s)</div></div>
          </div>
          <div className="card">
            <div className="card-title">Gastos del Periodo</div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Concepto</th><th>Categoría</th><th>Proveedor</th><th>Monto</th><th>Registrado por</th><th>Fecha</th></tr></thead>
                <tbody>
                  {gastos.map((g) => (
                    <tr key={g.id}>
                      <td>{g.concepto}</td>
                      <td style={{ textTransform: 'capitalize' }}>{g.categoria}</td>
                      <td style={{ color: 'var(--muted)' }}>{g.proveedor || '—'}</td>
                      <td style={{ color: 'var(--red)' }}>{money(g.monto)}</td>
                      <td>{g.usuario_nombre || '—'}</td>
                      <td style={{ color: 'var(--muted)' }}>{dateFmt(g.fecha)}</td>
                    </tr>
                  ))}
                  {!gastos.length && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)' }}>Sin gastos en este periodo.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!loading && tab === 'creditos' && creditos && (
        <>
          <div className="stats-grid">
            <div className="stat-card"><div className="stat-label">Créditos Activos</div><div className="stat-value">{creditos.resumen.num_creditos}</div></div>
            <div className="stat-card"><div className="stat-label">Deuda Total</div><div className="stat-value" style={{ color: 'var(--red)' }}>{money(creditos.resumen.total_deuda)}</div></div>
            <div className="stat-card"><div className="stat-label">Clientes con Deuda</div><div className="stat-value">{creditos.resumen.clientes_con_deuda}</div></div>
          </div>
          <div className="card">
            <div className="card-title">Créditos Pendientes (estado actual)</div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Folio</th><th>Cliente</th><th>Teléfono</th><th>Total</th><th>Pagado</th><th>Saldo</th><th>Fecha</th></tr></thead>
                <tbody>
                  {(creditos.rows || []).map((c) => (
                    <tr key={c.id}>
                      <td><code>{c.folio}</code></td>
                      <td>{c.cliente_nombre}</td>
                      <td style={{ color: 'var(--muted)' }}>{c.telefono}</td>
                      <td>{money(c.total)}</td>
                      <td style={{ color: 'var(--green)' }}>{money(c.monto_pagado)}</td>
                      <td style={{ color: 'var(--red)', fontWeight: 700 }}>{money(c.saldo_pendiente)}</td>
                      <td style={{ color: 'var(--muted)' }}>{dateFmt(c.created_at)}</td>
                    </tr>
                  ))}
                  {!(creditos.rows || []).length && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)' }}>Sin créditos pendientes ✓</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!loading && tab === 'devoluciones' && (
        <div className="card">
          <div className="card-title">Devoluciones del Periodo ({devoluciones.length})</div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Folio Venta</th><th>Cliente</th><th>Tipo</th><th>Monto</th><th>Estado</th><th>Registrado por</th><th>Fecha</th></tr></thead>
              <tbody>
                {devoluciones.map((d) => (
                  <tr key={d.id}>
                    <td><code>{d.folio}</code></td>
                    <td>{d.cliente_nombre}</td>
                    <td style={{ textTransform: 'capitalize' }}>{d.tipo_devolucion}</td>
                    <td>{money(d.monto_total)}</td>
                    <td><span className="badge-pill">{d.estado}</span></td>
                    <td>{d.usuario_nombre || '—'}</td>
                    <td style={{ color: 'var(--muted)' }}>{dateFmt(d.created_at)}</td>
                  </tr>
                ))}
                {!devoluciones.length && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)' }}>Sin devoluciones en este periodo.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && tab === 'caducidades' && (
        <>
          <div className="stats-grid">
            <div className="stat-card" style={{ borderColor: caducidades.caducados.length > 0 ? 'var(--red)' : 'var(--border)' }}>
              <div className="stat-label">Caducados</div>
              <div className="stat-value" style={{ color: caducidades.caducados.length > 0 ? 'var(--red)' : 'var(--text)' }}>{caducidades.caducados.length}</div>
            </div>
            <div className="stat-card"><div className="stat-label">Por Caducar (30 días)</div><div className="stat-value" style={{ color: 'var(--accent)' }}>{caducidades.porCaducar.length}</div></div>
          </div>
          <div className="card">
            <div className="card-title">Lotes Caducados o Próximos a Caducar</div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>SKU</th><th>Producto</th><th>Presentación</th><th>Lote</th><th>Cantidad</th><th>Caducidad</th><th>Departamento</th></tr></thead>
                <tbody>
                  {caducidadesRows.map((l) => (
                    <tr key={l.id}>
                      <td><code>{l.sku}</code></td>
                      <td>{l.nombre}</td>
                      <td>{l.presentacion}</td>
                      <td>{l.numero_lote || '—'}</td>
                      <td>{l.cantidad}</td>
                      <td>
                        <span className={'badge-pill ' + (l.fecha_caducidad < todayISO() ? 'badge-danger' : '')}>
                          {l.fecha_caducidad}{l.fecha_caducidad < todayISO() ? ' — CADUCADO' : ''}
                        </span>
                      </td>
                      <td style={{ textTransform: 'capitalize', color: 'var(--muted)' }}>{l.departamento}</td>
                    </tr>
                  ))}
                  {!caducidadesRows.length && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)' }}>Sin lotes caducados ni por caducar ✓</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
