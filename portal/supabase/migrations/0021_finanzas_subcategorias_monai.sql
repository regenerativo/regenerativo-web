alter table public.fin_movimientos add column if not exists subcategoria text;
alter table public.fin_categorias add column if not exists subcategorias text[] not null default '{}';
