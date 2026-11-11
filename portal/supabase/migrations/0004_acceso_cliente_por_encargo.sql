-- Acceso de clientes: nombre del encargo + contraseña asignada por administración.
alter table public.encargos add column cliente_usuario_id uuid references auth.users(id) on delete set null;

create or replace function public.normalizar_nombre(t text) returns text
language sql immutable as $$ select upper(regexp_replace(trim(coalesce(t,'')), '\s+', ' ', 'g')) $$;

create or replace function public.usuario_cliente(p_encargo text) returns text
language sql stable security definer set search_path = public as $$
  select lower(codigo) || '@clientes.portal.regenerativo.co'
  from public.encargos
  where cliente_usuario_id is not null
    and (normalizar_nombre(nombre) = normalizar_nombre(p_encargo) or upper(codigo) = normalizar_nombre(p_encargo))
  limit 1;
$$;
revoke execute on function public.usuario_cliente(text) from public;
grant execute on function public.usuario_cliente(text) to anon, authenticated;
