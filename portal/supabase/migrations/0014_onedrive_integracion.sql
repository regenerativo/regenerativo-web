-- Conexión con OneDrive (aplicada en Supabase como 20261111010039_onedrive_integracion)
create table public.integraciones (id text primary key, refresh_token text, cuenta text, actualizado timestamptz default now());
alter table public.integraciones enable row level security;   -- sin políticas: solo el servidor (service role) la lee
create table public.oauth_estados (estado text primary key, creado timestamptz default now());
alter table public.oauth_estados enable row level security;
alter table public.encargos add column onedrive_carpeta text;
create or replace function public.onedrive_conectado() returns jsonb language sql stable security definer set search_path to 'public' as $$
  select case when public.es_admin() then (select jsonb_build_object('conectado', refresh_token is not null, 'cuenta', cuenta, 'actualizado', actualizado) from public.integraciones where id='onedrive') end;
$$;
