import { useEffect, useState } from 'react';

/** Colores de acento seleccionables — mismos 7 que en la app móvil, para que
 *  cualquier tipo de negocio (tienda, restaurante, taller, salón, etc.) le
 *  pueda dar su propia identidad visual a la app sin tocar código. */
export const ACENTOS = [
  { id: 'naranja', etiqueta: 'Naranja', oscuro: '#f5a623', claro: '#b56c0a' },
  { id: 'azul', etiqueta: 'Azul', oscuro: '#3b82f6', claro: '#1d4ed8' },
  { id: 'verde', etiqueta: 'Verde', oscuro: '#22c55e', claro: '#128a43' },
  { id: 'morado', etiqueta: 'Morado', oscuro: '#9b6bd6', claro: '#6d3fb0' },
  { id: 'rosa', etiqueta: 'Rosa', oscuro: '#ec4899', claro: '#be185d' },
  { id: 'rojo', etiqueta: 'Rojo', oscuro: '#ef4444', claro: '#c81e1e' },
  { id: 'turquesa', etiqueta: 'Turquesa', oscuro: '#14b8a6', claro: '#0f766e' },
];

export function useAcento() {
  const [acento, setAcento] = useState(() => localStorage.getItem('pvp_acento') || 'naranja');

  useEffect(() => {
    document.documentElement.setAttribute('data-acento', acento);
    localStorage.setItem('pvp_acento', acento);
  }, [acento]);

  return [acento, setAcento];
}
