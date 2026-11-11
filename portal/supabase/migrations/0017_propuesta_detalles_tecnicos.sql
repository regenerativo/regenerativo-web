-- La información del proyecto vive en la propuesta preliminar (como en el Word SCREG_2XXXX_PROPUESTA).
alter table public.propuestas
  add column if not exists propietario text,
  add column if not exists ubicacion_propietario text,
  add column if not exists ubicacion text,
  add column if not exists direccion text,
  add column if not exists area_predio text,
  add column if not exists area_licencia text,
  add column if not exists area_existente text,
  add column if not exists area_intervenida text,
  add column if not exists categoria_trabajo text,
  add column if not exists duracion text,
  add column if not exists otras_necesidades text,
  add column if not exists iva text;

create or replace function public.despegar_propuesta(p_id uuid) returns text
language plpgsql security invoker set search_path = public as $$
declare p public.propuestas; e_id uuid;
begin
  if not public.es_admin() then raise exception 'Solo administración'; end if;
  select * into p from public.propuestas where id = p_id for update;
  if p.id is null then raise exception 'Propuesta no encontrada'; end if;
  if p.encargo_id is not null then return p.codigo; end if;
  insert into public.encargos (codigo, nombre, cliente_id, servicio_id, tipo, inicio, direccion, ciudad)
    values (p.codigo, substring(p.codigo from 7 for 2) || '  I  ' || upper(trim(p.nombre)), p.cliente_id, p.servicio_id, coalesce(p.tipo, 'ambos'), current_date, p.direccion, p.ubicacion)
    returning id into e_id;
  update public.propuestas set estado = 'despego', fecha_decision = current_date, encargo_id = e_id where id = p_id;
  return p.codigo;
end $$;
revoke execute on function public.despegar_propuesta(uuid) from public, anon;
grant execute on function public.despegar_propuesta(uuid) to authenticated;
