import { money, dateFmt } from '../format.js';

const ESTADOS = { pagada: 'Pagada', pendiente: 'Pendiente', credito: 'Crédito', a_meses: 'A Meses', devuelta: 'Devuelta', cancelada: 'Cancelada' };
const TIPOS = { contado: 'Contado', credito: 'Crédito', a_meses: 'A Meses' };

function esc(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Genera el HTML de un ticket listo para imprimirse en una impresora
// térmica de 58mm u 80mm (ESC/POS genérica vía driver de Windows).
export function construirTicketHtml({ venta, items, pagos, negocio, ancho = '80mm' }) {
  const widthMm = ancho === '58mm' ? 56 : 76;
  const filas = items.map((it) => `
    <div class="fila">
      <div class="nombre">${esc(it.prod_nombre)}</div>
      <div class="detalle">${it.presentacion ? `Presentacion: ${esc(it.presentacion)} · ` : ''}${it.cantidad} x ${money(it.precio_unitario)}</div>
      <div class="importe">${money(it.precio_unitario * it.cantidad)}</div>
    </div>`).join('');

  const pagosHtml = (pagos || []).length ? `
    <div class="sep"></div>
    <div class="titulo">Pagos registrados</div>
    ${pagos.map((p) => `<div class="linea"><span>${dateFmt(p.created_at)} — ${esc(p.forma_pago)}</span><span>${money(p.monto)}</span></div>`).join('')}
  ` : '';

  const planHtml = (venta.tipo_venta === 'a_meses' && venta.num_meses > 0) ? `
    <div class="sep"></div>
    <div class="linea"><span>Plan:</span><span>${venta.num_meses} meses</span></div>
    <div class="linea"><span>Enganche:</span><span>${money(venta.enganche)}</span></div>
    <div class="linea"><span>Cuota mensual:</span><span>${money(venta.cuota_mensual)}</span></div>
  ` : '';

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Ticket ${esc(venta.folio)}</title>
<style>
  @page { size: ${widthMm}mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body { width: ${widthMm}mm; margin: 0; padding: 2mm 3mm; font-family: 'Consolas', 'Courier New', monospace; font-size: 11px; color: #000; }
  .centro { text-align: center; }
  .marca { font-size: 15px; font-weight: 800; }
  .sub { font-size: 10px; text-transform: uppercase; color: #333; }
  .sep { border-top: 1px dashed #000; margin: 6px 0; }
  .linea { display: flex; justify-content: space-between; padding: 1px 0; }
  .fila { padding: 3px 0; border-bottom: 1px dotted #999; }
  .fila .nombre { font-weight: 700; }
  .fila .detalle { font-size: 10px; color: #333; display: flex; justify-content: space-between; }
  .fila .importe { text-align: right; font-weight: 700; }
  .titulo { font-size: 10px; font-weight: 700; text-transform: uppercase; margin-bottom: 2px; }
  .total { display: flex; justify-content: space-between; font-size: 15px; font-weight: 800; margin-top: 4px; }
  .pie { text-align: center; font-size: 10px; margin-top: 8px; }
  .badge { display: inline-block; margin-top: 4px; padding: 1px 6px; border: 1px solid #000; font-size: 10px; }
</style>
</head>
<body>
  <div class="centro">
    ${negocio?.logo ? `<img src="${negocio.logo}" style="width:14mm;height:14mm;object-fit:cover;margin-bottom:2px;" />` : ''}
    <div class="marca">PuntoVenta</div>
    <div class="sub">${esc(negocio?.nombre_negocio || 'Poblano')}</div>
    <div style="margin-top:4px;">Folio: <strong>${esc(venta.folio)}</strong></div>
    <div class="badge">${esc(ESTADOS[venta.estado] || venta.estado)}</div>
  </div>

  <div class="sep"></div>
  <div class="linea"><span>Fecha:</span><span>${dateFmt(venta.created_at)}</span></div>
  <div class="linea"><span>Cliente:</span><span>${esc(venta.cliente_nombre?.trim() || 'General')}</span></div>
  <div class="linea"><span>Tipo:</span><span>${esc(TIPOS[venta.tipo_venta] || venta.tipo_venta)}</span></div>
  <div class="linea"><span>Atendió:</span><span>${esc(venta.vendedor_nombre || '—')}</span></div>

  <div class="sep"></div>
  ${filas}

  ${planHtml}

  <div class="sep"></div>
  <div class="linea"><span>Subtotal</span><span>${money(venta.subtotal)}</span></div>
  ${venta.descuento_monto > 0 ? `<div class="linea"><span>Descuento</span><span>-${money(venta.descuento_monto)}</span></div>` : ''}
  <div class="total"><span>TOTAL</span><span>${money(venta.total)}</span></div>
  ${venta.monto_pagado > 0 ? `<div class="linea"><span>Pagado</span><span>${money(venta.monto_pagado)}</span></div>` : ''}
  ${venta.saldo_pendiente > 0 ? `<div class="linea"><span>Saldo pendiente</span><span>${money(venta.saldo_pendiente)}</span></div>` : ''}

  ${pagosHtml}

  <div class="pie">¡Gracias por su compra!<br/>Conserve su ticket para cambios y devoluciones.</div>
</body>
</html>`;
}
