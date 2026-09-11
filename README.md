# Punto Venta Poblano

Aplicación de escritorio de Punto de Venta (POS) para Windows, construida con **Electron + React (Vite) + SQLite (better-sqlite3)**. Es una traducción funcional del sistema PHP + MySQL de referencia ("Punto Family" / TiendaPOS) a un stack de escritorio local, **sin dependencia de red ni servidor**: la base de datos vive en la propia PC y el negocio puede vender aunque no haya internet.

> - **Contexto y problemáticas que resuelve:** ver [`docs/CONTEXTO-Y-PROBLEMATICA.md`](docs/CONTEXTO-Y-PROBLEMATICA.md).
> - **Cómo está construido (arquitectura, seguridad, base de datos, IPC, sync):** ver [`docs/COMO-ESTA-ELABORADO.md`](docs/COMO-ESTA-ELABORADO.md).

---

## Funcionalidad de un vistazo

| Área | Qué hace |
|------|----------|
| **Punto de Venta** | Carrito, búsqueda de productos, ventas de contado / crédito / a meses, formas de pago, promociones automáticas, control de lotes (FEFO), venta de productos regulados y tique imprimible. |
| **Ventas a meses** | Calcula enganche, tasa de interés, cuota mensual y saldo pendiente; descuenta inventario y genera el seguimiento de cobro. |
| **Crédito y Abonos** | Registra abonos parciales por forma de pago, mantiene el saldo por cliente y deja historial de cada abono. |
| **Clientes** | Catálogo con datos fiscales, límite de crédito, saldo, historial de compras y creación rápida desde la venta. |
| **Inventario** | Productos con **presentaciones** (tallas, gramajes, presentación única), stock y stock mínimo por presentación, registro de entradas/salidas/ajustes. |
| **Lotes y caducidades** | Productos que "manejan lotes" (medicamentos, alimentos) se venden estrictamente FEFO (primero el que caduca antes) y alertan cuando algo está por caducar. |
| **Inventario Físico** | Conteo físico por presentación con ajuste automático y trazabilidad (nunca descuenta a ciegas el stock). |
| **Proveedores** | Catálogo de proveedores para vincular compras/reposiciones y gastos. |
| **Devoluciones** | Reembolso, cambio o nota de crédito, reintegro al inventario y registro de todo el movimiento. |
| **Corte de Caja** | Cuadre de efectivo/tarjeta/transferencia esperados contra lo contado, con diferencia y cierre por turno. |
| **Reportes** | Ventas por rango de fechas, comisiones y utilidad; exporta a **CSV** y **PDF**. |
| **Gastos** | Registro de gastos con categoría/forma de pago y reporte mensual. |
| **Usuarios** | Tres roles (admin, vendedor, almacén) con permisos por menú y por canal IPC. |
| **Sync en línea** | Espejo **opcional** hacia Supabase (solo subida) con cola de reintentos; la venta local nunca depende de ello. |
| **Configuración** | Datos del negocio, impresora de ticket (58/80 mm), importar/exportar base de datos, conectar Supabase. |

---

## Módulos a detalle

### 1. Login y control de acceso
- Autenticación por correo y contraseña **hash BCrypt**, con sesión por ventana en el proceso principal.
- **Protección contra fuerza bruta**: 5 intentos fallidos = bloqueo de 10 minutos.
- Los roles definen qué menús se ven **y** qué canales de IPC responden en el backend (doble barrera).
- Al cerrar sesión se invalida la sesión del proceso principal.

### 2. Dashboard
- Indicadores del día/turno: ventas del día, promedio de ticket, artículos vendidos, cortes de caja recientes.
- Gráficos basados en **SVG propios** (sin librerías externas de gráficos) y alertas de lotes por caducar.

### 3. Punto de Venta (`Ventas`)
- Catálogo por departamento/categoría + **búsqueda por nombre, código de barras o SKU** (busca mientras escribes).
- Carrito con cantidades, edición y eliminación de líneas.
- Cliente opcional; **creación rápida de cliente** desde la propia venta.
- **Tipos de venta:** `contado`, `crédito`, `a_meses`.
  - A meses: enganche, número de meses, tasa de interés → calcula **cuota mensual** y saldo pendiente automáticamente.
