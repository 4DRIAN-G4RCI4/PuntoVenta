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
      <div class="linea"><span>${it.presentacion ? `${esc(it.presentacion)} · ` : ''}${it.cantidad} x ${money(it.precio_unitario)}</span><span>${money(it.precio_unitario * it.cantidad)}</span></div>
    </div>`).join('');

  const pagosHtml = (pagos || []).length ? `
    <div class="espacio"></div>
    <div><strong>Pagos registrados</strong></div>
    ${pagos.map((p) => `<div class="linea"><span>${dateFmt(p.created_at)} — ${esc(p.forma_pago)}</span><span>${money(p.monto)}</span></div>`).join('')}
  ` : '';

  const planHtml = (venta.tipo_venta === 'a_meses' && venta.num_meses > 0) ? `
    <div class="espacio"></div>
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
  body { width: ${widthMm}mm; margin: 0; padding: 3mm 3mm 12mm; font-family: 'Consolas', 'Courier New', monospace; font-size: 11px; color: #000; line-height: 1.5; }
  .centro { text-align: center; }
  .marca { font-size: 14px; font-weight: 800; margin-top: 2px; }
  .sub { font-size: 10px; margin-top: 2px; }
  .espacio { margin-top: 10px; }
  .linea { display: flex; justify-content: space-between; padding: 1px 0; }
  .fila { margin: 6px 0; }
  .fila .nombre { font-weight: 700; }
  .total { display: flex; justify-content: space-between; font-size: 14px; font-weight: 800; margin-top: 6px; }
  .pie { text-align: center; font-size: 10px; margin-top: 14px; }
  .badge { display: inline-block; margin-top: 6px; padding: 2px 8px; border: 1px solid #000; border-radius: 10px; font-size: 9px; }
</style>
</head>
<body>
  <div class="centro">
    ${negocio?.logo ? `<img src="${negocio.logo}" style="width:16mm;height:16mm;object-fit:cover;" />` : ''}
    <div class="marca">${esc(negocio?.nombre_negocio || 'PuntoVenta Poblano')}</div>
    <div class="sub">Folio: ${esc(venta.folio)}</div>
    <div class="badge">${esc(ESTADOS[venta.estado] || venta.estado)}</div>
  </div>

  <div class="espacio"></div>
  <div class="linea"><span>Fecha:</span><span>${dateFmt(venta.created_at)}</span></div>
  <div class="linea"><span>Cliente:</span><span>${esc(venta.cliente_nombre?.trim() || 'General')}</span></div>
  <div class="linea"><span>Tipo:</span><span>${esc(TIPOS[venta.tipo_venta] || venta.tipo_venta)}</span></div>
  <div class="linea"><span>Atendió:</span><span>${esc(venta.vendedor_nombre || '—')}</span></div>

  <div class="espacio"></div>
  ${filas}

  ${planHtml}

  <div class="espacio"></div>
  <div class="linea"><span>Subtotal</span><span>${money(venta.subtotal)}</span></div>
  ${venta.descuento_monto > 0 ? `<div class="linea"><span>Descuento</span><span>-${money(venta.descuento_monto)}</span></div>` : ''}
  <div class="total"><span>TOTAL</span><span>${money(venta.total)}</span></div>
  ${venta.monto_pagado > 0 ? `<div class="linea"><span>Pagado</span><span>${money(venta.monto_pagado)}</span></div>` : ''}
  ${venta.saldo_pendiente > 0 ? `<div class="linea"><span>Saldo pendiente</span><span>${money(venta.saldo_pendiente)}</span></div>` : ''}

  ${pagosHtml}

  <div class="pie">¡Gracias por su compra! Vuelva pronto.</div>
</body>
</html>`;
}
