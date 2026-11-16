-- Correo de revisión de finanzas para el comité regenerativo: lunes 8:00 a. m. Bogotá (13:00 UTC)
select cron.unschedule(jobid) from cron.job where jobname = 'comite-finanzas';
select cron.schedule('comite-finanzas', '0 13 * * 1', $c$
  select net.http_post(
    url := 'https://vevhopknufhfglfqribk.supabase.co/functions/v1/avisos-finanzas',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object('clave', (select refresh_token from public.integraciones where id = 'cron'), 'accion', 'comite'),
    timeout_milliseconds := 60000);
$c$);
