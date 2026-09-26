import React from 'react';

export default function AcercaDe() {
  return (
    <div style={{ maxWidth: 640 }}>
      <h2 style={{ marginBottom: 16 }}>Acerca de</h2>

      <div className="card" data-tour="acerca-app">
        <div className="card-title">PuntoVenta</div>
        <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.6 }}>
          Sistema de punto de venta para administrar ventas, inventario, clientes, créditos,
          gastos y reportes — con una app móvil de solo lectura para consultar tu negocio
          desde cualquier lugar.
        </p>
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>Versión 1.0.0</div>
      </div>

      <div className="card" data-tour="acerca-puntotec">
        <div className="card-title">Desarrollado por <span style={{ color: 'var(--accent)' }}>Tecnopriv</span></div>
        <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.6 }}>
          Tecnopriv desarrolla software de punto de venta a la medida para todo tipo de
          negocios y servicios — tiendas, restaurantes, talleres, salones y más — combinando
          una aplicación de escritorio robusta que funciona sin depender de internet con
          herramientas en la nube y una app móvil para que siempre tengas tu negocio a la mano.
        </p>
        <a
          href="#"
          onClick={(e) => { e.preventDefault(); window.api.config.abrirEnlaceExterno('https://tecnopriv.online'); }}
          style={{ color: 'var(--accent)', fontSize: 13 }}
        >
          tecnopriv.online
        </a>
      </div>

      <div className="card">
        <div className="card-title">Soporte</div>
        <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.6 }}>
          ¿Dudas, sugerencias o algo no funciona como esperabas? Contacta a quien te instaló
          o configuró el sistema para recibir ayuda.
        </p>
      </div>
    </div>
  );
}
