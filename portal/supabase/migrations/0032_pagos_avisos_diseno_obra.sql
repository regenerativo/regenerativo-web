-- Pagos visibles para el cliente, avisos por correo al cliente y alcance del encargo (diseño / obra).

-- Alcance del encargo: con esto el portal sabe qué módulos mostrar (sin obra: sin presupuesto ni coordinación de obra)
alter table encargos add column if not exists tiene_diseno boolean not null default true;
alter table encargos add column if not exists tiene_obra boolean not null default false;

-- Avisos al cliente: documentos de DOC _ ENV ya avisados (null = aún no se ha tomado la línea base) y respuestas avisadas
alter table encargos add column if not exists docs_avisados jsonb;
alter table comentarios add column if not exists respuesta_avisada timestamptz;

-- Pagos del encargo para quien está invitado a él (el cliente ve fecha y valor de sus abonos, nada más)
create or replace function public.pagos_de_mi_encargo(p_encargo uuid)
returns table (fecha date, valor numeric)
language sql security definer set search_path = public stable as $$
  select m.fecha, m.valor from fin_movimientos m
  where m.encargo_id = p_encargo and m.tipo = 'ingreso' and coalesce(m.estado, 'confirmado') = 'confirmado'
    and (rol_en_encargo(p_encargo) is not null or es_admin())
  order by m.fecha desc;
$$;
grant execute on function public.pagos_de_mi_encargo(uuid) to authenticated;

-- Revisión automática cada hora de documentos nuevos en DOC _ ENV para avisar al cliente
create extension if not exists pg_net;
insert into integraciones (id, refresh_token, cuenta, actualizado)
  values ('cron', encode(gen_random_bytes(24), 'hex'), 'revisión de envíos', now())
  on conflict (id) do nothing;
select cron.unschedule(jobid) from cron.job where jobname = 'revisar-envios';
select cron.schedule('revisar-envios', '17 * * * *', $$
  select net.http_post(
    url := 'https://vevhopknufhfglfqribk.supabase.co/functions/v1/onedrive-conexion',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object('accion', 'revisar_envios', 'clave', (select refresh_token from public.integraciones where id = 'cron')),
    timeout_milliseconds := 120000);
$$);
