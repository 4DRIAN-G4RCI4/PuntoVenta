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
  aplicar_promocion_venta: '★',
  farmacia_lotes_caducidad: '⚕',
  farmacia_receta_sustancia: '℞',
  farmacia_proveedores: '⚑',
  farmacia_reporte_caducidades: '☷'
};

// Tutoriales exclusivos para negocios que manejan medicamentos u otros
// productos regulados (lotes/caducidad, receta, sustancias controladas) —
// se muestran en su propia sección, separados de los tutoriales generales.
const IDS_FARMACIA = ['farmacia_lotes_caducidad', 'farmacia_receta_sustancia', 'farmacia_proveedores', 'farmacia_reporte_caducidades'];

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
  aplicar_promocion_venta: 'Cómo aplicar un descuento manual o una promoción durante una venta.',
  farmacia_lotes_caducidad: 'Cómo activar el control de lotes en un medicamento y por qué el sistema vende primero lo que antes caduca (FEFO).',
  farmacia_receta_sustancia: 'Cómo la app exige folio de receta o identificación del comprador antes de dejar cobrar ciertos productos.',
  farmacia_proveedores: 'Cómo dar de alta a tus distribuidoras y laboratorios.',
  farmacia_reporte_caducidades: 'Cómo generar y exportar el reporte dedicado a lotes caducados o próximos a caducar.'
};

function GrupoTutoriales({ tours, startTour, vacioTexto }) {
  return (
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
      {!tours.length && <p style={{ color: 'var(--muted)' }}>{vacioTexto}</p>}
    </div>
  );
}

export default function Tutoriales() {
  const { user } = useAuth();
  const { startTour } = useTourCtx();
  const todos = toursParaRol(user.rol);
  const tours = todos.filter((t) => !IDS_FARMACIA.includes(t.id));
  const toursFarmacia = todos.filter((t) => IDS_FARMACIA.includes(t.id));

  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>Tutoriales</h2>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>
        Recorridos guiados para tu rol ({user.rol}). Cada paso te señala en pantalla qué botón usar y para qué sirve. Los tutoriales de tareas específicas crean un registro de prueba y lo eliminan automáticamente al terminar.
      </p>

      <GrupoTutoriales tours={tours} startTour={startTour} vacioTexto="No hay tutoriales disponibles para tu rol todavía." />

      {!!toursFarmacia.length && (
        <>
          <h3 style={{ margin: '28px 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>⚕</span> Farmacia y Productos Regulados
          </h3>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>
            Solo relevantes si tu negocio vende medicamentos u otros productos que requieren control de lote, caducidad, receta o identificación del comprador.
          </p>
          <GrupoTutoriales tours={toursFarmacia} startTour={startTour} vacioTexto="Sin tutoriales de farmacia para tu rol." />
        </>
      )}
    </div>
  );
}
