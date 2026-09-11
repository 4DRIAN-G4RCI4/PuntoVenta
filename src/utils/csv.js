// Campos de texto libre (nombre de proveedor, notas, motivo, número de lote...)
// terminan en este CSV. Si alguno empieza con =, +, -, @, tab o retorno de
// carro, Excel/Sheets lo puede interpretar como fórmula al abrirlo — un vector
// conocido de "CSV injection" (OWASP) que permite ejecutar comandos o exfiltrar
// datos con solo abrir el archivo. Se neutraliza anteponiendo un apóstrofe.
function neutralizarFormula(s) {
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}

function escapeCsvCell(value) {
  let s = value === null || value === undefined ? '' : String(value);
  s = neutralizarFormula(s);
  if (/[",\n;]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function exportarCSV(filename, columnas, filas) {
  const encabezado = columnas.map((c) => escapeCsvCell(c.label)).join(',');
  const cuerpo = filas.map((fila) => columnas.map((c) => escapeCsvCell(typeof c.value === 'function' ? c.value(fila) : fila[c.value])).join(',')).join('\n');
  const csv = '﻿' + encabezado + '\n' + cuerpo;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : filename + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
