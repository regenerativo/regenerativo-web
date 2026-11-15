-- Sincronización en tiempo real del portal: los cambios en estas tablas llegan al instante a quien tenga la página abierta
-- (Realtime respeta las mismas reglas de acceso: el cliente solo recibe cambios de su encargo).
do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then create publication supabase_realtime; end if;
  foreach t in array array['encargos','propuestas','comentarios','fin_movimientos','encargo_adicionales','documentos','clientes','gantt_tareas','fin_categorias','responsables'] loop
    if exists (select 1 from pg_tables where schemaname = 'public' and tablename = t)
       and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
