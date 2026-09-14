import React, { useEffect, useRef, useState } from 'react';
import { money } from '../format.js';
import { useAuth } from '../App.jsx';
import { TicketContenido } from './Ticket.jsx';
import { useImprimirTicket } from '../utils/useImprimirTicket.js';

export default function Ventas() {
  const { user, negocio } = useAuth();
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState([]);
  const [scanMsg, setScanMsg] = useState('');
  const buscadorRef = useRef(null);
  const [carrito, setCarrito] = useState([]);
  const [clienteQ, setClienteQ] = useState('');
  const [clienteResultados, setClienteResultados] = useState([]);
  const [cliente, setCliente] = useState(null);
  const [nuevoCliOpen, setNuevoCliOpen] = useState(false);
  const [nuevoCli, setNuevoCli] = useState({ nombre: '', apellido: '', telefono: '' });
  const [tipoVenta, setTipoVenta] = useState('contado');
  const [formaPago, setFormaPago] = useState('efectivo');
  const [descTipo, setDescTipo] = useState('pct');
  const [descValor, setDescValor] = useState('');
  const [montoPagado, setMontoPagado] = useState('');
  const [notas, setNotas] = useState('');
  const [numMeses, setNumMeses] = useState(12);
  const [tasaInteres, setTasaInteres] = useState(0);
  const [enganche, setEnganche] = useState(0);
  const [promociones, setPromociones] = useState([]);
  const [ticket, setTicket] = useState(null);
  const [ticketDetalle, setTicketDetalle] = useState(null);
  const [error, setError] = useState('');
  const timer = useRef(null);
  const cliTimer = useRef(null);

  useEffect(() => { window.api.promociones.activas().then(setPromociones); }, []);

  useEffect(() => {
    clearTimeout(timer.current);
    if (!q.trim()) { setResultados([]); return; }
    timer.current = setTimeout(async () => {
      const rows = await window.api.ventas.buscarProducto({ q });
      const map = {};
      rows.forEach((r) => {
        if (!map[r.id]) map[r.id] = { id: r.id, nombre: r.nombre, sku: r.sku, departamento: r.departamento, precio: r.precio_publico, costo: r.costo_unitario, requiereReceta: !!r.requiere_receta, sustanciaControlada: !!r.sustancia_controlada, presentaciones: [] };
        if (r.presentacion_id) map[r.id].presentaciones.push({ id: r.presentacion_id, presentacion: r.presentacion, stock: r.stock });
      });
      setResultados(Object.values(map));
    }, 250);
  }, [q]);

  useEffect(() => {
    clearTimeout(cliTimer.current);
    if (!clienteQ.trim()) { setClienteResultados([]); return; }
    cliTimer.current = setTimeout(async () => {
      setClienteResultados(await window.api.ventas.buscarCliente({ q: clienteQ }));
    }, 250);
  }, [clienteQ]);

  function addCart(prod, presentacionId, presentacionNombre, stockDisp) {
    const key = `${prod.id}_${presentacionId || 'u'}`;
    setCarrito((prev) => {
      const idx = prev.findIndex((i) => i.key === key);
      if (idx >= 0) {
        if (prev[idx].qty >= stockDisp) { alert('Sin más stock.'); return prev; }
        const copy = [...prev]; copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 }; return copy;
      }
      return [...prev, {
        key, prod_id: prod.id, presentacion_id: presentacionId, nombre: prod.nombre, presentacion: presentacionNombre,
        precio: prod.precio, costo: prod.costo, qty: 1, stockDisp,
        requiereReceta: !!prod.requiereReceta, recetaFolio: '',
        sustanciaControlada: !!prod.sustanciaControlada, identificacionComprador: ''
      }];
    });
    setQ(''); setResultados([]); setScanMsg('');
    // Vuelve el foco al buscador para permitir escaneo continuo con cualquier lector de código de barras.
    buscadorRef.current?.focus();
  }

  // Compatible con cualquier lector de código de barras USB/Bluetooth: estos
  // dispositivos funcionan como un teclado ("keyboard wedge") que escribe el
  // código y presiona Enter. Al detectar Enter, se busca coincidencia exacta
  // por código de barras y se agrega automáticamente al carrito.
  async function handleScanEnter() {
    const query = q.trim();
    if (!query) return;
    clearTimeout(timer.current);
    const rows = await window.api.ventas.buscarProducto({ q: query });
    const map = {};
    rows.forEach((r) => {
      if (!map[r.id]) map[r.id] = { id: r.id, nombre: r.nombre, sku: r.sku, codigo_barras: r.codigo_barras, departamento: r.departamento, precio: r.precio_publico, costo: r.costo_unitario, requiereReceta: !!r.requiere_receta, sustanciaControlada: !!r.sustancia_controlada, presentaciones: [] };
      if (r.presentacion_id) map[r.id].presentaciones.push({ id: r.presentacion_id, presentacion: r.presentacion, stock: r.stock });
    });
    const productos = Object.values(map);
    setScanMsg('');

    const porCodigoExacto = productos.filter((p) => p.codigo_barras === query);
    const candidatos = porCodigoExacto.length === 1 ? porCodigoExacto : productos;

    if (candidatos.length === 1) {
      const p = candidatos[0];
      if (p.presentaciones.length === 0) {
        addCart(p, null, 'Única', 999);
        return;
      }
      const conStock = p.presentaciones.filter((t) => t.stock > 0);
      if (!conStock.length) { setResultados(productos); setScanMsg(`"${p.nombre}" no tiene stock disponible.`); return; }
      if (conStock.length > 1) { setResultados(productos); setScanMsg(`Selecciona la presentacion de "${p.nombre}".`); return; }
      addCart(p, conStock[0].id, conStock[0].presentacion, conStock[0].stock);
    } else if (candidatos.length > 1) {
      setResultados(productos);
      setScanMsg('Varios productos coinciden — selecciona uno de la lista.');
    } else {
      setResultados([]);
      setScanMsg(`Sin resultados para "${query}".`);
    }
  }

  function changeQty(key, d) {
    setCarrito((prev) => prev.map((i) => {
      if (i.key !== key) return i;
      const nuevo = i.qty + d;
      if (nuevo < 1 || nuevo > i.stockDisp) return i;
      return { ...i, qty: nuevo };
    }));
  }
  function removeItem(key) { setCarrito((prev) => prev.filter((i) => i.key !== key)); }
  function setRecetaFolio(key, folio) { setCarrito((prev) => prev.map((i) => i.key === key ? { ...i, recetaFolio: folio } : i)); }
  function setIdentificacionComprador(key, val) { setCarrito((prev) => prev.map((i) => i.key === key ? { ...i, identificacionComprador: val } : i)); }
  const faltaReceta = carrito.some((i) => i.requiereReceta && !i.recetaFolio.trim());
  const faltaIdentificacion = carrito.some((i) => i.sustanciaControlada && !i.identificacionComprador.trim());

  const subtotal = carrito.reduce((s, i) => s + i.precio * i.qty, 0);
  let descuentoMonto = 0;
  if (descTipo === 'pct') descuentoMonto = subtotal * (Number(descValor) || 0) / 100;
  else if (descTipo === 'monto') descuentoMonto = Math.min(Number(descValor) || 0, subtotal);
  const total = Math.max(0, subtotal - descuentoMonto);
  const pagado = Number(montoPagado) || 0;
  const cambio = pagado - total;

  const financiado = Math.max(0, total - (Number(enganche) || 0));
  const r = (Number(tasaInteres) || 0) / 100 / 12;
  const cuota = r > 0 ? (financiado * r) / (1 - Math.pow(1 + r, -numMeses)) : financiado / numMeses;

  async function crearCliente() {
    if (!nuevoCli.nombre || !nuevoCli.apellido) { alert('Nombre y apellido son requeridos.'); return; }
    const res = await window.api.clientes.crearRapido(nuevoCli);
    if (!res.ok) { alert(res.error); return; }
    setCliente(res);
    setNuevoCliOpen(false);
    setNuevoCli({ nombre: '', apellido: '', telefono: '' });
  }

  async function procesarVenta() {
    if (!carrito.length) return;
    setError('');
    const payload = {
      items: carrito.map((i) => ({
        prod_id: i.prod_id, presentacion_id: i.presentacion_id, qty: i.qty, precio: i.precio, costo: i.costo,
        receta_folio: i.recetaFolio || null, identificacion_comprador: i.identificacionComprador || null
      })),
      cliente_id: cliente?.id || null,
      tipo_venta: tipoVenta,
      forma_pago: formaPago,
      desc_pct: descTipo === 'pct' ? Number(descValor) || 0 : (subtotal > 0 ? (descuentoMonto / subtotal) * 100 : 0),
      desc_monto: descuentoMonto,
      notas,
      usuario_id: user.id
    };
    if (tipoVenta === 'a_meses') {
      payload.num_meses = numMeses;
      payload.tasa_interes = Number(tasaInteres) || 0;
      payload.enganche = Number(enganche) || 0;
      payload.cuota_mensual = Number(cuota.toFixed(2));
      payload.monto_pagado = Number(enganche) || 0;
    } else {
      payload.monto_pagado = pagado || total;
    }
    const res = await window.api.ventas.procesar(payload);
    if (!res.ok) { setError(res.error); return; }
    setTicket(res);
    const detalle = await window.api.ventas.detalle({ id: res.venta_id });
    if (detalle.ok) setTicketDetalle(detalle);
  }

  function nuevaVenta() {
    setCarrito([]); setCliente(null); setDescValor(''); setMontoPagado(''); setNotas('');
    setTipoVenta('contado'); setEnganche(0); setTasaInteres(0);
    setTicket(null);
    setTicketDetalle(null);
    setTimeout(() => buscadorRef.current?.focus(), 0);
  }

  const { imprimir, imprimiendo, msgImpresion, impresion } = useImprimirTicket({
    venta: ticketDetalle?.venta, items: ticketDetalle?.items, pagos: ticketDetalle?.pagos, negocio
  });

  return (
    <div className="pos-wrap">
      <div className="pos-left">
        <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="card-title">Productos</div>
          <div className="search-bar" style={{ marginBottom: 10 }} data-tour="ventas-buscador">
            <input
              ref={buscadorRef}
              placeholder="Escanea un código de barras, o busca por nombre / SKU..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleScanEnter(); } }}
              autoFocus
            />
          </div>
          {scanMsg && <div className="alert alert-info" style={{ marginBottom: 10, padding: '6px 10px', fontSize: 12 }}>{scanMsg}</div>}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {resultados.map((p) => (
              <div key={p.id} className="card" style={{ marginBottom: 8, padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div><strong>{p.nombre}</strong><div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.departamento} · {p.sku}</div></div>
                  <div style={{ color: 'var(--accent)', fontWeight: 700 }}>{money(p.precio)}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {p.presentaciones.length === 0 && <button className="btn btn-secondary btn-xs" onClick={() => addCart(p, null, 'Única', 999)}>+ Agregar</button>}
                  {p.presentaciones.map((t) => (
                    <button key={t.id} className="btn btn-secondary btn-xs" disabled={t.stock <= 0} onClick={() => addCart(p, t.id, t.presentacion, t.stock)}>
                      {t.presentacion} <span style={{ color: 'var(--muted)' }}>({t.stock})</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {q && resultados.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Sin resultados.</p>}
          </div>
        </div>

        <div className="card" style={{ maxHeight: 320, overflowY: 'auto', flexShrink: 0 }} data-tour="ventas-carrito">
          <div className="card-title">Carrito <span className="badge">{carrito.reduce((s, i) => s + i.qty, 0)} items</span></div>
          {carrito.length === 0 && <div className="empty-state">El carrito está vacío.</div>}
          {carrito.map((item) => (
            <React.Fragment key={item.key}>
              <div className="cart-row">
                <div><div style={{ fontWeight: 600 }}>{item.nombre}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>{item.presentacion !== 'Única' ? `Presentacion: ${item.presentacion}` : ''}</div></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button className="qty-btn" onClick={() => changeQty(item.key, -1)}>-</button>
                  <span>{item.qty}</span>
                  <button className="qty-btn" onClick={() => changeQty(item.key, 1)}>+</button>
                </div>
                <div style={{ fontWeight: 700 }}>{money(item.precio * item.qty)}</div>
                <div style={{ cursor: 'pointer', color: 'var(--red)' }} onClick={() => removeItem(item.key)}>✕</div>
              </div>
              {item.requiereReceta && (
                <div style={{ padding: '0 0 8px', marginTop: -4 }}>
                  <input
                    placeholder="Folio de receta médica (requerido)"
                    value={item.recetaFolio}
                    onChange={(e) => setRecetaFolio(item.key, e.target.value)}
                    style={{ borderColor: item.recetaFolio.trim() ? 'var(--border)' : 'var(--red)' }}
                  />
                </div>
              )}
              {item.sustanciaControlada && (
                <div style={{ padding: '0 0 8px', marginTop: -4 }}>
                  <input
                    placeholder="Nombre e identificación del comprador (requerido — sustancia controlada)"
                    value={item.identificacionComprador}
                    onChange={(e) => setIdentificacionComprador(item.key, e.target.value)}
                    style={{ borderColor: item.identificacionComprador.trim() ? 'var(--border)' : 'var(--red)' }}
                  />
                </div>
              )}
            </React.Fragment>
          ))}
          {carrito.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 8 }}>
              <div className="total-row"><span>Subtotal</span><span>{money(subtotal)}</span></div>
              <div className="total-row" style={{ color: 'var(--red)' }}><span>Descuento</span><span>-{money(descuentoMonto)}</span></div>
              <div className="total-row big"><span>TOTAL</span><span style={{ color: 'var(--accent)' }}>{money(total)}</span></div>
            </div>
          )}
        </div>
      </div>

      <div className="pos-right">
        <div className="card">
          <div className="card-title">Cliente <button className="btn btn-ghost btn-xs" style={{ marginLeft: 'auto' }} onClick={() => setNuevoCliOpen(!nuevoCliOpen)}>+ Nuevo</button></div>
          {cliente ? (
            <div className="card" style={{ marginBottom: 0, padding: 10, display: 'flex', justifyContent: 'space-between' }}>
              <div><strong>{cliente.nombre} {cliente.apellido}</strong><div style={{ fontSize: 11, color: 'var(--muted)' }}>{cliente.saldo_deuda > 0 ? `Deuda: ${money(cliente.saldo_deuda)}` : 'Sin deuda'}</div></div>
              <button className="btn btn-danger btn-xs" onClick={() => setCliente(null)}>✕</button>
            </div>
          ) : nuevoCliOpen ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
                <input placeholder="Nombre" value={nuevoCli.nombre} onChange={(e) => setNuevoCli({ ...nuevoCli, nombre: e.target.value })} />
                <input placeholder="Apellido" value={nuevoCli.apellido} onChange={(e) => setNuevoCli({ ...nuevoCli, apellido: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input placeholder="Teléfono" value={nuevoCli.telefono} onChange={(e) => setNuevoCli({ ...nuevoCli, telefono: e.target.value })} />
                <button className="btn btn-success" onClick={crearCliente}>Agregar</button>
              </div>
            </div>
          ) : (
            <div>
              <input placeholder="Nombre o teléfono..." value={clienteQ} onChange={(e) => setClienteQ(e.target.value)} />
              {clienteResultados.map((c) => (
                <div key={c.id} className="card" style={{ marginTop: 6, marginBottom: 0, padding: 8, cursor: 'pointer' }} onClick={() => { setCliente(c); setClienteQ(''); setClienteResultados([]); }}>
                  <div style={{ fontWeight: 600, fontSize: 12 }}>{c.nombre} {c.apellido}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>{c.telefono}{c.saldo_deuda > 0 ? ` · Deuda: ${money(c.saldo_deuda)}` : ''}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card" style={{ flex: 1, overflowY: 'auto' }} data-tour="ventas-pago">
          <div className="card-title">Pago</div>
          <div className="form-grid">
            <div className="form-group">
              <label>Tipo de Venta</label>
              <select value={tipoVenta} onChange={(e) => setTipoVenta(e.target.value)}>
                <option value="contado">Contado</option>
                <option value="a_meses">A Meses</option>
                <option value="credito">Crédito/Abono</option>
              </select>
            </div>
            <div className="form-group">
              <label>Forma de Pago</label>
              <select value={formaPago} onChange={(e) => setFormaPago(e.target.value)}>
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="transferencia">Transferencia</option>
                <option value="mixto">Mixto</option>
              </select>
            </div>
          </div>

          {tipoVenta === 'credito' && <div className="alert alert-info">El saldo se registrará como deuda del cliente.</div>}

          {tipoVenta === 'a_meses' && (
            <div className="card" style={{ background: 'var(--surface2)', marginBottom: 8 }}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Núm. Meses</label>
                  <select value={numMeses} onChange={(e) => setNumMeses(Number(e.target.value))}>
                    {[3, 6, 9, 12, 18, 24].map((m) => <option key={m} value={m}>{m} meses</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Interés (%)</label><input type="number" value={tasaInteres} onChange={(e) => setTasaInteres(e.target.value)} /></div>
              </div>
              <div className="form-group"><label>Enganche ($)</label><input type="number" value={enganche} onChange={(e) => setEnganche(e.target.value)} /></div>
              <div style={{ fontSize: 12, background: 'var(--surface)', padding: 8, borderRadius: 8 }}>
                <div className="total-row"><span>Financiado:</span><strong>{money(financiado)}</strong></div>
                <div className="total-row"><span>Cuota mensual:</span><strong style={{ color: 'var(--accent)' }}>{money(cuota || 0)}</strong></div>
              </div>
            </div>
          )}

          <div className="form-group" data-tour="ventas-descuento">
            <label>Descuento</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <select style={{ width: 110 }} value={descTipo} onChange={(e) => { setDescTipo(e.target.value); setDescValor(''); }}>
                <option value="pct">% Porcent.</option>
                <option value="monto">$ Monto</option>
                <option value="promo">Promoción</option>
              </select>
              {descTipo !== 'promo' ? (
                <input type="number" value={descValor} onChange={(e) => setDescValor(e.target.value)} placeholder="0" />
              ) : (
                <select onChange={(e) => { const opt = promociones.find((p) => p.id === Number(e.target.value)); if (!opt) return; setDescTipo('monto'); setDescValor(opt.tipo === 'porcentaje' ? (subtotal * opt.valor / 100).toFixed(2) : opt.valor); }}>
                  <option value="">— Selecciona promoción —</option>
                  {promociones.map((p) => <option key={p.id} value={p.id}>{p.nombre} — {p.tipo === 'porcentaje' ? p.valor + '%' : money(p.valor)}</option>)}
                </select>
              )}
            </div>
          </div>

          {tipoVenta !== 'a_meses' && (
            <div className="form-group">
              <label>Monto Recibido ($)</label>
              <input type="number" value={montoPagado} onChange={(e) => setMontoPagado(e.target.value)} placeholder="0.00" />
              {montoPagado !== '' && <div style={{ fontSize: 11, marginTop: 4, color: cambio >= 0 ? 'var(--green)' : 'var(--red)' }}>{cambio >= 0 ? `Cambio: ${money(cambio)}` : `Faltante: ${money(Math.abs(cambio))}`}</div>}
            </div>
          )}

          <div className="form-group"><label>Notas</label><textarea rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} /></div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {faltaReceta && <div className="alert alert-error">Falta el folio de receta en uno o más productos del carrito.</div>}
        {faltaIdentificacion && <div className="alert alert-error">Falta la identificación del comprador en uno o más productos de sustancia controlada.</div>}
        <button data-tour="ventas-cobrar" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 14, fontSize: 15 }} disabled={!carrito.length || faltaReceta || faltaIdentificacion} onClick={procesarVenta}>
          COBRAR — {money(total)}
        </button>
      </div>

      {ticket && (
        <div className="modal-overlay open">
          <div className="modal" style={{ maxWidth: 380, textAlign: 'center', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 40, color: 'var(--green)', marginBottom: 10 }}>✓</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{money(ticket.total)}</div>
            <div style={{ color: 'var(--muted)', margin: '6px 0' }}>Venta registrada correctamente</div>
            <div>Folio: <code>{ticket.folio}</code></div>
            {ticket.saldo > 0 && <div style={{ color: 'var(--red)', fontWeight: 600, marginTop: 6 }}>Saldo pendiente: {money(ticket.saldo)}</div>}

            {ticketDetalle && (
              <div style={{ background: '#fff', borderRadius: 10, padding: 16, marginTop: 18, textAlign: 'left' }}>
                <TicketContenido venta={ticketDetalle.venta} items={ticketDetalle.items} pagos={ticketDetalle.pagos} negocio={negocio} />
              </div>
            )}

            {msgImpresion && <div className="alert alert-error" style={{ marginTop: 10, textAlign: 'left' }}>{msgImpresion}</div>}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={nuevaVenta}>Cerrar</button>
              <button className="btn btn-primary" onClick={imprimir} disabled={imprimiendo || !ticketDetalle}>
                {imprimiendo ? 'Imprimiendo...' : impresion?.impresora_ticket ? `Imprimir en ${impresion.impresora_ticket}` : 'Imprimir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
