# Cómo está elaborado el proyecto

Documento técnico de **Punto Venta Poblano**: arquitectura, procesos, seguridad, esquema de base de datos, superficie IPC, sincronización, impresión, pruebas y empaquetado. Complementa a [`README.md`](../README.md) (funcionalidad) y a [`CONTEXTO-Y-PROBLEMATICA.md`](CONTEXTO-Y-PROBLEMATICA.md) (por qué existe).

## 1. Arquitectura general

```
┌──────────────────────────────────────────────────────────────────┐
│ Proceso principal (Main)  — Electron / Node.js                    │
│                                                                  │
│  main.js (BrowserWindow, seguridad)                              │
│   │                                                              │
│   ├── db.js ─────────────→ SQLite (better-sqlite3) ─→ data.db    │
│   │      (open/migrate/seed)                                     │
│   ├── ipcHandlers.js ──── todos los canales ipcMain.handle       │
│   │      (validación, ROLES, sesiones por ventana)               │
│   ├── logicaFarmacia.js ── lógica de lotes/FEFO (testeable)      │
│   ├── supabaseSync.js ─── espejo opcional a Supabase (cola)      │
│   └── ticket.js ────────── generación de ticket HTML             │
│                     ▲                                             │
│      contextBridge   │ IPC (solo canales permitidos)             │
│ ────────────────────┼────────────────────────────────────────    │
│  Preload (preload.js)│  expone window.api.* (whitelist)          │
│ ────────────────────┼────────────────────────────────────────    │
│                     ▼                                             │
│ Proceso de renderizado (Renderer) — React + Vite                 │
│  src/App.jsx (SPA por estado, AuthContext, navegación por rol)   │
│  src/pages/* (22 vistas)  src/components/*  src/hooks/*          │
│  src/utils/* (CSV, PDF, ticket)  src/tours/*  src/theme.css      │
└──────────────────────────────────────────────────────────────────┘
```

- **El renderer nunca importa `better-sqlite3` ni Node.** Toda lectura/escritura es IPC sobre `window.api.*`.
- El esquema de base de datos (`electron/schema.sql`) se ejecuta **en el proceso principal** al abrir la BD.

## 2. Procesos y archivos clave

| Archivo | Responsabilidad |
|---|---|
| `electron/main.js` | Creación de `BrowserWindow`, política de seguridad (ver §3), mapeo de preload, carga de `dist/index.html` o Vite dev. |
| `electron/preload.js` | `contextBridge.exposeInMainWorld('api', …)` con **whitelist** explícita de canales agrupados por dominio (`ventas`, `lotes`, `proveedores`, `productos`, …). |
| `electron/db.js` | `openDatabase(path)` → mkdir, `PRAGMA foreign_keys=ON`, `PRAGMA journal_mode=WAL`, migraciones y seed. Expone `generateFolio()`. |
| `electron/schema.sql` | DDL idempotente (`CREATE TABLE IF NOT EXISTS`) + índices. |
| `electron/ipcHandlers.js` | Registra `ipcMain.handle` para ~75 canales, todos con `proteger(ROL, …)`. |
| `electron/logicaFarmacia.js` | Algoritmos de lotes/FEFO y reconciliación de conteo físico, aislados de `ipcMain` para ser probados con `node:test`. |
| `electron/supabaseSync.js` | Sincronización opcional (solo subida) con cola y reintentos. |
| `electron/ticket.js` | HTML del ticket térmico (58/80 mm). |
| `src/App.jsx` | Estado de sesión (`AuthContext`), menú filtrado por `ROL_PERMISOS`, navegación por estado (sin router). |
| `src/pages/*` | 22 vistas React. |
| `src/theme.css` | Sistema de diseño (tema oscuro, variables CSS). |

## 3. Seguridad

