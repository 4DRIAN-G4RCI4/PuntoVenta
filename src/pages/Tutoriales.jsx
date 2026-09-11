import React from 'react';
import { useAuth } from '../App.jsx';
import { useTourCtx } from '../tours/TourContext.jsx';
import { toursParaRol } from '../tours/tours.js';

const ICONOS = {
  admin_general: '◎',
  admin_crear_usuario: '☺',
  admin_crear_producto: '▣',
  admin_crear_categoria: '☷',
  admin_crear_promocion: '★',
  admin_reportes: '☷',
  admin_configuracion: '⚙',
  admin_identidad_negocio: '◈',
  admin_revision_actividad: '⚖',
  admin_cortes_caja: 'Ⓢ',
  vendedor_general: '◎',
  vendedor_crear_cliente: '●',
  vendedor_realizar_venta: '▢',
  vendedor_abono_credito: 'Ⓢ',
  vendedor_devolucion: '↺',
  vendedor_historial_ventas: '≣',
  vendedor_gastos: '▤',
  vendedor_corte_caja: '☑',
  almacen_general: '◎',
  almacen_crear_producto: '▣',
  almacen_crear_categoria: '☷',
  almacen_inventario_fisico: '☑',
  almacen_editar_producto: '▣',
  almacen_devoluciones: '↺',
  dashboard_explicado: '▦',
  perfil_mi_cuenta: '☺',
  aplicar_promocion_venta: '★'
};

const DESCRIPCIONES = {
  admin_general: 'Un recorrido por todo el panel de administrador: dashboard, ventas, inventario, usuarios, reportes y configuración.',
  admin_crear_usuario: 'Te guiamos creando (y luego eliminando) un usuario de prueba, paso a paso.',
  admin_crear_producto: 'Te guiamos creando (y luego eliminando) un producto de prueba, paso a paso.',
  admin_crear_categoria: 'Te guiamos creando (y luego eliminando) una categoría de prueba, paso a paso.',
  admin_crear_promocion: 'Te guiamos creando (y luego eliminando) una promoción de prueba, paso a paso.',
  admin_reportes: 'Aprende a generar y exportar reportes financieros, de ventas, inventario y más.',
  admin_configuracion: 'Cómo configurar tu impresora térmica y respaldar tu base de datos.',
  admin_identidad_negocio: 'Cómo poner el nombre y logo de tu negocio en toda la aplicación.',
  admin_revision_actividad: 'Cómo supervisar la actividad y los cortes de caja de tus empleados.',
  admin_cortes_caja: 'Entiende cómo funciona el corte de caja al cerrar sesión.',
  vendedor_general: 'Un recorrido por el punto de venta, historial, crédito, devoluciones y gastos.',
  vendedor_crear_cliente: 'Te guiamos agregando (y luego eliminando) un cliente de prueba, paso a paso.',
  vendedor_realizar_venta: 'El paso a paso completo para registrar una venta, del carrito al cobro.',
  vendedor_abono_credito: 'Cómo registrar el abono de un cliente que compró a crédito.',
  vendedor_devolucion: 'Cómo buscar una venta y registrar la devolución de productos.',
  vendedor_historial_ventas: 'Cómo buscar una venta pasada y reimprimir su ticket.',
  vendedor_gastos: 'Cómo registrar los gastos del negocio.',
  vendedor_corte_caja: 'Entiende cómo funciona tu corte de caja al cerrar sesión.',
  almacen_general: 'Un recorrido por inventario, inventario físico y categorías.',
  almacen_crear_producto: 'Te guiamos creando (y luego eliminando) un producto de prueba, paso a paso.',
  almacen_crear_categoria: 'Te guiamos creando (y luego eliminando) una categoría de prueba, paso a paso.',
  almacen_inventario_fisico: 'Cómo hacer un conteo físico y ajustar diferencias de stock.',
  almacen_editar_producto: 'Cómo editar un producto y administrar sus presentaciones y stock.',
  almacen_devoluciones: 'Cómo buscar una venta y registrar la devolución de productos.',
  dashboard_explicado: 'Qué significa cada tarjeta y cada gráfica de tu Dashboard, al detalle.',
  perfil_mi_cuenta: 'Cómo actualizar tu información personal y cambiar tu contraseña.',
  aplicar_promocion_venta: 'Cómo aplicar un descuento manual o una promoción durante una venta.'
};

export default function Tutoriales() {
  const { user } = useAuth();
  const { startTour } = useTourCtx();
  const tours = toursParaRol(user.rol);

  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>Tutoriales</h2>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>
        Recorridos guiados para tu rol ({user.rol}). Cada paso te señala en pantalla qué botón usar y para qué sirve. Los tutoriales de tareas específicas crean un registro de prueba y lo eliminan automáticamente al terminar.
      </p>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
        {tours.map((t) => (
          <div key={t.id} className="card" style={{ margin: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 26, marginBottom: 6 }}>{ICONOS[t.id] || '◎'}</div>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{t.titulo}</div>
            <div style={{ color: 'var(--muted)', fontSize: 12, flex: 1, marginBottom: 14 }}>{DESCRIPCIONES[t.id]}</div>
            <div style={{ color: 'var(--muted)', fontSize: 11, marginBottom: 10 }}>{t.steps.length} pasos</div>
            <button className="btn btn-primary btn-sm" onClick={() => startTour(t.id)}>Iniciar tutorial</button>
          </div>
        ))}
        {!tours.length && <p style={{ color: 'var(--muted)' }}>No hay tutoriales disponibles para tu rol todavía.</p>}
      </div>
    </div>
  );
}
