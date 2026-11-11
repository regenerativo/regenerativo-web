-- REG — Portal de encargos · Fase 1: acceso, catálogos y encargos
-- Se dice "encargo", nunca "proyecto".

create extension if not exists pgcrypto;

-- ---------- Usuarios y roles ----------
create table public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text,
  email text not null,
  telefono text,
  creado timestamptz not null default now()
);

create table public.roles_usuario (
  usuario_id uuid not null references auth.users(id) on delete cascade,
  rol text not null check (rol in ('admin')),
  primary key (usuario_id, rol)
);

-- ---------- Catálogos ----------
create table public.empresa (
  id int primary key default 1 check (id = 1),
  marca text not null default 'REGENERATIVO',
  contratista text not null default 'Andrés Fernando Correa Pardo',
  documento_contratista text,
  direccion text, ciudad text default 'Bogotá',
  email text default 'info@regenerativo.co',
  telefono text default '+57 320 215 0932',
  instagram text default '@_regenerativo_'
);
insert into public.empresa (id) values (1);

create table public.servicios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  orden int not null default 0,
  activo boolean not null default true
);
insert into public.servicios (nombre, orden) values
  ('Arquitectura',1),('Diseño de Espacios',2),('Muebles y Objetos',3),('Conceptualización de Proyectos',4);

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'empresa' check (tipo in ('persona','empresa')),
  nombre text not null,
  tipo_documento text,          -- NIT / CC / CE
  documento text,
  representante text,
  documento_representante text,
  email text, telefono text, direccion text, ciudad text,
  creado timestamptz not null default now()
);

create table public.festivos (
  fecha date primary key,
  nombre text not null
);
insert into public.festivos (fecha, nombre) values
 ('2026-01-01','Año Nuevo'),('2026-01-12','Reyes Magos'),('2026-03-23','San José'),('2026-04-02','Jueves Santo'),
 ('2026-04-03','Viernes Santo'),('2026-05-01','Día del Trabajo'),('2026-05-18','Ascensión del Señor'),('2026-06-08','Corpus Christi'),
 ('2026-06-15','Sagrado Corazón'),('2026-06-29','San Pedro y San Pablo'),('2026-07-20','Independencia'),('2026-08-07','Batalla de Boyacá'),
 ('2026-08-17','Asunción de la Virgen'),('2026-10-12','Día de la Raza'),('2026-11-02','Todos los Santos'),('2026-11-16','Independencia de Cartagena'),
 ('2026-12-08','Inmaculada Concepción'),('2026-12-25','Navidad'),
 ('2027-01-01','Año Nuevo'),('2027-01-11','Reyes Magos'),('2027-03-22','San José'),('2027-03-25','Jueves Santo'),
 ('2027-03-26','Viernes Santo'),('2027-05-01','Día del Trabajo'),('2027-05-10','Ascensión del Señor'),('2027-05-31','Corpus Christi'),
 ('2027-06-07','Sagrado Corazón'),('2027-07-05','San Pedro y San Pablo'),('2027-07-20','Independencia'),('2027-08-07','Batalla de Boyacá'),
 ('2027-08-16','Asunción de la Virgen'),('2027-10-18','Día de la Raza'),('2027-11-01','Todos los Santos'),('2027-11-15','Independencia de Cartagena'),
 ('2027-12-08','Inmaculada Concepción'),('2027-12-25','Navidad');

create table public.unidades (
  sigla text primary key,
  nombre text not null
);
insert into public.unidades values ('und','Unidad'),('m2','Metro cuadrado'),('ml','Metro lineal'),('m3','Metro cúbico'),
  ('gl','Global'),('kg','Kilogramo'),('día','Día'),('hr','Hora'),('vje','Viaje');

-- ---------- Encargos ----------
create table public.encargos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,                       -- SCREG_26015
  nombre text not null,                              -- 26 I CEREZO 44
  cliente_id uuid references public.clientes(id),
  servicio_id uuid references public.servicios(id),
  tipo text not null default 'diseno' check (tipo in ('diseno','obra','ambos')),
  direccion text, ciudad text default 'Bogotá',
  area_m2 numeric(10,2),
  inicio date, fin date,
  dias_trabajo text not null default 'lv' check (dias_trabajo in ('lv','ls','todos')),
  fecha_corte date,                                  -- vacía = hoy
  estado text not null default 'activo' check (estado in ('activo','pausado','cerrado')),
  creado timestamptz not null default now(),
  check (fin is null or inicio is null or fin >= inicio)
);

create table public.miembros_encargo (
  encargo_id uuid not null references public.encargos(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  rol text not null check (rol in ('equipo','cliente')),
  primary key (encargo_id, usuario_id)
);

create table public.invitaciones (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  encargo_id uuid references public.encargos(id) on delete cascade,
  rol text not null check (rol in ('equipo','cliente')),
  estado text not null default 'pendiente' check (estado in ('pendiente','aceptada','anulada')),
  invitado_por uuid references auth.users(id),
  creado timestamptz not null default now()
);

create table public.encargo_responsables (
  id uuid primary key default gen_random_uuid(),
  encargo_id uuid not null references public.encargos(id) on delete cascade,
  numero int not null,
  nombre text not null,
  cargo text,
  usuario_id uuid references auth.users(id),
  unique (encargo_id, numero)
);

create table public.encargo_dias_no_laborables (
  encargo_id uuid not null references public.encargos(id) on delete cascade,
  fecha date not null,
  motivo text,
  primary key (encargo_id, fecha)
);

-- ---------- Funciones de acceso ----------
create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from roles_usuario where usuario_id = auth.uid() and rol = 'admin');
$$;

