-- Las aprobaciones las registra regenerativo (admin), no el cliente
CREATE OR REPLACE FUNCTION public.aprobar_documento(p_doc uuid, p_nombre text, p_cedula text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare d public.documentos;
begin
  select * into d from public.documentos where id = p_doc;
  if d.id is null or not public.es_admin() then raise exception 'Solo regenerativo registra aprobaciones'; end if;
  if d.estado <> 'enviado' then raise exception 'Solo se aprueban documentos enviados'; end if;
  if coalesce(trim(p_nombre),'') = '' or coalesce(trim(p_cedula),'') = '' then raise exception 'Escribe quién aprobó y cómo'; end if;
  update public.documentos set estado = 'aprobado', aprobado_por = trim(p_nombre), aprobado_doc = trim(p_cedula), aprobado_en = now() where id = p_doc;
end $function$;
