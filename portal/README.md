# REG — Portal de encargos

Portal de regenerativo: un expediente por encargo con Brief, Propuesta económica, Contrato, Adendas,
Presupuesto (con APU), Gantt e informes de avance. Acceso solo por invitación (admin / equipo / cliente).

## Estructura
- `index.html`, `css/`, `js/` — la aplicación (HTML + JavaScript, sin compilación).
- `js/config.js` — URL y clave pública de Supabase. Vacías = **modo demostración** (datos de ejemplo en el navegador).
- `supabase/migrations/` — base de datos por fases, con reglas de acceso (RLS).

## Fases
1. **Base** — ingreso, lista de encargos, expediente con menú lateral, resumen, ajustes, responsables, invitaciones. ← en curso
2. Brief + Propuesta económica (versiones, estados, aprobación del cliente, PDF legal con membrete).
3. Contrato REGOPS + Adendas.
4. Base de precios + APU (comunes y estables) + Presupuesto por encargo (capítulos según el tipo de obra, conectados a los APU).
5. Gantt + Informe de avance (misma lógica del Excel de 26 I CEREZO 44).
6. Publicación en regenerativo.co/portal (dentro de la web de regenerativo).

## Reglas
"Encargo", nunca "proyecto" · COP con punto de miles y sin $ (8.200.000 COP) · datos sin definir = XXX en vino #800000 ·
tablas con encabezado gris #D9D9D9 y líneas punteadas grises · imprimibles en papel legal vertical.

## Seguridad
El administrador inicial es apardo@regenerativo.co (lo asigna la base de datos). Además, **desactivar el registro público**
en Supabase (Authentication → Sign In / Providers → "Allow new users to sign up" apagado); el resto entra por invitación.

## Acceso
- **Equipo regenerativo:** correo + contraseña (invitación por correo).
- **Clientes:** nombre del encargo + contraseña asignada en Ajustes del encargo. Cada encargo tiene su propia cuenta de cliente;
  cambiar la contraseña cierra todas las sesiones anteriores. Desde la fase 2, toda aprobación pide nombre y cédula de quien aprueba.
