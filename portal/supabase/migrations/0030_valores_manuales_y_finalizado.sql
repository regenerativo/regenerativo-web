-- Valor del encargo editable en el portal (sin depender de la propuesta), adicionales manuales y estado Finalizado
alter table encargos add column if not exists valor_base numeric;
alter table encargos drop constraint if exists encargos_estado_check;
alter table encargos add constraint encargos_estado_check check (estado = any (array['activo','pausado','finalizado','cerrado']));
create table if not exists encargo_adicionales (
  id uuid primary key default gen_random_uuid(),
  encargo_id uuid not null references encargos(id) on delete cascade,
  descripcion text not null,
  valor numeric not null,
  fecha date not null default current_date,
  creado timestamptz not null default now()
);
alter table encargo_adicionales enable row level security;
create policy "admin adicionales" on encargo_adicionales for all using (es_admin()) with check (es_admin());
create policy "ver adicionales" on encargo_adicionales for select using (rol_en_encargo(encargo_id) is not null or es_facturacion());
