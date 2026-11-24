-- Estado de los avisos al cliente por documentos actualizados en DOC _ ENV y cambios del cronograma de obra
alter table public.encargos add column if not exists avisos_cliente jsonb;
