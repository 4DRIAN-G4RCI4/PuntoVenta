-- Permisos de ESCRITURA para que la app de escritorio (Electron) pueda
-- sincronizar. Seguro de volver a correr (borra la política si ya
-- existía antes de crearla de nuevo).

drop policy if exists "escritura autenticados" on negocio;
drop policy if exists "actualizar autenticados" on negocio;
create policy "escritura autenticados" on negocio for insert to authenticated with check (true);
create policy "actualizar autenticados" on negocio for update to authenticated using (true) with check (true);

drop policy if exists "escritura autenticados" on ventas_resumen;
drop policy if exists "actualizar autenticados" on ventas_resumen;
create policy "escritura autenticados" on ventas_resumen for insert to authenticated with check (true);
create policy "actualizar autenticados" on ventas_resumen for update to authenticated using (true) with check (true);

drop policy if exists "escritura autenticados" on stock_alertas;
drop policy if exists "actualizar autenticados" on stock_alertas;
drop policy if exists "eliminar autenticados" on stock_alertas;
create policy "escritura autenticados" on stock_alertas for insert to authenticated with check (true);
create policy "actualizar autenticados" on stock_alertas for update to authenticated using (true) with check (true);
create policy "eliminar autenticados" on stock_alertas for delete to authenticated using (true);

drop policy if exists "escritura autenticados" on gastos_resumen;
drop policy if exists "actualizar autenticados" on gastos_resumen;
create policy "escritura autenticados" on gastos_resumen for insert to authenticated with check (true);
create policy "actualizar autenticados" on gastos_resumen for update to authenticated using (true) with check (true);

-- Verificación: debe mostrar 3 filas por tabla (select, insert, update —
-- y 4 en stock_alertas por el delete). Si falta alguna, algo no se creó.
select tablename, policyname, cmd, roles
from pg_policies
where tablename in ('negocio','ventas_resumen','stock_alertas','gastos_resumen')
order by tablename, cmd;
