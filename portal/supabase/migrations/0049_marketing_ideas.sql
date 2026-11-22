-- Pestaña Marketing: ideas de mejora por parte de la web; administración las aprueba o descarta.
create table if not exists public.marketing_ideas (
  id uuid primary key default gen_random_uuid(),
  area text not null,
  titulo text not null,
  detalle text not null default '',
  estado text not null default 'pendiente' check (estado in ('pendiente','aprobada','descartada','hecha')),
  orden int not null default 0,
  nota text,
  decidido_por uuid references auth.users(id),
  decidido_en timestamptz,
  creado timestamptz not null default now()
);
alter table public.marketing_ideas enable row level security;
drop policy if exists marketing_admin on public.marketing_ideas;
create policy marketing_admin on public.marketing_ideas for all to authenticated using (public.es_admin()) with check (public.es_admin());
alter publication supabase_realtime add table public.marketing_ideas;

insert into public.marketing_ideas (area, titulo, detalle, orden) values
('Inicio', 'Suscripción a las publicaciones', 'Al final del Inicio, un campo corto de correo para recibir cada publicación nueva. Los correos quedan guardados aquí en el portal.', 10),
('Inicio', 'Tipo en cada publicación', 'Una etiqueta discreta en gris (Encargo, Instagram, Reflexión) para que el newsletter se lea con más orden, sin cambiar su diseño.', 20),
('Encargos', 'Filtro por los 4 servicios', 'Filtrar los encargos por Arquitectura, Diseño de Espacios, Muebles y Objetos y Conceptualización de Proyectos.', 30),
('Encargos', 'Ficha breve en cada encargo', 'Arriba de cada página de encargo: servicio, ciudad, año y área intervenida, en una sola línea gris.', 40),
('Encargos', 'Avisarme cuando se publique', 'En los encargos «Próximamente», la opción de dejar el correo para avisar cuando la página esté lista.', 50),
('About', 'La Matriz de Biomímesis Regenerativa en 3 pasos', 'Explicar en tres frases cortas cómo funciona la herramienta propia: relaciones, flujos y comportamientos del lugar.', 60),
('About', 'Quiénes somos', 'Andrés como founder y los asociados John Sedano (artista) y Wildeman Cárdenas (arquitecto urbanista), con una línea de cada uno.', 70),
('Contacto', 'Solicitud que llega al portal', 'Un formulario corto (nombre, ciudad, servicio y área aproximada) que entra directo a Propuestas como prospecto.', 80),
('Contacto', 'WhatsApp Business con mensaje listo', 'Un enlace a WhatsApp que abre con el texto «Hola regenerativo, quiero contarles de un proyecto».', 90),
('Google', 'Descripciones para buscadores por encargo', 'Título y descripción propios en cada página de encargo para que Google los muestre bien, sin cambiar el nombre de la pestaña (solo «regenerativo»).', 100),
('Google', 'Publicar cada encargo en el Perfil de Empresa', 'Cuando se active un encargo en la web, subir también una publicación al Perfil de Empresa de Google con el enlace corto.', 110),
('Google', 'Versión en inglés', 'Las páginas principales también en inglés, para clientes internacionales.', 120),
('Instagram', 'Enlace corto en cada post de encargo', 'Cada publicación de un encargo cierra con regenerativo.co/encargos/nombre-del-encargo.', 130),
('Instagram', 'Visitas de la web aquí mismo', 'Ver en esta pestaña cuántas personas entran a cada página (desde Search Console), para saber qué funciona.', 140);
