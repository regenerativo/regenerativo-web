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
  conectar: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
};
export const ico = n => `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;
// Botón de solo ícono: texto como título (tooltip) y etiqueta accesible
export const btnIco = (n, titulo, attrs = '', cls = 'sec') => `<button type="button" class="btn ${cls} mini ico" title="${titulo}" aria-label="${titulo}" ${attrs}>${ico(n)}</button>`;
export const enlaceIco = (n, titulo, href, cls = 'sec') => `<a class="btn ${cls} mini ico" title="${titulo}" aria-label="${titulo}" href="${href}" target="_blank" rel="noopener">${ico(n)}</a>`;
