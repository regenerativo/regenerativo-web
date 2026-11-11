-- ===== Base de precios común (insumos únicos + APU) =====
create table public.insumos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  unidad text not null,
  tipo text not null check (tipo in ('material','mano_obra')),
  precio numeric(14,2) not null default 0,
  proveedor text,
  fecha_precio date default current_date,
  revisar text,
  unique (nombre, unidad, tipo)
);
create table public.apus (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  capitulo text, actividad text,
  descripcion text not null,
  unidad text,
  valor_manual numeric(14,0),
  notas text
);
create table public.apu_insumos (
  id uuid primary key default gen_random_uuid(),
  apu_id uuid not null references public.apus(id) on delete cascade,
  insumo_id uuid not null references public.insumos(id),
  coeficiente numeric(14,6) not null default 0,
  orden int not null default 0
);
-- Valor del APU = Σ(coeficiente × precio) redondeado hacia arriba a la centena (o valor manual)
create view public.v_apus with (security_invoker = true) as
select a.*,
  coalesce(sum(ai.coeficiente * i.precio) filter (where i.tipo = 'material'), 0) as materiales,
  coalesce(sum(ai.coeficiente * i.precio) filter (where i.tipo = 'mano_obra'), 0) as mano_obra,
  coalesce(a.valor_manual, ceil(coalesce(sum(ai.coeficiente * i.precio), 0) / 100) * 100) as valor
from public.apus a left join public.apu_insumos ai on ai.apu_id = a.id left join public.insumos i on i.id = ai.insumo_id
group by a.id;

-- ===== Presupuesto por encargo y versión =====
create table public.presupuestos (
  id uuid primary key default gen_random_uuid(),
  encargo_id uuid not null references public.encargos(id) on delete cascade,
  version int not null default 1,
  estado text not null default 'borrador' check (estado in ('borrador','enviado','aprobado')),
  fecha date not null default current_date,
  pct_admin numeric(6,4) not null default 0.10,
  pct_utilidad numeric(6,4) not null default 0.07,
  pct_iva numeric(6,4) not null default 0.19,
  validez_dias int default 20,
  notas text,
  unique (encargo_id, version)
);
create table public.presupuesto_capitulos (
  id uuid primary key default gen_random_uuid(),
  presupuesto_id uuid not null references public.presupuestos(id) on delete cascade,
  orden int not null, nombre text not null,
  indirecto boolean not null default false
);
create table public.presupuesto_actividades (
  id uuid primary key default gen_random_uuid(),
  capitulo_id uuid not null references public.presupuesto_capitulos(id) on delete cascade,
  orden int not null, nombre text not null
);
create table public.presupuesto_items (
  id uuid primary key default gen_random_uuid(),
  actividad_id uuid not null references public.presupuesto_actividades(id) on delete cascade,
  orden int not null,
  apu_id uuid references public.apus(id),
  descripcion text not null, unidad text,
  cantidad numeric(14,3) not null default 0,
  valor_unitario numeric(14,0) not null default 0,
  contratista text, observaciones text
);

-- ===== Acceso =====
alter table public.insumos enable row level security;
alter table public.apus enable row level security;
alter table public.apu_insumos enable row level security;
alter table public.presupuestos enable row level security;
alter table public.presupuesto_capitulos enable row level security;
alter table public.presupuesto_actividades enable row level security;
alter table public.presupuesto_items enable row level security;

create or replace function public.es_equipo() returns boolean
language sql stable security definer set search_path = public as $$
  select public.es_admin() or exists (select 1 from public.miembros_encargo where usuario_id = auth.uid() and rol = 'equipo');
$$;
revoke execute on function public.es_equipo() from public, anon;
grant execute on function public.es_equipo() to authenticated;

create policy "equipo lee insumos" on public.insumos for select using (public.es_equipo());
create policy "admin insumos" on public.insumos for all using (public.es_admin()) with check (public.es_admin());
create policy "equipo lee apus" on public.apus for select using (public.es_equipo());
create policy "admin apus" on public.apus for all using (public.es_admin()) with check (public.es_admin());
create policy "equipo lee apu_insumos" on public.apu_insumos for select using (public.es_equipo());
create policy "admin apu_insumos" on public.apu_insumos for all using (public.es_admin()) with check (public.es_admin());

create policy "ver presupuestos" on public.presupuestos for select using (public.rol_en_encargo(encargo_id) is not null);
create policy "admin presupuestos" on public.presupuestos for all using (public.es_admin()) with check (public.es_admin());
create policy "ver capitulos" on public.presupuesto_capitulos for select using (
  exists (select 1 from public.presupuestos p where p.id = presupuesto_id and public.rol_en_encargo(p.encargo_id) is not null));
create policy "admin capitulos" on public.presupuesto_capitulos for all using (public.es_admin()) with check (public.es_admin());
create policy "ver actividades" on public.presupuesto_actividades for select using (
  exists (select 1 from public.presupuesto_capitulos c join public.presupuestos p on p.id = c.presupuesto_id
          where c.id = capitulo_id and public.rol_en_encargo(p.encargo_id) is not null));
create policy "admin actividades" on public.presupuesto_actividades for all using (public.es_admin()) with check (public.es_admin());
create policy "ver items" on public.presupuesto_items for select using (
  exists (select 1 from public.presupuesto_actividades a join public.presupuesto_capitulos c on c.id = a.capitulo_id
          join public.presupuestos p on p.id = c.presupuesto_id where a.id = actividad_id and public.rol_en_encargo(p.encargo_id) is not null));
create policy "admin items" on public.presupuesto_items for all using (public.es_admin()) with check (public.es_admin());
