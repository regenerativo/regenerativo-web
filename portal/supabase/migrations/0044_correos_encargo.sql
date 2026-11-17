-- Trazabilidad de correos por encargo: lo enviado al cliente y lo recibido de él (lo llena correos-encargos cada hora)
create table if not exists public.correos_encargo (
  id uuid primary key default gen_random_uuid(),
  encargo_id uuid not null references public.encargos(id) on delete cascade,
  ref text not null,
  fecha timestamptz not null,
  direccion text not null check (direccion in ('enviado','recibido')),
  de text, para text, asunto text, resumen text, web text, adjuntos boolean default false,
  creado timestamptz default now(),
  unique (encargo_id, ref)
);
create index if not exists correos_encargo_enc on public.correos_encargo (encargo_id, fecha desc);
alter table public.correos_encargo enable row level security;
drop policy if exists correos_ver on public.correos_encargo;
create policy correos_ver on public.correos_encargo for select to authenticated
  using (public.es_admin() or public.rol_en_encargo(encargo_id) is not null);
revoke all on public.correos_encargo from anon;
grant select on public.correos_encargo to authenticated;
select cron.unschedule(jobid) from cron.job where jobname = 'correos-encargos';
select cron.schedule('correos-encargos', '27 * * * *', $$
  select net.http_post(
    url := 'https://vevhopknufhfglfqribk.supabase.co/functions/v1/correos-encargos',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object('clave', (select refresh_token from public.integraciones where id = 'cron')),
    timeout_milliseconds := 120000);
$$);
