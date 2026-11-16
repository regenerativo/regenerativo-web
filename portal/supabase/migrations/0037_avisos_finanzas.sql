-- Aviso por correo de cambios en los números de los encargos.
-- Cada cambio en valor, adicionales, ingresos o gastos de un encargo queda anotado en fin_cambios.
-- Cada 15 minutos la función avisos-finanzas junta lo pendiente y envía un resumen por proyecto
-- (qué cambió y cómo queda: valor, recibido, por cobrar) a apardo@ y facturacion@regenerativo.co.

create table if not exists fin_cambios (
  id bigserial primary key,
  creado timestamptz not null default now(),
  encargo_id uuid not null references encargos(id) on delete cascade,
  detalle text not null,
  enviado boolean not null default false
);
create index if not exists fin_cambios_pend on fin_cambios (enviado, creado);
alter table fin_cambios enable row level security;   -- solo la usa el servidor

create or replace function public.cop_txt(v numeric) returns text language sql immutable as $$
  select replace(to_char(round(coalesce(v, 0)), 'FM999G999G999G990'), ',', '.') || ' COP'
$$;

-- Las mismas cuentas del portal (finanzas.js · cuentasEncargo)
create or replace function public.cuentas_encargo(p_encargo uuid)
returns table (valor numeric, recibido numeric, gastos numeric, por_cobrar numeric, saldado boolean)
language sql stable security definer set search_path = public as $$
  with e as (select * from encargos where id = p_encargo),
  hon as (
    select coalesce(
      (select valor_base from e),
      (select honorarios from propuestas where encargo_id = p_encargo and honorarios is not null limit 1),
      (select (contenido->>'honorarios')::numeric from documentos where encargo_id = p_encargo and tipo = 'propuesta' and estado in ('aprobado','firmado') order by creado desc limit 1),
      0) v),
  adic as (
    select coalesce((select sum(coalesce((contenido->>'valor')::numeric, 0)) from documentos where encargo_id = p_encargo and tipo = 'adenda' and estado in ('aprobado','firmado')), 0)
         + coalesce((select sum(valor) from encargo_adicionales where encargo_id = p_encargo), 0) v),
  mov as (
    select coalesce(sum(valor) filter (where tipo = 'ingreso'), 0) ing, coalesce(sum(valor) filter (where tipo = 'gasto'), 0) gas
    from fin_movimientos where encargo_id = p_encargo and coalesce(estado, 'confirmado') = 'confirmado')
  select hon.v + adic.v, mov.ing, mov.gas,
    case when (hon.v + adic.v) > 0 and mov.ing >= (hon.v + adic.v) then 0
         when (select pagado_total from e) then 0
         else greatest(0, hon.v + adic.v - mov.ing) end,
    coalesce((select pagado_total from e), false) and not ((hon.v + adic.v) > 0 and mov.ing >= (hon.v + adic.v))
  from hon, adic, mov;
$$;
revoke execute on function public.cuentas_encargo(uuid) from anon, authenticated;

create or replace function public.anotar_cambio(p_encargo uuid, p_detalle text) returns void
language sql security definer set search_path = public as $$
  insert into fin_cambios (encargo_id, detalle) select p_encargo, p_detalle where p_encargo is not null;
$$;
revoke execute on function public.anotar_cambio(uuid, text) from anon, authenticated;

-- Encargo: valor escrito a mano y marca de saldado
create or replace function public.tg_cambio_encargo() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.valor_base is distinct from old.valor_base then
    perform anotar_cambio(new.id, 'Valor del encargo: ' || coalesce(cop_txt(old.valor_base), 'sin valor') || ' → ' || coalesce(cop_txt(new.valor_base), 'el de la propuesta'));
  end if;
  if new.pagado_total is distinct from old.pagado_total then
    perform anotar_cambio(new.id, case when new.pagado_total then 'Se dio por saldado a mano' else 'Se quitó la marca de saldado' end);
  end if;
  return new;
end $$;
drop trigger if exists cambio_encargo on encargos;
create trigger cambio_encargo after update of valor_base, pagado_total on encargos for each row execute function tg_cambio_encargo();

