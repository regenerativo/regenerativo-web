create or replace function public.presupuesto_totales_actividad(p_presupuesto uuid)
returns table (actividad_id uuid, total numeric)
language sql stable security definer set search_path = public as $$
  select a.id, coalesce(sum(i.cantidad * i.valor_unitario), 0)
  from public.presupuestos p join public.presupuesto_capitulos c on c.presupuesto_id = p.id
  join public.presupuesto_actividades a on a.capitulo_id = c.id left join public.presupuesto_items i on i.actividad_id = a.id
  where p.id = p_presupuesto and public.rol_en_encargo(p.encargo_id) is not null
  group by a.id;
$$;
revoke execute on function public.presupuesto_totales_actividad(uuid) from public, anon;
grant execute on function public.presupuesto_totales_actividad(uuid) to authenticated;
