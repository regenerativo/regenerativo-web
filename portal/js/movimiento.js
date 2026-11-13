// REG — Portal · movimiento: escalonado de entradas, cifras que cuentan hasta su valor y sombra de la barra al hacer scroll.
// Funciona sobre lo que pinta app.js; no cambia datos ni comportamiento.
const raiz = document.getElementById('raiz');
const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Índice de cada hijo para el escalonado (--i)
const LISTAS = '.cont, .kpis, .tiles, .recordatorios, .cifras-emp, .tarjetas-cli, .lista-filas, .od-lista, .mon-cols, tbody, .barra-apilada';
function escalonar(base) {
  base.querySelectorAll(LISTAS).forEach(l => [...l.children].forEach((h, i) => h.style.setProperty('--i', Math.min(i, 14))));
  base.querySelectorAll('.mon-col').forEach((c, i) => c.querySelectorAll('.mon-gasto, .mon-pres').forEach(b => b.style.setProperty('--i', i)));
  base.querySelectorAll('.g-col').forEach((c, i) => c.querySelectorAll('span').forEach(b => b.style.setProperty('--i', i)));
  base.querySelectorAll('.lista-filas .barra i, td .barra i').forEach((b, i) => b.style.setProperty('--i', Math.min(i, 10)));
}

// Cifras que cuentan desde 0 hasta su valor (formato 1.234.567 COP)
const CIFRAS = '.kpi .va, .ce-va, .mon-cifra, .cifra-grande, .tile b';
function contar(base) {
  if (quieto) return;
  base.querySelectorAll(CIFRAS).forEach(el => {
    if (el.dataset.contado) return;
    const nodo = [...el.childNodes].find(n => n.nodeType === 3 && /\d/.test(n.textContent));
    if (!nodo) return;
    const txt = nodo.textContent, m = txt.match(/\d[\d.]*/);
    if (!m) return;
    const fin = Number(m[0].replace(/\./g, ''));
    if (!fin || fin < 2) return;
    el.dataset.contado = '1';
    const fmt = n => Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');
    const antes = txt.slice(0, m.index), despues = txt.slice(m.index + m[0].length);
    const t0 = performance.now(), dur = 900;
    const paso = t => {
      const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 4);
      nodo.textContent = antes + fmt(fin * e) + despues;
      if (p < 1) requestAnimationFrame(paso); else nodo.textContent = txt;
    };
    requestAnimationFrame(paso);
  });
}

let pendiente = false;
new MutationObserver(() => {
  if (pendiente) return; pendiente = true;
  requestAnimationFrame(() => { pendiente = false; escalonar(raiz); contar(raiz); });
}).observe(raiz, { childList: true, subtree: true });

addEventListener('scroll', () => document.documentElement.classList.toggle('desplazado', scrollY > 8), { passive: true });
