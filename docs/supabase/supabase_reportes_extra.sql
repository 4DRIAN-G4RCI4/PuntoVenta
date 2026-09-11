-- Tablas nuevas para que el celular pueda generar TODOS los reportes
-- que existen en la computadora (Inventario, Cortes de Caja, Créditos,
-- Devoluciones) — además de Ventas y Gastos que ya existían.

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

alter table inventario_resumen enable row level security;
alter table cortes_resumen enable row level security;
alter table creditos_resumen enable row level security;
alter table devoluciones_resumen enable row level security;

drop policy if exists "lectura autenticados" on inventario_resumen;
drop policy if exists "escritura autenticados" on inventario_resumen;
drop policy if exists "actualizar autenticados" on inventario_resumen;
create policy "lectura autenticados" on inventario_resumen for select using (auth.role() = 'authenticated');
create policy "escritura autenticados" on inventario_resumen for insert to authenticated with check (true);
create policy "actualizar autenticados" on inventario_resumen for update to authenticated using (true) with check (true);

drop policy if exists "lectura autenticados" on cortes_resumen;
drop policy if exists "escritura autenticados" on cortes_resumen;
drop policy if exists "actualizar autenticados" on cortes_resumen;
create policy "lectura autenticados" on cortes_resumen for select using (auth.role() = 'authenticated');
create policy "escritura autenticados" on cortes_resumen for insert to authenticated with check (true);
create policy "actualizar autenticados" on cortes_resumen for update to authenticated using (true) with check (true);

drop policy if exists "lectura autenticados" on creditos_resumen;
drop policy if exists "escritura autenticados" on creditos_resumen;
drop policy if exists "actualizar autenticados" on creditos_resumen;
drop policy if exists "eliminar autenticados" on creditos_resumen;
create policy "lectura autenticados" on creditos_resumen for select using (auth.role() = 'authenticated');
create policy "escritura autenticados" on creditos_resumen for insert to authenticated with check (true);
create policy "actualizar autenticados" on creditos_resumen for update to authenticated using (true) with check (true);
create policy "eliminar autenticados" on creditos_resumen for delete to authenticated using (true);

drop policy if exists "lectura autenticados" on devoluciones_resumen;
drop policy if exists "escritura autenticados" on devoluciones_resumen;
drop policy if exists "actualizar autenticados" on devoluciones_resumen;
create policy "lectura autenticados" on devoluciones_resumen for select using (auth.role() = 'authenticated');
create policy "escritura autenticados" on devoluciones_resumen for insert to authenticated with check (true);
create policy "actualizar autenticados" on devoluciones_resumen for update to authenticated using (true) with check (true);

-- Verificación
select tablename, policyname, cmd, roles
from pg_policies
where tablename in ('inventario_resumen','cortes_resumen','creditos_resumen','devoluciones_resumen')
order by tablename, cmd;
