import React, { useEffect, useMemo, useState } from 'react';
import { money, dateFmt, todayISO, firstDayOfMonthISO } from '../format.js';
import { GroupedBarChart, DonutChart } from '../components/Charts.jsx';

const PERIODOS = [
  { key: 'dia', label: 'Día' },
  { key: 'mes', label: 'Mes' },
  { key: 'anio', label: 'Año' },
];

function rangoParaPeriodo(periodo) {
  const hoy = new Date();
  const ff = todayISO();
  let ini = new Date(hoy);
  if (periodo === 'dia') ini.setDate(ini.getDate() - 13);
  else if (periodo === 'mes') ini.setMonth(ini.getMonth() - 11, 1);
  else ini.setFullYear(ini.getFullYear() - 4, 0, 1);
  const fi = ini.toISOString().slice(0, 10);
  return { fi, ff };
}

function etiquetaPeriodo(diaISO, periodo) {
  const d = new Date(diaISO + 'T00:00:00');
  if (periodo === 'dia') return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
  if (periodo === 'mes') return d.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' });
  return String(d.getFullYear());
}

function claveAgrupacion(diaISO, periodo) {
  if (periodo === 'dia') return diaISO;
  if (periodo === 'mes') return diaISO.slice(0, 7);
  return diaISO.slice(0, 4);
}

function agruparPorDia(porDia, periodo) {
  const mapa = new Map();
  for (const row of porDia || []) {
    const clave = claveAgrupacion(row.dia, periodo);
    if (!mapa.has(clave)) mapa.set(clave, { clave, dia: row.dia, total: 0, costo: 0, utilidad: 0 });
    const acc = mapa.get(clave);
    acc.total += row.total || 0;
    acc.costo += row.costo || 0;
    acc.utilidad += row.utilidad || 0;
  }
  return Array.from(mapa.values()).sort((a, b) => a.clave.localeCompare(b.clave));
}

// Cada gráfica maneja su propio periodo y su propia carga: al cambiarlo solo
// esa gráfica se atenúa mientras llegan los datos nuevos (sin ocultar ni
// recargar el resto del dashboard, evitando el "flash" de pantalla).
function usePeriodoReporte(inicial = 'mes') {
  const [periodo, setPeriodo] = useState(inicial);
  const [reporte, setReporte] = useState(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    let cancelado = false;
    setFetching(true);
    const { fi, ff } = rangoParaPeriodo(periodo);
    window.api.reportes.generar({ fecha_inicio: fi, fecha_fin: ff }).then((r) => {
      if (cancelado) return;
      if (r.ok) setReporte(r);
      setFetching(false);
    });
    return () => { cancelado = true; };
  }, [periodo]);

  return { periodo, setPeriodo, reporte, fetching };
}

