-- Funciones internas: solo el servidor (los avisos y triggers siguen funcionando porque corren como dueño)
revoke execute on function public.anotar_cambio(uuid, text) from public, anon, authenticated;
revoke execute on function public.cuentas_encargo(uuid) from public, anon, authenticated;
revoke execute on function public.correo_ya_cargado() from public, anon, authenticated;
revoke execute on function public.tg_cambio_adicional() from public, anon, authenticated;
revoke execute on function public.tg_cambio_encargo() from public, anon, authenticated;
revoke execute on function public.tg_cambio_movimiento() from public, anon, authenticated;
revoke execute on function public.tg_cambio_propuesta() from public, anon, authenticated;
grant execute on function public.cuentas_encargo(uuid) to service_role;
grant execute on function public.anotar_cambio(uuid, text) to service_role;
alter function public.cop_txt(numeric) set search_path = public;
alter function public.correo_sin_duplicados() set search_path = public;
