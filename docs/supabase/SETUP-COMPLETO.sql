-- ================================================================
-- SETUP COMPLETO DE SUPABASE — Punto Venta Poblano / PuntoApp
--
-- Para un proyecto de Supabase NUEVO. Copia y pega TODO este archivo en
-- el SQL Editor de tu proyecto (Supabase → SQL Editor → New query) y
-- dale "Run" una sola vez. Crea las 8 tablas que la app móvil necesita
-- para mostrar ventas, stock, gastos, inventario, cortes de caja,
-- créditos y devoluciones — es un espejo RESUMIDO de la base de datos
-- local (SQLite) de la computadora. Nunca se sube nada de contraseñas
-- ni datos sensibles de más.
--
-- Seguro de correr más de una vez: todo usa "if not exists" / "drop
-- policy if exists" antes de crear, así que no truena si ya lo corriste.
--
-- Después de correr esto, en la computadora ve a Configuración → App
-- Móvil (Sincronización) → Conectar, con el correo/contraseña de la
-- cuenta que crees en Authentication → Users de ESTE proyecto.
-- ================================================================

-- ── 1. Identidad del negocio (nombre + logo, para el celular) ──────
create table if not exists negocio (
  id int primary key default 1,
  nombre_negocio text not null default 'Mi Negocio',
  logo text
);
insert into negocio (id, nombre_negocio) values (1, 'Mi Negocio')
  on conflict (id) do nothing;

-- ── 2. Ventas (resumen — para Dashboard, reportes y ticket-histórico) ──
create table if not exists ventas_resumen (
  id bigint primary key,
  folio text not null,
  total numeric not null default 0,
  costo numeric not null default 0,
  utilidad numeric not null default 0,
  forma_pago text default 'efectivo',
  estado text default 'pagada',
  departamento text,
  usuario_nombre text,
  cliente_nombre text,
  creado_en timestamptz not null default now()
);
create index if not exists idx_ventas_resumen_creado on ventas_resumen (creado_en desc);

-- ── 3. Alertas de stock bajo/agotado (semáforo del celular) ─────────
create table if not exists stock_alertas (
  presentacion_id bigint primary key,
  producto_id bigint not null,
  nombre text not null,
  sku text,
  presentacion text,
  departamento text,
  stock int not null default 0,
  stock_minimo int not null default 3,
  actualizado_en timestamptz not null default now()
);

-- ── 4. Gastos del negocio ───────────────────────────────────────────
create table if not exists gastos_resumen (
  id bigint primary key,
  concepto text not null,
  monto numeric not null default 0,
  categoria text,
  fecha date not null,
  creado_en timestamptz not null default now()
);

-- ── 5. Inventario completo (para el reporte de Inventario) ──────────
create table if not exists inventario_resumen (
  presentacion_id bigint primary key,
  producto_id bigint not null,
  nombre text not null,
  sku text,
  presentacion text,
  departamento text,
  costo_unitario numeric not null default 0,
  precio_publico numeric not null default 0,
  stock int not null default 0,
  actualizado_en timestamptz not null default now()
);

-- ── 6. Cortes de caja ────────────────────────────────────────────────
create table if not exists cortes_resumen (
  id bigint primary key,
  usuario_nombre text,
  estado text not null,
  efectivo_esperado numeric default 0,
  efectivo_contado numeric,
  tarjeta_esperado numeric default 0,
  tarjeta_contado numeric,
  transferencia_esperado numeric default 0,
  transferencia_contado numeric,
  diferencia numeric default 0,
  motivo_omision text,
  creado_en timestamptz not null default now()
);

-- ── 7. Créditos activos (clientes con saldo pendiente) ──────────────
create table if not exists creditos_resumen (
  venta_id bigint primary key,
  folio text not null,
  cliente_nombre text,
  telefono text,
  total numeric default 0,
  monto_pagado numeric default 0,
  saldo_pendiente numeric default 0,
  creado_en timestamptz not null default now()
);

-- ── 8. Devoluciones procesadas ───────────────────────────────────────
create table if not exists devoluciones_resumen (
  id bigint primary key,
  folio text,
  cliente_nombre text,
  tipo_devolucion text,
  monto_total numeric default 0,
  estado text,
  usuario_nombre text,
  creado_en timestamptz not null default now()
);

-- ================================================================
-- SEGURIDAD (RLS) — mismo modelo para las 8 tablas:
--   - Cualquier usuario autenticado puede LEER (así lo consulta el celular).
--   - Cualquier usuario autenticado puede ESCRIBIR (así sube datos Electron).
-- Ahora mismo, la computadora y el celular usan LA MISMA cuenta de correo
-- para conectarse — por eso no se distingue "quién" escribe. Si más
-- adelante quieres separar "solo lectura" del celular de "puede escribir"
-- de la computadora con dos cuentas distintas, avísame y te paso ese
-- ajuste (ya lo platicamos antes para el proyecto original).
-- ================================================================

do $$
declare
  t text;
begin
  foreach t in array array['negocio','ventas_resumen','stock_alertas','gastos_resumen',
                            'inventario_resumen','cortes_resumen','creditos_resumen','devoluciones_resumen']
  loop
    execute format('alter table %I enable row level security', t);

    execute format('drop policy if exists "lectura autenticados" on %I', t);
    execute format('drop policy if exists "escritura autenticados" on %I', t);
    execute format('drop policy if exists "actualizar autenticados" on %I', t);
    execute format('drop policy if exists "eliminar autenticados" on %I', t);

    execute format('create policy "lectura autenticados" on %I for select using (auth.role() = ''authenticated'')', t);
    execute format('create policy "escritura autenticados" on %I for insert to authenticated with check (true)', t);
    execute format('create policy "actualizar autenticados" on %I for update to authenticated using (true) with check (true)', t);
    execute format('create policy "eliminar autenticados" on %I for delete to authenticated using (true)', t);
  end loop;
end $$;

-- ── Verificación — debes ver 4 filas (select/insert/update/delete) por
-- cada una de las 8 tablas = 32 filas en total. Si falta alguna, algo no
-- se creó bien y hay que revisar el mensaje de error de arriba.
select tablename, policyname, cmd, roles
from pg_policies
where tablename in ('negocio','ventas_resumen','stock_alertas','gastos_resumen',
                     'inventario_resumen','cortes_resumen','creditos_resumen','devoluciones_resumen')
order by tablename, cmd;
