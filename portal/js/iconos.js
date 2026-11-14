// Íconos de línea para botones de acción (mismo trazo en todo el portal)
const P = {
  detalles: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  ver: '<path d="M7 17L17 7M9 7h8v8"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  borrar: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  abrir: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  carpeta: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  descargar: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  enviar: '<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"/>',
  firmar: '<path d="M4 20h6M14.5 4.5l5 5L9 20H4v-5z"/>',
  reabrir: '<path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5"/>',
  excel: '<path d="M4 5h16v14H4zM4 10h16M4 15h16M10 5v14"/>',
  subir: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
  archivo: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  atras: '<path d="M15 18l-6-6 6-6"/>',
  editar: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  conectar: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
};
// Íconos del menú: línea redondeada con un detalle de acento (clase "ac") que se mueve al pasar o tocar
const M = {   // íconos sólidos de una sola forma, con la simpleza de los de Apple
  inicio: '<path d="M12 3.2c.4 0 .8.1 1.1.4l7 5.8c.4.3.6.8.6 1.3V19a2 2 0 0 1-2 2h-3.2v-5.2a1.5 1.5 0 0 0-1.5-1.5h-4a1.5 1.5 0 0 0-1.5 1.5V21H5.3a2 2 0 0 1-2-2v-8.3c0-.5.2-1 .6-1.3l7-5.8c.3-.3.7-.4 1.1-.4z"/>',
  propuestas: '<path d="M7 2.5h6.2c.5 0 1 .2 1.4.6l4.3 4.3c.4.4.6.9.6 1.4v10.7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2z"/>',
  propuesta: '<path d="M7 2.5h6.2c.5 0 1 .2 1.4.6l4.3 4.3c.4.4.6.9.6 1.4v10.7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2z"/>',
  encargos: '<path d="M5 21V5.5A2.5 2.5 0 0 1 7.5 3h6A2.5 2.5 0 0 1 16 5.5V9h2.5A2.5 2.5 0 0 1 21 11.5V21zm4-14v2h3V7zm0 4v2h3v-2zm0 4v2h3v-2zm8-2v2h2v-2zm0 4v2h2v-2z"/>',
  finanzas: '<rect x="3.5" y="12" width="4.5" height="8.5" rx="1.6"/><rect x="9.75" y="4" width="4.5" height="16.5" rx="1.6"/><rect x="16" y="8.5" width="4.5" height="12" rx="1.6"/>',
  folders: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.6c.6 0 1.2.3 1.6.7L12 7h6.5A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/>',
  carpetas: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.6c.6 0 1.2.3 1.6.7L12 7h6.5A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/>',
  base: '<path d="M3 5a2 2 0 0 1 2-2h6.2c.5 0 1 .2 1.4.6l8 8a2 2 0 0 1 0 2.8l-6.2 6.2a2 2 0 0 1-2.8 0l-8-8A2 2 0 0 1 3 11.2zm5 1.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>',
  comentarios: '<path d="M12 3.5c5 0 9 3.4 9 7.6s-4 7.6-9 7.6c-1 0-2-.1-2.9-.4L5 20.5l1-3.6C4.2 15.5 3 13.4 3 11.1 3 6.9 7 3.5 12 3.5z"/>',
  ajustes: '<path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 5.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z"/>',
  resumen: '<rect x="3" y="3" width="8" height="8" rx="2.4"/><rect x="13" y="3" width="8" height="8" rx="2.4"/><rect x="3" y="13" width="8" height="8" rx="2.4"/><rect x="13" y="13" width="8" height="8" rx="2.4"/>',
  legales: '<path d="M15.6 3.4a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L9.5 19.5 4 21l1.5-5.5z"/>',
  resena: '<path d="M12 2.8l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.7l-5.4 2.9 1.1-6.1-4.5-4.3 6.1-.8z"/>',
  contrato: '<path d="M15.6 3.4a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L9.5 19.5 4 21l1.5-5.5z"/>',
  adendas: '<path d="M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zm5 5v3H8v2h3v3h2v-3h3v-2h-3V8z"/>',
  presupuesto: '<path d="M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm2 4v2h8V7zm0 4v2h8v-2zm0 4v2h5v-2z"/>',
  gantt: '<rect x="3" y="4.5" width="11" height="4" rx="2"/><rect x="7" y="10" width="14" height="4" rx="2"/><rect x="3" y="15.5" width="9" height="4" rx="2"/>',
  informes: '<path d="M9 2.5h6a1 1 0 0 1 1 1V4h1.5A2.5 2.5 0 0 1 20 6.5v12a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18.5v-12A2.5 2.5 0 0 1 6.5 4H8v-.5a1 1 0 0 1 1-1z"/>',
  enviados: '<path d="M21.4 2.6c.3.3.4.8.2 1.2l-7 16.4c-.4.9-1.6.9-2-.1l-2.2-6.5-6.5-2.2c-1-.3-1-1.6-.1-2l16.4-7c.4-.2.9-.1 1.2.2z"/>',
  recibidos: '<path d="M5.6 4h12.8c.9 0 1.7.6 1.9 1.5L22 13v5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-5l1.7-7.5C3.9 4.6 4.7 4 5.6 4zM4.3 13H8a1 1 0 0 1 1 1 1.5 1.5 0 0 0 1.5 1.5h3A1.5 1.5 0 0 0 15 14a1 1 0 0 1 1-1h3.7L18.4 6H5.6z"/>',
};
export const icoMenu = n => M[n] ? `<svg class="ico-menu im-${n}" viewBox="0 0 24 24" width="19" height="19" fill="currentColor" fill-rule="evenodd" aria-hidden="true">${M[n]}</svg>` : '';
export const ico = n => `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;
// Botón de solo ícono: texto como título (tooltip) y etiqueta accesible
export const btnIco = (n, titulo, attrs = '', cls = 'sec') => `<button type="button" class="btn ${cls} mini ico" title="${titulo}" aria-label="${titulo}" ${attrs}>${ico(n)}</button>`;
export const enlaceIco = (n, titulo, href, cls = 'sec') => `<a class="btn ${cls} mini ico" title="${titulo}" aria-label="${titulo}" href="${href}" target="_blank" rel="noopener">${ico(n)}</a>`;
