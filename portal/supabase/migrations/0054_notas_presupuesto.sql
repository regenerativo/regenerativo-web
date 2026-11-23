-- Notas libres del presupuesto personal (no asociadas a ningún pago ni categoría)
create table if not exists public.per_notas (
  id uuid primary key default gen_random_uuid(),
  dueno uuid not null default auth.uid() references auth.users(id) on delete cascade,
  texto text not null,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
alter table public.per_notas enable row level security;
drop policy if exists per_notas_dueno on public.per_notas;
create policy per_notas_dueno on public.per_notas for all to authenticated using (dueno = auth.uid()) with check (dueno = auth.uid());
revoke all on public.per_notas from anon;
grant select, insert, update, delete on public.per_notas to authenticated;
