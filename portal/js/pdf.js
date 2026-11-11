// PDF real (texto vectorial) con membrete de regenerativo, papel legal. Se genera en el navegador con pdfmake.
// No depende del cuadro de impresión del navegador (que en iPhone agrega URL, fecha y desarma el diseño).

const LIBS = [
  ['pdfMake', 'https://cdn.jsdelivr.net/npm/pdfmake@0.2.10/build/pdfmake.min.js'],
  ['htmlToPdfmake', 'https://cdn.jsdelivr.net/npm/html-to-pdfmake@2.5.13/browser.js'],
];
const FUENTES = { 'stolzl-light.ttf': 'assets/fonts/stolzl-light.ttf', 'stolzl-book.ttf': 'assets/fonts/stolzl-book.ttf', 'stolzl-medium.ttf': 'assets/fonts/stolzl-medium.ttf' };
const GRIS = '#D9D9D9', TINTA = '#1E221D', GRIS_TXT = '#8A8A8A';
const ANCHO = 612, MI = 57, MD = 42;   // papel legal 8.5 in = 612 pt; márgenes 0.79 in / 0.59 in

let listo = null;
const cargarScript = src => new Promise((ok, mal) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => mal(new Error('No se pudo cargar ' + src)); document.head.appendChild(s); });
const aBase64 = buf => { let b = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) b += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(b); };

function preparar() {
  if (listo) return listo;
  listo = (async () => {
    for (const [g, src] of LIBS) if (!window[g]) await cargarScript(src);
    const vfs = {};
    await Promise.all(Object.entries(FUENTES).map(async ([n, url]) => { vfs[n] = aBase64(await (await fetch(url)).arrayBuffer()); }));
    window.pdfMake.vfs = vfs;
    window.pdfMake.fonts = {
      Stolzl: { normal: 'stolzl-book.ttf', bold: 'stolzl-medium.ttf', italics: 'stolzl-book.ttf', bolditalics: 'stolzl-medium.ttf' },
      StolzlLight: { normal: 'stolzl-light.ttf', bold: 'stolzl-book.ttf', italics: 'stolzl-light.ttf', bolditalics: 'stolzl-book.ttf' },
    };
  })();
  listo.catch(() => { listo = null; });
  return listo;
}

// Tablas: encabezado gris, líneas punteadas grises delgadas, ancho completo
function ajustarTablas(nodo) {
  if (Array.isArray(nodo)) return nodo.forEach(ajustarTablas);
  if (!nodo || typeof nodo !== 'object') return;
  if (nodo.table) {
    const filas = nodo.table.body || [];
    const n = Math.max(0, ...filas.map(f => f.length));
    const largo = Array(n).fill(0);
    filas.forEach(f => f.forEach((c, i) => { largo[i] += JSON.stringify(c?.text ?? c ?? '').length; }));
    const mayor = largo.indexOf(Math.max(...largo));
    nodo.table.widths = largo.map((_, i) => i === mayor ? '*' : 'auto');
    nodo.table.headerRows = filas[0]?.some(c => (c?.nodeName || '') === 'TH') ? 1 : 0;
    nodo.layout = {
      hLineWidth: i => (i === 0 ? 0 : 0.5), vLineWidth: () => 0, hLineColor: () => '#9A9A9A',
      hLineStyle: () => ({ dash: { length: 1, space: 1.5 } }),
      paddingLeft: () => 5, paddingRight: () => 5, paddingTop: () => 4, paddingBottom: () => 4,
    };
    filas.forEach(f => f.forEach(c => c && ajustarTablas(c)));
  }
  ['stack', 'columns', 'ul', 'ol', 'text'].forEach(k => Array.isArray(nodo[k]) && nodo[k].forEach(ajustarTablas));
}

/**
 * Descarga el PDF.
 * @param {{servicio:string, codigo:string, nombre:string, cuerpoHTML:string}} p
 */
export async function descargarPDF({ servicio, documento, codigo, nombre, cuerpoHTML }) {
  await preparar();
  const contenido = window.htmlToPdfmake(cuerpoHTML, {
    removeExtraBlanks: true,
    defaultStyles: {
      h1: { fontSize: 18, font: 'StolzlLight', bold: false, marginBottom: 2 },
      h3: { fontSize: 10.5, bold: true, marginTop: 12, marginBottom: 4 },
      p: { marginBottom: 6, lineHeight: 1.25 },
      th: { bold: true, fillColor: GRIS, fontSize: 7.5, characterSpacing: 0.4 },
      td: { fontSize: 9 },
      b: { bold: true }, strong: { bold: true },
      ul: { marginBottom: 6 }, ol: { marginBottom: 6 },
    },
  });
  ajustarTablas(contenido);
  const def = {
    pageSize: 'LEGAL',
    pageMargins: [MI, 128, MD, 78],
    info: { title: nombre.replace(/\.pdf$/i, ''), author: 'regenerativo' },
    defaultStyle: { font: 'Stolzl', fontSize: 9.5, color: TINTA, lineHeight: 1.2 },
    styles: {
      'doc-titulo': { fontSize: 18, font: 'StolzlLight' },
      'doc-sub': { fontSize: 8.5, color: GRIS_TXT, marginBottom: 12 },
      cifra: { fontSize: 15, font: 'StolzlLight' },
      sub: { fontSize: 8.5, color: GRIS_TXT },
      xxx: { color: '#800000' },
      num: { alignment: 'right' },
      cierre: { marginTop: 22 },
      firmas: { marginTop: 40 },
    },
    header: () => ({ stack: [
      { columns: [
        { stack: [{ text: (servicio || 'XXX').toUpperCase(), bold: true, fontSize: 10.5, characterSpacing: 0.6 }, { text: 'Servicios', font: 'StolzlLight', fontSize: 9.5, color: GRIS_TXT }] },
        { stack: [{ text: (documento || '').toUpperCase(), bold: true, fontSize: 10.5, characterSpacing: 0.6, alignment: 'right' }, { text: codigo, font: 'StolzlLight', fontSize: 9.5, color: GRIS_TXT, alignment: 'right' }], width: 'auto' },
      ], margin: [MI, 40, MD, 0] },
      { canvas: [{ type: 'rect', x: 0, y: 0, w: ANCHO, h: 22, color: GRIS }], margin: [0, 14, 0, 0] },
    ] }),
    footer: pag => ({ columns: [
      { text: [{ text: 'Por  ', font: 'StolzlLight', fontSize: 10 }, { text: '———  ', color: TINTA, fontSize: 7 }, { text: 'regenerativo', bold: true, fontSize: 11 }], width: 'auto' },
      { text: 'info@regenerativo.co    @_regenerativo_    +57 320 215 0932', fontSize: 7.5, color: GRIS_TXT, alignment: 'right', marginTop: 2, width: '*' },
      { text: String(pag), bold: true, fontSize: 10.5, alignment: 'right', width: 28 },
    ], margin: [MI, 30, MD, 0] }),
    content: contenido,
  };
  window.pdfMake.createPdf(def).download(nombre);
}
