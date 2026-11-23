-- Ahorro en las finanzas de regenerativo: tercer tipo de movimiento, que no suma a los gastos.
alter table public.fin_categorias drop constraint if exists fin_categorias_tipo_check;
alter table public.fin_categorias add constraint fin_categorias_tipo_check check (tipo in ('ingreso','gasto','ahorro'));
alter table public.fin_movimientos drop constraint if exists fin_movimientos_tipo_check;
alter table public.fin_movimientos add constraint fin_movimientos_tipo_check check (tipo in ('ingreso','gasto','socio','ahorro'));
insert into public.fin_categorias (nombre, tipo, orden, activa, subcategorias)
select 'Ahorro', 'ahorro', 1, true, '{}' where not exists (select 1 from public.fin_categorias where tipo = 'ahorro');
