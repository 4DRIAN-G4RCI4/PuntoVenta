const { test } = require('node:test');
const assert = require('node:assert');
const { construirTicketEscPos, rasterLogo } = require('../ticketEscpos');

const base = {
  venta: {
    folio: 'V20261006-0003', created_at: '2026-10-06 16:44:00', cliente_nombre: ' ', tipo_venta: 'contado',
    vendedor_nombre: 'Administrador', subtotal: 95.5, descuento_monto: 0, total: 95.5, monto_pagado: 100, saldo_pendiente: 0
  },
  items: [
    { prod_nombre: 'vaporu', cantidad: 2, precio_unitario: 20 },
    { prod_nombre: 'Paracetamol suspensión infantil sabor uva frasco grande', presentacion: '120ml', cantidad: 1, precio_unitario: 55.5 }
  ],
  pagos: [],
  negocio: { nombre_negocio: 'Farmacia Poblano' }
};

// Renglones de texto impreso con su límite: 32 en letra normal, 42 en letra
// chica (ESC ! 0x01). El código de barras no es texto y se omite.
function renglones(buf) {
  let chica = false;
  const out = [];
  for (const crudo of buf.toString('latin1').split('\n')) {
    const estilos = [...crudo.matchAll(/\x1b!([\s\S])/g)];
    if (estilos.length) chica = estilos[estilos.length - 1][1] === '\x01';
    if (crudo.includes('\x1dk')) continue;
    out.push({ texto: crudo.replace(/\x1b[@]|\x1c\.|\x1b[ta!d3][\s\S]/g, ''), max: chica ? 42 : 32 });
  }
  return out;
}

test('ticket ESC/POS: ningún renglón se pasa del ancho de 58mm (32 normal / 42 chica)', () => {
  const buf = construirTicketEscPos({ ...base, ancho: '58mm' });
  for (const { texto, max } of renglones(buf)) assert.ok(texto.length <= max, `renglón demasiado largo (${texto.length}/${max}): "${texto}"`);
});

test('ticket ESC/POS: producto de 1 pieza va en un solo renglón con su importe', () => {
  const t = construirTicketEscPos({ ...base, items: [{ prod_nombre: 'Vaporub 50g', cantidad: 1, precio_unitario: 64 }] }).toString('latin1');
  assert.match(t, /1x Vaporub 50g +\$64\.00\n/);
  assert.ok(!t.includes('c/u'), 'una sola pieza no lleva precio por unidad');
});

test('ticket ESC/POS: acentos en PC437 (no UTF-8), cambio calculado y avance de papel al final', () => {
  const buf = construirTicketEscPos({ ...base, ancho: '58mm' });
  assert.ok(buf.includes(Buffer.from([0x41, 0x74, 0x65, 0x6e, 0x64, 0x69, 0xa2])), '"Atendió" debe usar ó=0xA2');
  assert.ok(!buf.includes(Buffer.from([0xc3, 0xb3])), 'no debe haber bytes UTF-8');
  assert.ok(buf.toString('latin1').includes('Cambio:'), 'pagó 100 de 95.50 → debe mostrar el cambio');
  assert.ok(buf.subarray(-7).every((b) => b === 0x0a), 'debe terminar avanzando el papel con saltos de línea');
  assert.ok(buf.toString('latin1').includes('Desarrollado por Tecnopriv'), 'debe llevar el crédito al pie');
});

test('ticket ESC/POS: artículos, IVA incluido con descuento prorrateado, exento, ahorro y código de barras del folio', () => {
  // 2 x $58 gravado (16%) + 1 x $84 exento = $200; descuento $20 → total $180 (factor 0.9)
  const t = construirTicketEscPos({
    venta: { ...base.venta, forma_pago: 'tarjeta', subtotal: 200, descuento_monto: 20, total: 180, monto_pagado: 180 },
    items: [{ prod_nombre: 'Gel', cantidad: 2, precio_unitario: 58, iva: 16 }, { prod_nombre: 'Medicamento', cantidad: 1, precio_unitario: 84, iva: 0 }],
    pagos: [], negocio: base.negocio, ancho: '58mm'
  }).toString('latin1');
  assert.ok(t.includes('Art\xa1culos: 3'));
  // gravado con descuento: 116 * 0.9 = 104.40 → IVA = 104.40 - 104.40/1.16 = 14.40
  assert.match(t, /IVA incluido \(16%\): +\$14\.40/);
  assert.match(t, /Exento de IVA \(0%\): +\$75\.60/);
  assert.match(t, /Forma de pago: +Tarjeta/);
  assert.ok(t.includes('Usted ahor'));
  assert.match(t, /no es un comprobante\s+fiscal/);
  assert.ok(t.includes('\x1dkI\x10{BV20261006-0003'), 'CODE128 con el folio');
});

test('rasterLogo: imagen centrada a lo ancho del papel, píxel oscuro = punto impreso', () => {
  // Imagen 8x1: un píxel negro opaco en x=0, el resto transparente.
  const bgra = Buffer.alloc(8 * 4);
  bgra[3] = 255;
  const r = rasterLogo(bgra, 8, 1, '58mm');
  assert.deepStrictEqual([...r.subarray(0, 8)], [0x1d, 0x76, 0x30, 0, 48, 0, 1, 0]);
  const datos = r.subarray(8);
  // offset = (384-8)/2 = 188 → byte 23, bit 4
  assert.strictEqual(datos[23], 0x08);
  assert.strictEqual(datos.reduce((s, b) => s + (b ? 1 : 0), 0), 1, 'solo un byte con puntos (transparente = papel)');
});
