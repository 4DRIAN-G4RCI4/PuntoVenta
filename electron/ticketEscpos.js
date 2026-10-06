// Ticket en comandos ESC/POS (el "idioma" nativo de las impresoras térmicas).
// Se manda en crudo a la impresora, sin pasar por el driver de Windows: el
// driver "Generic / Text Only" tira todo el formato (centrado, logo, acentos)
// y no avanza el papel al final, dejando la última línea atorada para el
// siguiente ticket.
const ESC = 0x1b, GS = 0x1d, FS = 0x1c, LF = 0x0a;

// cols = letra normal (fuente A, 12 puntos), colsB = letra chica (fuente B, 9 puntos).
const ANCHOS = { '58mm': { cols: 32, colsB: 42, dots: 384 }, '80mm': { cols: 48, colsB: 64, dots: 576 } };

// Página de códigos PC437 (la que queda activa tras ESC t 0).
const PC437 = {
  'á': 0xa0, 'é': 0x82, 'í': 0xa1, 'ó': 0xa2, 'ú': 0xa3, 'ñ': 0xa4, 'Ñ': 0xa5,
  'ü': 0x81, 'Ü': 0x9a, 'É': 0x90, '¡': 0xad, '¿': 0xa8, '°': 0xf8
};

function bytesTexto(s) {
  const out = [];
  for (const ch of String(s ?? '')) {
    const c = ch.charCodeAt(0);
    if (c >= 0x20 && c < 0x7f) out.push(c);
    else if (PC437[ch]) out.push(PC437[ch]);
    else {
      const base = ch.normalize('NFD')[0];
      out.push(base && base.charCodeAt(0) < 0x7f ? base.charCodeAt(0) : 0x3f);
    }
  }
  return out;
}