-- Propuesta: valor final
create or replace function public.tg_cambio_propuesta() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.encargo_id is not null and new.honorarios is distinct from old.honorarios then
    perform anotar_cambio(new.encargo_id, 'Valor de la propuesta ' || coalesce(new.codigo, '') || ': ' || cop_txt(old.honorarios) || ' → ' || cop_txt(new.honorarios));
  end if;
  return new;
end $$;
drop trigger if exists cambio_propuesta on propuestas;
create trigger cambio_propuesta after update of honorarios on propuestas for each row execute function tg_cambio_propuesta();

-- Adicionales
create or replace function public.tg_cambio_adicional() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform anotar_cambio(new.encargo_id, 'Adicional nuevo: ' || new.descripcion || ' · ' || cop_txt(new.valor));
  elsif tg_op = 'DELETE' then
    perform anotar_cambio(old.encargo_id, 'Adicional borrado: ' || old.descripcion || ' · ' || cop_txt(old.valor));
  elsif new.encargo_id is distinct from old.encargo_id then
    perform anotar_cambio(old.encargo_id, 'Adicional movido a otro encargo: ' || old.descripcion || ' · ' || cop_txt(old.valor));
    perform anotar_cambio(new.encargo_id, 'Adicional recibido de otro encargo: ' || new.descripcion || ' · ' || cop_txt(new.valor));
  elsif new.valor is distinct from old.valor or new.descripcion is distinct from old.descripcion then
    perform anotar_cambio(new.encargo_id, 'Adicional editado: ' || new.descripcion || ' · ' || cop_txt(old.valor) || ' → ' || cop_txt(new.valor));
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists cambio_adicional on encargo_adicionales;
create trigger cambio_adicional after insert or update or delete on encargo_adicionales for each row execute function tg_cambio_adicional();

-- Ingresos y gastos asignados a un encargo (solo los que cuentan: confirmados)
create or replace function public.tg_cambio_movimiento() returns trigger language plpgsql security definer set search_path = public as $$
declare
  vo boolean := false;
  vn boolean := false;
begin
  if tg_op <> 'INSERT' then vo := old.encargo_id is not null and coalesce(old.estado, 'confirmado') = 'confirmado' and old.tipo in ('ingreso', 'gasto'); end if;
  if tg_op <> 'DELETE' then vn := new.encargo_id is not null and coalesce(new.estado, 'confirmado') = 'confirmado' and new.tipo in ('ingreso', 'gasto'); end if;
  if tg_op = 'UPDATE' and vo and vn and new.encargo_id = old.encargo_id and new.tipo = old.tipo then
    if new.valor <> old.valor then
      perform anotar_cambio(new.encargo_id, initcap(new.tipo) || ' editado: ' || cop_txt(old.valor) || ' → ' || cop_txt(new.valor) || ' del ' || to_char(new.fecha, 'DD/MM/YYYY') || coalesce(' · ' || nullif(new.descripcion, ''), ''));
    end if;
    return new;
  end if;
  if vo then
    perform anotar_cambio(old.encargo_id, initcap(old.tipo) || ' quitado: ' || cop_txt(old.valor) || ' del ' || to_char(old.fecha, 'DD/MM/YYYY') || coalesce(' · ' || nullif(old.descripcion, ''), ''));
  end if;
  if vn then
    perform anotar_cambio(new.encargo_id, initcap(new.tipo) || ' registrado: ' || cop_txt(new.valor) || ' del ' || to_char(new.fecha, 'DD/MM/YYYY') || coalesce(' · ' || nullif(new.descripcion, ''), ''));
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists cambio_movimiento on fin_movimientos;
create trigger cambio_movimiento after insert or update or delete on fin_movimientos for each row execute function tg_cambio_movimiento();

-- Revisión cada 15 minutos (manda el resumen cuando los cambios llevan 10 minutos quietos)
select cron.unschedule(jobid) from cron.job where jobname = 'avisos-finanzas';
select cron.schedule('avisos-finanzas', '*/15 * * * *', $$
  select net.http_post(
    url := 'https://vevhopknufhfglfqribk.supabase.co/functions/v1/avisos-finanzas',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object('clave', (select refresh_token from public.integraciones where id = 'cron')),
    timeout_milliseconds := 60000);
$$);
