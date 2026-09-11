import React, { useEffect, useState } from 'react';
import { useTourCtx } from './TourContext.jsx';

export default function TourOverlay() {
  const { tour, step, stepIndex, stepData, setStepData, next, prev, finish } = useTourCtx();
  const [rect, setRect] = useState(null);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    if (!step) return;
    setRect(null);
    if (!step.selector) return;
    setBuscando(true);
    let intentos = 0;
    const id = setInterval(() => {
      const el = document.querySelector(step.selector);
      intentos++;
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        setRect(el.getBoundingClientRect());
        setBuscando(false);
        clearInterval(id);
      } else if (intentos > 30) {
        setBuscando(false);
        clearInterval(id);
      }
    }, 100);
    return () => clearInterval(id);
  }, [step]);

  useEffect(() => {
    if (!step?.selector) return;
    function actualizar() {
      const el = document.querySelector(step.selector);
      if (el) setRect(el.getBoundingClientRect());
    }
    window.addEventListener('resize', actualizar);
    window.addEventListener('scroll', actualizar, true);
    return () => { window.removeEventListener('resize', actualizar); window.removeEventListener('scroll', actualizar, true); };
  }, [step, rect]);

  if (!tour || !step) return null;

  const pad = 8;
  const spotStyle = rect ? {
    position: 'fixed',
    top: rect.top - pad, left: rect.left - pad,
    width: rect.width + pad * 2, height: rect.height + pad * 2,
    borderRadius: 10,
    boxShadow: '0 0 0 9999px rgba(0,0,0,.68)',
    border: '2px solid var(--accent)',
    pointerEvents: 'none',
    zIndex: 9998,
    transition: 'top .2s ease, left .2s ease, width .2s ease, height .2s ease'
  } : { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.68)', zIndex: 9998 };

  let tooltipStyle = { position: 'fixed', zIndex: 9999, width: 360, maxWidth: 'calc(100vw - 32px)' };
  if (rect) {
    let top = rect.bottom + 16;
    let left = Math.min(rect.left, window.innerWidth - 376);
    left = Math.max(16, left);
    if (top + 260 > window.innerHeight) top = Math.max(16, rect.top - 260);
    tooltipStyle = { ...tooltipStyle, top, left };
  } else {
    tooltipStyle = { ...tooltipStyle, top: '50%', left: '50%', transform: 'translate(-50%,-50%)' };
  }

  const Componente = step.Componente;
  const esUltimo = stepIndex === tour.steps.length - 1;

  return (
    <>
      <div style={spotStyle} />
      <div className="card" style={{ ...tooltipStyle, padding: 18, boxShadow: '0 10px 40px rgba(0,0,0,.55)' }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
          {tour.titulo} · Paso {stepIndex + 1} de {tour.steps.length}
        </div>
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8 }}>{step.titulo}</div>
        <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: Componente ? 10 : 14, lineHeight: 1.5 }}>{step.texto}</div>
        {buscando && <p style={{ fontSize: 11, color: 'var(--muted)' }}>Buscando el elemento en pantalla...</p>}
        {Componente && <Componente stepData={stepData} setStepData={setStepData} />}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
          <button className="btn btn-ghost btn-sm" onClick={finish}>Salir del tutorial</button>
          <div style={{ display: 'flex', gap: 6 }}>
            {stepIndex > 0 && <button className="btn btn-secondary btn-sm" onClick={prev}>Atrás</button>}
            <button className="btn btn-primary btn-sm" onClick={next}>{esUltimo ? 'Finalizar' : 'Siguiente'}</button>
          </div>
        </div>
      </div>
    </>
  );
}
