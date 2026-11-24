-- Cuentas de cobro de cada encargo (valor leído del Word; el PDF se rehace cuando cambia el Word)
create table if not exists public.cuentas_cobro (
  id uuid primary key default gen_random_uuid(),
  encargo_id uuid not null references public.encargos(id) on delete cascade,
  nombre text not null, numero text, concepto text, valor bigint, fecha date,
  manual boolean not null default false, word_web text, pdf_web text,
  creado timestamptz not null default now(), actualizado timestamptz not null default now(),
  unique (encargo_id, nombre)
);
alter table public.cuentas_cobro enable row level security;
create policy "admin cuentas de cobro" on public.cuentas_cobro for all using (es_admin()) with check (es_admin());
