-- Importación de la exportación CSV de MONAI (fuente de verdad de ingresos y gastos de regenerativo).
-- Cada fila de MONAI queda como un movimiento con ref_correo = 'monai:<id>'; volver a importar actualiza, no duplica.
-- p_aplicar = false: solo muestra qué cambiaría (vista previa). true: lo aplica.
create or replace function public.importar_monai(p_filas jsonb, p_aplicar boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_min date; r jsonb;
begin
  if not (es_admin() or es_facturacion()) then raise exception 'Solo administración o facturación.'; end if;
  create temp table _m on commit drop as
    select x.ref, x.fecha, x.valor, x.descripcion, x.tipo, x.cat, x.sub, c.id as categoria_id
    from jsonb_to_recordset(p_filas) as x(ref text, fecha date, valor numeric, descripcion text, tipo text, cat text, sub text)
    left join fin_categorias c on c.nombre = x.cat and c.tipo = x.tipo;
  select min(fecha) into v_min from _m;

  create temp table _nuevos on commit drop as
    select m.*, (select e.id from encargos e
                 where m.tipo = 'ingreso' and (upper(m.descripcion) like '%' || regexp_replace(e.nombre, '^\d{2}\s+I\s+', '') || '%'
                    or (upper(m.descripcion) like '%TREVENER%' and e.nombre like '%REFORMA 102%')) limit 1) as encargo_id
    from _m m where not exists (select 1 from fin_movimientos f where f.ref_correo = m.ref);
  create temp table _cambios on commit drop as
    select f.id, m.* from _m m join fin_movimientos f on f.ref_correo = m.ref
    where f.fecha is distinct from m.fecha or f.valor is distinct from m.valor or f.descripcion is distinct from m.descripcion
       or f.tipo is distinct from m.tipo or f.categoria_id is distinct from m.categoria_id;
  create temp table _faltan on commit drop as
    select f.id, f.fecha, f.valor, f.descripcion from fin_movimientos f
    where f.origen = 'monai' and f.fecha >= v_min and not exists (select 1 from _m m where m.ref = f.ref_correo);
  create temp table _dup on commit drop as
    select f.id, f.fecha, f.valor, f.descripcion, f.estado from fin_movimientos f
    where f.origen = 'correo' and f.estado in ('confirmado', 'por_confirmar')
      and exists (select 1 from _m m where m.valor = f.valor and m.tipo = f.tipo and abs(m.fecha - f.fecha) <= 1);

  r := jsonb_build_object(
    'filas', (select count(*) from _m),
    'nuevos', (select count(*) from _nuevos), 'cambios', (select count(*) from _cambios),
    'eliminados', (select count(*) from _faltan), 'duplicados_correo', (select count(*) from _dup),
    'sin_categoria', (select count(*) from _m where categoria_id is null),
    'detalle_nuevos', (select coalesce(jsonb_agg(jsonb_build_object('fecha', fecha, 'valor', valor, 'descripcion', descripcion, 'tipo', tipo) order by fecha), '[]') from _nuevos),
    'detalle_eliminados', (select coalesce(jsonb_agg(jsonb_build_object('fecha', fecha, 'valor', valor, 'descripcion', descripcion) order by fecha), '[]') from _faltan),
    'detalle_duplicados', (select coalesce(jsonb_agg(jsonb_build_object('fecha', fecha, 'valor', valor, 'descripcion', descripcion, 'estado', estado) order by fecha), '[]') from _dup));

  if p_aplicar then
    insert into fin_movimientos (fecha, tipo, valor, categoria_id, subcategoria, encargo_id, descripcion, estado, origen, ref_correo, ejemplo)
      select fecha, tipo, valor, categoria_id, sub, encargo_id, descripcion, 'confirmado', 'monai', ref, false from _nuevos;
    -- Se actualiza lo que viene de MONAI; el encargo y el medio de pago que pusiste en el portal se conservan
    update fin_movimientos f set fecha = c.fecha, valor = c.valor, descripcion = c.descripcion, tipo = c.tipo, categoria_id = c.categoria_id,
      subcategoria = case when f.categoria_id = c.categoria_id and f.subcategoria is not null then f.subcategoria else c.sub end
      from _cambios c where f.id = c.id;
    delete from fin_movimientos f using _faltan x where f.id = x.id;
    update fin_movimientos f set estado = 'descartado' from _dup d where f.id = d.id;
  end if;
  return r;
end $$;
revoke all on function public.importar_monai(jsonb, boolean) from public, anon;
grant execute on function public.importar_monai(jsonb, boolean) to authenticated;
