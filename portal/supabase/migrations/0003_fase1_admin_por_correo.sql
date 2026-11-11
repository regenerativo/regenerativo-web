-- El administrador inicial es solo apardo@regenerativo.co; nadie más queda como admin por registrarse primero.
create or replace function public.al_crear_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, email, nombre) values (new.id, new.email, new.raw_user_meta_data->>'nombre');
  if lower(new.email) = 'apardo@regenerativo.co' then
    insert into public.roles_usuario values (new.id, 'admin') on conflict do nothing;
  end if;
  insert into public.miembros_encargo (encargo_id, usuario_id, rol)
    select encargo_id, new.id, rol from public.invitaciones
    where lower(email) = lower(new.email) and estado = 'pendiente' and encargo_id is not null
  on conflict do nothing;
  update public.invitaciones set estado = 'aceptada' where lower(email) = lower(new.email) and estado = 'pendiente';
  return new;
end $$;
revoke execute on function public.al_crear_usuario() from public, anon, authenticated;
