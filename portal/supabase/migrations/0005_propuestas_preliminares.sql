-- Propuestas preliminares: viven antes del encargo. "Despegó" crea el encargo; "No despegó" la archiva.
-- En espera más de 30 días sin decisión pasa sola a "No despegó".
create table public.propuestas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,                     -- SCREG_26016 (el encargo hereda el mismo código)
  nombre text not null,                            -- CEREZO 44 (sin el prefijo "26  I  ")
  cliente_id uuid references public.clientes(id),
  servicio_id uuid references public.servicios(id),
  tipo text not null default 'diseno' check (tipo in ('diseno','obra','ambos')),
  honorarios numeric(14,0),
  fecha date not null default current_date,
  estado text not null default 'borrador' check (estado in ('borrador','en_espera','despego','no_despego')),
  fecha_envio date,
  fecha_decision date,
  motivo text,
  encargo_id uuid references public.encargos(id) on delete set null,
  notas text,
  creado timestamptz not null default now()
);
alter table public.propuestas enable row level security;
create policy "admin propuestas" on public.propuestas for all using (public.es_admin()) with check (public.es_admin());

-- Vence las propuestas en espera con más de 30 días.
create or replace function public.vencer_propuestas() returns int
language sql security definer set search_path = public as $$
  with v as (
    update public.propuestas
       set estado = 'no_despego', fecha_decision = current_date, motivo = coalesce(motivo, 'Sin respuesta en 30 días')
     where estado = 'en_espera' and fecha_envio is not null and fecha_envio + 30 <= current_date
    returning 1)
  select count(*)::int from v;
$$;
revoke execute on function public.vencer_propuestas() from public, anon;
grant execute on function public.vencer_propuestas() to authenticated;
