-- El cliente del encargo ve los datos del proyecto de su propuesta (sin código, honorarios, notas ni archivos)
create or replace function public.propuesta_de_mi_encargo(p_encargo uuid)
returns table (
  propietario text, ubicacion_propietario text, ubicacion text, direccion text,
  area_predio text, area_licencia text, area_existente text, area_intervenida text,
  categoria_trabajo text, duracion text, fecha date, fecha_envio date
)
language sql stable security definer set search_path = public as $$
  select p.propietario::text, p.ubicacion_propietario::text, p.ubicacion::text, p.direccion::text,
         p.area_predio::text, p.area_licencia::text, p.area_existente::text, p.area_intervenida::text,
         p.categoria_trabajo::text, p.duracion::text, p.fecha::date, p.fecha_envio::date
  from propuestas p
  where p.encargo_id = p_encargo and rol_en_encargo(p_encargo) is not null
  limit 1;
$$;
revoke all on function public.propuesta_de_mi_encargo(uuid) from public, anon;
grant execute on function public.propuesta_de_mi_encargo(uuid) to authenticated;
