import { useEffect, useState } from 'react';

// Lógica de impresión de ticket, reutilizable donde se necesite (Ticket.jsx,
// y la vista previa que aparece justo al terminar de cobrar en Ventas).
export function useImprimirTicket({ venta, items, pagos, negocio }) {
  const [impresion, setImpresion] = useState(null);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [msgImpresion, setMsgImpresion] = useState('');

  useEffect(() => {
    window.api.config.getImpresion().then((r) => { if (r.ok) setImpresion(r); });
  }, []);

  async function imprimir() {
    setMsgImpresion('');
    if (impresion?.impresora_ticket) {
      setImprimiendo(true);
      const res = await window.api.ticket.imprimir({ venta_id: venta.id });
      setImprimiendo(false);
      if (!res.ok) {
        setMsgImpresion(res.error + ' Se abrirá el diálogo de impresión normal.');
        window.print();
      }
      return;
    }
    window.print();
  }

  return { imprimir, imprimiendo, msgImpresion, impresion };
}
