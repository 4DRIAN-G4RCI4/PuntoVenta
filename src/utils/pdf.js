function esc(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function exportarPDF({ filename, titulo, subtitulo, resumen, columnas, filas, negocio }) {
  const filasHtml = filas.map((fila) => (
    '<tr>' + columnas.map((c) => `<td>${esc(typeof c.value === 'function' ? c.value(fila) : fila[c.value])}</td>`).join('') + '</tr>'
  )).join('');

  const resumenHtml = (resumen || []).map((r) => (
    `<div class="stat"><div class="stat-label">${esc(r.label)}</div><div class="stat-value">${esc(r.value)}</div></div>`
  )).join('');

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>${esc(titulo)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; margin: 24px; }
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #222; padding-bottom: 12px; margin-bottom: 16px; }
  .brand { font-size: 18px; font-weight: 800; }
  .brand span { color: #b56c0a; }
  h1 { font-size: 18px; margin: 0 0 2px; }
  .subtitulo { color: #555; font-size: 12px; margin-bottom: 16px; }
  .stats { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 18px; }
  .stat { border: 1px solid #ddd; border-radius: 8px; padding: 10px 14px; min-width: 140px; }
  .stat-label { font-size: 10px; text-transform: uppercase; color: #666; letter-spacing: .4px; }
  .stat-value { font-size: 16px; font-weight: 800; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
  th { background: #f2f2f2; text-transform: uppercase; font-size: 10px; letter-spacing: .3px; }
  tr:nth-child(even) td { background: #fafafa; }
  .footer { margin-top: 18px; font-size: 10px; color: #888; text-align: center; }
</style>
</head>
<body>
  <div class="header">
    <div class="brand">Punto<span>Venta</span> ${esc(negocio?.nombre_negocio || 'Poblano')}</div>
    <div style="font-size: 11px; color: #666;">${esc(new Date().toLocaleString('es-MX'))}</div>
  </div>
  <h1>${esc(titulo)}</h1>
  <div class="subtitulo">${esc(subtitulo || '')}</div>
  ${resumenHtml ? `<div class="stats">${resumenHtml}</div>` : ''}
  <table>
    <thead><tr>${columnas.map((c) => `<th>${esc(c.label)}</th>`).join('')}</tr></thead>
    <tbody>${filasHtml || `<tr><td colspan="${columnas.length}" style="text-align:center;color:#888;">Sin datos.</td></tr>`}</tbody>
  </table>
  <div class="footer">Generado desde Punto Venta ${esc(negocio?.nombre_negocio || 'Poblano')}</div>
</body>
</html>`;

  return window.api.reportes.exportarPdf({ html, filename });
}
