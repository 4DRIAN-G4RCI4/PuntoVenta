-- ================================================================
-- Esquema de Supabase para la app móvil de solo lectura (PuntoApp).
-- Ejecutar en el SQL Editor de tu proyecto de Supabase.
--
-- Esto es un "espejo" resumido de la base de datos local (SQLite) de
-- la app de escritorio — NO se sube todo, solo lo que la app móvil
-- necesita mostrar (ventas, stock, gastos). Nada de contraseñas ni
-- datos sensibles de más.
-- ================================================================

create table if not exists negocio (
  id int primary key default 1,
  nombre_negocio text not null default 'Poblano',
  logo text
);
insert into negocio (id, nombre_negocio) values (1, 'Poblano')
  on conflict (id) do nothing;

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

create table if not exists gastos_resumen (
  id bigint primary key,
  concepto text not null,
  monto numeric not null default 0,
  categoria text,
  fecha date not null,
  creado_en timestamptz not null default now()
);

-- ── Seguridad (RLS) ──────────────────────────────────────────────
-- Tanto la app de escritorio (Electron, sube datos) como la app móvil
-- (solo lee) usan el MISMO usuario autenticado de Supabase — por eso
-- ambas necesitan permiso: lectura para el celular, lectura+escritura
-- para que Electron pueda sincronizar.

alter table negocio enable row level security;
alter table ventas_resumen enable row level security;
alter table stock_alertas enable row level security;
alter table gastos_resumen enable row level security;

create policy "lectura autenticados" on negocio for select using (auth.role() = 'authenticated');
create policy "lectura autenticados" on ventas_resumen for select using (auth.role() = 'authenticated');
create policy "lectura autenticados" on stock_alertas for select using (auth.role() = 'authenticated');
create policy "lectura autenticados" on gastos_resumen for select using (auth.role() = 'authenticated');

create policy "escritura autenticados" on negocio for insert to authenticated with check (true);
create policy "actualizar autenticados" on negocio for update to authenticated using (true) with check (true);

create policy "escritura autenticados" on ventas_resumen for insert to authenticated with check (true);
create policy "actualizar autenticados" on ventas_resumen for update to authenticated using (true) with check (true);

create policy "escritura autenticados" on stock_alertas for insert to authenticated with check (true);
create policy "actualizar autenticados" on stock_alertas for update to authenticated using (true) with check (true);
create policy "eliminar autenticados" on stock_alertas for delete to authenticated using (true);

create policy "escritura autenticados" on gastos_resumen for insert to authenticated with check (true);
create policy "actualizar autenticados" on gastos_resumen for update to authenticated using (true) with check (true);
