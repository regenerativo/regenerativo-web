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
const M = {
  inicio: '<path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-5h-6v5H5a1 1 0 0 1-1-1z"/><circle class="ac" cx="12" cy="10.6" r="1.3"/>',
  propuestas: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path class="ac" d="M9 14.5l2 2 4-4"/>',
  encargos: '<path d="M12 4l8 4-8 4-8-4z"/><path class="ac" d="M4 12l8 4 8-4"/><path d="M4 16l8 4 8-4"/>',
  finanzas: '<path d="M4 20h16"/><path d="M6 20v-6M11 20V8"/><path class="ac" d="M16 20V4"/>',
  folders: '<path d="M3 8a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path class="ac" d="M3 11.5h18"/>',
  base: '<path d="M3.5 12.5V4.5a1 1 0 0 1 1-1h8l8.5 8.5-9 9z"/><circle class="ac" cx="8" cy="8" r="1.6"/>',
  ajustes: '<path d="M4 7h9M19 7h1M4 17h3M13 17h7"/><circle class="ac" cx="16" cy="7" r="2.4"/><circle class="ac ac2" cx="10" cy="17" r="2.4"/>',
  resumen: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect class="ac" x="13" y="13" width="7" height="7" rx="2"/>',
  carpetas: '<path d="M3 8a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path class="ac" d="M3 11.5h18"/>',
  propuesta: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path class="ac" d="M9 14.5l2 2 4-4"/>',
  contrato: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path class="ac" d="M8 17c1.5-2.4 2.6-2.4 3 0s1.6 1.6 3.4-1.2"/>',
  adendas: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path class="ac" d="M12 11.5v6M9 14.5h6"/>',
  presupuesto: '<rect x="5" y="3" width="14" height="18" rx="2.5"/><path class="ac" d="M8.5 7.5h7"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01"/>',
  gantt: '<path d="M4 4v16h16"/><path class="ac" d="M8 8h6"/><path d="M10 12h7M7.5 16h5"/>',
  informes: '<rect x="5" y="4.5" width="14" height="16.5" rx="2.5"/><path d="M9 4.5V3h6v1.5"/><path class="ac" d="M9 11h6M9 15h4"/>',
  enviados: '<path d="M21 3L10 14"/><path class="ac" d="M21 3l-7 18-4-7-7-4z"/>',
  recibidos: '<path d="M4 13l2-8h12l2 8v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path class="ac" d="M4 13h4l1 2h6l1-2h4"/>',
};
export const icoMenu = n => M[n] ? `<svg class="ico-menu im-${n}" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${M[n]}</svg>` : '';
export const ico = n => `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;
// Botón de solo ícono: texto como título (tooltip) y etiqueta accesible
export const btnIco = (n, titulo, attrs = '', cls = 'sec') => `<button type="button" class="btn ${cls} mini ico" title="${titulo}" aria-label="${titulo}" ${attrs}>${ico(n)}</button>`;
export const enlaceIco = (n, titulo, href, cls = 'sec') => `<a class="btn ${cls} mini ico" title="${titulo}" aria-label="${titulo}" href="${href}" target="_blank" rel="noopener">${ico(n)}</a>`;
