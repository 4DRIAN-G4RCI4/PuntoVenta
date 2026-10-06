import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import Modal from './Modal.jsx';

// Reemplaza window.confirm()/alert() nativos — en Electron, esos diálogos
// bloquean el hilo de UI del sistema operativo y dejan el renderer brevemente
// congelado (inputs sin foco, cursor sin aparecer) un momento después de
// cerrarse. Un modal propio de React no tiene ese problema.
const ConfirmCtx = createContext(null);

export function useConfirm() {
  return useContext(ConfirmCtx);
}

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null); // { tipo: 'confirm'|'alert', mensaje, titulo }
  const resolverRef = useRef(null);

  const confirmar = useCallback((mensaje, titulo = 'Confirmar') => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setState({ tipo: 'confirm', mensaje, titulo });
    });
  }, []);

  const avisar = useCallback((mensaje, titulo = 'Aviso') => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setState({ tipo: 'alert', mensaje, titulo });
    });
  }, []);

  function responder(valor) {
    setState(null);
    resolverRef.current?.(valor);
    resolverRef.current = null;
  }

  return (
    <ConfirmCtx.Provider value={{ confirmar, avisar }}>
      {children}
      <Modal open={!!state} onClose={() => responder(state?.tipo === 'confirm' ? false : undefined)} title={state?.titulo}
        footer={state?.tipo === 'confirm' ? (
          <>
            <button className="btn btn-secondary" onClick={() => responder(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={() => responder(true)} autoFocus>Aceptar</button>
          </>
        ) : (
          <button className="btn btn-primary" onClick={() => responder(undefined)} autoFocus>Entendido</button>
        )}>
        <p style={{ fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{state?.mensaje}</p>
      </Modal>
    </ConfirmCtx.Provider>
  );
}
