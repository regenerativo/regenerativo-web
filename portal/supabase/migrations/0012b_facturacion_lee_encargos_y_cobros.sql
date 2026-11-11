create policy "facturacion ve encargos" on public.encargos for select using (public.es_facturacion());
create policy "facturacion ve propuestas y adendas" on public.documentos for select using (public.es_facturacion() and tipo in ('propuesta','adenda'));