create or replace function public.rol_en_encargo(p_encargo uuid) returns text
language sql stable security definer set search_path = public as $$
  select case when es_admin() then 'admin'
    else (select rol from miembros_encargo where encargo_id = p_encargo and usuario_id = auth.uid()) end;
$$;

-- El primer usuario que se registra queda como admin; los demás solo entran por invitación.
create or replace function public.al_crear_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into perfiles (id, email, nombre) values (new.id, new.email, new.raw_user_meta_data->>'nombre');
  if not exists (select 1 from roles_usuario where rol = 'admin') then
    insert into roles_usuario values (new.id, 'admin');
  end if;
  insert into miembros_encargo (encargo_id, usuario_id, rol)
    select encargo_id, new.id, rol from invitaciones
    where lower(email) = lower(new.email) and estado = 'pendiente' and encargo_id is not null
  on conflict do nothing;
  update invitaciones set estado = 'aceptada' where lower(email) = lower(new.email) and estado = 'pendiente';
  return new;
end $$;
create trigger al_crear_usuario after insert on auth.users
  for each row execute function public.al_crear_usuario();

-- Reemplaza la lista de responsables conservando los id (el Gantt los referencia por id).
create or replace function public.guardar_responsables(p_encargo uuid, p_lista jsonb) returns void
language plpgsql security invoker set search_path = public as $$
begin
  if not es_admin() then raise exception 'Solo administración puede editar responsables'; end if;
  delete from encargo_responsables where encargo_id = p_encargo
    and id not in (select (x->>'id')::uuid from jsonb_array_elements(p_lista) x where x ? 'id' and x->>'id' <> '');
  update encargo_responsables r set numero = -(x->>'numero')::int
    from jsonb_array_elements(p_lista) x where r.id = (x->>'id')::uuid and x->>'id' <> '';
  update encargo_responsables r set numero = (x->>'numero')::int, nombre = x->>'nombre', cargo = x->>'cargo'
    from jsonb_array_elements(p_lista) x where r.id = (x->>'id')::uuid and x->>'id' <> '';
  insert into encargo_responsables (encargo_id, numero, nombre, cargo)
    select p_encargo, (x->>'numero')::int, x->>'nombre', x->>'cargo'
    from jsonb_array_elements(p_lista) x where coalesce(x->>'id','') = '';
end $$;

-- ---------- Row Level Security ----------
alter table public.perfiles enable row level security;
alter table public.roles_usuario enable row level security;
alter table public.empresa enable row level security;
alter table public.servicios enable row level security;
alter table public.clientes enable row level security;
alter table public.festivos enable row level security;
alter table public.unidades enable row level security;
alter table public.encargos enable row level security;
alter table public.miembros_encargo enable row level security;
alter table public.invitaciones enable row level security;
alter table public.encargo_responsables enable row level security;
alter table public.encargo_dias_no_laborables enable row level security;

create policy "perfil propio o admin" on public.perfiles for select using (id = auth.uid() or es_admin());
create policy "perfil propio edita" on public.perfiles for update using (id = auth.uid());
create policy "admin ve roles" on public.roles_usuario for select using (usuario_id = auth.uid() or es_admin());

-- Catálogos: los leen usuarios con sesión; los edita admin
create policy "leer empresa" on public.empresa for select to authenticated using (true);
create policy "admin empresa" on public.empresa for update using (es_admin());
create policy "leer servicios" on public.servicios for select to authenticated using (true);
create policy "admin servicios" on public.servicios for all using (es_admin()) with check (es_admin());
create policy "leer festivos" on public.festivos for select to authenticated using (true);
create policy "admin festivos" on public.festivos for all using (es_admin()) with check (es_admin());
create policy "leer unidades" on public.unidades for select to authenticated using (true);
create policy "admin unidades" on public.unidades for all using (es_admin()) with check (es_admin());

-- Clientes: admin todo; cada miembro ve solo el cliente de sus encargos
create policy "admin clientes" on public.clientes for all using (es_admin()) with check (es_admin());
create policy "ver cliente propio" on public.clientes for select using (
  exists (select 1 from encargos e where e.cliente_id = clientes.id and rol_en_encargo(e.id) is not null));

-- Encargos: solo los invitados los ven
create policy "ver encargos invitados" on public.encargos for select using (rol_en_encargo(id) is not null);
create policy "admin encargos" on public.encargos for all using (es_admin()) with check (es_admin());

create policy "ver miembros" on public.miembros_encargo for select using (rol_en_encargo(encargo_id) is not null);
create policy "admin miembros" on public.miembros_encargo for all using (es_admin()) with check (es_admin());
create policy "admin invitaciones" on public.invitaciones for all using (es_admin()) with check (es_admin());

create policy "ver responsables" on public.encargo_responsables for select using (rol_en_encargo(encargo_id) is not null);
create policy "admin responsables" on public.encargo_responsables for all using (es_admin()) with check (es_admin());
create policy "ver no laborables" on public.encargo_dias_no_laborables for select using (rol_en_encargo(encargo_id) is not null);
create policy "admin no laborables" on public.encargo_dias_no_laborables for all using (es_admin()) with check (es_admin());
