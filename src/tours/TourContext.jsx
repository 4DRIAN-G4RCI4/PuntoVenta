import React, { createContext, useCallback, useContext, useState } from 'react';
import { TOURS } from './tours.js';

const TourCtx = createContext(null);
export const useTourCtx = () => useContext(TourCtx);

// Limpia cualquier dato de demostración que haya quedado a medias
// (producto/usuario/cliente creados por un tutorial) sin importar en
// qué paso se haya salido — así nunca queda basura de prueba en la BD.
async function limpiarDemos(stepData) {
  try {
    if (stepData.productoDemoId) await window.api.productos.delete({ id: stepData.productoDemoId });
  } catch (_e) {}
  try {
    if (stepData.usuarioDemoId) await window.api.usuarios.delete({ id: stepData.usuarioDemoId });
  } catch (_e) {}
  try {
    if (stepData.clienteDemoId) await window.api.clientes.delete({ id: stepData.clienteDemoId });
  } catch (_e) {}
  try {
    if (stepData.categoriaDemoId) await window.api.categorias.delete({ id: stepData.categoriaDemoId });
  } catch (_e) {}
  try {
    if (stepData.promocionDemoId) await window.api.promociones.delete({ id: stepData.promocionDemoId });
  } catch (_e) {}
}

export function TourProvider({ children, goto }) {
  const [tourId, setTourId] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [stepData, setStepData] = useState({});

  const tour = tourId ? TOURS[tourId] : null;
  const step = tour ? tour.steps[stepIndex] : null;

  const startTour = useCallback((id) => {
    const t = TOURS[id];
    if (!t) return;
    setTourId(id);
    setStepIndex(0);
    setStepData({});
    if (t.steps[0]?.page) goto(t.steps[0].page);
  }, [goto]);

  const finish = useCallback(() => {
    setStepData((d) => { limpiarDemos(d); return d; });
    setTourId(null);
    setStepIndex(0);
    setStepData({});
  }, []);

  const goToStep = useCallback((idx) => {
    if (!tour) return;
    if (idx < 0) return;
    if (idx >= tour.steps.length) { finish(); return; }
    const destino = tour.steps[idx];
    if (destino.page) goto(destino.page);
    setStepIndex(idx);
  }, [tour, goto, finish]);

  const next = useCallback(() => goToStep(stepIndex + 1), [goToStep, stepIndex]);
  const prev = useCallback(() => goToStep(stepIndex - 1), [goToStep, stepIndex]);

  return (
    <TourCtx.Provider value={{ tourId, tour, step, stepIndex, stepData, setStepData, startTour, next, prev, finish }}>
      {children}
    </TourCtx.Provider>
  );
}
