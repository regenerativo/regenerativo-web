-- Encargos y propuestas con varios servicios (p. ej. CASA E: Arquitectura, Diseño de Espacios, Muebles y Objetos)
alter table encargos add column if not exists servicios text[] not null default '{}';
alter table propuestas add column if not exists servicios text[] not null default '{}';
