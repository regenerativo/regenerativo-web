-- Hora del movimiento (la del aviso del banco: "... el 17/11/2026 a las 20:06."; en los manuales, la que se escriba)
alter table public.fin_movimientos add column if not exists hora time;
update public.fin_movimientos set hora = (substring(correo_texto from 'a las (\d{1,2}:\d{2})'))::time
 where hora is null and correo_texto ~ 'a las \d{1,2}:\d{2}';
