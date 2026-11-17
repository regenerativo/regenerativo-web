-- Documento del cliente (NIT / cédula) en la propuesta preliminar: lo que dice su Word; si no lo tiene, XXX; proyectos de familia, No aplica
alter table public.propuestas add column if not exists documento_cliente text;
update public.propuestas set documento_cliente = 'NIT 830.018.957-3' where codigo = 'SCREG_26016';
update public.propuestas set documento_cliente = 'No aplica' where codigo in ('SCREG_26017','SCREG_26018');
update public.propuestas set documento_cliente = 'XXX' where documento_cliente is null;
update public.clientes set tipo_documento = 'NIT', documento = '830.018.957-3' where nombre ilike 'FODESEP%' and coalesce(documento,'') = '';
