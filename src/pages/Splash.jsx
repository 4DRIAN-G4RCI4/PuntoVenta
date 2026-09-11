import React, { useEffect, useState } from 'react';

export default function Splash({ negocio, saliendo }) {
  const [entrado, setEntrado] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntrado(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className={'splash-wrap' + (saliendo ? ' splash-saliendo' : '')}>
      <div className={'splash-contenido' + (entrado ? ' splash-in' : '')}>
        <div className="splash-logo">
          {negocio?.logo
            ? <img src={negocio.logo} alt="" />
            : <span className="splash-logo-letra">{(negocio?.nombre_negocio || 'P').trim().charAt(0).toUpperCase()}</span>}
        </div>
        <div className="splash-marca">Punto<span>Venta</span></div>
        <div className="splash-negocio">{negocio?.nombre_negocio || 'Poblano'}</div>
        <div className="splash-loader"><span></span><span></span><span></span></div>
      </div>
    </div>
  );
}
