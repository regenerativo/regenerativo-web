create policy "admin edita perfiles" on public.perfiles for update using (es_admin()) with check (es_admin());
