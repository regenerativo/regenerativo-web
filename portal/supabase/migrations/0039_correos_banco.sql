-- Revisión automática del correo cada hora: las alertas de Bancolombia entran a Finanzas → Por confirmar.
select cron.unschedule(jobid) from cron.job where jobname = 'correos-banco';
select cron.schedule('correos-banco', '7 * * * *', $$
  select net.http_post(
    url := 'https://vevhopknufhfglfqribk.supabase.co/functions/v1/correos-banco',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object('clave', (select refresh_token from public.integraciones where id = 'cron')),
    timeout_milliseconds := 120000);
$$);