function money(n) {
  return '$' + (Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fecha(iso) {
  if (!iso) return '';
  const d = new Date(String(iso).replace(' ', 'T'));
  if (isNaN(d)) return String(iso);
  return d.toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Corta un texto en renglones de máximo `cols` caracteres, respetando palabras.
function envolver(texto, cols) {
  const lineas = [];
  let actual = '';
  for (const palabra of String(texto).split(/\s+/).filter(Boolean)) {
    if (!actual) actual = palabra;
    else if ((actual + ' ' + palabra).length <= cols) actual += ' ' + palabra;
    else { lineas.push(actual); actual = palabra; }
    while (actual.length > cols) { lineas.push(actual.slice(0, cols)); actual = actual.slice(cols); }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

// "izquierda ........ derecha" a lo ancho del papel.
function columnas(izq, der, cols) {
  const espacio = cols - izq.length - der.length;
  if (espacio >= 1) return [izq + ' '.repeat(espacio) + der];
  // No cabe en un renglón: se parte la izquierda y la derecha va al final del
  // último pedazo si cabe ahí (ahorra un renglón), o en uno propio si no.
  const lineas = envolver(izq, cols);
  const ultima = lineas[lineas.length - 1] || '';
  if (cols - ultima.length - der.length >= 1) lineas[lineas.length - 1] = ultima + ' '.repeat(cols - ultima.length - der.length) + der;
  else lineas.push(' '.repeat(Math.max(0, cols - der.length)) + der);
  return lineas;
}

/** Convierte un bitmap BGRA (lo que da nativeImage.toBitmap() en Windows) a
 * un comando de imagen ESC/POS (GS v 0), centrado a lo ancho del papel. */
function rasterLogo(bgra, w, h, anchoPapel) {
  const dots = ANCHOS[anchoPapel].dots;
  const bytesFila = dots / 8;
  const offset = Math.max(0, Math.floor((dots - w) / 2));
  const datos = Buffer.alloc(bytesFila * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w && x + offset < dots; x++) {
      const i = (y * w + x) * 4;
      const a = bgra[i + 3] / 255;
      // Transparente cuenta como blanco (papel).
      const lum = (0.114 * bgra[i] + 0.587 * bgra[i + 1] + 0.299 * bgra[i + 2]) * a + 255 * (1 - a);
      if (lum < 128) {
        const px = x + offset;
        datos[y * bytesFila + (px >> 3)] |= 0x80 >> (px & 7);
      }
    }
  }
  return Buffer.concat([
    Buffer.from([GS, 0x76, 0x30, 0x00, bytesFila & 0xff, bytesFila >> 8, h & 0xff, h >> 8]),
    datos
  ]);
}

const TIPOS = { contado: 'Contado', credito: 'Credito', a_meses: 'A meses' };
const FORMAS_PAGO = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia', mixto: 'Mixto' };

// Código de barras CODE128 (juego B) del folio, para escanearlo en
// Devoluciones. Módulos ×2 si cabe en el papel; si no, ×1.
function codigoBarras(texto, dots) {
  const datos = bytesTexto(texto).slice(0, 60);
  const modulos = 11 * (datos.length + 2) + 13; // inicio + datos + verificador + fin
  const ancho = modulos * 2 <= dots - 16 ? 2 : 1;
  return Buffer.from([
    GS, 0x68, 48,      // alto: 48 puntos (~6mm)
    GS, 0x77, ancho,   // ancho de módulo
    GS, 0x48, 0,       // sin texto debajo (el folio ya va impreso arriba)
    GS, 0x6b, 73, datos.length + 2, 0x7b, 0x42, ...datos
  ]);
}

// IVA incluido en el total, prorrateando el descuento de la venta entre los
// productos. Devuelve { iva, exento } en pesos.
function desgloseIva(venta, items) {
  const factor = venta.subtotal > 0 ? venta.total / venta.subtotal : 1;
  let iva = 0, exento = 0;
  for (const it of items) {
    const importe = it.cantidad * it.precio_unitario * factor;
    const tasa = Number(it.iva ?? 16);
    if (tasa > 0) iva += importe - importe / (1 + tasa / 100);
    else exento += importe;
  }
  return { iva, exento };
}

const AVISOS = [
  'Cualquier duda o aclaración, presente su ticket.',
  'No se aceptan devoluciones de productos abiertos.',
  'Consulte términos y condiciones.',
  'Consulte promociones en tienda.',
  'Este ticket no es un comprobante fiscal.'
];
const PIE = ['Desarrollado por Tecnopriv', 'Punto de Venta'];

function construirTicketEscPos({ venta, items, pagos, negocio, ancho = '58mm', logo = null, avisos = AVISOS, pie = PIE }) {
  const { cols, colsB, dots } = ANCHOS[ancho] || ANCHOS['58mm'];
  const partes = [];
  const cmd = (...b) => partes.push(Buffer.from(b));
  const linea = (s = '') => partes.push(Buffer.from([...bytesTexto(s), LF]));
  const centrado = (on) => cmd(ESC, 0x61, on ? 1 : 0);
  const estilo = (n) => cmd(ESC, 0x21, n); // 0x08 negrita, 0x10 doble alto

  cmd(ESC, 0x40);       // reinicia la impresora
  cmd(FS, 0x2e);        // apaga modo chino (algunas genéricas lo traen activo)
  cmd(ESC, 0x74, 0x00); // página de códigos PC437
  cmd(ESC, 0x33, 26);   // interlineado de 26 puntos (de fábrica ~30): ticket más corto

  centrado(true);
  if (logo) partes.push(logo);
  estilo(0x18);
  for (const l of envolver(negocio?.nombre_negocio || 'Punto de Venta', cols)) linea(l);
  estilo(0);
  linea(`Folio: ${venta.folio}`);
  linea(`Fecha: ${fecha(venta.created_at)}`);
  linea(`Cliente: ${venta.cliente_nombre?.trim() || 'Venta al publico'}`);
  if (venta.tipo_venta && venta.tipo_venta !== 'contado') linea(`Tipo: ${TIPOS[venta.tipo_venta] || venta.tipo_venta}`);
  if (venta.vendedor_nombre) linea(`Atendió: ${venta.vendedor_nombre}`);
  centrado(false);
  linea();

  for (const it of items) {
    const nombre = `${it.cantidad}x ${it.prod_nombre}${it.presentacion ? ` (${it.presentacion})` : ''}`;
    const importe = money(it.precio_unitario * it.cantidad);
    if (Number(it.cantidad) === 1) {
      for (const l of columnas(nombre, importe, cols)) linea(l);
    } else {
      for (const l of envolver(nombre, cols)) linea(l);
      for (const l of columnas(`  ${money(it.precio_unitario)} c/u`, importe, cols)) linea(l);
    }
  }
  linea();
  linea(`Artículos: ${items.reduce((s, it) => s + Number(it.cantidad || 0), 0)}`);
  for (const l of columnas('Subtotal:', money(venta.subtotal), cols)) linea(l);
  if (venta.descuento_monto > 0) for (const l of columnas('Descuento:', '-' + money(venta.descuento_monto), cols)) linea(l);
  estilo(0x18);
  for (const l of columnas('TOTAL:', money(venta.total), cols)) linea(l);
  estilo(0);
  const { iva, exento } = desgloseIva(venta, items);
  if (iva > 0) for (const l of columnas('IVA incluido (16%):', money(iva), cols)) linea(l);
  if (exento > 0) for (const l of columnas('Exento de IVA (0%):', money(exento), cols)) linea(l);
  for (const l of columnas('Forma de pago:', FORMAS_PAGO[venta.forma_pago] || venta.forma_pago || 'Efectivo', cols)) linea(l);
  if (venta.monto_pagado > 0) for (const l of columnas('Pagado:', money(venta.monto_pagado), cols)) linea(l);
  if (venta.monto_pagado > venta.total) for (const l of columnas('Cambio:', money(venta.monto_pagado - venta.total), cols)) linea(l);
  if (venta.saldo_pendiente > 0) for (const l of columnas('Saldo pendiente:', money(venta.saldo_pendiente), cols)) linea(l);
  if (venta.descuento_monto > 0) {
    linea();
    centrado(true);
    estilo(0x08);
    linea(`¡Usted ahorró ${money(venta.descuento_monto)}!`);
    estilo(0);
    centrado(false);
  }

  if (venta.tipo_venta === 'a_meses' && venta.num_meses > 0) {
    linea();
    for (const l of columnas('Plan:', `${venta.num_meses} meses`, cols)) linea(l);
    for (const l of columnas('Enganche:', money(venta.enganche), cols)) linea(l);
    for (const l of columnas('Cuota mensual:', money(venta.cuota_mensual), cols)) linea(l);
  }
  if (pagos?.length) {
    linea();
    linea('Pagos registrados:');
    for (const p of pagos) for (const l of columnas(`${fecha(p.created_at)} ${p.forma_pago}`, money(p.monto), cols)) linea(l);
  }

  linea();
  centrado(true);
  linea('¡Gracias por su compra!');
  linea('Vuelva pronto');
  linea();
  partes.push(codigoBarras(venta.folio, dots));
  linea();
  estilo(0x01); // fuente B (chica): avisos y crédito ocupan menos
  for (const aviso of avisos) for (const l of envolver(aviso, colsB)) linea(l);
  if (pie.length) {
    linea();
    for (const p of pie) for (const l of envolver(p, colsB)) linea(l);
  }
  estilo(0);
  centrado(false);
  // Avanza el papel (~2.6cm) para que lo impreso pase la barra de corte; sin
  // esto la última línea se queda adentro y sale pegada al inicio del
  // siguiente ticket. Saltos de línea normales y no ESC d: varias impresoras
  // genéricas ignoran ESC d.
  partes.push(Buffer.alloc(7, LF));
  return Buffer.concat(partes);
}

module.exports = { construirTicketEscPos, rasterLogo, ANCHOS };
