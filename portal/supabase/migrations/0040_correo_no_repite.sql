-- Lo que Andrés ya cargó manda: un aviso del banco no vuelve a pedir confirmación de algo ya registrado.
-- 1) Al registrar o confirmar un movimiento (MONAI, portal), se descarta el aviso del correo del mismo valor (±3 días).
create or replace function public.correo_ya_cargado() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.estado = 'confirmado' and new.origen <> 'correo' then
    update fin_movimientos set estado = 'descartado', nota_correo = 'Ya estaba cargado: ' || coalesce(new.descripcion, '')
    where id = (select id from fin_movimientos where origen = 'correo' and estado = 'por_confirmar'
                and valor = new.valor and abs(fecha - new.fecha) <= 3 order by abs(fecha - new.fecha) limit 1);
  end if;
  return new;
end $$;
drop trigger if exists t_correo_ya_cargado on fin_movimientos;
create trigger t_correo_ya_cargado after insert or update of estado on fin_movimientos for each row execute function public.correo_ya_cargado();

-- 2) Limpieza: Andrés organizó todo hasta el 15/11; los avisos de esas fechas ya estaban cargados.
update fin_movimientos set estado = 'descartado', nota_correo = 'Ya organizado el 15/11'
where origen = 'correo' and estado = 'por_confirmar' and fecha <= '2026-11-15';
