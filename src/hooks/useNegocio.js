import { useEffect, useState } from 'react';

export function useNegocio() {
  const [negocio, setNegocioState] = useState({ nombre_negocio: 'Poblano', logo: null });

  useEffect(() => {
    let activo = true;
    window.api.config.getNegocio().then((r) => {
      if (activo && r.ok) setNegocioState({ nombre_negocio: r.nombre_negocio, logo: r.logo });
    });
    return () => { activo = false; };
  }, []);

  async function guardarNegocio({ nombre_negocio, logo }) {
    const r = await window.api.config.setNegocio({ nombre_negocio, logo });
    if (r.ok) setNegocioState({ nombre_negocio: r.nombre_negocio, logo: r.logo });
    return r;
  }

  return { negocio, guardarNegocio };
}
