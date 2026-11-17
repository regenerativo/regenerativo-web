-- Los abonos de un encargo solo los consulta alguien con sesión (cliente del encargo o administración)
revoke execute on function public.pagos_de_mi_encargo(uuid) from public, anon;
grant execute on function public.pagos_de_mi_encargo(uuid) to authenticated, service_role;
