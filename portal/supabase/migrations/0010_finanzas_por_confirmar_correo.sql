-- Movimientos que llegan por correo quedan "por confirmar"; tipo 'socio' = personal / aportes y retiros (no cuenta en totales)
alter table public.fin_movimientos drop constraint fin_movimientos_tipo_check;
alter table public.fin_movimientos add constraint fin_movimientos_tipo_check check (tipo in ('ingreso','gasto','socio'));
alter table public.fin_movimientos add column estado text not null default 'confirmado' check (estado in ('por_confirmar','confirmado','descartado'));
alter table public.fin_movimientos add column origen text not null default 'manual';
alter table public.fin_movimientos add column ref_correo text unique;
alter table public.fin_movimientos add column nota_correo text;
create index on public.fin_movimientos (estado);
