-- Finanzas personales de Andrés (apardo@): separadas de las de regenerativo. Cada fila tiene dueño y solo él la ve.
-- Igual que MONAI: categoría (con tipo ingreso, gasto o ahorro) y etiquetas libres (varias por movimiento, p. ej. variable_food;debt_credit).
create table if not exists public.per_categorias (
  id uuid primary key default gen_random_uuid(),
  dueno uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre text not null,
  tipo text not null check (tipo in ('ingreso','gasto','ahorro')),
  emoji text, color text,
  presupuesto_mensual numeric(14,0),
  orden int not null default 0,
  activa boolean not null default true,
  unique (dueno, nombre)
);
create table if not exists public.per_etiquetas (
  id uuid primary key default gen_random_uuid(),
  dueno uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre text not null,
  unique (dueno, nombre)
);
create table if not exists public.per_movimientos (
  id uuid primary key default gen_random_uuid(),
  dueno uuid not null default auth.uid() references auth.users(id) on delete cascade,
  fecha date not null default current_date,
  hora time,
  tipo text not null check (tipo in ('ingreso','gasto','ahorro')),
  valor numeric(14,0) not null,          -- positivo; un reintegro de ingreso queda negativo
  categoria_id uuid references public.per_categorias(id) on delete set null,
  etiquetas text[] not null default '{}',
  descripcion text,
  medio text,
  origen text not null default 'portal' check (origen in ('portal','monai')),
  ref text,
  creado timestamptz not null default now(),
  unique (dueno, ref)
);
create index if not exists per_mov_fecha on public.per_movimientos (dueno, fecha desc);
alter table public.per_categorias enable row level security;
alter table public.per_etiquetas enable row level security;
alter table public.per_movimientos enable row level security;
drop policy if exists per_cat_dueno on public.per_categorias;
drop policy if exists per_eti_dueno on public.per_etiquetas;
drop policy if exists per_mov_dueno on public.per_movimientos;
create policy per_cat_dueno on public.per_categorias for all to authenticated using (dueno = auth.uid()) with check (dueno = auth.uid());
create policy per_eti_dueno on public.per_etiquetas for all to authenticated using (dueno = auth.uid()) with check (dueno = auth.uid());
create policy per_mov_dueno on public.per_movimientos for all to authenticated using (dueno = auth.uid()) with check (dueno = auth.uid());
revoke all on public.per_categorias, public.per_etiquetas, public.per_movimientos from anon;
grant select, insert, update, delete on public.per_categorias, public.per_etiquetas, public.per_movimientos to authenticated;
do $$ begin
  begin alter publication supabase_realtime add table public.per_movimientos; exception when others then null; end;
  begin alter publication supabase_realtime add table public.per_categorias; exception when others then null; end;
end $$;

-- Categorías y etiquetas de MONAI para apardo@ (las mismas, en inglés, como él las escribe)
insert into public.per_categorias (dueno, nombre, tipo, emoji, color, orden)
select u.id, c.nombre, c.tipo, c.emoji, c.color, c.orden from auth.users u,
  (values ('Income','ingreso','🟢','#2E9E3B',1), ('Debts','gasto','🔴','#A54646',2), ('Essentials','gasto','▪️','#7F7F7F',3),
          ('Lifestyle','gasto','🤫','#9C7124',4), ('Ministerio','gasto','✝️','#9154A8',5), ('Projects','gasto','🚀','#8E6F6A',6),
          ('Relationships','gasto','🔸','#A0702A',7), ('Transport','gasto','🚌','#8E9478',8), ('Variable','gasto','▫️','#8A8A8A',9),
          ('Savings','ahorro','🔵','#3A6EA5',10)) as c(nombre, tipo, emoji, color, orden)
where lower(u.email) = 'apardo@regenerativo.co'
on conflict (dueno, nombre) do nothing;
insert into public.per_etiquetas (dueno, nombre)
select u.id, t from auth.users u, unnest(array['debt_bank','debt_credit','essentials_food','essentials_groceries','essentials_home','essentials_services',
  'essentials_suscriptions','income_extra','income_salary','lifestyle_growth','lifestyle_personal','lifestyle_shopping','lifestyle_travel',
  'ministerio_actividades','ministerio_diezmo','ministerio_ofrenda','projects_home','projects_personal','projects_setup','relationship_couple',
  'relationship_family','relationship_friends','savings_5','savings_diezmo','transport_public','transport_uber-taxi','variable_coffee',
  'variable_food','variable_others']) t
where lower(u.email) = 'apardo@regenerativo.co'
on conflict (dueno, nombre) do nothing;
