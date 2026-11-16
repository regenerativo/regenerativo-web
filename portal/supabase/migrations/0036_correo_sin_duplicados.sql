-- El lector de correo a veces guarda el mismo correo dos veces (con y sin «@dominio» en la referencia).
-- Si llega un movimiento cuyo correo ya está registrado, entra como descartado y con la nota de duplicado.
create or replace function public.correo_sin_duplicados() returns trigger language plpgsql as $$
begin
  if new.origen = 'correo' and new.ref_correo is not null and exists (
    select 1 from fin_movimientos m where m.origen = 'correo' and m.id <> new.id
      and split_part(m.ref_correo, '@', 1) = split_part(new.ref_correo, '@', 1)) then
    new.estado := 'descartado';
    new.nota_correo := coalesce(new.nota_correo || ' · ', '') || 'Duplicado: este correo ya estaba registrado';
  end if;
  return new;
end $$;
drop trigger if exists t_correo_sin_duplicados on fin_movimientos;
create trigger t_correo_sin_duplicados before insert on fin_movimientos for each row execute function public.correo_sin_duplicados();
