import React from 'react';

export default function Modal({ open, onClose, title, children, footer, maxWidth = 520, confirmarCierre }) {
  if (!open) return null;
  // confirmarCierre (opcional): si existe, se le pregunta antes de cerrar por clic
  // afuera o la X — así un formulario a medio llenar no se pierde por un clic
  // accidental. Debe devolver (o resolver a) true para proceder con el cierre;
  // puede ser async si usa el modal propio de confirmación en vez de uno nativo.
  async function intentarCerrar() {
    if (!confirmarCierre || (await confirmarCierre())) onClose();
  }
  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) intentarCerrar(); }}>
      <div className="modal" style={{ maxWidth }}>
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="modal-close" onClick={intentarCerrar}>✕</button>
        </div>
        <div>{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
