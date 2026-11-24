-- Lista de pendientes por encargo: cliente y equipo agregan y chulean (solo texto + hecho, fecha al finalizar)
create table if not exists public.pendientes (
  id uuid primary key default gen_random_uuid(),
  encargo_id uuid not null references public.encargos(id) on delete cascade,
  texto text not null check (length(trim(texto)) > 0),
  hecho boolean not null default false,
  hecho_en timestamptz,
  autor uuid not null default auth.uid(),
  autor_nombre text,
  creado timestamptz not null default now()
);
create index if not exists pendientes_encargo on public.pendientes(encargo_id, creado);
alter table public.pendientes enable row level security;
create policy "ver pendientes" on public.pendientes for select using (es_admin() or rol_en_encargo(encargo_id) is not null);
create policy "crear pendiente" on public.pendientes for insert with check (autor = auth.uid() and (es_admin() or rol_en_encargo(encargo_id) is not null));
create policy "chulear pendiente" on public.pendientes for update using (es_admin() or rol_en_encargo(encargo_id) is not null) with check (es_admin() or rol_en_encargo(encargo_id) is not null);
create policy "borrar pendiente" on public.pendientes for delete using (es_admin() or autor = auth.uid());
revoke update on public.pendientes from authenticated, anon;
grant update (hecho) on public.pendientes to authenticated;
create or replace function public.pendiente_fecha() returns trigger language plpgsql set search_path = public as $$
begin
  if new.hecho is distinct from old.hecho then new.hecho_en := case when new.hecho then now() else null end; end if;
  return new;
end $$;
create trigger pendiente_fecha before update on public.pendientes for each row execute function public.pendiente_fecha();
alter publication supabase_realtime add table public.pendientes;
