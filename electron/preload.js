const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel) => (...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('api', {
  auth: {
    login: invoke('auth:login'),
    logout: invoke('auth:logout'),
    changePassword: invoke('auth:changePassword'),
    updateProfile: invoke('auth:updateProfile')
  },
  usuarios: {
    list: invoke('usuarios:list'),
    save: invoke('usuarios:save'),
    delete: invoke('usuarios:delete'),
    resumenActividad: invoke('usuarios:resumenActividad'),
    actividad: invoke('usuarios:actividad')
  },
  corte: {
    resumen: invoke('corte:resumen'),
    registrar: invoke('corte:registrar'),
    list: invoke('corte:list')
  },
  categorias: {
    listAll: invoke('categorias:listAll'),
    save: invoke('categorias:save'),
    toggle: invoke('categorias:toggle'),
    delete: invoke('categorias:delete')
  },
  productos: {
    list: invoke('productos:list'),
    departamentos: invoke('productos:departamentos'),
    presentaciones: invoke('productos:presentaciones'),
    save: invoke('productos:save'),
    delete: invoke('productos:delete'),
    updateStock: invoke('productos:updateStock'),
    addPresentacion: invoke('productos:addPresentacion')
  },
  lotes: {
    list: invoke('lotes:list'),
    add: invoke('lotes:add'),
    delete: invoke('lotes:delete'),
    alertas: invoke('lotes:alertas')
  },
  proveedores: {
    list: invoke('proveedores:list'),
    save: invoke('proveedores:save'),
    toggle: invoke('proveedores:toggle'),
    delete: invoke('proveedores:delete')
  },
  inventarioFisico: {
    list: invoke('inventarioFisico:list'),
    ajustar: invoke('inventarioFisico:ajustar')
  },
  ventas: {
    buscarProducto: invoke('ventas:buscarProducto'),
    catalogo: invoke('ventas:catalogo'),
    departamentos: invoke('ventas:departamentos'),
    buscarCliente: invoke('ventas:buscarCliente'),
    procesar: invoke('ventas:procesar'),
    detalle: invoke('ventas:detalle')
  },
  clientes: {
    list: invoke('clientes:list'),
    historial: invoke('clientes:historial'),
    save: invoke('clientes:save'),
    delete: invoke('clientes:delete'),
    crearRapido: invoke('clientes:crearRapido')
  },
  promociones: {
    activas: invoke('promociones:activas'),
    list: invoke('promociones:list'),
    save: invoke('promociones:save'),
    toggle: invoke('promociones:toggle'),
    delete: invoke('promociones:delete')
  },
  historial: {
    list: invoke('historial:list')
  },
  credito: {
    list: invoke('credito:list'),
    abonar: invoke('credito:abonar'),
    historialAbonos: invoke('credito:historialAbonos')
  },
  devoluciones: {
    buscarVenta: invoke('devoluciones:buscarVenta'),
    registrar: invoke('devoluciones:registrar'),
    list: invoke('devoluciones:list'),
    delete: invoke('devoluciones:delete')
  },
  gastos: {
    list: invoke('gastos:list'),
    save: invoke('gastos:save'),
    delete: invoke('gastos:delete')
  },
  reportes: {
    generar: invoke('reportes:generar'),
    exportarPdf: invoke('reportes:exportarPdf')
  },
  updates: {
    estado: invoke('updates:estado'),
    buscar: invoke('updates:buscar'),
    instalarYReiniciar: invoke('updates:instalarYReiniciar'),
    onEstado: (callback) => {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on('updates:estado', listener);
      return () => ipcRenderer.removeListener('updates:estado', listener);
    }
  },
  config: {
    dbInfo: invoke('config:dbInfo'),
    abrirLogs: invoke('config:abrirLogs'),
    exportDb: invoke('config:exportDb'),
    importDb: invoke('config:importDb'),
    getNegocio: invoke('config:getNegocio'),
    setNegocio: invoke('config:setNegocio'),
    getImpresion: invoke('config:getImpresion'),
    setImpresion: invoke('config:setImpresion')
  },
  impresoras: {
    list: invoke('impresoras:list')
  },
  ticket: {
    imprimir: invoke('ticket:imprimir')
  },
  sync: {
    estado: invoke('sync:estado'),
    configurar: invoke('sync:configurar'),
    desconectar: invoke('sync:desconectar'),
    forzar: invoke('sync:forzar'),
    reenviarTodo: invoke('sync:reenviarTodo'),
    cancelar: invoke('sync:cancelar'),
    onProgreso: (callback) => {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on('sync:progreso', listener);
      return () => ipcRenderer.removeListener('sync:progreso', listener);
    }
  }
});
