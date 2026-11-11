-- Perfil de facturación: solo quien lo tenga ve ingresos, gastos y presupuesto de la empresa.
-- (Las categorías y movimientos de ejemplo de la versión aplicada se reemplazaron después; ver la base de datos.)
alter table public.roles_usuario drop constraint if exists roles_usuario_rol_check;
alter table public.roles_usuario add constraint roles_usuario_rol_check check (rol in ('admin','facturacion'));

create or replace function public.es_facturacion() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.roles_usuario where usuario_id = auth.uid() and rol = 'facturacion');
$$;
revoke execute on function public.es_facturacion() from public, anon;
grant execute on function public.es_facturacion() to authenticated;

insert into public.roles_usuario (usuario_id, rol)
  select id, 'facturacion' from auth.users where lower(email) in ('apardo@regenerativo.co')
  on conflict do nothing;

create table public.fin_categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text not null check (tipo in ('ingreso','gasto')),
  icono text,
  presupuesto_mensual numeric(14,0),
  orden int not null default 0,
  activa boolean not null default true,
  unique (nombre, tipo)
);
create table public.fin_movimientos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  tipo text not null check (tipo in ('ingreso','gasto')),
  valor numeric(14,0) not null check (valor >= 0),
  categoria_id uuid references public.fin_categorias(id),
  encargo_id uuid references public.encargos(id) on delete set null,
  descripcion text,
  medio text,
  ejemplo boolean not null default false,
  creado timestamptz not null default now()
);
alter table public.fin_categorias enable row level security;
alter table public.fin_movimientos enable row level security;
create policy "facturacion categorias" on public.fin_categorias for all using (public.es_facturacion()) with check (public.es_facturacion());
create policy "facturacion movimientos" on public.fin_movimientos for all using (public.es_facturacion()) with check (public.es_facturacion());
