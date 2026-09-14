import {
  CrearProductoDemo, EliminarProductoDemo,
  CrearUsuarioDemo, EliminarUsuarioDemo,
  CrearClienteDemo, EliminarClienteDemo,
  CrearCategoriaDemo, EliminarCategoriaDemo,
  CrearPromocionDemo, EliminarPromocionDemo
} from './DemoSteps.jsx';

export const TOURS = {
  // ══════════════════════════════════════════════════════════════
  // ADMINISTRADOR
  // ══════════════════════════════════════════════════════════════
  admin_general: {
    titulo: 'Recorrido General — Administrador',
    rol: 'admin',
    steps: [
      { titulo: '¡Bienvenido, administrador!', texto: 'Como administrador tienes acceso a todo el sistema: ventas, inventario, usuarios, reportes y configuración. Vamos a recorrer las partes clave.' },
      { page: 'index', selector: '[data-tour="nav-index"]', titulo: 'Dashboard', texto: 'Aquí ves un resumen del negocio: ventas de hoy y del mes, clientes con deuda, stock bajo y gráficas de inversión vs. ganancia.' },
      { page: 'index', selector: '[data-tour="dash-stats"]', titulo: 'Tarjetas de resumen', texto: 'Estas tarjetas muestran las cifras más importantes del día y del mes de un vistazo.' },
      { page: 'index', selector: '[data-tour="topbar-theme"]', titulo: 'Modo claro / oscuro', texto: 'Con este botón cambias entre modo oscuro y modo claro, el que prefieras para trabajar.' },
      { page: 'index', selector: '[data-tour="topbar-fullscreen"]', titulo: 'Pantalla completa', texto: 'Este botón activa o desactiva la pantalla completa, útil si usas un monitor dedicado para el punto de venta.' },
      { page: 'ventas', selector: '[data-tour="nav-ventas"]', titulo: 'Punto de Venta', texto: 'Desde aquí tú o tus vendedores registran las ventas: buscan productos, arman el carrito y cobran.' },
      { page: 'inventario', selector: '[data-tour="nav-inventario"]', titulo: 'Inventario', texto: 'Aquí administras tus productos: nombre, precio, costo, código de barras y presentaciones con su stock.' },
      { page: 'usuarios', selector: '[data-tour="nav-usuarios"]', titulo: 'Usuarios', texto: 'Solo el administrador ve esta sección: aquí creas cuentas para tus vendedores y personal de almacén, y defines su rol.' },
      { page: 'revision', selector: '[data-tour="nav-revision"]', titulo: 'Revisión de Actividad', texto: 'Aquí puedes ver la actividad de cada empleado: sus ventas, sus cortes de caja (y si alguno fue omitido) y más — útil para supervisar honestidad y desempeño.' },
      { page: 'reportes', selector: '[data-tour="nav-reportes"]', titulo: 'Reportes', texto: 'Genera reportes financieros, de ventas, inventario, cortes de caja, gastos, créditos y devoluciones — exportables a CSV o PDF.' },
      { page: 'configuracion', selector: '[data-tour="nav-configuracion"]', titulo: 'Configuración', texto: 'Aquí eliges tu impresora de tickets térmica, y puedes exportar o importar tu base de datos como respaldo.' },
      { page: 'perfil', selector: '[data-tour="nav-perfil"]', titulo: 'Mi Perfil', texto: 'Aquí cambias tu contraseña y, como administrador, el nombre y logo de tu negocio — se usan en el menú, tickets y en el ícono de la app.' },
      { titulo: '¡Listo!', texto: 'Ya conoces las partes principales de tu panel de administrador. Explora los demás tutoriales de "Tutoriales" para profundizar en cada tarea.' }
    ]
  },

  admin_crear_usuario: {
    titulo: 'Tutorial: Crear un Usuario',
    rol: 'admin',
    steps: [
      { titulo: 'Crear un usuario nuevo', texto: 'Te mostraremos cómo dar de alta a un empleado (vendedor o almacén). Crearemos un usuario de PRUEBA y lo eliminaremos al final — esto es solo una demostración.' },
      { page: 'usuarios', selector: '[data-tour="usr-nuevo"]', titulo: 'Botón "+ Nuevo Usuario"', texto: 'Desde la sección Usuarios, este botón abre el formulario para crear una cuenta nueva: nombre, correo, contraseña y rol (admin, vendedor o almacén).' },
      { page: 'usuarios', selector: '[data-tour="usr-tabla"]', titulo: 'Vamos a crear uno de prueba', texto: 'Haz clic para crear un usuario de demostración con rol "vendedor" y ver cómo aparece.', Componente: CrearUsuarioDemo },
      { page: 'usuarios', selector: '[data-tour="usr-tabla"]', titulo: 'Así se ve en la lista', texto: 'Actualiza la sección Usuarios (o navega y regresa) para verlo en la tabla, con su rol y estado activo. Desde ahí también puedes editarlo o desactivarlo.' },
      { titulo: 'Limpieza — solo era una demostración', texto: 'Ahora eliminamos el usuario de prueba que creamos, para no dejar cuentas de más en tu sistema.', Componente: EliminarUsuarioDemo }
    ]
  },

  admin_crear_producto: {
    titulo: 'Tutorial: Crear un Producto',
    rol: 'admin',
    steps: [
      { titulo: 'Crear un producto nuevo', texto: 'Aunque tus empleados de almacén suelen hacer esto, tú como administrador también puedes. Crearemos uno de PRUEBA y lo eliminaremos al final.' },
      { page: 'inventario', selector: '[data-tour="inv-nuevo"]', titulo: 'Botón "+ Nuevo Producto"', texto: 'Aquí harías clic para abrir el formulario: nombre, categoría, marca, costo, precio, código de barras y las presentaciones con su stock inicial.' },
      { titulo: 'Vamos a crear uno de prueba', texto: 'Haz clic para crear un producto de demostración (costo $100, precio $199, presentacion "Única" con 5 unidades).', Componente: CrearProductoDemo },
      { page: 'inventario', selector: '[data-tour="inv-tabla"]', titulo: 'Así se ve en tu inventario', texto: 'Cambia de departamento o filtra para verlo listado, junto con su utilidad calculada automáticamente (precio − costo).' },
      { titulo: 'Limpieza — solo era una demostración', texto: 'Ahora eliminamos el producto de prueba.', Componente: EliminarProductoDemo }
    ]
  },

  admin_crear_categoria: {
    titulo: 'Tutorial: Crear una Categoría',
    rol: 'admin',
    steps: [
      { titulo: 'Organizar tu catálogo', texto: 'Las categorías te ayudan a ordenar tus productos. Crearemos una de PRUEBA y la eliminaremos al final.' },
      { page: 'categorias', selector: '[data-tour="cat-nuevo"]', titulo: 'Botón "+ Nueva Categoría"', texto: 'Aquí defines el nombre, si es una categoría principal o una subcategoría (eligiendo una "categoría padre"), y una descripción opcional.' },
      { titulo: 'Vamos a crear una de prueba', texto: 'Haz clic para crear una categoría de demostración.', Componente: CrearCategoriaDemo },
      { page: 'categorias', selector: '[data-tour="cat-tabla"]', titulo: 'Así se ve en la lista', texto: 'Aparece en "Categorías Principales", con contador de subcategorías y de productos asociados. Desde aquí puedes editarla, ocultarla o eliminarla.' },
      { titulo: 'Limpieza — solo era una demostración', texto: 'Ahora eliminamos la categoría de prueba.', Componente: EliminarCategoriaDemo }
    ]
  },

  admin_crear_promocion: {
    titulo: 'Tutorial: Crear una Promoción',
    rol: 'admin',
    steps: [
      { titulo: 'Crear un descuento o promoción', texto: 'Solo el administrador puede crear promociones, ya que afectan directamente los precios de venta. Crearemos una de PRUEBA y la eliminaremos al final.' },
      { page: 'promociones', selector: '[data-tour="promo-nueva"]', titulo: 'Botón "+ Nueva Promoción"', texto: 'Defines el nombre, si es un descuento por porcentaje o por monto fijo, a qué departamento/categoría/producto aplica, y su vigencia.' },
      { titulo: 'Vamos a crear una de prueba', texto: 'Haz clic para crear una promoción de demostración (10% de descuento).', Componente: CrearPromocionDemo },
      { page: 'promociones', selector: '[data-tour="promo-tabla"]', titulo: 'Así se ve en la lista', texto: 'Tus vendedores podrán aplicarla en el Punto de Venta al momento de cobrar, en la sección de descuentos.' },
      { titulo: 'Limpieza — solo era una demostración', texto: 'Ahora eliminamos la promoción de prueba.', Componente: EliminarPromocionDemo }
    ]
  },

  admin_reportes: {
    titulo: 'Tutorial: Generar Reportes',
    rol: 'admin',
    steps: [
      { titulo: 'Generar reportes del negocio', texto: 'Aprende a consultar y exportar la información financiera y operativa de tu negocio.' },
      { page: 'reportes', selector: '[data-tour="reportes-tabs"]', titulo: 'Tipos de reporte', texto: 'Puedes elegir entre Financiero, Ventas, Inventario, Cortes de Caja, Gastos, Créditos y Devoluciones — cada uno con sus propias cifras y tabla de detalle.' },
      { page: 'reportes', selector: '[data-tour="reportes-exportar"]', titulo: 'Exportar', texto: 'Con estos botones descargas el reporte activo como CSV (para Excel) o como PDF listo para imprimir o compartir.' },
      { titulo: '¡Listo!', texto: 'Recuerda que puedes ajustar el rango de fechas arriba (Hoy / Semana / Mes / Año, o un rango personalizado) antes de generar o exportar.' }
    ]
  },

  admin_configuracion: {
    titulo: 'Tutorial: Configuración del Sistema',
    rol: 'admin',
    steps: [
      { titulo: 'Configurar tu sistema', texto: 'Aquí ajustas cómo se imprimen tus tickets y cómo respaldas tu información.' },
      { page: 'configuracion', selector: '[data-tour="config-personalizacion"]', titulo: 'Personalización', texto: 'Elige el color de acento de la app — sirve para cualquier tipo de negocio, no solo tiendas de calzado.' },
      { page: 'configuracion', selector: '[data-tour="config-impresion"]', titulo: 'Impresión de tickets', texto: 'Elige la impresora térmica instalada en Windows (58mm u 80mm) para que los tickets se impriman automáticamente al cobrar, sin diálogos molestos.' },
      { page: 'configuracion', selector: '[data-tour="config-db"]', titulo: 'Respaldo de base de datos', texto: 'Exporta una copia de tu base de datos regularmente por seguridad. Importar reemplaza TODA tu información actual — úsalo con mucho cuidado.' },
      { titulo: '¡Listo!', texto: 'Con esto tienes tu sistema configurado y respaldado.' }
    ]
  },

  admin_identidad_negocio: {
    titulo: 'Tutorial: Identidad de tu Negocio',
    rol: 'admin',
    steps: [
      { titulo: 'Personaliza tu negocio', texto: 'Puedes poner el nombre y logo de tu negocio para que aparezcan en toda la aplicación.' },
      { page: 'perfil', selector: '[data-tour="perfil-negocio"]', titulo: 'Identidad del Negocio', texto: 'Cambia el nombre que aparece junto a "PuntoVenta" en el menú, y sube tu logo — se usa en el menú lateral, la pantalla de inicio de sesión, los tickets impresos, y como ícono de la ventana de la aplicación.' },
      { titulo: '¡Listo!', texto: 'No olvides presionar "Guardar Identidad" después de hacer cambios.' }
    ]
  },

  admin_revision_actividad: {
    titulo: 'Tutorial: Revisión de Actividad',
    rol: 'admin',
    steps: [
      { titulo: 'Supervisa a tu equipo', texto: 'Esta sección te permite auditar lo que hace cada empleado en el sistema.' },
      { page: 'revision', selector: '[data-tour="revision-tarjetas"]', titulo: 'Tarjetas por empleado', texto: 'Cada tarjeta muestra el total vendido, número de ventas y de cortes de caja de ese usuario. Si tiene cortes omitidos, se marca en rojo — una señal para investigar.' },
      { titulo: 'Detalle de actividad', texto: 'Al hacer clic en una tarjeta, se abre el detalle con pestañas: Ventas, Cortes de Caja, Gastos y Devoluciones registradas por esa persona.' },
      { titulo: '¡Listo!', texto: 'Usa esta sección periódicamente para verificar que los cortes de caja se estén haciendo correctamente.' }
    ]
  },

  admin_cortes_caja: {
    titulo: 'Tutorial: Cortes de Caja',
    rol: 'admin',
    steps: [
      { titulo: '¿Qué es un corte de caja?', texto: 'Es la comparación entre el dinero que el sistema espera (según las ventas registradas) y el dinero que realmente hay — efectivo, tarjeta y transferencias.' },
      { page: 'index', selector: '[data-tour="sidebar-footer"]', titulo: 'Se activa al cerrar sesión', texto: 'Cuando tú o un vendedor cierran sesión, el sistema pide hacer el corte: contar el efectivo, tarjeta y transferencias recibidos durante el turno.' },
      { titulo: 'Omitir con motivo', texto: 'Si alguien no puede hacer el corte en ese momento, puede omitirlo, pero debe escribir un motivo — queda registrado y visible para ti en "Revisión de Actividad".' },
      { page: 'reportes', selector: '[data-tour="reportes-tabs"]', titulo: 'Consulta los cortes', texto: 'También puedes revisar el historial completo de cortes desde Reportes → pestaña "Cortes de Caja", con las diferencias encontradas.' },
      { titulo: '¡Listo!', texto: 'Este mecanismo ayuda a mantener la honestidad en el manejo de efectivo de tu negocio.' }
    ]
  },

  // ══════════════════════════════════════════════════════════════
  // VENDEDOR
  // ══════════════════════════════════════════════════════════════
  vendedor_general: {
    titulo: 'Recorrido General — Vendedor',
    rol: 'vendedor',
    steps: [
      { titulo: '¡Bienvenido!', texto: 'Aquí verás lo esencial para vender, atender clientes y llevar el control de tu caja.' },
      { page: 'ventas', selector: '[data-tour="ventas-buscador"]', titulo: 'Buscar productos', texto: 'Escribe el nombre, SKU, o escanea el código de barras del producto — cualquier lector de código de barras funciona aquí automáticamente.' },
      { page: 'ventas', selector: '[data-tour="ventas-carrito"]', titulo: 'Carrito', texto: 'Los productos que agregas aparecen aquí. Puedes ajustar la cantidad o quitarlos.' },
      { page: 'ventas', selector: '[data-tour="ventas-pago"]', titulo: 'Forma de pago', texto: 'Elige si la venta es de contado, a crédito o a meses, la forma de pago, y aplica descuentos o promociones.' },
      { page: 'ventas', selector: '[data-tour="ventas-cobrar"]', titulo: 'Cobrar', texto: 'Al terminar, presiona este botón para registrar la venta y generar el ticket — se puede imprimir directo en la impresora térmica configurada.' },
      { page: 'historial_ventas', selector: '[data-tour="nav-historial_ventas"]', titulo: 'Historial de Ventas', texto: 'Aquí consultas y reimprimes tickets de ventas anteriores.' },
      { page: 'credito', selector: '[data-tour="nav-credito"]', titulo: 'Crédito y Abonos', texto: 'Aquí registras los abonos que hacen los clientes que compraron a crédito.' },
      { page: 'devoluciones', selector: '[data-tour="nav-devoluciones"]', titulo: 'Devoluciones', texto: 'Busca la venta por folio y registra los artículos que el cliente devuelve.' },
      { titulo: 'Corte de caja', texto: 'Al cerrar tu turno, la app te pedirá contar tu efectivo, tarjeta y transferencias — esto se compara contra lo que el sistema espera, para llevar un control honesto de la caja.' },
      { titulo: '¡Listo!', texto: 'Ya conoces lo esencial para vender. Explora los demás tutoriales de "Tutoriales" para profundizar en cada tarea.' }
    ]
  },

  vendedor_crear_cliente: {
    titulo: 'Tutorial: Agregar un Cliente',
    rol: 'vendedor',
    steps: [
      { titulo: 'Agregar un cliente nuevo', texto: 'Te mostraremos cómo registrar un cliente. Crearemos uno de PRUEBA y lo eliminaremos al final — esto es solo una demostración.' },
      { page: 'clientes', selector: '[data-tour="nav-clientes"]', titulo: 'Sección Clientes', texto: 'Aquí puedes buscar, crear y editar la información de tus clientes: datos de contacto, límite de crédito y su historial de compras.' },
      { titulo: 'Vamos a crear uno de prueba', texto: 'Haz clic para crear un cliente de demostración y ver cómo se guarda.', Componente: CrearClienteDemo },
      { page: 'clientes', selector: '[data-tour="cli-tabla"]', titulo: 'Así se ve en la lista', texto: 'El cliente aparece en esta tabla, junto con su saldo de deuda si tiene alguno pendiente.' },
      { titulo: 'Limpieza — solo era una demostración', texto: 'Ahora eliminamos el cliente de prueba que creamos.', Componente: EliminarClienteDemo }
    ]
  },

  vendedor_realizar_venta: {
    titulo: 'Tutorial: Realizar una Venta',
    rol: 'vendedor',
    steps: [
      { titulo: 'Paso a paso de una venta', texto: 'Vamos a repasar con más detalle cómo se hace una venta completa, de principio a fin.' },
      { page: 'ventas', selector: '[data-tour="ventas-buscador"]', titulo: '1. Busca o escanea el producto', texto: 'Escribe el nombre, SKU o código de barras. Si escaneas un código de barras exacto, el producto se agrega solo al carrito.' },
      { page: 'ventas', selector: '[data-tour="ventas-carrito"]', titulo: '2. Revisa el carrito', texto: 'Verifica cantidades y productos antes de cobrar. Puedes quitar artículos con la "✕".' },
      { page: 'ventas', selector: '[data-tour="ventas-pago"]', titulo: '3. Elige cómo se paga', texto: 'Contado, crédito o a meses; efectivo, tarjeta o transferencia. Si el cliente compra a crédito, primero debes seleccionarlo en "Cliente" arriba.' },
      { page: 'ventas', selector: '[data-tour="ventas-cobrar"]', titulo: '4. Cobra', texto: 'Presiona "COBRAR" para registrar la venta. Se genera el ticket automáticamente y puedes imprimirlo.' },
      { titulo: '¡Listo!', texto: 'Con la práctica esto se vuelve muy rápido, especialmente si usas un lector de código de barras.' }
    ]
  },

  vendedor_abono_credito: {
    titulo: 'Tutorial: Registrar un Abono',
    rol: 'vendedor',
    steps: [
      { titulo: 'Cobrar un abono a crédito', texto: 'Cuando un cliente que debe dinero viene a pagar (total o parcialmente), lo registras aquí.' },
      { page: 'credito', selector: '[data-tour="credito-tabla"]', titulo: 'Lista de créditos activos', texto: 'Aquí ves a todos los clientes con saldo pendiente, cuánto deben y hace cuántos días.' },
      { page: 'credito', selector: '[data-tour="credito-abonar"]', titulo: 'Botón "Abonar"', texto: 'Al hacer clic se abre una ventana donde capturas el monto del abono (con atajos de 25%, 50%, 75% o liquidar todo) y la forma de pago.' },
      { titulo: '¡Listo!', texto: 'El saldo del cliente se actualiza automáticamente, y si liquida todo, la venta pasa a estado "Pagada".' }
    ]
  },

  vendedor_devolucion: {
    titulo: 'Tutorial: Registrar una Devolución',
    rol: 'vendedor',
    steps: [
      { titulo: 'Procesar una devolución', texto: 'Cuando un cliente regresa uno o varios productos de una compra ya realizada.' },
      { page: 'devoluciones', selector: '[data-tour="dev-nueva"]', titulo: 'Botón "+ Nueva Devolución"', texto: 'Abre el formulario donde primero buscas la venta original por su folio.' },
      { titulo: 'Selecciona los artículos', texto: 'Una vez encontrada la venta, eliges cuántas unidades de cada producto se devuelven (no puedes devolver más de lo que se vendió), el tipo de devolución (reembolso, cambio o nota de crédito) y el motivo.' },
      { page: 'devoluciones', selector: '[data-tour="dev-tabla"]', titulo: 'Historial de devoluciones', texto: 'Todas las devoluciones procesadas quedan registradas aquí, junto con quién las atendió.' },
      { titulo: '¡Listo!', texto: 'El stock de los productos devueltos regresa automáticamente al inventario.' }
    ]
  },

  vendedor_historial_ventas: {
    titulo: 'Tutorial: Historial de Ventas y Tickets',
    rol: 'vendedor',
    steps: [
      { titulo: 'Consultar ventas anteriores', texto: 'Si un cliente pide una copia de su ticket o necesitas verificar una venta pasada, aquí la encuentras.' },
      { page: 'historial_ventas', selector: '[data-tour="historial-tabla"]', titulo: 'Lista de ventas', texto: 'Busca por folio o nombre de cliente. Ves el total, saldo pendiente (si aplica) y el estado de cada venta.' },
      { titulo: 'Ver e imprimir el ticket', texto: 'El botón "Ver ticket" en cada fila abre el ticket original, con opción de volver a imprimirlo.' },
      { titulo: '¡Listo!', texto: 'Útil para resolver dudas de clientes o hacer una devolución (necesitarás el folio).' }
    ]
  },

  vendedor_gastos: {
    titulo: 'Tutorial: Registrar un Gasto',
    rol: 'vendedor',
    steps: [
      { titulo: 'Registrar gastos del negocio', texto: 'Renta, luz, papelería, transporte — cualquier gasto que afecte las utilidades del negocio se registra aquí.' },
      { page: 'gastos', selector: '[data-tour="gastos-nuevo"]', titulo: 'Botón "+ Nuevo Gasto"', texto: 'Captura el concepto, monto, categoría, forma de pago, fecha y opcionalmente el proveedor.' },
      { page: 'gastos', selector: '[data-tour="gastos-tabla"]', titulo: 'Lista de gastos', texto: 'Aquí ves todos los gastos del mes filtrados por categoría, y el total acumulado.' },
      { titulo: '¡Listo!', texto: 'Estos gastos se restan automáticamente de la utilidad neta en Reportes y en el Dashboard. Solo un administrador puede eliminar un gasto ya registrado.' }
    ]
  },

  vendedor_corte_caja: {
    titulo: 'Tutorial: Tu Corte de Caja',
    rol: 'vendedor',
    steps: [
      { titulo: '¿Qué es tu corte de caja?', texto: 'Al terminar tu turno, cierras sesión — y ahí el sistema te pide contar el dinero que tienes: efectivo, tarjeta y transferencias.' },
      { titulo: 'Cuenta el dinero', texto: 'El sistema te muestra cuánto "espera" según tus ventas del turno. Tú capturas lo que realmente contaste — el sistema calcula la diferencia automáticamente.' },
      { titulo: 'Si no puedes contarlo ahora', texto: 'Puedes presionar "Omitir corte", pero deberás escribir un motivo obligatorio — esto queda registrado y tu administrador podrá verlo.' },
      { page: 'index', selector: '[data-tour="sidebar-footer"]', titulo: 'Se activa al cerrar sesión', texto: 'Recuerda: este paso aparece automáticamente cada vez que presionas "Cerrar sesión".' },
      { titulo: '¡Listo!', texto: 'Hacer tu corte correctamente cada turno ayuda a mantener claridad y confianza en el manejo de la caja.' }
    ]
  },

  // ══════════════════════════════════════════════════════════════
  // ALMACÉN
  // ══════════════════════════════════════════════════════════════
  almacen_general: {
    titulo: 'Recorrido General — Almacén',
    rol: 'almacen',
    steps: [
      { titulo: '¡Bienvenido!', texto: 'Aquí verás cómo administrar el inventario: productos, categorías y conteos físicos.' },
      { page: 'inventario', selector: '[data-tour="nav-inventario"]', titulo: 'Inventario', texto: 'La sección principal de tu trabajo: aquí creas y editas productos, precios, costos y presentaciones.' },
      { page: 'inventario', selector: '[data-tour="inv-nuevo"]', titulo: 'Nuevo producto', texto: 'Este botón abre el formulario para dar de alta un producto nuevo con su costo, precio y presentaciones iniciales.' },
      { page: 'inventario_fisico', selector: '[data-tour="nav-inventario_fisico"]', titulo: 'Inventario Físico', texto: 'Aquí comparas el stock que dice el sistema contra el conteo físico real, y ajustas si hay diferencias.' },
      { page: 'categorias', selector: '[data-tour="nav-categorias"]', titulo: 'Categorías', texto: 'Organiza tus productos en categorías y subcategorías para que sean más fáciles de encontrar.' },
      { page: 'devoluciones', selector: '[data-tour="nav-devoluciones"]', titulo: 'Devoluciones', texto: 'También puedes registrar devoluciones de productos desde aquí.' },
      { titulo: '¡Listo!', texto: 'Ya conoces lo esencial del inventario. Explora los demás tutoriales de "Tutoriales" para profundizar en cada tarea.' }
    ]
  },

  almacen_crear_producto: {
    titulo: 'Tutorial: Crear un Producto',
    rol: 'almacen',
    steps: [
      { titulo: 'Crear un producto nuevo', texto: 'Te mostraremos cómo dar de alta un producto. Crearemos uno de PRUEBA con su costo, precio y una presentacion, y lo eliminaremos al final — esto es solo una demostración.' },
      { page: 'inventario', selector: '[data-tour="inv-nuevo"]', titulo: 'Botón "+ Nuevo Producto"', texto: 'En la vida real, aquí harías clic para abrir el formulario: nombre, categoría, marca, costo, precio, código de barras y las presentaciones con su stock inicial.' },
      { titulo: 'Vamos a crear uno de prueba', texto: 'Haz clic para crear un producto de demostración (costo $100, precio $199, presentacion "Única" con 5 unidades).', Componente: CrearProductoDemo },
      { page: 'inventario', selector: '[data-tour="inv-tabla"]', titulo: 'Así se ve en tu inventario', texto: 'Cambia de departamento o filtra para verlo listado en esta tabla, junto con su utilidad calculada automáticamente (precio − costo).' },
      { titulo: 'Limpieza — solo era una demostración', texto: 'Ahora eliminamos el producto de prueba que creamos, para no dejar productos de más en tu catálogo.', Componente: EliminarProductoDemo }
    ]
  },

  almacen_crear_categoria: {
    titulo: 'Tutorial: Crear una Categoría',
    rol: 'almacen',
    steps: [
      { titulo: 'Organizar tu catálogo', texto: 'Las categorías te ayudan a ordenar tus productos. Crearemos una de PRUEBA y la eliminaremos al final.' },
      { page: 'categorias', selector: '[data-tour="cat-nuevo"]', titulo: 'Botón "+ Nueva Categoría"', texto: 'Aquí defines el nombre, si es una categoría principal o una subcategoría, y una descripción opcional.' },
      { titulo: 'Vamos a crear una de prueba', texto: 'Haz clic para crear una categoría de demostración.', Componente: CrearCategoriaDemo },
      { page: 'categorias', selector: '[data-tour="cat-tabla"]', titulo: 'Así se ve en la lista', texto: 'Aparece en "Categorías Principales", con su contador de productos asociados.' },
      { titulo: 'Limpieza — solo era una demostración', texto: 'Ahora eliminamos la categoría de prueba.', Componente: EliminarCategoriaDemo }
    ]
  },

  almacen_inventario_fisico: {
    titulo: 'Tutorial: Conteo de Inventario Físico',
    rol: 'almacen',
    steps: [
      { titulo: '¿Para qué sirve?', texto: 'Cada cierto tiempo conviene contar físicamente el stock en el almacén y compararlo contra lo que dice el sistema, para detectar diferencias (mermas, errores de captura, etc.).' },
      { page: 'inventario_fisico', selector: '[data-tour="invfis-tabla"]', titulo: 'Tabla de conteo', texto: 'Cada fila es una presentacion de un producto. La columna "Stock Sistema" es lo que el sistema cree que hay; tú capturas lo que realmente contaste en "Stock Físico".' },
      { titulo: 'Diferencia y ajuste', texto: 'La columna "Diferencia" se calcula sola (en verde si sobra, en rojo si falta). Al presionar "Aplicar", el stock del sistema se actualiza al valor que contaste, y queda un registro del ajuste.' },
      { titulo: '¡Listo!', texto: 'Recomendado hacerlo periódicamente para mantener tu inventario confiable.' }
    ]
  },

  almacen_editar_producto: {
    titulo: 'Tutorial: Editar Producto y Agregar Presentaciones',
    rol: 'almacen',
    steps: [
      { titulo: 'Editar un producto existente', texto: 'Vamos a crear un producto de prueba y mostrarte cómo se le agregan presentaciones y se actualiza su stock — luego lo eliminamos.' },
      { titulo: 'Creamos un producto de prueba', texto: 'Haz clic para crear el producto de demostración.', Componente: CrearProductoDemo },
      { page: 'inventario', selector: '[data-tour="inv-tabla"]', titulo: 'Botón "Editar"', texto: 'En la vida real, en cualquier fila de la tabla puedes presionar "Editar" para cambiar nombre, precio, costo u otros datos del producto.' },
      { titulo: 'Ver y agregar presentaciones', texto: 'El botón sobre el número de presentaciones (ej. "3 presentaciones (10 u)") abre una ventana donde ves el stock de cada presentacion, puedes actualizarlo directamente, o agregar una presentacion nueva.' },
      { titulo: 'Limpieza — solo era una demostración', texto: 'Ahora eliminamos el producto de prueba que creamos.', Componente: EliminarProductoDemo }
    ]
  },

  almacen_devoluciones: {
    titulo: 'Tutorial: Registrar una Devolución',
    rol: 'almacen',
    steps: [
      { titulo: 'Procesar una devolución', texto: 'Cuando un cliente regresa uno o varios productos de una compra ya realizada, también puedes registrarlo desde almacén.' },
      { page: 'devoluciones', selector: '[data-tour="dev-nueva"]', titulo: 'Botón "+ Nueva Devolución"', texto: 'Abre el formulario donde primero buscas la venta original por su folio.' },
      { titulo: 'Selecciona los artículos', texto: 'Eliges cuántas unidades de cada producto se devuelven, el tipo de devolución y el motivo.' },
      { titulo: '¡Listo!', texto: 'El stock de los productos devueltos regresa automáticamente al inventario — por eso es importante que almacén también pueda registrar esto.' }
    ]
  },

  // ══════════════════════════════════════════════════════════════
  // FARMACIA Y PRODUCTOS REGULADOS
  // ══════════════════════════════════════════════════════════════
  farmacia_lotes_caducidad: {
    titulo: 'Farmacia: Lotes y Caducidad',
    rol: ['admin', 'almacen'],
    steps: [
      { titulo: 'Vender medicamentos sin arriesgarte a vender algo caducado', texto: 'Si tu negocio maneja medicamentos u otros productos perecederos, esta app puede llevar el control de lote y fecha de caducidad de cada presentación — y bloquear la venta si lo único que queda ya caducó.' },
      { page: 'inventario', selector: '[data-tour="inv-nuevo"]', titulo: 'Empieza en Inventario', texto: 'Al crear o editar un producto, baja hasta la sección "Datos regulados".' },
      { page: 'inventario', selector: '[data-tour="inv-datos-regulados"]', titulo: 'Datos del medicamento', texto: 'Aquí capturas principio activo, laboratorio, forma farmacéutica y registro sanitario (COFEPRIS) — todo opcional, pero útil para identificar bien el producto.' },
      { page: 'inventario', selector: '[data-tour="inv-checks-farmacia"]', titulo: 'La casilla clave: "Maneja lotes y caducidad"', texto: 'Actívala en cualquier medicamento. Una vez guardado el producto, su stock ya NO se captura como número suelto — siempre entra por un lote con su propia fecha de caducidad.' },
      { titulo: 'Capturar un lote', texto: 'En la tabla de Inventario, haz clic en el botón de presentaciones (ej. "2 pres. (30 u)") de ese producto, y luego en "Ver lotes" de la presentación que quieras. Ahí agregas número de lote, fecha de caducidad y cantidad.' },
      { titulo: 'FEFO: primero el que antes caduca', texto: 'Cuando alguien vende ese producto en el Punto de Venta, el sistema descuenta automáticamente del lote que caduca más pronto — sin que el vendedor tenga que elegir nada. Así nunca se queda estancado el lote viejo mientras se vende el nuevo.' },
      { titulo: 'El semáforo de caducidad', texto: 'En "Ver lotes" cada fila se pinta de color: verde (vigente), naranja (caduca en 30 días o menos), rojo (ya caducado). Un lote rojo NO se puede vender — el sistema lo rechaza aunque tenga piezas.' },
      { titulo: '¡Listo!', texto: 'Revisa el Dashboard y el reporte de Caducidades seguido para dar de baja o vender primero lo que está por vencer.' }
    ]
  },

  farmacia_receta_sustancia: {
    titulo: 'Farmacia: Receta Médica y Sustancias Controladas',
    rol: ['admin', 'vendedor'],
    steps: [
      { titulo: 'Control al momento de cobrar', texto: 'Algunos medicamentos legalmente requieren receta, y las sustancias controladas requieren identificar a quien las compra. La app exige estos datos antes de dejar cobrar — no depende de que el vendedor se acuerde.' },
      { titulo: '¿Cómo se activa?', texto: 'El administrador marca "Requiere receta médica" y/o "Sustancia controlada" en ese producto, desde Inventario → Datos regulados.' },
      { page: 'ventas', selector: '[data-tour="ventas-carrito"]', titulo: 'En el carrito aparece el campo obligatorio', texto: 'En cuanto agregas al carrito un producto marcado así, sale un campo extra debajo de esa línea: folio de receta, o nombre e identificación del comprador, según el caso.' },
      { page: 'ventas', selector: '[data-tour="ventas-cobrar"]', titulo: 'No deja cobrar sin llenarlo', texto: 'El botón "COBRAR" se bloquea y aparece una alerta roja si falta ese dato en cualquier producto del carrito — es un candado real, no solo un recordatorio visual.' },
      { titulo: '¡Listo!', texto: 'Esto queda guardado junto con la venta, como respaldo por si necesitas comprobarlo después.' }
    ]
  },

  farmacia_proveedores: {
    titulo: 'Farmacia: Proveedores',
    rol: ['admin', 'almacen'],
    steps: [
      { titulo: 'Lleva el control de a quién le compras', texto: 'Útil para saber de qué distribuidora viene cada medicamento — importante si algún día hay que rastrear un lote hasta su origen.' },
      { page: 'proveedores', selector: '[data-tour="nav-proveedores"]', titulo: 'Sección Proveedores', texto: 'Aquí das de alta cada distribuidora o laboratorio con el que trabajas.' },
      { page: 'proveedores', selector: '[data-tour="prov-nuevo"]', titulo: 'Botón "+ Nuevo Proveedor"', texto: 'Capturas nombre, persona de contacto, teléfono, correo y notas.' },
      { page: 'proveedores', selector: '[data-tour="prov-tabla"]', titulo: 'Así se ve en la lista', texto: 'Puedes editarlo, desactivarlo (si dejas de comprarle pero no quieres perder el historial), o eliminarlo si nunca se usó.' },
      { titulo: '¡Listo!', texto: 'Aunque hoy no esté ligado directamente a cada compra, tenerlos registrados deja tu operación lista para cuando lo necesites.' }
    ]
  },

  farmacia_reporte_caducidades: {
    titulo: 'Farmacia: Reporte de Caducidades',
    rol: 'admin',
    steps: [
      { titulo: 'Un reporte dedicado solo a esto', texto: 'Además del aviso rápido en el Dashboard, existe un reporte completo — igual de exportable que los demás — enfocado en lo que ya caducó o está por caducar.' },
      { page: 'reportes', selector: '[data-tour="reportes-tabs"]', titulo: 'Pestaña "Caducidades"', texto: 'Muestra cada lote caducado o próximo a caducar (30 días), con producto, presentación, número de lote, cantidad y fecha.' },
      { page: 'reportes', selector: '[data-tour="reportes-exportar"]', titulo: 'Exportar', texto: 'Igual que los otros 7 reportes, lo puedes exportar a CSV o PDF — útil para llevarlo a una junta o dejárselo al encargado de compras.' },
      { titulo: '¡Listo!', texto: 'Revísalo periódicamente (semanal es un buen ritmo) para no dejar que nada llegue a caducar sin haberlo vendido o dado de baja a tiempo.' }
    ]
  },

  // ══════════════════════════════════════════════════════════════
  // COMUNES A TODOS LOS ROLES
  // ══════════════════════════════════════════════════════════════
  dashboard_explicado: {
    titulo: 'Tutorial: Entender tu Dashboard',
    rol: 'todos',
    steps: [
      { titulo: 'Tu Dashboard al detalle', texto: 'El Dashboard es la primera pantalla que ves al entrar — un resumen de la salud de tu negocio. Vamos a explicar cada parte.' },
      { page: 'index', selector: '[data-tour="dash-stats"]', titulo: 'Tarjetas de resumen', texto: '"Ventas Hoy" y "Ventas del Mes" muestran ingresos y utilidad; "Clientes con Deuda" tu cartera de crédito; "Stock Bajo / Sin Stock" cuántas presentaciones necesitan reabasto urgente.' },
      { page: 'index', selector: '[data-tour="dash-chart-inversion"]', titulo: 'Inversión vs Ganancia', texto: 'Compara cuánto invertiste (costo de tus productos vendidos) contra cuánto ganaste (utilidad), agrupado por Día, Mes o Año — cambia el periodo con los botones de la esquina superior.' },
      { page: 'index', selector: '[data-tour="dash-chart-tendencia"]', titulo: 'Tendencia de Ventas', texto: 'La línea de tus ventas totales a través del tiempo — útil para ver de un vistazo si vas para arriba o para abajo.' },
      { page: 'index', selector: '[data-tour="dash-chart-categoria"]', titulo: 'Categoría con Más Ganancia', texto: 'Esta gráfica de dona te dice qué departamento (Calzado, Ropa, Joyería, etc.) te está dejando más utilidad en el periodo elegido.' },
      { page: 'index', selector: '[data-tour="dash-chart-formapago"]', titulo: 'Ventas por Forma de Pago', texto: 'Qué tanto de lo que vendes es efectivo, tarjeta o transferencia — útil para planear cuánto efectivo esperar en caja.' },
      { page: 'index', selector: '[data-tour="dash-departamento"]', titulo: 'Ventas por Departamento', texto: 'El desglose de cuánto se vendió en cada departamento, también con su propio selector de periodo.' },
      { page: 'index', selector: '[data-tour="dash-topproductos"]', titulo: 'Top Productos', texto: 'Los productos más vendidos en el periodo, con unidades vendidas y monto total.' },
      { page: 'index', selector: '[data-tour="dash-ultimas-ventas"]', titulo: 'Últimas Ventas', texto: 'Las ventas más recientes registradas en el sistema, para tener un vistazo rápido de la actividad reciente.' },
      { titulo: '¡Listo!', texto: 'Cada gráfica cambia de forma independiente al elegir su periodo — así puedes comparar, por ejemplo, ventas de hoy contra utilidad del año, sin que se mezclen.' }
    ]
  },

  perfil_mi_cuenta: {
    titulo: 'Tutorial: Mi Perfil y Contraseña',
    rol: 'todos',
    steps: [
      { titulo: 'Administra tu cuenta', texto: 'Desde "Mi Perfil" controlas tu propia información de acceso al sistema.' },
      { page: 'perfil', selector: '[data-tour="perfil-info"]', titulo: 'Información Personal', texto: 'Aquí puedes actualizar tu nombre y correo electrónico. Tu rol lo asigna el administrador y no se puede cambiar desde aquí.' },
      { page: 'perfil', selector: '[data-tour="perfil-password"]', titulo: 'Contraseña', texto: 'Por seguridad, solo el administrador puede cambiar contraseñas (incluida la suya propia). Si eres vendedor o almacén y necesitas una nueva contraseña, pídesela a tu administrador — él la actualiza desde la sección Usuarios.' },
      { titulo: '¡Listo!', texto: 'Mantener tu contraseña segura y actualizada protege tanto tu cuenta como la información de tu negocio.' }
    ]
  },

  aplicar_promocion_venta: {
    titulo: 'Tutorial: Aplicar un Descuento o Promoción',
    rol: ['admin', 'vendedor'],
    steps: [
      { titulo: 'Descuentos al momento de vender', texto: 'Durante una venta, puedes aplicar un descuento manual o una promoción ya creada por el administrador.' },
      { page: 'ventas', selector: '[data-tour="ventas-descuento"]', titulo: 'Sección Descuento', texto: 'Elige "% Porcent." o "$ Monto" para un descuento manual, o "Promoción" para elegir una de las promociones activas de la lista — el descuento se calcula solo.' },
      { titulo: '¡Listo!', texto: 'El descuento se refleja de inmediato en el total del carrito antes de cobrar.' }
    ]
  }
};

export function toursParaRol(rol) {
  return Object.entries(TOURS)
    .filter(([, t]) => t.rol === 'todos' || t.rol === rol || (Array.isArray(t.rol) && t.rol.includes(rol)))
    .map(([id, t]) => ({ id, ...t }));
}
