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
const M = {   // íconos simples de línea, estilo The Noun Project: una sola idea por ícono
  inicio: '<path d="M4 10.5 12 4l8 6.5V20H4z"/><path class="ac" d="M10 20v-5h4v5"/>',
  propuestas: '<path d="M6 3h8l4 4v14H6z"/><path class="ac" d="M9 12h6M9 16h4"/>',
  encargos: '<path d="M12 4 3 9l9 5 9-5z"/><path class="ac" d="m3 14 9 5 9-5"/>',
  finanzas: '<path d="M5 20v-7M19 20v-10"/><path class="ac" d="M12 20V5"/>',
  folders: '<path d="M3 6h6l2 2h10v11H3z"/><path class="ac" d="M3 11h18"/>',
  base: '<path d="M3.5 12V3.5H12L20.5 12 12 20.5z"/><circle class="ac" cx="7.8" cy="7.8" r="1.2"/>',
  ajustes: '<path d="M4 8h16M4 16h16"/><circle class="ac" cx="9" cy="8" r="2.2"/><circle class="ac ac2" cx="15" cy="16" r="2.2"/>',
  resumen: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect class="ac" x="13" y="13" width="7" height="7" rx="1.5"/>',
  carpetas: '<path d="M3 6h6l2 2h10v11H3z"/><path class="ac" d="M3 11h18"/>',
  propuesta: '<path d="M6 3h8l4 4v14H6z"/><path class="ac" d="M9 12h6M9 16h4"/>',
  contrato: '<path d="M6 3h8l4 4v14H6z"/><path class="ac" d="M9 16c1.4-2 2.4-2 3 0s1.8.4 3-1"/>',
  adendas: '<path d="M6 3h8l4 4v14H6z"/><path class="ac" d="M12 10v6M9 13h6"/>',
  presupuesto: '<rect x="5" y="3" width="14" height="18" rx="2"/><path class="ac" d="M8.5 7.5h7"/><path d="M8.5 12h7M8.5 16h4"/>',
  gantt: '<path d="M4 6h9M6 18h7"/><path class="ac" d="M8 12h11"/>',
  informes: '<rect x="5" y="4" width="14" height="17" rx="2"/><path class="ac" d="M9 10h6M9 14h4"/>',
  enviados: '<path d="M21 3 3 10.5l7 2.5 3 8z"/><path class="ac" d="M10 13 21 3"/>',
  recibidos: '<path d="M5 5h14l2 8v6H3v-6z"/><path class="ac" d="M3 13h5l1 3h6l1-3h5"/>',
};
export const icoMenu = n => M[n] ? `<svg class="ico-menu im-${n}" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${M[n]}</svg>` : '';
export const ico = n => `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;
// Botón de solo ícono: texto como título (tooltip) y etiqueta accesible
export const btnIco = (n, titulo, attrs = '', cls = 'sec') => `<button type="button" class="btn ${cls} mini ico" title="${titulo}" aria-label="${titulo}" ${attrs}>${ico(n)}</button>`;
export const enlaceIco = (n, titulo, href, cls = 'sec') => `<a class="btn ${cls} mini ico" title="${titulo}" aria-label="${titulo}" href="${href}" target="_blank" rel="noopener">${ico(n)}</a>`;
