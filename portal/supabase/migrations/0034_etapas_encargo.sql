-- Etapas claras del encargo, guardadas tal cual se ven: Por iniciar · En curso · Pausado · Finalizado · Cancelado
-- (en la base: por_iniciar · activo · pausado · finalizado · cerrado)
alter table encargos drop constraint if exists encargos_estado_check;
alter table encargos add constraint encargos_estado_check check (estado in ('por_iniciar', 'activo', 'pausado', 'finalizado', 'cerrado'));
alter table encargos alter column estado set default 'por_iniciar';
-- Lo que hoy se veía como "Por iniciar" (activo sin fecha de inicio o con inicio futuro) queda guardado así
update encargos set estado = 'por_iniciar' where estado = 'activo' and (inicio is null or inicio > current_date);
-- Los "cerrados" con fecha de fin ya cumplida son encargos entregados: Finalizado
update encargos set estado = 'finalizado' where estado = 'cerrado' and fin is not null and fin <= current_date;
