-- Las funciones de acceso no se exponen a usuarios sin sesión.
revoke execute on function public.al_crear_usuario() from public, anon, authenticated;
revoke execute on function public.es_admin() from public, anon;
revoke execute on function public.rol_en_encargo(uuid) from public, anon;
revoke execute on function public.guardar_responsables(uuid, jsonb) from public, anon;
grant execute on function public.es_admin() to authenticated;
grant execute on function public.rol_en_encargo(uuid) to authenticated;
grant execute on function public.guardar_responsables(uuid, jsonb) to authenticated;