- **Formas de pago:** efectivo, tarjeta, transferencia (y combinables en crédito/contado).
- **Promociones automáticas** (porcentaje/monto fijo, por producto/categoría/departamento o global) y validación de vigencia.
- **Productos que manejan lotes:** el sistema descuenta **solo lotes vigentes, el que caduca primero (FEFO)** y avisa si no hay suficiente lote vigente o si nunca se capturó el lote.
- **Productos regulados:** si el producto lo requiere, pide número de receta y/o identificación del comprador, y los guarda en el detalle de la venta.
- Al cobrar: registra la venta + detalle, **descuenta stock** (de lotes si aplica), genera el **folio** (`VAAAAAMMDD-0001`, secuencial del día), guarda pagos/abonos y encola la sincronización.
- **Tique:** pide imprimir el ticket y lo manda a la impresora térmica configurada (58 o 80 mm, ancho de papel configurable).

### 4. Historial de Ventas
- Listado paginado/filtrado por folio, cliente, estado y rango de fechas.
- Ver detalle completo de cualquier venta y reimprimir ticket.

### 5. Crédito y Abonos
- Tarjeta de créditos activos con saldo, ordenable y con búsqueda.
- **Registrar abono** con monto y forma de pago; se registra en `pagos`, se actualiza el saldo del cliente y el saldo pendiente de la venta.
- Historial de abonos por venta.

### 6. Clientes
- Alta/edición con datos de contacto y **datos fiscales** (RFC, dirección/CP).
- **Límite de crédito** y saldo vigente.
- Historial de compras del cliente.

### 7. Devoluciones
- **Buscar por folio** la venta original.
- Modalidad: **reembolso**, **cambio** o **nota de crédito**, seleccionando los productos devueltos y su cantidad.
- Registra la devolución con detalle, **regresa el stock** (a lotes de reingreso si aplica) y ajusta el estado de la venta.

### 8. Inventario
- Productos con datos completos (SKU, código de barras, departamento, marca, modelo, color, material, costo, precio público, IVA, activo).
- **Presentaciones** por producto (p. ej. tallas 25/26/27, o presentación "Única"), cada una con su **stock** y **stock mínimo** de reposición.
- Campos especiales para productos regulados/perecederos: `requiere_receta`, `sustancia_controlada`, `iva`, `maneja_lotes`.
- **Registro de movimientos** (entrada, salida, ajuste) con motivo y usuario.
- Alertas de stock mínimo y de caducidad (días configurados).

### 9. Inventario Físico (Conteo)
- Permite capturar el **conteo real** por producto/presentación.
- El ajuste es inteligente para productos con lotes: una **baja** descuenta primero de los lotes más próximos a caducar; un **sobrante** se registra como lote `AJUSTE-FISICO` sin caducidad (queda evidencia y pendiente de capturar la caducidad real). Si la baja excede lo capturado en lotes, deja aviso en el motivo del movimiento.

### 10. Categorías
- Estructura **padre/hijo** (p. ej. Calzado → Deportivo, Ropa → Playeras) con activación/desactivación.

### 11. Proveedores
- Catálogo con contacto, teléfono, correo y notas; activar/desactivar.
- Servir de referencia para los **gastos** (`proveedor_id`) y compras.

### 12. Promociones
- Alta por **porcentaje** o **monto fijo**, ámbito (todos / departamento / categoría / producto) y vigencia.
- Se aplican automáticamente en el punto de venta cuando aplican.

### 13. Gastos
- Registro con concepto, monto, categoría, forma de pago, fecha y proveedor.
- Reporte/filtro por mes y categoría (solo administrador).

### 14. Reportes
- **Ventas por rango de fechas** (ingresos, formas de pago, desglose) y **comisiones/utilidad por vendedor**.
- Exportación a **CSV** y **PDF** (el HTML del PDF se genera en el proceso principal y se imprime/guarda con herramientas locales; sin servicios externos).

### 15. Usuarios (solo administrador)
- Alta/edición de vendedores y almacén con rol, contraseña y estatus activo.
- El administrador no se puede eliminar.

