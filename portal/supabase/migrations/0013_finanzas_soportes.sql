create table public.fin_soportes (
  id uuid primary key default gen_random_uuid(),
  movimiento_id uuid not null references public.fin_movimientos(id) on delete cascade,
  nombre text not null, ruta text not null unique, origen text not null default 'manual',
  creado timestamptz not null default now());
alter table public.fin_soportes enable row level security;
create policy "facturacion soportes" on public.fin_soportes for all using (public.es_facturacion()) with check (public.es_facturacion());
alter table public.fin_movimientos add column correo_texto text;
insert into storage.buckets (id, name, public) values ('soportes','soportes', false) on conflict do nothing;
create policy "facturacion lee soportes" on storage.objects for select using (bucket_id = 'soportes' and public.es_facturacion());
create policy "facturacion sube soportes" on storage.objects for insert with check (bucket_id = 'soportes' and public.es_facturacion());
create policy "facturacion borra soportes" on storage.objects for delete using (bucket_id = 'soportes' and public.es_facturacion());
