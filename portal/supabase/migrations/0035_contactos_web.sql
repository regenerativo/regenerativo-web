-- Solicitudes del formulario de contacto de regenerativo.co: se guardan siempre (aunque falle el correo) para no perder ninguna
create table if not exists contactos_web (
  id uuid primary key default gen_random_uuid(),
  creado timestamptz not null default now(),
  nombre text not null, correo text not null, ciudad text not null, telefono text, servicios text, modalidad text, mensaje text not null,
  ip text, enviado boolean not null default false, error text
);
alter table contactos_web enable row level security;
create policy "admin contactos web" on contactos_web for select using (es_admin());
