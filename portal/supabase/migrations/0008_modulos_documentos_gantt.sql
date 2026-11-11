-- El cliente NO ve ítems ni APU: solo totales por actividad (función resumen).
alter policy "ver items" on public.presupuesto_items using (
  exists (select 1 from public.presupuesto_actividades a join public.presupuesto_capitulos c on c.id = a.capitulo_id
          join public.presupuestos p on p.id = c.presupuesto_id
          where a.id = actividad_id and public.rol_en_encargo(p.encargo_id) in ('admin','equipo')));

create or replace function public.presupuesto_resumen(p_presupuesto uuid)
returns table (capitulo_orden int, capitulo text, indirecto boolean, actividad_orden int, actividad text, total numeric)
language sql stable security definer set search_path = public as $$
  select c.orden, c.nombre, c.indirecto, a.orden, a.nombre, coalesce(sum(i.cantidad * i.valor_unitario), 0)
  from public.presupuestos p
  join public.presupuesto_capitulos c on c.presupuesto_id = p.id
  join public.presupuesto_actividades a on a.capitulo_id = c.id
  left join public.presupuesto_items i on i.actividad_id = a.id
  where p.id = p_presupuesto and public.rol_en_encargo(p.encargo_id) is not null
  group by c.orden, c.nombre, c.indirecto, a.orden, a.nombre
  order by c.orden, a.orden;
$$;
revoke execute on function public.presupuesto_resumen(uuid) from public, anon;
grant execute on function public.presupuesto_resumen(uuid) to authenticated;

create table public.documentos (
  id uuid primary key default gen_random_uuid(),
  encargo_id uuid not null references public.encargos(id) on delete cascade,
  tipo text not null check (tipo in ('brief','propuesta','contrato','adenda','informe')),
  numero int not null default 1,
  version int not null default 1,
  estado text not null default 'borrador' check (estado in ('borrador','enviado','aprobado','firmado')),
  fecha date not null default current_date,
  titulo text,
  contenido jsonb not null default '{}'::jsonb,
  aprobado_por text, aprobado_doc text, aprobado_en timestamptz,
  creado timestamptz not null default now(),
  unique (encargo_id, tipo, numero, version)
);
alter table public.documentos enable row level security;
create policy "equipo ve documentos" on public.documentos for select using (public.rol_en_encargo(encargo_id) in ('admin','equipo'));
create policy "cliente ve documentos enviados" on public.documentos for select using (
  public.rol_en_encargo(encargo_id) = 'cliente' and estado in ('enviado','aprobado','firmado'));
create policy "admin documentos" on public.documentos for all using (public.es_admin()) with check (public.es_admin());

create or replace function public.aprobar_documento(p_doc uuid, p_nombre text, p_cedula text) returns void
language plpgsql security definer set search_path = public as $$
declare d public.documentos;
begin
  select * into d from public.documentos where id = p_doc;
  if d.id is null or public.rol_en_encargo(d.encargo_id) not in ('cliente','admin') then raise exception 'Sin permiso'; end if;
  if d.estado <> 'enviado' then raise exception 'Solo se aprueban documentos enviados'; end if;
  if coalesce(trim(p_nombre),'') = '' or coalesce(trim(p_cedula),'') = '' then raise exception 'Escribe tu nombre y cédula'; end if;
  update public.documentos set estado = 'aprobado', aprobado_por = trim(p_nombre), aprobado_doc = trim(p_cedula), aprobado_en = now() where id = p_doc;
end $$;
revoke execute on function public.aprobar_documento(uuid,text,text) from public, anon;
grant execute on function public.aprobar_documento(uuid,text,text) to authenticated;

create table public.gantt_tareas (
  id uuid primary key default gen_random_uuid(),
  encargo_id uuid not null references public.encargos(id) on delete cascade,
  orden int not null,
  nombre text not null,
  presupuesto_actividad_id uuid references public.presupuesto_actividades(id) on delete set null,
  responsable_id uuid references public.encargo_responsables(id) on delete set null,
  peso_manual numeric(6,4),
  inicio_esperado date, dias_esperados int,
  inicio_real date, fin_real date,
  avance numeric(5,4) not null default 0 check (avance between 0 and 1),
  notas text
);
alter table public.gantt_tareas enable row level security;
create policy "ver gantt" on public.gantt_tareas for select using (public.rol_en_encargo(encargo_id) is not null);
create policy "admin gantt" on public.gantt_tareas for all using (public.es_admin()) with check (public.es_admin());
create policy "equipo actualiza avance" on public.gantt_tareas for update using (public.rol_en_encargo(encargo_id) = 'equipo') with check (public.rol_en_encargo(encargo_id) = 'equipo');
