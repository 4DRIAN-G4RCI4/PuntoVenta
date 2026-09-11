# Contexto del proyecto y problemática a resolver

## 1. Contexto de negocio

**Punto Venta Poblano** es un sistema de Punto de Venta de escritorio para micro, pequeñas y medianas empresas comerciales (tiendas de ropa/calzado, joyerías/bisutería, abarrotes, ferreterías y farmacias) que operan con:

- Una **caja física** y personal poco técnico que necesita un sistema simple de aprender.
- **Inventario por presentación** (tallas de calzado, tallas de ropa, presentaciones por gramaje), con control de stock y mínimos.
- Venta **a crédito y a meses** a clientes conocidos del barrio/colonia.
- **Desconexiones frecuentes de internet** o directamente sin internet en el local: vender no puede depender del servicio.
- **Control interno de dinero**: cuadre de caja, gastos, comisiones y utilidad por vendedor.

El sistema de referencia ("Punto Family" / TiendaPOS, PHP + MySQL) ya resolvía la lógica de negocio, pero arrastraba problemas operativos de su arquitectura web/híbrida (ver §3). En algunos giros (farmacias, productos perecederos) la operación actual también requiere registro de **lotes y caducidades** y de **ventas de productos regulados**, algo que el flujo genérico de la tienda no contemplaba.

## 2. Objetivo del proyecto

Proveer una **aplicación de escritorio para Windows, instalable, que funcione sin conexión a internet**, que centralice la operación comercial diaria en una **base de datos local** (única fuente de verdad) y que reproduzca, de forma modernizada, toda la funcionalidad del sistema de referencia, añadiendo lo que el giro requiere hoy.

Principios rectores:

1. **Offline-first.** La venta, el inventario, el crédito y la caja nunca dependen de red.
2. **Datos del negocio en la propia PC.** Sin suscripción, sin servidor remoto obligatorio, con respaldo manual (export/import de la base).
3. **Seguridad por rol** en la interfaz y en el backend (IPC).
4. **Trazabilidad.** Cada movimiento de inventario, venta, abono, devolución y corte queda registrado con usuario y fecha.
5. **Fácil de aprender.** Tours guiados, español, interfaz elemental para cajeros.

## 3. Problemática heredada (por qué no seguir con PHP + MySQL)

| Problema del sistema de referencia | Consecuencia en el negocio | Solución en este proyecto |
|---|---|---|
| Requiere servidor web + MySQL instalados y configurados en cada PC | Instalación frágil y dependiente de conocimientos técnicos | Aplicación de escritorio con instalador NSIS; la BD se crea sola |
| Ventas dependen de que el servidor/localhost responda | Pérdida de ventas si Apache/MySQL fallan o si hay red | Base local `SQLite` en el proceso principal; la UI nunca toca la BD directamente |
| Datos fragmentados o sin respaldo traslado | Pérdida de información | Export/import del `.db` desde la propia Configuración |
| Sin control de presentaciones por producto | Inventario por tallas inexacto | Modelo `productos → presentaciones` con stock/mínimo por presentación |
| Sin control de caducidad ni lotes | Farmacias/alimentos no pueden usarlo | Tabla `lotes` + venta FEFO + reconciliación en conteo físico |
| Sin soporte para venta a meses/crédito con abonos | Cobranza informal | Tipos de venta `contado / crédito / a_meses` con enganche, interés y abonos |
| Sin cuadre formal de caja | Faltantes no detectados | Módulo **Corte de Caja** con esperado vs. contado y diferencia |
| Sin auditoría de actividad por usuario | No se sabe quién hizo qué | Registro de actividad, módulo Revisión y trazabilidad en movimientos |
| Credenciales y datos sin protección | Ingreso no autorizado al inventario y a la caja | Hash BCrypt, sesiones por ventana, bloqueo por intentos fallidos, permisos por rol en UI y backend |

## 4. Problemática específica que resuelve (requisitos funcionales)

