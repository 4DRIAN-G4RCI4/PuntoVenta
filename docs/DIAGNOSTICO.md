# INFORME DE AUDITORÍA INTEGRAL — Punto de Venta Poblano (Electron POS)

## 🟢 Actualización 2026-09-20 — Los 4 críticos (P0) ya están corregidos

Antes de generar el instalador para producción se corrigieron los 4 hallazgos
**CRÍTICOS** de la sección 5 (dinero/datos). Evidencia: `npm test` pasa
**17/17** (6 pruebas nuevas específicas para estos hallazgos), `vite build`
limpio. Detalle de cada corrección:

- **C1 — Devolución no reintegraba a lotes** → ahora pasa siempre por
  `reconciliarStockPresentacion()`, creando un lote identificable `"DEV-VENTA"`
  en vez de un alta ciega al total. Prueba: `devoluciones.test.js` ("C1 —
  devolver stock a un producto con lotes...").
- **C2 — Devolución no revertía crédito/caja** → se extrajo la lógica de
  dinero a `calcularReversionDevolucion()` (testeable y probada con 4 casos:
  reembolso sin deuda, nota de crédito que cancela deuda sin sacar dinero,
  reembolso que primero cancela deuda y regresa el resto en efectivo, y
  devolución que salda la deuda sin ser el 100% de la venta). Un "reembolso"
  ahora genera un gasto real (`categoria='devoluciones'`) visible en Reportes.
  Además, las ventas devueltas al 100% (`estado='devuelta'`) y las canceladas
  ya se excluyen de Ventas Hoy/Mes, el reporte Financiero y "menos vendidos"
  (antes solo se excluían las canceladas).
- **C3 — Venta a crédito se guardaba pagada** → `src/pages/Ventas.jsx`: el
  `pagado || total` que sustituía un monto vacío por el total completo ahora
  solo aplica a ventas de contado; en crédito, vacío significa **$0 recibido**
  de verdad.
- **C4 — Backup podía perder ventas recientes (WAL)** → `config:exportDb`
  usa `VACUUM INTO` (vía `db().prepare('VACUUM INTO ?').run(...)`) en vez de
  copiar el archivo `.db` vivo con `fs.copyFileSync`. Prueba: `devoluciones.test.js`
  ("C4 — VACUUM INTO produce un backup completo...").

**Lo que queda pendiente y NO se tocó en esta pasada** (fuera del alcance
acordado — están en la sección 17, Matriz de Riesgos, con su prioridad):
credenciales demo visibles en login (A4), doble clic duplica ventas/abonos
(A1), descuentos sin validar contra promociones (A2), `refresh_token` en
texto plano (A5), backup automático programado (parte de C4, la corrección
manual ya es correcta), y el resto de hallazgos ALTOS/MEDIOS/BAJOS.

---

**Fecha:** 2026-09-14
**Alcance:** Revisión completa del código fuente, base de datos, sincronización, scripts, documentación y pruebas del proyecto `punto-venta-poblano`.
**Método:** Lectura exhaustiva de archivos con evidencia `archivo:línea`, contraste frontend↔backend (canales IPC, roles, payloads), revisión de políticas RLS de Supabase, ejecución real de las pruebas (`npm test`: 11/11 OK) y `npm audit`.
**Regla aplicada:** SOLO DIAGNÓSTICO. No se modificó ningún archivo de código. Las soluciones propuestas están pendientes de autorización.

---

## 1. Resumen Ejecutivo

El sistema es sólido en su **capa servidor**: modelo de sesiones por ventana, validación `proteger(ROLES.*)` en todos los canales sensibles, `contextIsolation`+`sandbox`, `preload` con canales por lista blanca, `prepared statements`, recálculo de precios/totales **siempre del lado servidor**, FEFO en lotes y transacciones SQLite. La arquitectura como POS offline-first es correcta y el código es legible y consistente.

Sin embargo, la auditoría encontró **4 problemas críticos que afectan dinero o datos**, concentrados en el **flujo de devoluciones**, el **registro de ventas a crédito** y el **backup de la base de datos**:

1. **Las devoluciones reintegran stock solo a `presentaciones` y NO a lotes** (`ipcHandlers.js:827`) → en productos con `maneja_lotes=1` se rompe la invariante `stock = SUM(lotes.cantidad)`, lo que corrompe FEFO y las alertas de caducidad del Dashboard.
2. **La devolución no deshace crédito ni caja** (`ipcHandlers.js:829`): marca toda la venta `'devuelta'` sin ajustar `saldo_pendiente`/`monto_pagado`/`clientes.saldo_deuda`, y un "reembolso" **no genera ningún egreso de dinero** → el cliente sigue debiendo lo devuelto y la caja no cuadra.
3. **Una venta "a crédito" se registra automáticamente como pagada** (`src/pages/Ventas.jsx:124/176`, `payload.monto_pagado = pagado || total`) → con monto vacío/0 no se crea deuda y no se descuenta nada. No existe crédito puro en la práctica.
4. **Exportar/importar la BD en modo WAL copia el archivo vivo** sin checkpoint → una copia/backup puede perder las ventas más recientes.

A esto se suman hallazgos altos de seguridad (contraseñas por defecto conocidas, token de sincronización guardado en texto plano, políticas RLS sobre-permisivas), riesgo de **duplicados por doble clic** (incluido COBRAR y Registrar Abono) y scripts que **escriben directamente sobre la BD de producción**.

**Calificación general: 66/100.**

---

## 2. Metodología y Alcance

Archivos revisados con lectura directa o delegación a agentes de auditoría con instrucciones de contraste de permisos:

| Capa | Archivos |
|---|---|
| Núcleo Electron | `electron/main.js`, `preload.js`, `ipcHandlers.js` (1234 líneas, completo), `db.js`, `schema.sql`, `supabaseSync.js` (413 líneas) |
| Frontend | `src/App.jsx`, `main.jsx`, 16 páginas en `src/pages/`, componentes (`Modal`, `Charts`, `UpdateBanner`, `CorteCajaModal`), hooks (`useNegocio`, `useAcento`), tours (`TourContext`, `TourOverlay`, `DemoSteps`, `tours.js`) |
| Utils/Formato | `format.js`, `csv.js`, `ticketHtml.js`, `pdf.js`, `image.js`, `useImprimirTicket.js` |
| Scripts/Docs SQL | `scripts/seedTestData.js`, `fixSeedRoles.js`, `docs/supabase/*.sql` (schema, políticas RLS, reportes extra, rename) |
| Pruebas | `electron/__tests__/logicaFarmacia.test.js`, `dbMigration.test.js` |
| Ejecución | `npm test` (11/11 OK) y `npm audit --omit=dev` |

Convenciones del informe: se distingue entre "existe en código", "está implementado" y "está probado". Todo lo que no se pudo verificar en ejecución se marca **NO VERIFICADO**. Nunca se exponen secretos (URL de Supabase publicada, credenciales de cuenta, contraseñas de seed): se indican por nombre de archivo y línea.

---

## 3. Arquitectura y Stack

| Componente | Detalle | Veredicto |
|---|---|---|
| Runtime | Electron 32 + better-sqlite3 | ✅ |
| Frontend | React 18 + Vite 5 (SPA sin router; navegación por estado en `App.jsx`) | ✅ Simplicidad intencional |
| Persistencia | SQLite local (única fuente de verdad), WAL | ✅ Offline-first real |
| Sincronización | Solo-subida a Supabase (espejo de resúmenes para app móvil de lectura) | ⚠️ Ver FASE Seguridad |
| Comunicación | IPC whitelist vía `contextBridge` en `preload.js`; `invoke` con canales explícitos | ✅ |
| Instalador/actualizaciones | NSIS + electron-updater (autoUpdate configurado en `main.js`) | ✅ |

Puntos fuertes del núcleo (confirmados leyendo `ipcHandlers.js` completo):

- **Sesiones por ventana**: `Map(webContents.id → usuario)`; el logout cierra la sesión webContents. El renderer **no** confía en sí mismo para autorizar.
- `proteger(ROLES.*)` en cada handler sensible (ventas, crédito, corte, gastos, usuarios, ajustes de inventario, config).
- **Server-side recalculation**: en `ventas:procesar` y `devoluciones:registrar` los precios/totales se recalculan desde la BD; el cliente solo aporta productos y cantidades.
- Validaciones utilitarias (`esTextoValido`, `esEmailValido`, `esNumeroValido`, `esEnteroValido`, `limpiar`) aplicadas de forma sistemática.
- Bloqueo por intentos fallidos de login (5 fallos → 10 min) y un solo `data.db` por instalación.

---

## 4. Estructura y Módulos del Sistema

| Módulo | ¿Existe? | ¿Implementado y coherente? | ¿Probado? |
|---|---|---|---|
| Autenticación y roles (admin/vendedor/almacén) | ✅ | ✅ | ❌ Sin test |
| Ventas (efectivo/tarjeta/transferencia + crédito/a_meses) | ✅ | ⚠️ Crédito roto, doble clic | ❌ Sin test |
| Devoluciones (reembolso/cambio/nota_credito) | ✅ | 🔴 No reintegra lotes, no revierte caja | ❌ Sin test |
| Crédito y abonos | ✅ | ⚠️ Doble clic en abono | ❌ Sin test |
| Inventario, lotes, caducidades (FEFO) | ✅ | ✅ | ✅ Parcial (utilidades) |
| Conteo físico (ajuste) | ✅ | ⚠️ Fallo silencioso, sin confirmación | ❌ |
| Corte de caja | ✅ | 🔴 Auto-correlacionado y mal atribuido | ❌ |
| Clientes / Proveedores / Categorías / Promociones | ✅ | ⚠️ Problemas de validación y doble clic | ❌ |
| Gastos y Reportes (PDF) | ✅ | ⚠️ Listas frágiles | ❌ |
| Usuarios y Revisión (actividad) | ✅ | ✅ (admin) | ❌ |
| Sync Supabase | ✅ | ⚠️ RLS/token | ❌ |
| Dashboard con gráficas | ✅ | ⚠️ Carga frágil, canales con rol superior | ❌ |
| Tours guiados, temas, acento, actualizador | ✅ | ✅ | ❌ |

---

## 5. Hallazgos Críticos (P0)

### C1 — Devolución reintegra stock a `presentaciones` pero NO a lotes
- **Archivo/línea:** `electron/ipcHandlers.js:827` (`UPDATE presentaciones SET stock=stock+? WHERE id=?`).
- **Problema:** la devolución suma directamente al stock total **sin pasar por `lotes`** ni por `reconciliarStockPresentacion()`. Para productos con `maneja_lotes=1`, se rompe la invariante `stock = SUM(lotes.cantidad)` que mantiene la lógica de farmacia.
- **Riesgo/impacto:** FEFO deja de descontar correctamente, alertas de caducidad del Dashboard (`lotes.alertas`) pueden vender stock ya devuelto sin fecha; inventario inconsistente. **Severidad: CRÍTICA — integridad de inventario.**
- **Evidencia:** contraste `ipcHandlers.js:827` (devolución directa) vs el flujo correcto en `ventas:procesar` (usa `seleccionarLotesFEFO`/`reconciliarStockPresentacion` según se vio en `logicaFarmacia.test.js:119-141`).
- **Solución:** en la devolución, para presentaciones con `maneja_lotes=1`, crear un lote de ingreso (ej. ajuste `DEV-VENTA`) con fecha de caducidad de la venta o llamar `reconciliarStockPresentacion(presentacionId)` tras el alta, y encolar sync de lotes.

### C2 — La devolución no deshace crédito y el "reembolso" no genera egreso
- **Archivo/línea:** `electron/ipcHandlers.js:829` (`UPDATE ventas SET estado='devuelta' WHERE id=?`), en bloque transaccional de `:798-832`.
- **Problema:**
  - Marca **toda la venta** como `devuelta` aunque la devolución sea parcial.
  - No corrige `saldo_pendiente`/`monto_pagado` ni `clientes.saldo_deuda` para ventas a crédito → el cliente sigue debiendo un artículo ya devuelto.
  - El tipo `reembolso` solo guarda `monto_total` informativo (columna `tipo_devolucion`); **no registra egreso de caja** ni afecta `cortes_caja`.
  - Las ventas devueltas **siguen contando** en "Ventas Hoy/Mes" del Dashboard y reportes (`reportes.generar` agrupa por `ventas` sin excluir `devuelta`; solo `cancelada` se excluye en `calcularEsperado`).
- **Riesgo/impacto:** Cuentas por cobrar falsas, caja que nunca cuadra, estado financiero distorsionado. **Severidad: CRÍTICA — dinero.**
- **Solución:** en la transacción de devolución: (a) recalcular `saldo_pendiente`/`monto_pagado` según `monto_total` devuelto y tipo (si reembolso), restar de `clientes.saldo_deuda`; (b) registrar el egreso en una tabla de movimientos de caja consultable por el corte; (c) añadir estado de parcialidad (`devuelto_parcial`) y quitar de los reportes las ventas íntegramente devueltas o contabilizarlas netas.

### C3 — La venta "a crédito" se guarda como pagada (deuda nunca se crea)
- **Archivo/línea:** `src/pages/Ventas.jsx:124/176` (`payload.monto_pagado = pagado || total;`) enviado a `ventas:procesar`.
- **Problema:** si el usuario deja el monto recibido vacío/0 en una venta a crédito, el campo se rellena con el total → el backend registra `estado='pagada'`, `monto_pagado=total`, `saldo_pendiente=0`. No hay camino de UI para registrar crédito puro, y un pago parcial no descuenta su saldo.
- **Riesgo/impacto:** el crédito no existe tal como está enunciado en la documentación; ventas registradas como pagadas sin cobrar. **Severidad: CRÍTICA — dinero y funcionalidad declarada.**
- **Solución:** eliminar `|| total`; enviar el monto real y dejar que el backend derive estado/saldo (`esEnteroValido`>0, y si `forma_pago` es crédito/a_meses y `monto_pagado<total` → `estado='credito'` con `saldo_pendiente`). Añadir test de `ventas:procesar` para crÉdito/parcial.

### C4 — Backup/export de BD en modo WAL puede perder datos recientes
- **Archivo/línea:** `config:exportDb` / `config:importDb` en `electron/ipcHandlers.js` (copia de archivo `data.db` vivo).
- **Problema:** con WAL activo, los cambios confirmados viven en `data.db-wal` hasta el checkpoint; copiar solo `data.db` produce un backup **incompleto**. Además no hay scheduler de backup automático.
- **Riesgo/impacto:** el export que el usuario cree "respaldo" puede carecer de las últimas ventas; si importa esa copia, pierde datos. **Severidad: CRÍTICA — disponibilidad de datos.**
- **Solución:** ejecutar `PRAGMA wal_checkpoint(PASSIVE)` (o `FULL`) antes de copiar; o mejor usar la API de `better-sqlite3` `db.backup()` / `VACUUM INTO 'archivo'`; programar copia diaria con rotación y validar integridad al importar.

---

## 6. Seguridad

### 6.1 Fortalezas confirmadas
- `index.html` incluye **CSP** estricta.
- `preload.js` expone solo canales explícitos con `contextBridge`; `sandbox: true` e `contextIsolation` (no se verificó el valor exacto del `webPreferences` en `main.js` — NO VERIFICADO en ejecución).
- **Brute-force:** bloqueo de cuenta por 5 intentos fallidos por 10 minutos.
- Passwords con bcrypt; hashes en `usuarios.password`.
- `reportes:exportarPdf` escribe el HTML en un `BrowserWindow` sin `nodeIntegration`.
- CSV: la inyección de fórmulas **sí** está mitigada (`neutralizarFormula` antepone `'`).

### 6.2 Hallazgos
- **A4 — Credenciales por defecto conocidas (ALTA):** `electron/db.js:113-115` siembra `admin@tienda.com/admin123`, `vendedor123`, `almacen123`; `src/pages/Login.jsx:4` **prellena el correo del admin** y la pantalla de login muestra las credenciales demo. Si no se cambian, cualquiera con la app accede como admin.
  - **Solución:** Forzar cambio de contraseña en el primer login para los 3 usuarios seed (flag `debe_cambiar_password`), no prellenar, y quitar las credenciales de la pantalla de login.
- **A5 — Token de sincronización en texto plano + credenciales embebidas (ALTA):** `electron/supabaseSync.js:21-22` contiene la URL y anon-key del proyecto (publishable, no secretas per se) y `:56`/`:82` guardan `supabase_refresh_token` y `supabase_email` **en claro** en `app_config`. Con acceso al `data.db` (o a un backup mal protegido) se reproduce un token vivo que da acceso a los datos remotos. Los valores completos **no** se reproducen en este informe.
  - **Solución:** cifrar el `refresh_token` con `safeStorage` (Electron) antes de persistir; rotar el token actual en la consola de Supabase (el cambio de contraseña revoca), y documentar que URL/anon son publicables solo porque la RLS lo admite.
- **A6 — Políticas RLS sobre-permisivas (ALTA):** en `docs/supabase/supabase_policies_escritura.sql` (`:7-8, 12-13, 18-20, 24-25`) y `supabase_reportes_extra.sql` (`:63-88`) todas las escrituras usan `with check (true)` / `using (true)` para cualquier rol `authenticated`, **sin filtro por `auth.uid()`**, y los SELECT también son globales. Un segundo usuario/equipo conectado al mismo proyecto de Supabase tendría lectura y escritura totales sobre ventas, stock, cortes, créditos y devoluciones.
  - **Solución:** por cada tabla, políticas donde el `auth.uid()` coincida con el dueño del tenant (columna `created_by` o `owner_id`), o migrar a un proyecto por negocio con `service_role` restringido.
- **M12 — `updates:instalarYReiniciar` expuesto a ROLES.ANY (MEDIA):** cualquier empleado autenticado puede forzar instalación/reinicio. Intencional (comentario en `ipcHandlers.js:1114-1116`) pero es una acción de disponibilidad; restringir a admin.
- **M13 — Escapado parcial del ticket (BAJA/MEDIA):** `ticketHtml.js`/`pdf.js` escapan `&`, `<`, `>` con `esc()` pero no comillas; usado en contexto de texto → riesgo teórico. El logo se acepta como `data:image/*` (incluye SVG con `<script>`, `ipcHandlers.js:1039`) y se pinta en `<img>`; self-XSS solo por el admin. `image.js` no tiene timeout (BAJA).
- **B1 — `config:getNegocio` sin proteger (BAJA):** devuelve nombre/logo; requerido para la pantalla de login (no filtra secreto; exposición mínima).
- **XSS:** sin `dangerouslySetInnerHTML` en `src/`; React escapa textos y atributos SVG en `Charts.jsx` (verificado). No hay vector de XSS real.

---

## 7. Sistema POS (Lógica de Negocio)

- **C1/C2/C3:** ver sección 5 (críticos).
- **A1 — Duplicados por doble clic (ALTA):** todos los botones de "Guardar"/"Registrar"/"COBRAR" carecen de bloqueo mientras se envía. El backend es síncrono, así que dos clics = dos registros reales:
  - `Credito.jsx:24-32` "Registrar Abono" → **dos abonos** (un abono doble de $100 en una deuda de $150 la deja saldada en $200 — bug de dinero directo).
  - `Ventas.jsx` COBRAR → dos ventas.
  - Guardar en `Clientes.jsx:23-29`, `Gastos.jsx:30-36`, `Promociones.jsx:22-28`, `Categorias.jsx`, `Proveedores.jsx`, `Usuarios.jsx`.
  - **Solución:** estado `enviando` (deshabilitar botón + guard) en todos; y en backend, idempotencia (ej. folio de operación único por evento) para los casos de dinero.
- **A2 — Descuentos no validados contra `promociones` (ALTA):** `ventas:procesar` acepta `desc_monto` (solo lo limita al subtotal) **sin verificar la regla de la promoción** (tipo %, monto, vigencia, producto). Un vendedor puede aplicar descuentos arbitrarios.
  - **Solución:** server-side, resolver descuento desde `promociones` según fecha/producto/rol, o eliminar el campo del payload y calcularlo.
- **A3 — Venta sin `presentacion_id` no controla stock (ALTA):** en `ventas:procesar`, si un ítem no trae presentación, no hay validación de existencias ni descuento (venta "por producto genérico" sin inventario). Mientras `categorias`/`productos` lo permitan, un payload manipulador o un mal set del selector de presentación venden sin descontar.
- **M1 — Corte de caja (MEDIA):**
  - `calcularEsperado` suma `ventas.total` por `forma_pago` excluyendo **solo** `cancelada` → incluye ventas `credito`/`a_meses` al total completo y ventas `devuelta` (cuyo dinero ya salió), y **no incluye** los abonos parciales (que viven en `pagos` con su propia forma). Con C2 sin corregir, el esperado nunca cuadrará.
  - `CorteCajaModal.jsx` **auto-rellena** el campo "efectivo contado" con el valor esperado del sistema → corte auto-correlacionado, sin conteo real; la diferencia se calcula en el cliente.
  - **Solución:** esperado por forma de pago sumando `pagos` (abonos) y neto de devoluciones; NO precargar el contado; calcular la diferencia server-side y reportarla.
- **M2 — Forma de pago "mixto" (MEDIA):** el selector de `Ventas.jsx` permite `efectivo+tarjeta` (`mixto`) pero `ventas:procesar` solo acepta `efectivo/tarjeta/transferencia` → la venta se rechaza. O quitar la opción o implementarla (dos renglones en `pagos`).
- **M4 — Exposición de datos por rol (MEDIA):** `inventarioFisico:list` y `historial:list` usan ROLES.ANY; `usuarioía`/costos y listado de ventas quedan visibles para almacén/vendedor en los canales (la UI oculta el menú, pero el canal no). Revisar si almacén debe ver el historial de ventas.

---

## 8. Base de Datos y Backups

- Esquema local (18 tablas) con FKs activadas (`PRAGMA foreign_keys=ON`), migraciones idempotentes (`tallas`→`presentaciones` probado en `dbMigration.test.js`), `ensureColumn` para campos farmacia, seed de usuarios/negocio.
- **C4** (backup WAL): ver sección 5.
- **A7 — `scripts/seedTestData.js` escribe sobre la BD real (ALTA):** `:7` apunta a `%AppData%\punto-venta-poblano\data\data.db` (producción), `:180` ejecuta `seedAll()` sin confirmación/backup. No es idempotente (folio diario `V{aaaa}{mm}{dd}-T{seq}`, `:119`) → una segunda corrida choca con `UNIQUE(folio)` y **la transacción revierte todo en silencio** (`:46`). `:104/146-148` produce ventas `estado='pendiente'` con `monto_pagado=total` (estado incoherente).
  - **Solución:** apuntar a un DSN de prueba o hacer copia previa, y/o aceptar "solo if test"; idempotencia con semilla única por corrida; validar estados.
- **M9 — `scripts/fixSeedRoles.js` destructivo (MEDIA):** `:41` borra los `cortes_caja` de almacén **de forma permanente** y `:34` reasigna ventas a usuarios aleatorios sin backup/reversa.
- Índices: la mayoría de consultas clave filtran por `venta_id`/`created_at`/`folio`. No se verificó cobertura completa de índices para `reportes.generar` (agrupaciones por día/mes/año) — **NO VERIFICADO**; recomendación: `EXPLAIN QUERY PLAN` sobre `reportes.generar` con BD poblada.
- **B3 — Sin constraint único de cliente por nombre/teléfono (BAJA):** doble clic de Guardar duplica clientes (ver A1).

---

## 9. Navegación y Roles

- Navegación por estado en `App.jsx` (sin router) con `puedeVer`/`goto` por `ROL_PERMISOS`.
- **M3 — Permisos duplicados y divergentes (MEDIA):** `App.jsx` y `ipcHandlers.js:33-34` (devolución de `hoteles` de login: declara `index`, `gastos`, `reportes` para vendedor) mantienen dos listas que **no coinciden**. El backend es la autoridad real (handlers protegidos), pero la incoherencia produce: vendedor ve permisos en su lista del login que luego no puede usar (ROLES.ADMIN), y el Dashboard se monta al restaurar sesión de vendedor/almacén disparando canales admin (`A8`).
- **A8 — Dashboard con carga frágil y canales de rol superior (ALTA):**
  - `Dashboard.jsx:123-130` usa `Promise.all` **sin try/catch/finally** → si un solo canal rechaza, `setLoading(false)` nunca se ejecuta y la pantalla queda "Cargando dashboard..." para siempre.
  - `Dashboard.jsx:139` `if (cad) setCaducidades(cad)` confía en la forma del canal; `:183-185` asume `caducados.length` → TypeError → pantalla en blanco si el canal falla.
  - `Dashboard.jsx:124-129` invoca `reportes.generar` (ROLES.ADMIN) y `lotes.alertas` (ROLES.ALMACEN). Para vendedor, el login incluso devuelve `index` (permiso contradictorio, M3) y `App.jsx:70` inicia en `page='index'` → al restaurar sesión de un rol restringido se renderiza un frame de Dashboard que intenta llamar canales prohibidos.
  - **Solución:** try/catch/finally con mensaje de error; validar shape de cada respuesta; cargar el Dashboard solo para admin (o redirigir al primer menú permitido según rol).
- **B2 — Filtros de historial se pierden al navegar (BAJA):** el estado local se descarta al desmontar (`HistorialVentas.jsx:12-13`), incluye el `q` de búsqueda.

---

## 10. Pruebas

- **Ejecución real:** `npm test` → **11/11 pasan** (pharmacía FEFO, reconciliación de stock, migración `tallas→presentaciones`, idempotencia). Pruebas aisladas con BD temporal en `os.tmpdir()` y limpieza en `finally`.
- **Gaps críticos (MEDIA-ALTA):** cero cobertura de `ventas:procesar` (incluyendo descuentos, crédito, vuelto, doble envío), `credito:abonar`, `devoluciones:registrar`, `auth` (login/brute-force/roles), `corte:registrar`, `reportes:generar`, `sync_queue`. Es decir: **justo el núcleo transaccional del dinero no tiene pruebas**, mientras los utilitarios sí.
- **Recomendación:** tabla de casos por handler crítico (ver FASE 6) y `npm test` en CI.

---

## 11. Documentación

- ✅ `README.md` (raíz): funcionalidad general del sistema.
- ✅ `docs/CONTEXTO-Y-PROBLEMATICA.md`: contexto y problemática.
- ✅ `docs/COMO-ESTA-ELABORADO.md`: estructura técnica (18 tablas, diagramas corregidos).
- ✅ `docs/supabase/*.sql`: esquema, políticas, reportes extra y rename (idempotente), coherentes con los payloads de `supabaseSync.js`.
- ⚠️ Falta: `docs/INSTALACION-Y-BACKUP.md` (pasos reales de backup seguro con WAL), guía de operación de roles, y un `SECURITY.md`. Documentación funcional buena pero orientada a código, no a operación.

---

## 12. Calidad de Código

- ✅ Estilo consistente, helpers de validación centralizados, comentarios de sección claros, nombres descriptivos.
- ⚠️ **M5 — Listas que confían en `res.ok` (MEDIA):** muchas cargas asignan directamente al state sin verificar el formato del handler: `HistorialVentas.jsx:12`, `Clientes.jsx:17`, `Gastos.jsx:20`, `Credito.jsx:17`, `Devoluciones.jsx:19`, `InventarioFisico.jsx:7`. Si el backend devuelve `{ok:false,error}` (p.ej. sesión expirada) → `rows.map is not a function` y la página se rompe en blanco.
- ⚠️ **A1/M5** relacionado: falta patrón común de `useAsync` con estados loading/error/empty.
- ⚠️ Sin linter ni formatter en `package.json` (no hay `npm run lint`); no hay CI.
- ⚠️ Código muerto menor: `Gastos.jsx:9-10,75` (chequeo de rol en página admin-only); duplicación `ROL_PERMISOS` (M3).
- ⚠️ `useNegocio.js:8-10` sin `.catch` (promesa no manejada) y `guardarNegocio` sin try/catch (B6).
- ✅ `Charts.jsx` sin inyección (React escapa), `UpdateBanner.jsx` sin fuga de listeners (1 suscripción por montaje con `unsub`).

---

## 13. Rendimiento

- ✅ Transacciones SQLite en ventas/devoluciones; agrupación de upserts del sync por tabla (evita N+1 requests).
- ⚠️ **M15 — Cola de sync con bloqueo y sin tope (MEDIA):** si un grupo de `sync_queue` falla permanentemente (o se descarta sin confirmar), se reintenta cada 30 s indefinidamente y la cola crece sin límite; además retrite en bloque puede bloquear ítems posteriores.
- ⚠️ `Dashboard.jsx` hace 6 llamadas IPC + 6 gráficas (cada una con su propio `reportes.generar`) al montar y por cambio de periodo → coste alto al abrir la app y por periodo (tablas pesadas sobre BD poblada). Ver `EXPLAIN QUERY PLAN` (no verificado).
- ⚠️ `TourOverlay.jsx:31-40` re-suscribe listeners de scroll/resize en cada frame (dependencia `[step, rect]` con objeto nuevo) → churn durante tours (BAJA).

---

## 14. UX/UI

- ✅ Diseño consistente (CSS `theme.css`), tours guiados por rol, tema claro/oscuro, acento configurable, stat-cards y gráficas claras, teclado (Enter) en búsquedas.
- ⚠️ Feedback inconsistente: algunos flujos usan `alert()`, otros errores pintados de verde (`Perfil.jsx:62` muestra error con `alert-success`), y ajustes de inventario **se aplican sin confirmación y fallan en silencio** (`InventarioFisico.jsx:15` no verifica `res.ok`).
- ⚠️ Doble clic (A1) y sin deshabilitado "Guardando..." en múltiples formularios.
- ⚠️ Crédito: al abonar no se imprime comprobante ni se muestra el nuevo saldo (`Credito.jsx:30`); el modal solo se cierra.
- ⚠️ `InventarioFisico.jsx:37` permite capturar negativos/decimales; el backend rechaza y la UI **no muestra el error** (solución: `min=0`, `step=1`, mostrar error del backend, confirmación de ajuste).
- ⚠️ Modal sin tecla `Escape`/ARIA (accesibilidad menor).

---

## 15. Auditoría y Trazabilidad

- ✅ Las ventas, devoluciones, gastos, cortes, usuarios y abonos guardan `usuario_id`/`created_at`; cancelación de venta existe vía estado (`cancelada`) que el corte excluye.
- ⚠️ **Borrados duros sin trazabilidad:** `devoluciones:delete` (`ipcHandlers.js:850`) elimina el registro de la devolución (y su vínculo en `devoluciones_detalle` queda huérfano) sin revertir stock y sin dejar historial de quién lo borró; `gastos:delete` elimina el gasto; `usuarios:delete` borra el usuario. No hay tabla de auditoría de acciones administrativas.
- ⚠️ Con C2 sin corregir, la "devolución" no deja rastro de egreso monetario.
- ❓ Sin registro de auditoría de intentos de acceso fallidos en BD (el bloqueo 5×10 min es en memoria/por ventana). **NO VERIFICADO** si persiste el contador entre reinicios.

---

## 16. Límites del Análisis (NO VERIFICADO)

- Construcción del instalador NSIS y flujo real de `updates` (no se ejecutó `electron-builder`).
- Comportamiento del backend contra BD poblada real (`EXPLAIN QUERY PLAN` de reportes, tiempos de corte de caja).
- Configuración exacta de `webPreferences` en `main.js` (sandbox/contextIsolation): se confirmaron `preload.js`/CSP, pero el valor de `nodeIntegration/sandbox` en la ventana se cita como pendiente de doble check.
- RLS de Supabase en un proyecto real con usuarios externos (se evalúo el SQL, no la consola).
- Persistencia del contador de brute-force entre reinicios.

---

## 17. Matriz de Riesgos

| ID | Problema | Módulo | Severidad | Impacto | Prioridad | Solución resumida |
|---|---|---|---|---|---|---|
| C1 | Devolución reintegra stock a `presentaciones` sin tocar lotes | Devoluciones/Inventario | CRÍTICA | Inventario corrupto, FEFO/caducidades rotos | **P0** | Alta vía lotes + `reconciliarStockPresentacion` y sync |
| C2 | Devolución no revierte crédito ni caja; `reembolso` sin egreso; toda la venta marcada `devuelta` | Devoluciones/Crédito/Corte | CRÍTICA | CxC falsa, caja nunca cuadra, reportes inflados | **P0** | Recalcular saldos, registrar egreso, estado parcial, excluir/neter en reportes |
| C3 | Venta a crédito se guarda `pagada` (`monto_pagado = pagado \|\| total`) | Ventas/Crédito | CRÍTICA | No existen deudas reales | **P0** | Enviar monto real; backend deriva `credito` y `saldo_pendiente`; test |
| C4 | Backup/export copia `data.db` vivo en WAL | Backup | CRÍTICA | Pérdida silenciosa de ventas recientes | **P0** | `VACUUM INTO`/checkpoint previo; backup automático + rotación |
| A1 | Doble clic duplica abonos, ventas y capturas | Todo el POS | ALTA | Duplicados de dinero/datos | **P1** | Guard `enviando` + idempotencia server-side |
| A2 | Descuento sin validar contra `promociones` | Ventas | ALTA | Merma por descuento arbitrario | **P1** | Resolver descuento en backend |
| A3 | Venta sin `presentacion_id` no descuenta stock | Ventas/Inventario | ALTA | Stock incorrecto | **P1** | Exigir presentación o descontar por producto |
| A4 | Contraseñas seed conocidas y visibles | Auth | ALTA | Acceso admin no autorizado | **P1** | Forzar cambio 1er login; quitar credenciales de la UI |
| A5 | `refresh_token`/email en claro + creds embebidas | Sync | ALTA | Acceso total a datos remotos | **P1** | Cifrar con `safeStorage`; rotar token; remover de libro |
| A6 | RLS sin `auth.uid()`, `with check(true)` global | Supabase | ALTA | Fuga multi-cuenta | **P1** | Políticas por tenant/owner |
| A7 | `seedTestData` escribe sobre BD real, no idempotente | Scripts | ALTA | Corrupción de producción | **P1** | DSN de prueba/idempotencia/confirmación |
| A8 | Dashboard: Promise.all sin catch, shape frágil, canales admin | Dashboard | ALTA | Pantalla infinita/blank; permisos | **P1** | Robustecer cargas; montar solo para admin |
| M1 | Corte auto-correlacionado y mal atribuido | Corte | MEDIA | Control interno débil | P1/P2 | No prefill; sumar `pagos`; neto de devoluciones |
| M2 | `mixto` ofrecido y rechazado | Ventas | MEDIA | Ventas rechazadas | P2 | Quitar o implementar |
| M3 | Permisos duplicados y divergentes | Core | MEDIA | Confusión de roles | P2 | Fuente única de permisos |
| M4 | `inventarioFisico:list`/`historial:list` ROLES.ANY | Inventario | MEDIA | Info expuesta | P2 | Restringir canal |
| M5 | Listas sin verificar `res.ok` | Todas las páginas | MEDIA | Crash de páginas | P2 | Patrón `useAsync` con ok/shape |
| M6 | `InventarioFisico` acepta negativos y falla en silencio | Inventario | MEDIA | Ajustes erróneos no detectados | P2 | `min=0`, confirmación, mostrar errores |
| M7 | Promociones sin validar `valor>0` ni fechas | Promociones | MEDIA | Promos inválidas | P2 | Validación front+back |
| M8 | Perfil: contexto stale, botones trabados, errores en verde | Perfil | MEDIA | UX rota | P2 | Refrescar `user`, try/catch, colores |
| M9 | `fixSeedRoles` destructivo sin backup | Scripts | MEDIA | Pérdida de cortes | P2 | Backup + confirmación |
| M10 | DemoSteps: éxito falso, password demo | Tours | MEDIA | Demos huérfanas | P2 | Verificar `res.ok`; parametrizar |
| M11 | `updates:instalarYReiniciar` ROLES.ANY | Updates | MEDIA | Reinicio no autorizado | P2 | Restringir a admin |
| M12 | `devoluciones:delete` borra sin rastro | Devoluciones | MEDIA | Sin trazabilidad | P2 | Borrado lógico/auditoría |
| M13 | Escapado incompleto ticket + logo SVG | Ticket | BAJA | XSS teórico | P2/P3 | Escapar comillas; validar SVG |
| M14 | `sync_queue` poison-block sin tope | Sync | MEDIA | Cola infinita | P2 | Backoff + límite + dead-letter |
| M15 | Proveedores sin validar email; Client. dup sin unique | Catálogos | BAJA | Datos sucios | P3 | Validación front/back + unique |
| B1 | `config:getNegocio` sin proteger | Config | BAJA | Exposición mínima | P3 | Aceptable; documentar |
| B2 | Filtros/estado perdidos al navegar | Historial | BAJA | UX | P3 | Retener o memoizar |
| B3 | `fixSeedRoles`/seed incoherencias de estado | Scripts | BAJA | Datos sucios | P3 | Estados coherentes |
| B4 | TourOverlay churn de listeners | Tours | BAJA | Perf tour | P3 | Dependencias refinadas |
| B5 | Categorías sin check de ciclo server-side | Categorías | BAJA | Raro, manipulado | P3 | Validar en backend |
| B6 | `useNegocio` sin `.catch`/try-catch | Hook | BAJA | Rejection no manejada | P3 | Robustecer |
| B7 | js-yaml 4.3.1 (CVE DoS CPU) vía electron-updater | Dependencias | MEDIA* | DoS al parsear feed | P1 | `npm audit fix` (≥4.3.2) |

\* El único hallazgo de `npm audit`: `js-yaml` 4.0.0–4.3.1 (https://github.com/advisories/GHSA-2883-xcg3-v3hh), severidad alta CVSS 7.5, DoS por CPU al parsear YAML no confiable; llega vía `electron-updater@6.8.9` (prod) y `electron-builder@25.1.8` (dev). Riesgo práctico bajo (el feed de actualización es propio) pero corrección trivial: `npm audit fix`.

---

## 18. Plan de Corrección (FASE 1–7)

- **FASE 1 — CRÍTICO (dinero y datos)**
  1. Devoluciones: reintegrar a lotes / `reconciliarStockPresentacion` + sync (C1).
  2. Devoluciones: recalcular `saldo_pendiente`/`monto_pagado`/`clientes.saldo_deuda`, registrar egreso real, estado de parcialidad, y ajustar reportes/corte (C2).
  3. Ventas: eliminar `|| total`; backend deriva estado y saldo por forma de pago y monto (C3).
  4. Backup: `VACUUM INTO`/checkpoint + import válido + backup automático diario con rotación (C4).

- **FASE 2 — SEGURIDAD**
  5. Forzar cambio de contraseña en primer login; quitar credenciales del login (A4).
  6. Cifrar `refresh_token` con `safeStorage`; rotar token en Supabase; documentar (A5).
  7. Políticas RLS por `auth.uid()`/tenant (A6).
  8. Revisar y unificar permisos (M3); restringir `updates:instalarYReiniciar` (M11) y canales de lectura (M4).

- **FASE 3 — ALTOS (correctitud)**
  9. Guard de doble clic en todos los guardados + COBRAR + abono; idempotencia server-side (A1).
  10. Descuento validado contra `promociones` en backend (A2).
  11. Exigir `presentacion_id` (o descontar por producto) (A3).
  12. Dashboard: try/catch/finally, validar shapes, montar solo para admin (A8).
  13. `seedTestData`/`fixSeedRoles` a BD de prueba/idempotentes/confirmación (A7/M9).

- **FASE 4 — MEDIOS (correctitud y caja)**
  14. Corte de caja: sin prefill, esperado por forma sumando `pagos`, neto de devoluciones, diferencia server-side (M1).
  15. Decidir `mixto` y validaciones de promociones/proveedores/categorías (M2/M7/M15/B5).
  16. `InventarioFisico`: `min=0`, confirmación, mostrar errores (M6).
  17. Perfil y estados de formulario (M8).

- **FASE 5 — ROBUSTEZ DE UI**
  18. Patrón común `useAsync` (loading/error/empty) para todas las listas (M5).
  19. `devoluciones:delete` → borrado lógico/auditoría (M12). Trazabilidad de gastos/usuarios.
  20. Feedback correcto (colores), comprobante de abono, retención de filtros (B2, M8, sección 14).

- **FASE 6 — PRUEBAS**
  21. Cobertura de `ventas:procesar`, `credito:abonar`, `devoluciones:registrar`, `auth` (login/brute-force/roles), `corte:registrar`, `reportes:generar`, `sync_queue` y backup (C4).
  22. `npm test` en CI + linter (ESLint) y `npm audit` en CI.

- **FASE 7 — MEJORAS**
  23. `safeStorage` documentado, js-yaml ≥4.3.2, escaping completo del ticket, validación de SVG, timeout en `image.js`.
  24. Perf: revisar `EXPLAIN QUERY PLAN` de reportes y coste del Dashboard; `sync_queue` con backoff/límite/dead-letter; TourOverlay.
  25. Accesibilidad (Escape/ARIA en Modal), `SECURITY.md`, guía operativa de backup.

---

## 19. Calificación por Área (0–100)

| Área | Calificación | Justificación |
|---|---|---|
| Arquitectura y stack | **85** | Offline-first correcto, capa servidor fuerte, IPC whitelist, transacciones SQLite. Se descuenta por duplicación de permisos. |
| Seguridad | **50** | Defensa en profundidad real (proteger/roles, brute-force, CSP), pero credenciales seed, token en claro, RLS sobre-permisiva y permisos divergentes. |
| Sistema POS (dinero) | **45** | Recálculo server-side y FEFO bien, pero 3 críticos de dinero (C1-C3) y doble clic. |
| Base de datos y backups | **65** | Migraciones idempotentes y FKs; backup WAL roto (C4), scripts destructivos, índices no verificados. |
| Navegación y roles | **70** | Menú por rol y sesiones por ventana OK; Dashboard rompe en restauración y permisos duplicados. |
| Pruebas | **50** | 11/11 en utilitarios y migración (aisladas y limpias); núcleo transaccional sin cobertura. |
| Documentación | **85** | README + CONTEXTO + COMO-ESTA-ELABORADO + docs SQL coherentes; faltan operación/backup/SECURITY. |
| Calidad de código | **70** | Estilo consistente y validadores centralizados; sin lint, cargas frágiles, código muerto menor. |
| Rendimiento | **75** | Transacciones y batch de sync bien; Dashboard costoso, cola sin tope, TourOverlay churn. |
| UX/UI | **70** | Tours/tema/gráficas sólidos; doble clic, feedback dispar (alert/verde/silencio), confirmaciones. |
| Auditoría y trazabilidad | **55** | Se guarda el autor en registros y existe cancelación suave; borrados duros sin auditoría y sin egreso en devoluciones. |
| **GLOBAL** | **66** | Promedio ponderado de las áreas; **no operativo apto para producción** hasta resolver P0. |

---

## 20. Checklist Final

- 🔴 **Credenciales por defecto** visibles y activas (`db.js:113-115`, `Login.jsx:4`)
- 🔴 **Devoluciones** reintegran stock fuera de lotes (C1)
- 🔴 **Devoluciones** no revierten crédito ni caja (C2)
- 🔴 **Venta a crédito** se registra pagada (C3)
- 🔴 **Backup/export WAL** puede perder datos recientes (C4)
- ⚠️ **Doble clic** en COBRAR, abono y guardados (A1)
- ⚠️ **Descuento** no validado contra promociones (A2)
- ⚠️ **refresh_token** en texto plano en `app_config` (A5)
- ⚠️ **RLS** sobre-permisiva sin `auth.uid()` (A6)
- ⚠️ **seedTestData/fixSeedRoles** escriben sobre BD real (A7/M9)
- ⚠️ **Dashboard** frágil y con canales de rol superior (A8)
- ⚠️ **Corte de caja** auto-correlacionado (M1)
- ⚠️ **Permisos** duplicados/divergentes (M3)
- ⚠️ **Listas** sin verificar `res.ok` (M5)
- ⚠️ **Inventario físico** falla en silencio y acepta negativos (M6)
- ⚠️ **js-yaml 4.3.1** con CVE DoS (P1, fix trivial)
- ✅ **contextIsolation + preload whitelist + CSP**
- ✅ **`proteger(ROLES.*)`** server-side y sesiones por ventana
- ✅ **Brute-force** 5 fallos → 10 min
- ✅ **Recálculo server-side** de precios/totales en ventas y devoluciones
- ✅ **FEFO** y `reconciliarStockPresentacion` (con pruebas)
- ✅ **Migraciones idempotentes** (`tallas→presentaciones`) probadas
- ✅ **CSV** con mitigación de inyección de fórmulas
- ✅ **11/11 pruebas** pasan; **sin fuga de listeners** en UpdateBanner
- ✅ **Charts.jsx** sin inyección SVG; sin `dangerouslySetInnerHTML`
- ❓ **webPreferences** de `main.js` (sandbox/contextIsolation) — NO VERIFICADO en ejecución
- ❓ **EXPLAIN QUERY PLAN** de reportes con BD poblada — NO VERIFICADO
- ❓ **RLS en consola real** y persistencia del bloqueo entre reinicios — NO VERIFICADO

---

*Fin del diagnóstico. Ningún archivo de código fue modificado. Queda pendiente la autorización del usuario para iniciar el plan de corrección por fases.*