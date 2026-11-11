-- Servicio "Otro" para encargos que no encajan en los 4 servicios de regenerativo.
insert into public.servicios (nombre, orden, activo) select 'Otro', 5, true where not exists (select 1 from public.servicios where nombre = 'Otro');
