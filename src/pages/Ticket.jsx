import React, { useEffect, useState } from 'react';
import { money, dateFmt } from '../format.js';
import { useImprimirTicket } from '../utils/useImprimirTicket.js';

const ESTADOS = { pagada: 'Pagada', pendiente: 'Pendiente', credito: 'Crédito', a_meses: 'A Meses', devuelta: 'Devuelta', cancelada: 'Cancelada' };
const TIPOS = { contado: 'Contado', credito: 'Crédito', a_meses: 'A Meses' };

// Solo el contenido visual del ticket (estilo recibo, fondo blanco) — sin
// modal ni botones, para poder reutilizarlo tanto en el visor de Historial
// de Ventas como en la vista previa que aparece justo al terminar de cobrar.
export function TicketContenido({ venta, items, pagos, negocio }) {
  return (
    <div style={{ color: '#1a1a2e' }}>
      <div style={{ textAlign: 'center', borderBottom: '2px dashed #e5e7eb', paddingBottom: 14, marginBottom: 14 }}>
        {negocio?.logo && <img src={negocio.logo} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', marginBottom: 6 }} />}
        <div style={{ fontSize: 22, fontWeight: 800 }}>Punto<span style={{ color: '#2563eb' }}>Venta</span></div>
        <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase' }}>{negocio?.nombre_negocio || 'Poblano'}</div>
        <div style={{ marginTop: 8, fontSize: 13 }}>Folio: <strong>{venta.folio}</strong></div>
        <span style={{ display: 'inline-block', marginTop: 6, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#dbeafe', color: '#2563eb' }}>{ESTADOS[venta.estado] || venta.estado}</span>
      </div>

      <div style={{ fontSize: 12, marginBottom: 12 }}>
        <div>Fecha: <strong>{dateFmt(venta.created_at)}</strong></div>
        <div>Cliente: <strong>{venta.cliente_nombre?.trim() || 'Cliente general'}</strong></div>
        <div>Tipo: <strong>{TIPOS[venta.tipo_venta] || venta.tipo_venta}</strong></div>
        <div>Atendió: <strong>{venta.vendedor_nombre || '—'}</strong></div>
      </div>

      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 8 }}>
        {items.map((it) => (
          <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e5e7eb', fontSize: 13 }}>
            <div>
              <div style={{ fontWeight: 600 }}>{it.prod_nombre}</div>
              <div style={{ fontSize: 10, color: '#6b7280' }}>{it.presentacion ? `Presentacion: ${it.presentacion} · ` : ''}{it.cantidad} × {money(it.precio_unitario)}</div>
            </div>
            <div style={{ fontWeight: 700 }}>{money(it.precio_unitario * it.cantidad)}</div>
          </div>
        ))}
      </div>

      {venta.tipo_venta === 'a_meses' && venta.num_meses > 0 && (
        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 10, margin: '10px 0', fontSize: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Plan:</span><span>{venta.num_meses} meses</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Enganche:</span><span>{money(venta.enganche)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}><span>Cuota mensual:</span><span>{money(venta.cuota_mensual)}</span></div>
        </div>
      )}

      <div style={{ borderTop: '2px dashed #e5e7eb', marginTop: 12, paddingTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span>Subtotal</span><span>{money(venta.subtotal)}</span></div>
        {venta.descuento_monto > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444', fontSize: 13 }}><span>Descuento</span><span>-{money(venta.descuento_monto)}</span></div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 800, marginTop: 8, borderTop: '1px solid #e5e7eb', paddingTop: 8 }}><span>TOTAL</span><span style={{ color: '#2563eb' }}>{money(venta.total)}</span></div>
        {venta.monto_pagado > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: '#22c55e', fontSize: 13 }}><span>Pagado</span><span>{money(venta.monto_pagado)}</span></div>}
        {venta.saldo_pendiente > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444', fontSize: 13 }}><span>Saldo pendiente</span><span>{money(venta.saldo_pendiente)}</span></div>}
      </div>

      {pagos?.length > 0 && (
        <div style={{ marginTop: 10, borderTop: '1px dashed #e5e7eb', paddingTop: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', marginBottom: 6 }}>Pagos registrados</div>
          {pagos.map((p, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b7280' }}>
              <span>{dateFmt(p.created_at)} — {p.forma_pago}</span><span style={{ color: '#22c55e', fontWeight: 600 }}>{money(p.monto)}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: 18, paddingTop: 14, borderTop: '2px dashed #e5e7eb', fontSize: 11, color: '#6b7280' }}>
        ¡Gracias por su compra! Conserve su ticket para cambios y devoluciones.
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
