import React, { useEffect, useState } from 'react';
import { money, dateFmt } from '../format.js';
import { useImprimirTicket } from '../utils/useImprimirTicket.js';

const TIPOS = { contado: 'Contado', credito: 'Crédito', a_meses: 'A meses' };
const FORMAS_PAGO = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia', mixto: 'Mixto' };
const AVISOS = [
  'Cualquier duda o aclaración, presente su ticket.',
  'No se aceptan devoluciones de productos abiertos.',
  'Consulte términos y condiciones.',
  'Consulte promociones en tienda.',
  'Este ticket no es un comprobante fiscal.'
];

// Mismo cálculo que el ticket impreso (electron/ticketEscpos.js): IVA incluido,
// con el descuento de la venta repartido entre los productos.
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

const fila = { display: 'flex', justifyContent: 'space-between', gap: 8 };

function Fila({ izq, der, estilo }) {
  return <div style={{ ...fila, ...estilo }}><span>{izq}</span><span style={{ whiteSpace: 'nowrap' }}>{der}</span></div>;
}

// Vista en pantalla del ticket, con el mismo diseño que sale en la impresora
// térmica — se usa en Historial de Ventas y en la vista previa al cobrar.
export function TicketContenido({ venta, items, pagos, negocio }) {
  const { iva, exento } = desgloseIva(venta, items);
  const articulos = items.reduce((s, it) => s + Number(it.cantidad || 0), 0);
  return (
    <div style={{ color: '#111', fontFamily: "Consolas, 'Courier New', monospace", fontSize: 13, lineHeight: 1.35, maxWidth: '34ch', margin: '0 auto' }}>
      <div style={{ textAlign: 'center' }}>
        {negocio?.logo && <img src={negocio.logo} alt="" style={{ width: 64, height: 64, objectFit: 'contain', filter: 'grayscale(1)' }} />}
        <div style={{ fontWeight: 800, fontSize: 18 }}>{negocio?.nombre_negocio || 'Punto de Venta'}</div>
        <div>Folio: {venta.folio}</div>
        <div>Fecha: {dateFmt(venta.created_at)}</div>
        <div>Cliente: {venta.cliente_nombre?.trim() || 'Venta al público'}</div>
        {venta.tipo_venta && venta.tipo_venta !== 'contado' && <div>Tipo: {TIPOS[venta.tipo_venta] || venta.tipo_venta}</div>}
        {venta.vendedor_nombre && <div>Atendió: {venta.vendedor_nombre}</div>}
      </div>

      <div style={{ marginTop: 14 }}>
        {items.map((it) => {
          const nombre = `${it.cantidad}x ${it.prod_nombre}${it.presentacion ? ` (${it.presentacion})` : ''}`;
          const importe = money(it.precio_unitario * it.cantidad);
          return Number(it.cantidad) === 1
            ? <Fila key={it.id} izq={nombre} der={importe} />
            : (
              <div key={it.id}>
                <div>{nombre}</div>
                <Fila izq={`${money(it.precio_unitario)} c/u`} der={importe} estilo={{ paddingLeft: '2ch' }} />
              </div>
            );
        })}
      </div>

      <div style={{ marginTop: 14 }}>
        <div>Artículos: {articulos}</div>
        <Fila izq="Subtotal:" der={money(venta.subtotal)} />
        {venta.descuento_monto > 0 && <Fila izq="Descuento:" der={'-' + money(venta.descuento_monto)} />}
        <Fila izq="TOTAL:" der={money(venta.total)} estilo={{ fontWeight: 800, fontSize: 18 }} />
        {iva > 0 && <Fila izq="IVA incluido (16%):" der={money(iva)} />}
        {exento > 0 && <Fila izq="Exento de IVA (0%):" der={money(exento)} />}
        <Fila izq="Forma de pago:" der={FORMAS_PAGO[venta.forma_pago] || venta.forma_pago || 'Efectivo'} />
        {venta.monto_pagado > 0 && <Fila izq="Pagado:" der={money(venta.monto_pagado)} />}
        {venta.monto_pagado > venta.total && <Fila izq="Cambio:" der={money(venta.monto_pagado - venta.total)} />}
        {venta.saldo_pendiente > 0 && <Fila izq="Saldo pendiente:" der={money(venta.saldo_pendiente)} />}
        {venta.descuento_monto > 0 && <div style={{ textAlign: 'center', fontWeight: 700, marginTop: 10 }}>¡Usted ahorró {money(venta.descuento_monto)}!</div>}
      </div>

      {venta.tipo_venta === 'a_meses' && venta.num_meses > 0 && (
        <div style={{ marginTop: 14 }}>
          <Fila izq="Plan:" der={`${venta.num_meses} meses`} />
          <Fila izq="Enganche:" der={money(venta.enganche)} />
          <Fila izq="Cuota mensual:" der={money(venta.cuota_mensual)} />
        </div>
      )}

      {pagos?.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div>Pagos registrados:</div>
          {pagos.map((p, i) => <Fila key={i} izq={`${dateFmt(p.created_at)} ${p.forma_pago}`} der={money(p.monto)} />)}
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: 14 }}>
        <div>¡Gracias por su compra!</div>
        <div>Vuelva pronto</div>
        <div style={{ fontSize: 11, marginTop: 12, color: '#333' }}>
          {AVISOS.map((a) => <div key={a}>{a}</div>)}
          <div style={{ marginTop: 8 }}>Desarrollado por Tecnopriv</div>
          <div>Punto de Venta</div>
        </div>
      </div>
    </div>
  );
}

export default function Ticket({ data, onClose }) {
  const { venta, items, pagos } = data;
  const [negocio, setNegocio] = useState(null);

  useEffect(() => {
    window.api.config.getNegocio().then((r) => { if (r.ok) setNegocio(r); });
  }, []);

  const { imprimir, imprimiendo, msgImpresion, impresion } = useImprimirTicket({ venta, items, pagos, negocio });

  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 400, background: '#fff', color: '#1a1a2e' }}>
        <TicketContenido venta={venta} items={items} pagos={pagos} negocio={negocio} />

        {msgImpresion && <div className="alert alert-error" style={{ marginTop: 10 }}>{msgImpresion}</div>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 18 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
          <button className="btn btn-primary" onClick={imprimir} disabled={imprimiendo}>
            {imprimiendo ? 'Imprimiendo...' : impresion?.impresora_ticket ? `Imprimir en ${impresion.impresora_ticket}` : 'Imprimir'}
          </button>
        </div>
      </div>
    </div>
  );
}