function SelectorPeriodo({ periodo, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {PERIODOS.map((p) => (
        <button
          key={p.key}
          className={'btn btn-sm ' + (periodo === p.key ? 'btn-primary' : 'btn-ghost')}
          onClick={() => onChange(p.key)}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

function ChartCard({ titulo, periodo, onChangePeriodo, fetching, vacio, mensajeVacio = 'Sin datos para este periodo.', children, dataTour }) {
  return (
    <div className="card" data-tour={dataTour}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div className="card-title" style={{ margin: 0 }}>{titulo}</div>
        <SelectorPeriodo periodo={periodo} onChange={onChangePeriodo} />
      </div>
      <div style={{ opacity: fetching ? 0.45 : 1, transition: 'opacity .2s ease', minHeight: 40 }}>
        {vacio ? <p style={{ color: 'var(--muted)' }}>{mensajeVacio}</p> : children}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [hoy, setHoy] = useState(null);
  const [mes, setMes] = useState(null);
  const [deuda, setDeuda] = useState({ num: 0, total: 0 });
  const [stockBajo, setStockBajo] = useState(0);
  const [sinStock, setSinStock] = useState(0);
  const [ultimas, setUltimas] = useState([]);
  const [caducidades, setCaducidades] = useState({ caducados: [], porCaducar: [] });

  const invGanancia = usePeriodoReporte('mes');
  const categoriaTop = usePeriodoReporte('mes');
  const porDepto = usePeriodoReporte('mes');
  const topProductos = usePeriodoReporte('mes');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const today = todayISO();
    const [rHoy, rMes, cDeuda, inv, hist, cad] = await Promise.all([
      window.api.reportes.generar({ fecha_inicio: today, fecha_fin: today }),
      window.api.reportes.generar({ fecha_inicio: firstDayOfMonthISO(), fecha_fin: today }),
      window.api.clientes.list({ filtro: 'deuda' }),
      window.api.inventarioFisico.list(),
      window.api.historial.list({}),
      window.api.lotes.alertas(),
    ]);
    if (rHoy.ok) setHoy(rHoy);
    if (rMes.ok) setMes(rMes);
    if (Array.isArray(cDeuda)) setDeuda({ num: cDeuda.length, total: cDeuda.reduce((s, c) => s + c.saldo_deuda, 0) });
    if (Array.isArray(inv)) {
      setStockBajo(inv.filter((t) => t.stock_sistema > 0 && t.stock_sistema <= (t.stock_minimo || 3)).length);
      setSinStock(inv.filter((t) => t.stock_sistema === 0).length);
    }
    if (Array.isArray(hist)) setUltimas(hist.slice(0, 8));
    if (cad) setCaducidades(cad);
    setLoading(false);
  }

  const agrupado = useMemo(
    () => agruparPorDia(invGanancia.reporte?.por_dia, invGanancia.periodo),
    [invGanancia.reporte, invGanancia.periodo]
  );
  const labels = agrupado.map((r) => etiquetaPeriodo(r.dia, invGanancia.periodo));
  const serieInversionGanancia = [
    { name: 'Inversión (costo)', data: agrupado.map((r) => r.costo) },
    { name: 'Ganancia (utilidad)', data: agrupado.map((r) => r.utilidad) },
  ];

  const categorias = useMemo(() => (
    (categoriaTop.reporte?.por_dept || [])
      .map((d) => ({ label: d.departamento || 'Sin depto.', value: Math.max(0, d.utilidad || 0) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  ), [categoriaTop.reporte]);

  if (loading) return <p style={{ color: 'var(--muted)' }}>Cargando dashboard...</p>;

  return (
    <div>
      <div className="stats-grid" data-tour="dash-stats">
        <div className="stat-card">
          <div className="stat-label">Ventas Hoy</div>
          <div className="stat-value" style={{ color: 'var(--accent)' }}>{money(hoy?.ventas_total?.total || 0)}</div>
          <div className="stat-sub">{hoy?.ventas_total?.num || 0} transacciones</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Ventas del Mes</div>
          <div className="stat-value" style={{ color: 'var(--green)' }}>{money(mes?.ventas_total?.total || 0)}</div>
          <div className="stat-sub">Utilidad neta: {money(mes?.utilidad_neta || 0)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Clientes con Deuda</div>
          <div className="stat-value">{deuda.num}</div>
          <div className="stat-sub">Total: {money(deuda.total)}</div>
        </div>
        <div className="stat-card" style={{ borderColor: sinStock > 0 ? 'var(--red)' : 'var(--border)' }}>
          <div className="stat-label">Stock Bajo / Sin Stock</div>
          <div className="stat-value">{stockBajo} / {sinStock}</div>
          <div className="stat-sub">Presentaciones a revisar</div>
        </div>
        <div className="stat-card" style={{ borderColor: caducidades.caducados.length > 0 ? 'var(--red)' : 'var(--border)' }}>
          <div className="stat-label">Caducado / Por Caducar</div>
          <div className="stat-value">{caducidades.caducados.length} / {caducidades.porCaducar.length}</div>
          <div className="stat-sub">Lotes a revisar (30 días)</div>
        </div>
      </div>

      {(caducidades.caducados.length > 0 || caducidades.porCaducar.length > 0) && (
        <div className="card" data-tour="dash-caducidades">
          <div className="card-title">Caducidades</div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Producto</th><th>Presentación</th><th>Lote</th><th>Cantidad</th><th>Caducidad</th></tr></thead>
              <tbody>
                {[...caducidades.caducados, ...caducidades.porCaducar].slice(0, 12).map((l) => (
                  <tr key={l.id}>
                    <td>{l.nombre}</td>
                    <td>{l.presentacion}</td>
                    <td>{l.numero_lote || '—'}</td>
                    <td>{l.cantidad}</td>
                    <td>
                      <span className={'badge-pill ' + (l.fecha_caducidad < todayISO() ? 'badge-danger' : '')}>
                        {l.fecha_caducidad}{l.fecha_caducidad < todayISO() ? ' — CADUCADO' : ''}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ChartCard
        titulo="Inversión vs Ganancia"
        periodo={invGanancia.periodo}
        onChangePeriodo={invGanancia.setPeriodo}
        fetching={invGanancia.fetching}
        vacio={!agrupado.length}
        dataTour="dash-chart-inversion"
      >
        <GroupedBarChart series={serieInversionGanancia} labels={labels} />
      </ChartCard>

      <ChartCard
        titulo="Categoría con Más Ganancia"
        periodo={categoriaTop.periodo}
        onChangePeriodo={categoriaTop.setPeriodo}
        fetching={categoriaTop.fetching}
        vacio={!categorias.length}
        dataTour="dash-chart-categoria"
      >
        <DonutChart data={categorias} />
      </ChartCard>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <ChartCard
          titulo="Ventas por Departamento"
          periodo={porDepto.periodo}
          onChangePeriodo={porDepto.setPeriodo}
          fetching={porDepto.fetching}
          vacio={!porDepto.reporte?.por_dept?.length}
          mensajeVacio="Sin ventas en este periodo."
          dataTour="dash-departamento"
        >
          {porDepto.reporte?.por_dept?.map((d, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ textTransform: 'capitalize' }}>{d.departamento || 'Sin depto.'}</span>
              <strong>{money(d.total)}</strong>
            </div>
          ))}
        </ChartCard>
        <ChartCard
          titulo="Top Productos"
          periodo={topProductos.periodo}
          onChangePeriodo={topProductos.setPeriodo}
          fetching={topProductos.fetching}
          vacio={!topProductos.reporte?.top_prods?.length}
          dataTour="dash-topproductos"
        >
          {topProductos.reporte?.top_prods?.slice(0, 6).map((p, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
              <span>{p.nombre} <span className="badge">{p.qty}u</span></span>
              <strong>{money(p.total)}</strong>
            </div>
          ))}
        </ChartCard>
      </div>

      <div className="card" data-tour="dash-ultimas-ventas">
        <div className="card-title">Últimas Ventas</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Folio</th><th>Cliente</th><th>Total</th><th>Estado</th><th>Fecha</th></tr></thead>
            <tbody>
              {ultimas.map((v) => (
                <tr key={v.id}>
                  <td><code>{v.folio}</code></td>
                  <td>{(v.nombre || '') + ' ' + (v.apellido || '') || 'General'}</td>
                  <td>{money(v.total)}</td>
                  <td><span className="badge-pill">{v.estado}</span></td>
                  <td style={{ color: 'var(--muted)' }}>{dateFmt(v.created_at)}</td>
                </tr>
              ))}
              {!ultimas.length && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)' }}>Sin ventas registradas.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
