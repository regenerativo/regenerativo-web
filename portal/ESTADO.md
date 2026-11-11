# ESTADO DEL PORTAL DE ENCARGOS — regenerativo

Última actualización: 10 nov 2026. La carpeta `portal/` del repo `regenerativo/regenerativo-web` (rama `main`) es la versión vigente del portal.

## Dónde vive
- Web: https://regenerativo.co/portal/ — dentro de la web de regenerativo (GitHub Pages, repo `regenerativo/regenerativo-web`, carpeta `portal/`).
- Este es ahora el ÚNICO lugar del portal. El repo `regenerativo/reg-portal` queda solo como redirección a regenerativo.co/portal.
- Acceso público desde regenerativo.co/contacto (ícono "Portal de encargos").
- Base de datos y funciones: Supabase, proyecto `vevhopknufhfglfqribk`.
- Sitio estático sin compilación: `index.html`, `css/app.css`, `js/*.js`. Al cambiar CSS/JS, subir el `?v=` en `index.html`.

## Pendientes inmediatos
1. Supabase Auth: Site URL `https://regenerativo.co/portal/` y Redirect URLs `https://regenerativo.co/portal/**`.
2. Redesplegar la función `onedrive-conexion` (el código ya tiene PORTAL = `https://regenerativo.co/portal/`).
3. Andrés crea el client secret en Entra y lo pega directo en Supabase como `MS_CLIENT_SECRET` (nunca en el chat).
4. Ajustes generales → Conectar OneDrive → probar Despegó.

## Reglas definidas por Andrés
- Código de encargo: `26  I  NOMBRE` (dos espacios, I, dos espacios, mayúsculas). `SCREG_xxxxx` es solo la cotización: aparece únicamente en la propuesta y en Propuestas preliminares.
- El cliente solo ve y descarga; nunca aprueba ni firma. Aprobar es solo del administrador (apardo@).
- Cliente: propuesta, contrato y adendas (el otrosí va dentro de contrato) = tarjeta "A continuación encuentras el documento de…" + descarga. Brief e informes = visibles + descarga. Presupuesto y Gantt = visibles, sin descarga. Nunca editables (Word/Excel).
- Un solo membrete regenerativo para todos los PDF: izquierda servicio en mayúscula bold + "Servicios" en gris; derecha TIPO _ ref y fecha debajo en gris; número de página abajo a la derecha en bold; pie "Por — regenerativo" + contacto.
- facturacion@ solo ve Finanzas; apardo@ ve todo.
- Gráfica igual a regenerativo.co y a la maqueta REG - BRAND WEB (barra superior: nombre del encargo a la izquierda sin bold, logo a la derecha; remate inferior solo con la línea final).
- Finanzas: gastos del correo entran "por confirmar" y Andrés los clasifica; el salario va aparte del balance.

## Pendientes de producto
- Cuentas de cobro como tipo de documento.
- Propuesta completa en PDF sobre la plantilla real SCREG.
- Subir contrato firmado y anexos.
- Finanzas: gestión de categorías, topes, vista de soportes para el contador.
