-- Endurecer funciones (revisión de seguridad de Supabase, 10 nov 2026)
-- rls_auto_enable es un ayudante interno: nadie desde la web debe poder llamarlo.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
-- onedrive_conectado solo para usuarios con sesión.
revoke execute on function public.onedrive_conectado() from public, anon;
grant execute on function public.onedrive_conectado() to authenticated;
-- normalizar_nombre con search_path fijo.
alter function public.normalizar_nombre(text) set search_path = public;
-- usuario_cliente sigue pública a propósito: el ingreso de clientes la usa antes de iniciar sesión.
