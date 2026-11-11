-- facturacion@ solo ve Finanzas: necesita leer nombres de encargos y propuestas/adendas para "por cobrar"
create policy "facturacion ve encargos" on public.encargos for select using (public.es_facturacion());
create policy "facturacion ve propuestas y adendas" on public.documentos for select using (public.es_facturacion() and tipo in ('propuesta','adenda'));