1. **Ventana aislada.** `contextIsolation: true`, `nodeIntegration: false`, `sandbox` habilitado, `devTools` deshabilitado en producción.
2. **CSP** en `index.html`; navegación de ventana controlada (bloqueo de ventanas nuevas/cargas externas).
3. **Superficie IPC mínima:** solo los canales expuestos en `preload.js`; nada más llega al main.
4. **Sesiones por webContents:** `auth:login` crea una sesión (`Map webContents.id → usuario`) que el resto de handlers verifican; `auth:logout` la invalida.
5. **Anti fuerza bruta:** 5 intentos fallidos → 10 min de bloqueo por correo (`intentosLogin`).
6. **Total de caja calculado en el backend:** `ventas:procesar` **recalcula** subtotales, descuentos e impuestos con la BD (no confía en los totales del renderer).
7. **`prepared statements`** en todas las consultas; entrada validada con `esTextoValido`, `esEmailValido`, `esNumeroValido`, `esEnteroValido` y acotada con `limpiar()`.
8. **Passwords con `bcryptjs`** (también la verificación en cambio de contraseña).
9. **Roles dobles:** `App.jsx` → `ROL_PERMISOS` (menú) y `ipcHandlers.js` → `ROLES`/`proteger()` (canales). Un rol sin permiso no ejecuta el canal aunque lo llame directo.
10. Datos sensibles (URL/clave de Supabase) residen únicamente en la BD local de la PC; nunca se registran en logs ni se exponen al renderer salvo estado de sync.

## 4. Base de datos (SQLite)

**Ubicación:** `<userData de Electron>/data/data.db` → `%APPDATA%\punto-venta-poblano\data\data.db`.

**Bootstrap (`db.js::openDatabase`):**
1. Crea carpeta si falta.
2. Marca `foreign_keys = ON` y `journal_mode = WAL`.
3. **Migración de renombrado:** si existía la tabla `tallas`/columna `talla_id` (nomenclatura antigua de zapatería), la renombra a `presentaciones`/`presentacion_id` **antes** de aplicar el schema para no perder inventario capturado.
4. Aplica `schema.sql` (idempotente).
5. Inserta `app_config` si no existe.
6. Aplica **migraciones ligeras** (`ensureColumn`): columnas nuevas sobre instalaciones existentes (impresión, supabase, campos de farmacia en `productos`/`ventas_detalle`/`gastos`).
7. Si la BD es nueva, `seed()` siembra usuarios demo, categorías, productos + presentaciones y clientes.

**Tablas (18):** `usuarios`, `categorias`, `productos`, `presentaciones`, `inventario_movimientos`, `clientes`, `promociones`, `ventas`, `ventas_detalle`, `pagos`, `devoluciones`, `devoluciones_detalle`, `gastos`, `app_config`, `sync_queue`, `cortes_caja`, `lotes`, `proveedores`.

**Filas y validaciones clave:**
- `ventas.tipo_venta ∈ contado|credito|a_meses`; `estado ∈ pagada|pendiente|credito|a_meses|devuelta|cancelada`.
- `stock` del inventario **siempre se descuenta al vender**; el detalle se guarda en `ventas_detalle` con el precio congelado.
- `app_config` es fila única (`id=1`).
- `sync_queue` guarda la cola de subida pendiente; `lotes` es la fuente de verdad de caducidad.
- Índices en las claves foráneas más consultadas (lotes por presentación y caducidad, ventas por cliente/tipo, movimientos, etc.).

## 5. Lógica de farmacia / lotes (`logicaFarmacia.js`)

Regla de oro documentada en el propio archivo: **la tabla `lotes` es la única fuente de verdad de cuándo caduca cada unidad**; `presentaciones.stock` es un total cacheado que siempre debe coincidir con `SUM(lotes.cantidad)` cuando `maneja_lotes=1`.

| Función | Qué hace |
|---|---|
| `seleccionarLotesFEFO(db, presentacionId, cantidad, hoyIso)` | Elige qué lotes descontar para vender `n` unidades ordenando por caducidad ascendente (nulos al final) y **jamás tomando lotes caducados**. No escribe; devuelve `deducciones` o `{ok:false}` distinguiendo **falta de lotes capturados** (`sinLotesCapturados`) de **stock vigente insuficiente**. |
| `aplicarDeducciones(db, deducciones)` | Aplica los `UPDATE lotes` dentro de la transacción del llamador. |
| `reconciliarStockPresentacion(db, presentacionId, nuevoStock, …)` | Ajuste de conteo físico/edición sin UPDATE ciego: baja → descuenta los lotes más próximos a caducar (y si la baja excede lo capturado lo avisa en el motivo); sube → crea un lote **AJUSTE-FISICO** sin caducidad para conservar trazabilidad. Registra `inventario_movimientos` tipo `ajuste`. |

