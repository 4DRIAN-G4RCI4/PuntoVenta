-- ================================================================
-- Renombra talla_id/talla -> presentacion_id/presentacion en Supabase,
-- para que coincida con el renombre ya hecho en la app de escritorio
-- y en la app móvil (PuntoApp). Ejecutar UNA VEZ en el SQL Editor de
-- tu proyecto de Supabase.
--
-- Es seguro correrlo más de una vez: cada ALTER solo se ejecuta si la
-- columna vieja todavía existe (no truena si ya lo corriste antes).
-- No borra ni modifica ningún dato, solo el nombre de la columna.
-- ================================================================

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'stock_alertas' and column_name = 'talla_id'
  ) then
    alter table stock_alertas rename column talla_id to presentacion_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_name = 'stock_alertas' and column_name = 'talla'
  ) then
    alter table stock_alertas rename column talla to presentacion;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_name = 'inventario_resumen' and column_name = 'talla_id'
  ) then
    alter table inventario_resumen rename column talla_id to presentacion_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_name = 'inventario_resumen' and column_name = 'talla'
  ) then
    alter table inventario_resumen rename column talla to presentacion;
  end if;
end $$;

-- Verificación: deberías ver presentacion_id/presentacion en ambas tablas
-- y ningún talla_id/talla restante.
select table_name, column_name
from information_schema.columns
where table_name in ('stock_alertas', 'inventario_resumen')
  and column_name in ('presentacion_id', 'presentacion', 'talla_id', 'talla')
order by table_name, column_name;
