-- "Despegó": crea el encargo "26  I  NOMBRE" con el mismo código y enlaza la propuesta. Vencimiento diario con pg_cron.
create or replace function public.despegar_propuesta(p_id uuid) returns text
language plpgsql security invoker set search_path = public as $$
declare p public.propuestas; e_id uuid;
begin
  if not public.es_admin() then raise exception 'Solo administración'; end if;
  select * into p from public.propuestas where id = p_id for update;
  if p.id is null then raise exception 'Propuesta no encontrada'; end if;
  if p.encargo_id is not null then return p.codigo; end if;
  -- Nombre del encargo: "26  I  NOMBRE" (año del código SCREG_26xxx, dos espacios, I, dos espacios)
  insert into public.encargos (codigo, nombre, cliente_id, servicio_id, tipo, inicio)
    values (p.codigo, substring(p.codigo from 7 for 2) || '  I  ' || upper(trim(p.nombre)), p.cliente_id, p.servicio_id, p.tipo, current_date)
    returning id into e_id;
  update public.propuestas set estado = 'despego', fecha_decision = current_date, encargo_id = e_id where id = p_id;
  return p.codigo;
end $$;
revoke execute on function public.despegar_propuesta(uuid) from public, anon;
grant execute on function public.despegar_propuesta(uuid) to authenticated;

create extension if not exists pg_cron;
select cron.schedule('vencer-propuestas-diario', '0 11 * * *', $$select public.vencer_propuestas()$$);
