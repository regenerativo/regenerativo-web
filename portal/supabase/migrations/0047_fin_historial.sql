-- Historial de cambios de los movimientos de finanzas (quién, cuándo, antes y después); solo lo ve administración
create table if not exists public.fin_historial (
  id bigint generated always as identity primary key,
  creado timestamptz not null default now(),
  movimiento_id uuid, accion text not null, quien text, antes jsonb, despues jsonb
);
alter table public.fin_historial enable row level security;
drop policy if exists historial_ver on public.fin_historial;
create policy historial_ver on public.fin_historial for select to authenticated using (public.es_admin());
revoke all on public.fin_historial from anon;
grant select on public.fin_historial to authenticated;
create or replace function public.tg_fin_historial() returns trigger language plpgsql security definer set search_path = public as $$
declare q text := coalesce((select email from auth.users where id = auth.uid()), case when auth.uid() is null then 'automático (correo del banco)' end);
begin
  if tg_op = 'INSERT' then insert into fin_historial (movimiento_id, accion, quien, despues) values (new.id, 'creó', q, to_jsonb(new));
  elsif tg_op = 'UPDATE' then
    if to_jsonb(new) - 'actualizado' is distinct from to_jsonb(old) - 'actualizado' then
      insert into fin_historial (movimiento_id, accion, quien, antes, despues) values (new.id,
        case when old.estado is distinct from new.estado and new.estado = 'confirmado' then 'confirmó' when new.estado = 'descartado' then 'descartó' else 'editó' end, q, to_jsonb(old), to_jsonb(new));
    end if;
  else insert into fin_historial (movimiento_id, accion, quien, antes) values (old.id, 'eliminó', q, to_jsonb(old)); end if;
  return null;
end $$;
revoke execute on function public.tg_fin_historial() from public, anon, authenticated;
drop trigger if exists t_fin_historial on public.fin_movimientos;
create trigger t_fin_historial after insert or update or delete on public.fin_movimientos for each row execute function public.tg_fin_historial();
