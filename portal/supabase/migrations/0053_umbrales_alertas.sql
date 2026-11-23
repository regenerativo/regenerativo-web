-- Alertas personales: porcentajes de aviso que él elige (p. ej. 20, 50, 80, 100) en vez de uno fijo
alter table public.per_ajustes add column if not exists umbrales int[] not null default '{50,80,100}';