Esta capa está **aislada de `ipcMain`** a propósito para poder probarla con `node:test` sin levantar Electron (§8).

## 6. Superficie IPC (~75 canales)

Todos los canales se registran con `proteger(rol, handler)`; los grupos de roles se definen en constantes `ROLES = { ANY, VENTAS, ALMACEN, ADMIN }`.

| Dominio | Canales | Roles |
|---|---|---|
| `auth` | `login`, `logout`, `changePassword`, `updateProfile` | `login` abierto; por sesión |
| `usuarios` | `list`, `save`, `delete`, `resumenActividad`, `actividad` | ADMIN |
| `categorias` | `listAll`, `save`, `toggle`, `delete` | ALMACEN |
| `productos` | `list`, `departamentos`, `presentaciones`, `save`, `delete`, `updateStock`, `addPresentacion` | ALMACEN (list es ALMACEN) |
| `lotes` | `list`, `add`, `delete` (ALMACEN); `alertas` (ANY) | ALMACEN / ANY |
| `ventas` | `buscarProducto`, `catalogo`, `departamentos`, `buscarCliente`, `procesar`, `detalle` | VENTAS |
| `clientes` | `crearRapido`, `list`, `historial`, `save`, `delete` | VENTAS (`list` ANY) |
| `historial` | `list` | ANY |
| `credito` | `list`, `abonar`, `historialAbonos` | VENTAS |
| `devoluciones` | `buscarVenta`, `registrar`, `list`, `delete` | ANY (`delete` ADMIN) |
| `proveedores` | `list`, `save`, `toggle`, `delete` | ALMACEN |
| `gastos` | `list`, `save`, `delete` | ADMIN |
| `promociones` | `activas` (VENTAS), `list`, `save`, `toggle`, `delete` (ADMIN) | VENTAS / ADMIN |
| `reportes` | `generar`, `exportarPdf` | ADMIN |
| `corte` | `resumen`, `registrar`, `list` | VENTAS |
| `config` | `getNegocio`, `setNegocio`, `getImpresion`, `setImpresion`, `dbInfo`, `exportDb`, `importDb` | get=ANY, resto ADMIN |
| `sync` | `estado`, `configurar`, `desconectar`, `forzar`, `cancelar`, `reenviarTodo` | ADMIN |
| `impresoras`/`ticket` | `impresoras:list`, `ticket:imprimir` | VENTAS |

El handler `ventas:procesar` es el corazón: valida tipo de venta, aplica promociones, recalcula montos, chequea y descuenta lotes FEFO/caducidad para productos que `maneja_lotes`, genera folio, guarda venta + detalle + pagos y encola sync.

## 7. Sincronización con Supabase (opcional)

- **Dirección:** solo subida ("espejo resumido"); la app de escritorio es la dueña de los datos.
- Cada cambio relevante (ventas, gastos, movimientos de stock, cortes, etc.) se **encola en `sync_queue`** con `operacion ∈ upsert|delete`.
- Un proceso en segundo plano intenta subir los pendientes en lotes; si falla (sin internet), **reintenta** acumulando `intentos`/`ultimo_error` — jamás bloquea la operación local.
- Configuración por `app_config` (`supabase_*`) + canales `sync:*` (admin). Existen SQL de apoyo en `docs/` (`supabase_schema.sql`, `supabase_policies_escritura.sql`, `supabase_reportes_extra.sql`) para montar el lado remoto.

## 8. Pruebas

```bash
npm test
```

