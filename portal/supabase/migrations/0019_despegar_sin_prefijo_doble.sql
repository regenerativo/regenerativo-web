-- Si el nombre de la propuesta ya trae "26  I  ", no se repite el prefijo al crear el encargo
create or replace function public.despegar_propuesta(p_id uuid) returns text
language plpgsql security invoker set search_path = public as $$
declare p public.propuestas; e_id uuid; limpio text;
begin
  if not public.es_admin() then raise exception 'Solo administración'; end if;
  select * into p from public.propuestas where id = p_id for update;
  if p.id is null then raise exception 'Propuesta no encontrada'; end if;
  if p.encargo_id is not null then return p.codigo; end if;
  limpio := regexp_replace(upper(trim(p.nombre)), '^[0-9]{2}\s+I\s+', '');
  insert into public.encargos (codigo, nombre, cliente_id, servicio_id, tipo, inicio, direccion, ciudad)
    values (p.codigo, substring(p.codigo from 7 for 2) || '  I  ' || limpio, p.cliente_id, p.servicio_id, coalesce(p.tipo, 'ambos'), current_date, p.direccion, p.ubicacion)
    returning id into e_id;
  update public.propuestas set estado = 'despego', fecha_decision = current_date, encargo_id = e_id where id = p_id;
  return p.codigo;
end $$;
revoke execute on function public.despegar_propuesta(uuid) from public, anon;
grant execute on function public.despegar_propuesta(uuid) to authenticated;