### 16. Revisión de Actividad (solo administrador)
- Resumen de actividad por usuario y detalle de sesiones/acciones recientes (auditoría).

### 17. Corte de Caja
- **Resumen del turno** automático: esperado de efectivo, tarjeta y transferencia + número de ventas.
- Captura de lo **contado realmente** en caja, cálculo automático de **diferencia** y cierre con estado `completado` u `omitido` (con motivo).
- Historial de cortes.

### 18. Mi Perfil
- El usuario autenticado cambia su nombre, correo y **contraseña** (verificando la contraseña actual).

### 19. Tutoriales
- **Tours guiados** paso a paso con superposición (`TourOverlay`) sobre la propia interfaz para aprender a operar el punto de venta.

### 20. Acerca de
- Información de la aplicación y versión.

### 21. Configuración (solo administrador)
- **Datos del negocio** (nombre y logo), que aparecen en la cabecera y en los tickets.
- **Impresión**: seleccionar impresora de ticket y ancho de papel 58/80 mm.
- **Base de datos**: exportar e importar el archivo `.db` (import = acción destructiva con confirmación).
- **Sync Supabase (opcional)**: vincular con correo/contraseña del proyecto, forzar sincronización, ver último sync, desconectar. La app funciona igual **sin** esto.

---

## Roles y permisos efectivos

| Menú | Admin | Vendedor | Almacén |
|------|:-----:|:--------:|:-------:|
| Dashboard / Punto de Venta | ✅ | ✅ | — |
| Historial de Ventas / Crédito / Clientes / Promociones | ✅ | ✅ | — |
| Devoluciones / Perfil / Tutoriales | ✅ | ✅ | ✅ |
| Inventario / Inventario Físico / Categorías / Proveedores | ✅ | — | ✅ |
| Gastos / Reportes / Usuarios / Revisión / Configuración / Corte | ✅ | — * | — |

> \* Corte de Caja y gastos/reportes son operaciones de administrador en el backend actual (los canales IPC están protegidos con `ROLES.ADMIN`). El backend además define el rol `vendedor` con acceso a `historial`, `clientes` y `lotes:alertas`.

Backend (autoritativo): `usuarios`, `corte`, `gastos`, `reportes`, `promociones:*`, `config:*`, `sync:*`, `revision/usuarios:*` → admin; ventas, crédito, clientes, devoluciones (básicas) → vendedor; productos, presentaciones, lotes, proveedores, categorías, inventario → almacén.

---

## Tema visual

- **Tema oscuro** único con variables CSS centralizadas en `src/theme.css` (fondo casi negro, paneles oscuros, acento ámbar `#f5a623`).
- Interfaz 100 % en español, pensada para uso con teclado/capturador en caja.

---

## Credenciales por defecto (datos semilla)

Al primer arranque la app crea el esquema y siembra datos de ejemplo (3 usuarios, 3 categorías, 3 productos con presentaciones/stock y 2 clientes).

| Rol     | Correo               | Contraseña   |
|---------|----------------------|--------------|
| Admin   | `admin@tienda.com`   | `admin123`   |
| Vendedor| `vendedor@tienda.com`| `vendedor123`|
| Almacén | `almacen@tienda.com` | `almacen123` |

> ⚠️ Cambiar las credenciales por defecto antes de usarlo en producción.

---

## Cómo ejecutar en desarrollo

```bash
cd "C:\Trabajos ADRIAN\punto-venta-poblano"
npm install
npm run dev          # Vite (5173) + Electron
```

Si el módulo nativo `better-sqlite3` no compiló contra el ABI de Electron:

```bash
npx electron-rebuild -f -w better-sqlite3
```

## Cómo compilar el instalador de Windows

```bash
npm run electron:build   # vite build + electron-builder (instalador NSIS en dist-installer/)
```

## Probar

```bash
npm test   # corre electron --test sobre electron/__tests__ (node:test)
```

---

## Dónde vive la base de datos

```
<userData de Electron>/data/data.db   →  %APPDATA%\punto-venta-poblano\data\data.db
```

Se eligió `userData` (y no la carpeta del ejecutable) para garantizar permisos de escritura tanto en desarrollo como en la app instalada. La app opera **100 % offline**; la sincronización a Supabase es un espejo opcional.