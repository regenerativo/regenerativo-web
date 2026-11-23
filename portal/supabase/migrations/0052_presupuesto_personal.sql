-- Presupuesto personal (esperado contra real), pagos fijos, proyecciones de proyectos personales y alertas al correo personal.
create table if not exists public.per_presupuesto (
  id uuid primary key default gen_random_uuid(),
  dueno uuid not null default auth.uid() references auth.users(id) on delete cascade,
  categoria_id uuid not null references public.per_categorias(id) on delete cascade,
  mes text,                                   -- null = plan base (se repite cada mes); 'AAAA-MM' = ajuste solo de ese mes
  valor numeric(14,0) not null default 0
);
create unique index if not exists per_pres_unico on public.per_presupuesto (dueno, categoria_id, coalesce(mes, 'base'));
create table if not exists public.per_fijos (
  id uuid primary key default gen_random_uuid(),
  dueno uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre text not null,
  categoria_id uuid references public.per_categorias(id) on delete set null,
  etiqueta text,
  valor numeric(14,0) not null default 0,
  dia int not null default 1 check (dia between 1 and 31),
  activo boolean not null default true,
  creado timestamptz not null default now()
);
create table if not exists public.per_proyectos (
  id uuid primary key default gen_random_uuid(),
  dueno uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre text not null,
  descripcion text,
  fecha_meta date,
  estado text not null default 'plan' check (estado in ('plan','activo','cerrado')),
  creado timestamptz not null default now()
);
create table if not exists public.per_proyecto_items (
  id uuid primary key default gen_random_uuid(),
  dueno uuid not null default auth.uid() references auth.users(id) on delete cascade,
  proyecto_id uuid not null references public.per_proyectos(id) on delete cascade,
  categoria_id uuid references public.per_categorias(id) on delete set null,
  concepto text not null,
  valor numeric(14,0) not null default 0,
  orden int not null default 0
);
create table if not exists public.per_ajustes (
  dueno uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  correo_alertas text,
  alertas boolean not null default true,
  avisar_pct int not null default 80
);
create table if not exists public.per_alertas_enviadas (
  dueno uuid not null references auth.users(id) on delete cascade,
  clave text not null,
  enviado timestamptz not null default now(),
  primary key (dueno, clave)
);
alter table public.per_movimientos add column if not exists proyecto_id uuid references public.per_proyectos(id) on delete set null;
alter table public.per_movimientos add column if not exists fijo_id uuid references public.per_fijos(id) on delete set null;
do $$ declare t text; begin
  foreach t in array array['per_presupuesto','per_fijos','per_proyectos','per_proyecto_items','per_ajustes','per_alertas_enviadas'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_dueno', t);
    execute format('create policy %I on public.%I for all to authenticated using (dueno = auth.uid()) with check (dueno = auth.uid())', t || '_dueno', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
insert into public.per_ajustes (dueno, correo_alertas)
select id, 'andresspardo@icloud.com' from auth.users where lower(email) = 'apardo@regenerativo.co'
on conflict (dueno) do update set correo_alertas = excluded.correo_alertas;
