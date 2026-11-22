-- El cliente puede corregir o borrar su comentario mientras regenerativo no lo haya respondido
alter table public.comentarios add column if not exists editado timestamptz;
create or replace function public.editar_mi_comentario(p_id uuid, p_texto text) returns void
language plpgsql security definer set search_path = public as $$
declare c public.comentarios;
begin
  select * into c from comentarios where id = p_id for update;
  if c.id is null or c.autor <> auth.uid() then raise exception 'Solo quien escribió el comentario puede editarlo.'; end if;
  if c.respuesta is not null or c.estado <> 'abierto' then raise exception 'Ya fue respondido: escribe un comentario nuevo.'; end if;
  if coalesce(trim(p_texto), '') = '' then raise exception 'Escribe el comentario.'; end if;
  update comentarios set texto = trim(p_texto), editado = now(), avisado = false where id = p_id;
end $$;
create or replace function public.borrar_mi_comentario(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c public.comentarios;
begin
  select * into c from comentarios where id = p_id;
  if c.id is null or c.autor <> auth.uid() then raise exception 'Solo quien escribió el comentario puede eliminarlo.'; end if;
  if c.respuesta is not null then raise exception 'Ya fue respondido: no se puede eliminar.'; end if;
  delete from comentarios where id = p_id;
end $$;
revoke execute on function public.editar_mi_comentario(uuid, text) from public, anon;
revoke execute on function public.borrar_mi_comentario(uuid) from public, anon;
grant execute on function public.editar_mi_comentario(uuid, text) to authenticated;
grant execute on function public.borrar_mi_comentario(uuid) to authenticated;
