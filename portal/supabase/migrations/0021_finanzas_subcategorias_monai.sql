-- Subcategorías (como las etiquetas de Monai) y origen de cada movimiento importado, para no duplicar al importar de nuevo
alter table public.fin_movimientos add column if not exists subcategoria text;
alter table public.fin_movimientos add column if not exists origen text;
create unique index if not exists fin_movimientos_origen_uk on public.fin_movimientos (origen) where origen is not null;
alter table public.fin_categorias add column if not exists subcategorias text[] not null default '{}';