- Se ejecuta con el binario de Electron como Node: `ELECTRON_RUN_AS_NODE=1 electron --test electron/__tests__/` (usa `node:test`, sin levantar ventana).
- **`__tests__/logicaFarmacia.test.js`** — cubre `seleccionarLotesFEFO` (orden FEFO, rechazo de caducados, insuficiencia, sin lotes) y `reconciliarStockPresentacion` (bajas/altas, lote AJUSTE-FISICO, movimiento registrado).
- **`__tests__/dbMigration.test.js`** — valida el bootstrap/migraciones sobre una BD en memoria.

## 9. UI (renderer)

- **SPA sin router:** la vista activa vive en el estado de `src/App.jsx`; el menú se filtra por `ROL_PERMISOS` y los ítems `adminOnly`.
- **`AuthContext`** guarda el usuario autenticado y expone `logout`.
- **Gráficos en SVG propios** (Dashboard) sin librerías externas; **CSV/PDF** generados con utilidades internas (`src/utils`).
- **Tickets** renderizados como HTML para impresión/exportación PDF.
- **Tours guiados** (`src/tours/TourContext.jsx` + `TourOverlay.jsx`) con pasos de superposición.
- **Tema oscuro** por variables CSS en `src/theme.css`; sin dependencias de UI.

## 10. Construcción y empaquetado

Scripts (`package.json`):
- `dev` — `concurrently` + `wait-on`: Vite en `:5173` y Electron apuntando a la URL de dev.
- `build` — `vite build` → `dist/`.
- `electron:build` — `vite build` + `electron-builder` → instalador **NSIS** en `dist-installer/` (`appId: com.puntofamily.puntoventa`, `productName: Punto Venta Poblano`).
- `test` — pruebas (`node:test` en runtime de Electron).
- `postinstall` — recompila `better-sqlite3` contra el ABI de Electron (`electron-builder install-app-deps`), para evitar binarios de Node del sistema.

`better-sqlite3` se eligió por tener binarios precompilados para el runtime de Electron (a diferencia de `node:sqlite`, experimental e indisponible en el Node empaquetado de Electron).

## 11. Estructura de carpetas

```
punto-venta-poblano/
├── electron/
│   ├── main.js            # ventana + seguridad
│   ├── preload.js         # window.api.* (whitelist)
│   ├── db.js              # bootstrap, migraciones, seed
│   ├── schema.sql         # DDL + índices
│   ├── ipcHandlers.js     # ~75 canales con roles y validación
│   ├── logicaFarmacia.js  # FEFO / lotes / reconciliación
│   ├── supabaseSync.js    # espejo opcional a Supabase
│   ├── ticket.js          # HTML de ticket
│   └── __tests__/         # pruebas node:test
├── src/
│   ├── App.jsx            # sesión, menú, SPA
│   ├── pages/             # 22 vistas
│   ├── components/        # UI reutilizable (CorteCajaModal, etc.)
│   ├── hooks/             # useNegocio, etc.
│   ├── utils/             # CSV/PDF/ticket
│   ├── tours/             # tours guiados
│   └── theme.css
├── docs/
│   ├── CONTEXTO-Y-PROBLEMATICA.md
│   ├── COMO-ESTA-ELABORADO.md
│   └── supabase_*.sql     # lado remoto
├── vite.config.js / index.html   # build + CSP
└── package.json
```

## 12. Deudas técnicas y mejoras sugeridas

- Los totales se validan en el backend, pero conviene **ampliar cobertura de pruebas** a `ipcHandlers.js` (hoy las pruebas cubren la capa de farmacia y las migraciones).
- `ROL_PERMISOS` existe duplicado (UI en `src/App.jsx` y lista en `ipcHandlers.js`); es una doble fuente de verdad: la fuente autoritativa de permisos de canales son las constantes `ROLES` usadas por `proteger()`.
- El `ROLES`/permisos de UI no incluyen `gastos`/`reportes` para vendedor pese a que la lista `ROL_PERMISOS` de backend los menciona — los canales están efectivamente restringidos a ADMIN.
- La exportación CSV no sanitiza el riesgo de **inyección de fórmulas** (conveniente anteponer `=`/`+`/`-`/`@` o comillas, o exportar JSON).
- Considerar `npm audit` / actualizaciones de dependencias y un lint automatizado (ESLint/Prettier) al pipeline.