- **RF-1 – Control de acceso.** Identificación de vendedor/almacén/admin con contraseña; cada rol solo ve y ejecuta lo suyo (menú y canales IPC protegidos).
- **RF-2 – Venta de mostrador.** Carrito, búsqueda por nombre/código de barras/SKU, promociones automáticas, captura de cliente rápido y generación de ticket con folio secuencial diario.
- **RF-3 – Crédito y venta a meses.** Cálculo de cuota con enganche e interés, registro de **abonos parciales**, saldo por cliente y estado de la venta.
- **RF-4 – Inventario por presentación.** Cada producto maneja N presentaciones (tallas/presentaciones) con stock y stock mínimo; compra y venta por presentación.
- **RF-5 – Conteo físico.** Reconciliar el stock teórico con el real sin perder trazabilidad y sin romper el control de lotes.
- **RF-6 – Control de caducidad (FEFO).** Para productos que `maneja_lotes`: vender siempre primero el lote que **antes caduca**, nunca despachar un lote caducado, y alertar antes de la caducidad.
- **RF-7 – Productos regulados.** Capturar número de **receta** y **identificación del comprador** cuando el producto lo requiere; campos de principio activo, laboratorio, forma farmacéutica y registro sanitario para fármacos.
- **RF-8 – Devoluciones.** Reembolso, cambio o nota de crédito, con repo de inventario y ajuste del estado de la venta.
- **RF-9 – Corte de caja.** Resumen esperado vs. contado por forma de pago con diferencia y cierre por turno.
- **RF-10 – Gastos y proveedores.** Registro de gastos (con proveedor), catálogo de proveedores.
- **RF-11 – Reportes y exportación.** Ventas por fechas, comisiones/utilidad por vendedor, exportación a **CSV y PDF**.
- **RF-12 – Auditoría.** Historial de actividad por usuario y trazabilidad de cada movimiento.
- **RF-13 – Continuidad de datos.** Respaldar (`export`) y restaurar (`import`) la base local.
- **RF-14 – Visibilidad en línea opcional.** Un **espejo resumido** hacia Supabase (solo subida, con cola de reintentos) para consultas/lecturas desde móvil, sin que la operación local dependa de ello.

## 5. Requisitos no funcionales

- **Rendimiento:** operaciones síncronas locales (`SQLite`) sin latencia de red; catálogos y buscadores responden a la velocidad de la PC.
- **Confiabilidad:** la venta jamás se bloquea por falta de internet; la sincronización es *best-effort* con reintento.
- **Seguridad:** `contextIsolation`, `sandbox`, CSP en la ventana, las credenciales de Supabase viven en la BD local de la propia PC, los totales de venta se **recalculan en el backend** (nunca se confía en lo que envía la UI), sentencias `prepared`, validación de entrada y bloqueo anti fuerza bruta en login.
- **Usabilidad:** interfaz en español, tema oscuro de alto contraste, navegación por teclado y **tours guiados** para nuevos cajeros.
- **Portabilidad de instalación:** instalador NSIS que instala la app y crea la BD automáticamente; y `node --test` para validar la lógica de negocio sin arrancar la ventana.

## 6. Usuarios destino

| Usuario | Perfil | Lo que hace |
|---|---|---|
| **Cajero / Vendedor** | Poco técnico | Hacer la venta, cobrar, registrar abonos, atender clientes y devoluciones. |
| **Encargado de almacén** | Técnico medio | Registrar productos, presentaciones, entradas/salidas, lotes y conteo físico. |
| **Administrador / Dueño** | Toma de decisiones | Usuarios, gastos, reportes, corte de caja, configuración, respaldos y sync. |

## 7. Criterios de aceptación (nivel alto)

1. Una PC con Windows sin internet puede iniciar sesión, vender de contado/crédito/a meses, imprimir ticket y hacer corte de caja.
2. Una venta de un producto con lotes descuenta **exactamente** de los lotes vigentes más próximos a caducar y nunca de un lote caducado.
3. Un conteo físico que sobra/baja inventario queda reflejado en stock, en `lotes` y en el historial de movimientos, sin inconsistencias.
4. Cada operación sensible queda registrada con usuario/fecha y la actividad es revisable por el administrador.
5. Un vendedor no puede ejecutar canales de administrador (gastos, reportes, usuarios, config) ni siquiera escribiendo directamente contra `window.api`.
6. La base se puede exportar e importar sin pérdida de datos.
7. La app instalada arranca y crea su base automáticamente (sin pasos manuales de instalación de servidores).