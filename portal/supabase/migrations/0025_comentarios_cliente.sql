-- Comentarios y dudas del cliente por encargo (el equipo los responde y los marca resueltos; avisan por correo a proyectos@regenerativo.co)
create table if not exists public.comentarios (
  id uuid primary key default gen_random_uuid(),
  encargo_id uuid not null references public.encargos(id) on delete cascade,
  autor uuid not null default auth.uid() references auth.users(id) on delete set null,
  autor_nombre text,
  tipo text not null default 'comentario' check (tipo in ('comentario','duda')),
  modulo text,
  texto text not null check (length(trim(texto)) > 0),
  estado text not null default 'abierto' check (estado in ('abierto','resuelto')),
  respuesta text,
  respondido_por uuid references auth.users(id) on delete set null,
  respondido timestamptz,
  avisado timestamptz,
  creado timestamptz not null default now()
);
create index if not exists comentarios_encargo on public.comentarios(encargo_id, creado desc);
alter table public.comentarios enable row level security;
create policy "ver comentarios del encargo" on public.comentarios for select using (es_admin() or rol_en_encargo(encargo_id) is not null);
create policy "comentar en mi encargo" on public.comentarios for insert with check (autor = auth.uid() and (es_admin() or rol_en_encargo(encargo_id) is not null));
create policy "admin gestiona comentarios" on public.comentarios for update using (es_admin()) with check (es_admin());
create policy "admin borra comentarios" on public.comentarios for delete using (es_admin());
