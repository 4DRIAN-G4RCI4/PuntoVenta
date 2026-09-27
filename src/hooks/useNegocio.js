import { useEffect, useState } from 'react';

export function useNegocio() {
  const [negocio, setNegocioState] = useState({ nombre_negocio: 'Poblano', logo: null, tipo_negocio: 'general' });

  useEffect(() => {
    let activo = true;
    window.api.config.getNegocio().then((r) => {
      if (activo && r.ok) setNegocioState({ nombre_negocio: r.nombre_negocio, logo: r.logo, tipo_negocio: r.tipo_negocio || 'general' });
    });
    return () => { activo = false; };
  }, []);

  async function guardarNegocio({ nombre_negocio, logo, tipo_negocio }) {
    const r = await window.api.config.setNegocio({ nombre_negocio, logo, tipo_negocio });
    if (r.ok) setNegocioState({ nombre_negocio: r.nombre_negocio, logo: r.logo, tipo_negocio: r.tipo_negocio || 'general' });
    return r;
  }

  return { negocio, guardarNegocio };
}
