import * as D from './datos.js?v=167';
import * as M from './modulos.js?v=167';
import { vistaFinanzas, modalMov, icoCat as icoCatF, cuentasEncargo } from './finanzas.js?v=167';
import { vistaPersonal } from './personal.js?v=167';
import { cop, fecha, pct, diasDeTrabajo, fechaCorte, DIAS_TRABAJO, ESTADOS_ENCARGO, AYUDA_ESTADOS, faseEncargo } from './formato.js?v=167';
import { ico, icoMenu, btnIco, enlaceIco } from './iconos.js?v=167';

// Avisos con la gráfica de regenerativo (no la ventana gris del sistema): aparecen abajo y se van solos
window.alert = m => {
  const t = document.createElement('div'); t.className = 'lv-toast'; t.setAttribute('role', 'status');
  t.textContent = String(m ?? '').trim();
  document.body.appendChild(t);
  const dura = 3500 + t.textContent.length * 35;
  t.onclick = () => t.remove();
  setTimeout(() => t.classList.add('fuera'), dura); setTimeout(() => t.remove(), dura + 600);
};

// Ventanas de confirmación y de pregunta con la gráfica de regenerativo (en vez de las grises del sistema)
function dialogo(mensaje, { ok = 'Aceptar', peligro = false, campo = false, valor = '', opcional = false } = {}) {
  return new Promise(res => {
    const fondo = document.createElement('div'); fondo.className = 'modal-fondo dialogo-fondo';
    const [tit, ...resto] = String(mensaje).split('\n\n');
    const e = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    fondo.innerHTML = `<form class="modal dialogo" role="dialog" aria-modal="true"><h2>${e(tit)}</h2>${resto.length ? `<p class="sutil">${e(resto.join(' '))}</p>` : ''}
      ${campo ? `<input name="v" value="${e(valor)}" autocomplete="off" style="width:100%">` : ''}
      <div class="pie-modal pie-dialogo"><button type="button" class="btn sec" data-no>Cancelar</button><button class="btn${peligro ? ' peligro' : ''}" type="submit">${e(ok)}</button></div></form>`;
    document.body.appendChild(fondo);
    const f = fondo.querySelector('form'), inp = f.querySelector('input');
    const cerrar = v => { fondo.remove(); document.removeEventListener('keydown', tecla, true); res(v); };
    const tecla = ev => { if (ev.key === 'Escape') { ev.stopPropagation(); cerrar(campo ? null : false); } };
    document.addEventListener('keydown', tecla, true);
    f.querySelector('[data-no]').onclick = () => cerrar(campo ? null : false);
    fondo.addEventListener('click', ev => { if (ev.target === fondo) cerrar(campo ? null : false); });
    f.onsubmit = ev => { ev.preventDefault(); if (!campo) return cerrar(true); const v = inp.value.trim(); if (!v && !opcional) { inp.focus(); return; } cerrar(v); };
    setTimeout(() => (inp || f.querySelector('[type=submit]')).focus(), 50);
  });
}
window.confirmar = (m, o) => dialogo(m, o);
window.preguntar = (m, o = {}) => dialogo(m, { ...o, campo: true });

// Mensajes de Supabase en español
function msg(err) {
  const t = String(err && (err.message || err) || '');
  const seg = t.match(/after (\d+) seconds?/i);
  if (seg) return `Por seguridad, puedes pedirlo de nuevo en ${seg[1]} segundos.`;
  const M = [
    [/invalid login credentials/i, 'Correo o contraseña incorrectos.'],
    [/email not confirmed/i, 'Este correo aún no está confirmado. Revisa tu bandeja de entrada.'],
    [/user not found/i, 'No encontramos ese usuario.'],
    [/password should be at least (\d+)/i, m => `La contraseña debe tener al menos ${m[1]} caracteres.`],
    [/new password should be different/i, 'La nueva contraseña debe ser distinta a la anterior.'],
    [/rate limit|too many requests/i, 'Demasiados intentos. Espera un momento y vuelve a intentarlo.'],
    [/failed to fetch|networkerror|load failed/i, 'No se pudo conectar con el servidor. Revisa tu conexión a internet.'],
    [/auth session missing|otp.?expired|email link is invalid|link.*expired/i, 'El enlace ya no es válido o venció. Pide uno nuevo en "Olvidé mi contraseña".'],
    [/jwt expired|session.*expired|refresh token/i, 'Tu sesión expiró. Vuelve a ingresar.'],
    [/unable to validate email|invalid email/i, 'El correo no es válido.'],
    [/signups not allowed|signup is disabled/i, 'El registro está cerrado. El acceso es solo por invitación.'],
    [/permission denied|row-level security/i, 'No tienes permiso para esta acción.'],
  ];
  for (const [re, es] of M) { const m = t.match(re); if (m) return typeof es === 'function' ? es(m) : es; }
  return t;
}
// Cuenta regresiva cuando Supabase pide esperar antes de reenviar
function esperaReenvio(err, btn, aviso) {
  const seg = String(err && (err.message || err) || '').match(/after (\d+) seconds?/i);
  if (!seg) return false;
  let n = Number(seg[1]); btn.disabled = true;
  const pinta = () => { aviso.textContent = `Por seguridad, puedes pedirlo de nuevo en ${n} segundo${n === 1 ? '' : 's'}.`; };
  pinta();
  const t = setInterval(() => { n--; if (n <= 0) { clearInterval(t); btn.disabled = false; aviso.textContent = 'Ya puedes pedir el enlace de nuevo.'; } else pinta(); }, 1000);
  return true;
}

const $ = (s, r = document) => r.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const xxx = v => (v === null || v === undefined || v === '' || v === 'XXX') ? '<span class="xxx">XXX</span>' : esc(v);
const raiz = $('#raiz');
// Mensajes de validación del navegador en español (el navegador los muestra en su idioma por defecto)
document.addEventListener('invalid', ev => {
  const el = ev.target, v = el.validity; if (!v) return;
  el.setCustomValidity(v.valueMissing ? (el.type === 'file' ? 'Elige un archivo.' : el.tagName === 'SELECT' ? 'Elige una opción.' : 'Completa este campo.')
    : v.typeMismatch && el.type === 'email' ? 'Escribe un correo válido, por ejemplo nombre@dominio.com.'
    : v.rangeUnderflow || v.rangeOverflow ? 'El valor está fuera del rango permitido.' : v.tooShort ? `Escribe al menos ${el.minLength} caracteres.` : v.patternMismatch ? 'Revisa el formato de este campo.' : v.badInput ? 'Revisa este dato.' : '');
}, true);
document.addEventListener('input', ev => { if (ev.target.setCustomValidity) ev.target.setCustomValidity(''); }, true);
document.addEventListener('change', ev => { if (ev.target.setCustomValidity) ev.target.setCustomValidity(''); }, true);
let cargando = null;
let finAntes = '';

// ---------------- Router ----------------
window.addEventListener('hashchange', ir);
ir();

// ---------------- Sincronización en tiempo real ----------------
// Cualquier cambio en la base de datos (desde otro equipo, el cliente o Claude) vuelve a pintar la página sola.
// Si hay un formulario abierto o se está escribiendo, espera a que termine para no borrar lo que se escribe.
let refrescoPendiente = false, tRefresco = null, ocultaDesde = 0;
const ocupado = () => !!document.querySelector('.modal-fondo') || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) || document.body.classList.contains('ingreso') || document.hidden;
async function refrescar() {
  if (ocupado()) { refrescoPendiente = true; return; }
  refrescoPendiente = false;
  const y = scrollY;
  await ir();
  scrollTo(0, y);
}
const programarRefresco = () => { clearTimeout(tRefresco); tRefresco = setTimeout(refrescar, 700); };
const olvidarConteos = () => { try { Object.keys(sessionStorage).filter(k => k.startsWith('reg-conteo-')).forEach(k => sessionStorage.removeItem(k)); } catch (_) {} };
setInterval(() => { if (refrescoPendiente && !ocupado()) refrescar(); }, 1500);
// OneDrive no avisa sus cambios: se vuelve a leer al regresar a la pestaña y cada 3 minutos con la página abierta
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { ocultaDesde = Date.now(); return; }
  if (ocultaDesde && Date.now() - ocultaDesde > 20000) { olvidarConteos(); programarRefresco(); }
});
setInterval(() => { if (!document.hidden && !document.body.classList.contains('ingreso')) { olvidarConteos(); if (!ocupado()) refrescar(); } }, 180000);
// Versión nueva publicada: la pestaña abierta se actualiza sola (sin esperar a que alguien recargue a mano).
// Compara el número de versión de esta página con el de la publicada; si cambió y no se está escribiendo, recarga.
const VERSION_ACTUAL = (import.meta.url.match(/[?&]v=(\d+)/) || [])[1];
let versionNueva = false;
async function revisarVersion() {
  try {
    const r = await fetch(location.pathname + '?nv=' + Date.now(), { cache: 'no-store' });
    const v = ((await r.text()).match(/app\.js\?v=(\d+)/) || [])[1];
    if (VERSION_ACTUAL && v && v !== VERSION_ACTUAL) versionNueva = true;
  } catch (_) { /* sin conexión: se intenta después */ }
  if (versionNueva && !ocupado()) location.reload();
}
setInterval(revisarVersion, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) revisarVersion(); });

var hashAntes = location.hash;   // var: ir() se llama antes de esta línea al abrir el portal
async function ir() {
  clearTimeout(cargando);
  cargando = setTimeout(() => document.body.classList.add('cargando'), 150);
  // Al cambiar de página se ve enseguida que está cargando (el contenido viejo se atenúa), aunque la nueva tarde en llegar
  const base = h => (h || '').replace(/^#\/?/, '').split('/')[0];
  if (base(location.hash) !== base(hashAntes)) document.body.classList.add('navegando');
  hashAntes = location.hash;
  try { await irSeguro(); }
  catch (err) {
    console.error(err);
    raiz.innerHTML = `<div class="acceso"><div class="acceso-caja"><img src="/assets/33b2a586a276.png" alt=""><h1>Sin conexión</h1><p>${esc(msg(err))}</p>
      <button class="btn full" onclick="location.reload()">Reintentar</button></div></div>`;
  } finally { clearTimeout(cargando); document.body.classList.remove('cargando', 'navegando'); }
}

async function irSeguro() {
  const enlace = await D.procesarEnlace();
  if (enlace && (enlace.error || enlace.tipo === 'invite' || enlace.tipo === 'recovery')) return vistaNuevaClave(enlace);
  if (enlace) { history.replaceState(null, '', location.pathname + '#/'); }
  const ruta = location.hash.replace(/^#/, '') || '/';
  document.body.classList.toggle('ingreso', ['/acceso', '/recuperar', '/nueva-clave'].includes(ruta));
  const s = await D.sesion();
  if (s) { s.admin = await D.esAdmin(); s.facturacion = await D.esFacturacion(); s.soloFinanzas = s.facturacion && !s.admin; }  // se guarda en memoria por sesión (datos.js)
  if (!s && ruta !== '/acceso' && ruta !== '/recuperar') { location.hash = '#/acceso'; return; }
  if (ruta === '/acceso') return vistaAcceso();
  if (ruta === '/recuperar') return vistaRecuperar();
  if (ruta === '/nueva-clave') return vistaNuevaClave({ tipo: 'recovery' });
  const p = ruta.split('?')[0].split('/').filter(Boolean);
  const qs = new URLSearchParams(ruta.split('?')[1] || '');
  if (s.soloFinanzas && p[0] !== 'finanzas') { location.hash = '#/finanzas'; return; }   // facturacion@ solo ve Finanzas
  try {
    let esCliente = s.email.endsWith('@clientes.portal.regenerativo.co');
    if (!esCliente && !s.admin && p.length === 0) { const l = await D.encargos(); const roles = await Promise.all(l.slice(0, 5).map(e => D.miRol(e.id))); esCliente = roles.length > 0 && roles.every(r => r === 'cliente'); }
    if (p.length === 0) return esCliente ? await vistaEncargos(s) : await vistaInicio(s);
    if (p[0] === 'encargos' && !p[1]) return await vistaEncargos(s);
    if (p[0] === 'encargos' && p[1]) return await vistaExpediente(s, decodeURIComponent(p[1]), p[2] || 'resumen', p[3]);
    const RESERVADAS = ['personal', 'marketing', 'folders', 'finanzas', 'base-precios', 'ajustes', 'propuestas', 'acceso', 'recuperar', 'nueva-clave', 'encargos'];
    if (p[0] && !RESERVADAS.includes(p[0])) return await vistaExpediente(s, decodeURIComponent(p[0]), p[1] || 'resumen', p[2]);
    if (p[0] === 'finanzas' && s.facturacion) {
      const pedido = location.hash;
      const caja = $('.cont'); if (caja && location.hash !== finAntes) caja.classList.add('fin-cargando');   // al cambiar de mes se ve que está cargando, no los datos viejos
      finAntes = pedido;
      const v = await vistaFinanzas(p[1], p[2]);
      if (location.hash !== pedido) return;   // si ya se pidió otro mes, esta respuesta vieja no se pinta
      marco(s, { titulo: 'Finanzas', ruta: 'Portal · solo perfil de facturación', activo: 'finanzas', html: v.html, acciones: v.rend ? '' : `<span class="fin-vista ${v.vista.cls}" title="${esc(v.vista.titulo)}">${esc(v.vista.txt)}</span>` + btnIco('ajustes', 'Ajustes de finanzas', 'id="fin-ajustes"'), eyebrow: v.eyebrow });
      v.montar(ir); return;
    }
    // Finanzas personales: solo la cuenta de Andrés (y la base solo le muestra sus propias filas)
    if (p[0] === 'personal' && esDueno(s)) {
      const pedido = location.hash;
      const v = await vistaPersonal(p[1]);
      if (location.hash !== pedido) return;
      marco(s, { titulo: 'Finanzas personales', ruta: 'Finanzas personales', activo: 'personal', html: v.html, eyebrow: v.eyebrow, acciones: btnIco('ajustes', 'Ajustes de finanzas personales', 'id="per-ajustes"') });
      v.montar(ir); return;
    }
    if (p[0] === 'base-precios' && s.admin) return await vistaBasePrecios(s, p[1]);
    if (p[0] === 'ajustes' && s.admin) return await vistaAjustes(s, qs);
    if (p[0] === 'propuestas' && s.admin) return await vistaPropuestas(s);
    if (p[0] === 'marketing' && s.admin) return await vistaMarketing(s);
    if (p[0] === 'folders' && s.admin) {
      marco(s, { titulo: 'Folders', ruta: 'Folders', activo: 'folders', html: '<section class="panel od" id="od"></section>', eyebrow: 'OneDrive · REG', bajada: 'Toda la carpeta REG de OneDrive: encargos, gestión integral y librerías.' });
      return panelOneDrive($('#od'), null, [['']], { titulo: 'REG' });
    }
    return marco(s, { titulo: 'Página no encontrada', html: `<div class="vacio">Esta página no existe. <a href="#/">Volver a los encargos</a></div>` });
  } catch (err) {
    console.error(err);
    marco(s, { titulo: 'Algo salió mal', html: `<div class="vacio">${esc(msg(err))}<br><br><a href="#/">Volver a los encargos</a></div>` });
  }
}

// Finanzas personales: solo la cuenta de Andrés
const esDueno = s => (s?.email || '').toLowerCase() === 'apardo@regenerativo.co';

// ---------------- Marco general ----------------
let firmaMarco = '', hashMarco = '';
function marco(s, { titulo, ruta = '', acciones = '', html, menu = null, activo = '', enc = null, h1 = '', bajada = '', eyebrow = '' }) {
  D.escucharCambios(programarRefresco).catch(() => {});
  document.body.classList.remove('ingreso');  // el pie del ingreso (Por regenerativo fijo abajo) no debe quedar encima del menú
  const esCli = s.email.endsWith('@clientes.portal.regenerativo.co');
  const enlacesGen = esCli || enc ? '' : `
    ${s.soloFinanzas ? '' : `<a href="#/" class="${activo === 'inicio' ? 'activo' : ''}">${icoMenu('inicio')}<span>Inicio</span></a>`}
    ${s.admin ? `<a href="#/propuestas" class="${activo === 'propuestas' ? 'activo' : ''}">${icoMenu('propuestas')}<span>Propuestas</span></a>` : ''}
    ${s.soloFinanzas ? '' : `<a href="#/encargos" class="${activo === 'encargos' ? 'activo' : ''}">${icoMenu('encargos')}<span>Encargos</span></a>`}
    ${s.facturacion ? `<a href="#/finanzas" class="${activo === 'finanzas' ? 'activo' : ''}">${icoMenu('finanzas')}<span>Finanzas</span></a>` : ''}
    ${esDueno(s) ? `<a href="#/personal" class="${activo === 'personal' ? 'activo' : ''}">${icoMenu('personal')}<span>Finanzas personales</span></a>` : ''}
    ${s.admin ? `<a href="#/marketing" class="${activo === 'marketing' ? 'activo' : ''}">${icoMenu('marketing')}<span>Marketing</span></a>` : ''}
    ${s.admin ? `<a href="#/folders" class="${activo === 'folders' ? 'activo' : ''}">${icoMenu('folders')}<span>Folders</span></a>` : ''}
    ${s.admin ? `<a href="#/base-precios" class="${activo === 'base' ? 'activo' : ''}">${icoMenu('base')}<span>Base de precios</span></a>` : ''}
    ${s.admin ? `<a href="#/ajustes" class="${activo === 'ajustes' ? 'activo' : ''}">${icoMenu('ajustes')}<span>Ajustes</span></a>` : ''}`;
  const cabEnc = enc ? `${enc.volver && !esCli ? `<a class="volver" href="#/">${ico('atras')}Portal</a>` : ''}<a class="enc-nom" href="${enc.href}">${esc(enc.nombre)}</a>` : '';
  const tituloPag = h1 || (ruta.includes(' / ') ? ruta.split(' / ').pop() : titulo);
  const ceja = eyebrow || (enc ? 'Encargo' : '');
  const htmlMarco = `
  <div class="lv">
    <header class="lv-top">
      ${enc ? `<a href="#/" class="lv-volver-top" aria-label="Volver al portal" title="Volver al portal"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 5.5l-6.5 6.5 6.5 6.5"/></svg></a>` : ''}
      <a href="#/" class="logo-reg" aria-label="regenerativo, inicio del portal">regenerativo</a>
      <span class="lv-top-sub">${esc(enc ? enc.nombre : 'Portal de encargos')}</span>
      ${s.admin ? `<a class="lv-claude-top" href="https://claude.ai/project/01a07ee0-6e6e-76ae-8f6f-875a422348d9" target="_blank" rel="noopener" title="Abrir el chat de regenerativo con Claude" aria-label="Abrir el chat de regenerativo con Claude"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/></svg></a>` : ''}
    </header>
    <aside class="lado" id="lado"><div class="lv-lado">
      <div class="lv-marca"><div class="lv-marca-f"><a href="#/" class="logo-reg" aria-label="regenerativo, inicio del portal">regenerativo</a><button type="button" class="lv-cambia" data-menu="arriba" title="Llevar el menú arriba" aria-label="Llevar el menú arriba"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="3.5"/><path d="M9.5 4.5v15"/><path class="ac" d="M6 8h1M6 11h1"/></svg></button></div><span>Portal de encargos</span></div>
      <nav class="lv-nav" aria-label="Principal"><span class="lv-ind" aria-hidden="true"></span>
        ${cabEnc}
        ${menu || ''}
        ${enlacesGen}
      </nav>
      <a class="lv-web" href="https://regenerativo.co/"><span class="lv-ico-l"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.5 4.5h-4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h4"/><path d="M19.5 12h-10"/><path d="M13 8.5 9.5 12l3.5 3.5"/></svg></span>Volver a regenerativo.co</a>
      ${s.admin ? `<a class="lv-web lv-claude-hoja" href="https://claude.ai/project/01a07ee0-6e6e-76ae-8f6f-875a422348d9" target="_blank" rel="noopener"><span class="lv-ico-l"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/></svg></span>Abrir Claude</a>` : ''}
      <div class="pie lv-pie-lado"><span class="pie-correo" title="${esc(s.email)}">${esCli ? 'Acceso de cliente' : esc(s.email)}</span><button id="salir" class="lv-salir"><span class="lv-ico-l"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.5 4.5h-4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h4"/><path d="M19.5 12h-10"/><path d="M13 8.5 9.5 12l3.5 3.5"/></svg></span>Cerrar sesión</button></div>
    </div></aside>
    <header class="lv-arriba" id="lv-arriba">
      <a href="#/" class="logo-reg" aria-label="regenerativo, inicio del portal">regenerativo</a>
      <nav class="lv-isla" aria-label="Menú"><button type="button" class="lv-cambia" data-menu="lado" title="Llevar el menú al lado" aria-label="Llevar el menú al lado"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="3.5"/><path d="M9.5 4.5v15"/><path class="ac" d="M6 8h1M6 11h1"/></svg></button><div class="lv-isla-in" id="lv-isla"><span class="lv-ind-h" aria-hidden="true"></span></div></nav>
      <div class="lv-cuenta-c"><button type="button" class="lv-circulo" id="lv-cuenta" aria-label="Cuenta"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><circle cx="5.5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="18.5" cy="12" r="1.7"/></svg></button>
        <div class="lv-pop" id="lv-pop" hidden><span>${esCli ? 'Acceso de cliente' : esc(s.email)}</span><button type="button" id="salir2" class="lv-salir"><span class="lv-ico-l"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.5 4.5h-4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h4"/><path d="M19.5 12h-10"/><path d="M13 8.5 9.5 12l3.5 3.5"/></svg></span>Cerrar sesión</button></div></div>
    </header>
    <div class="main">
      ${D.MODO_DEMO ? '<div class="demo">Modo demostración: los datos son de ejemplo y se guardan solo en este navegador.</div>' : ''}
      <div class="titulo-pag">
        <div>${ceja ? `<span class="lv-ceja">${esc(ceja)}</span>` : ''}<h1>${tituloPag}</h1></div>
        <div class="acciones">${acciones}</div>
      </div>
      <main class="cont">${html}</main>
      <footer class="remate">
        <div class="remate-fin">
          <span class="porx"><span class="p1">Por</span><span class="ln"></span><span class="p2">regenerativo</span><span class="g" style="margin-left:.6em">© 2020</span></span>
        </div>
      </footer>
    </div>
    <nav class="lv-tabs" id="lv-tabs" aria-label="Menú"></nav>
    <div class="lv-velo" id="lv-velo"></div>
    ${s.admin ? `<a class="lv-claude" href="https://claude.ai/project/01a07ee0-6e6e-76ae-8f6f-875a422348d9" target="_blank" rel="noopener" title="Abrir el chat de regenerativo con Claude" aria-label="Abrir el chat de regenerativo con Claude"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/></svg><span>Claude</span></a>` : ''}
  </div>`;
  // Navegación fluida: si el menú es el mismo (misma sección del portal o del mismo encargo), solo cambia el contenido;
  // el menú, la barra de arriba y las pestañas se quedan quietos y el indicador se desliza a la opción nueva.
  const firma = [s.email, enc ? 'encargo:' + enc.href : 'general:' + (enlacesGen.match(/href="[^"]*"/g) || []).join(',')].join('|');
  const lvViejo = raiz.querySelector(':scope > .lv');
  // Sección = la página sin el periodo ni el detalle (#/personal, #/finanzas, #/encargo/finanzas…)
  const seccion = h => { const q = (h || '').replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean); return q[0] && !/^(personal|finanzas|marketing|propuestas|encargos|ajustes|folders|base-precios)$/.test(q[0]) ? q.slice(0, 2).join('/') : (q[0] || ''); };
  const mismaSeccion = seccion(location.hash) === seccion(hashMarco);
  const otraPagina = location.hash !== hashMarco; hashMarco = location.hash;   // al entrar a otra página (o a un encargo) se empieza arriba
  // Misma sección (un refresco, otro mes, otra pestaña de la página): solo cambia el contenido, sin animación ni salto
  if (lvViejo && firmaMarco === firma && mismaSeccion && lvViejo.querySelector('.main .cont')) {
    const t = document.createElement('div'); t.innerHTML = htmlMarco;
    const mainN = t.querySelector('.lv .main'), mainV = lvViejo.querySelector('.main');
    const y = scrollY;
    ['.titulo-pag', '.cont'].forEach(sel => { const a = mainV.querySelector(sel), b = mainN.querySelector(sel); if (a && b && a.innerHTML !== b.innerHTML) a.innerHTML = b.innerHTML; });
    const navV = lvViejo.querySelector('.lv-lado > .lv-nav'), navN = t.querySelector('.lv-lado > .lv-nav');
    if (navV && navN && navV.innerHTML !== navN.innerHTML) { navV.innerHTML = navN.innerHTML; armarTabs(); moverIndicador(); }
    if (!otraPagina || Math.abs(scrollY - y) > 2) scrollTo(0, y);
    return;
  }
  if (lvViejo && firmaMarco === firma && lvViejo.querySelector('.main')) {
    const t = document.createElement('div'); t.innerHTML = htmlMarco;
    const lvN = t.querySelector('.lv');
    const mainN = lvN.querySelector('.main'); mainN.querySelector('.cont')?.classList.add('lv-entra');
    lvViejo.querySelector('.main').replaceWith(mainN);
    const navV = lvViejo.querySelector('.lv-lado > .lv-nav'), navN = lvN.querySelector('.lv-lado > .lv-nav');
    if (navV && navN && navV.innerHTML !== navN.innerHTML) navV.innerHTML = navN.innerHTML;
    const subV = lvViejo.querySelector('.lv-top-sub'), subN = lvN.querySelector('.lv-top-sub'); if (subV && subN) subV.textContent = subN.textContent;
    const islaV = lvViejo.querySelector('#lv-isla'), islaN = lvN.querySelector('#lv-isla');
    if (islaV && islaN) [...islaV.querySelectorAll('a')].forEach(x => { const h = x.getAttribute('href'); const y = [...navN.querySelectorAll('a')].find(z => z.getAttribute('href') === h); if (y) x.classList.toggle('activo', y.classList.contains('activo')); });
    armarTabs();
    lvViejo.querySelector('#lado')?.classList.remove('abierto'); lvViejo.querySelector('#lv-velo')?.classList.remove('si');
    moverIndicador();
    if (otraPagina) scrollTo(0, 0);
    return;
  }
  firmaMarco = firma;
  raiz.innerHTML = htmlMarco;
  // Flecha de volver (celular y iPad): va siempre al inicio del portal, aunque el navegador no siga el enlace
  raiz.querySelectorAll('.lv-volver-top').forEach(a => a.addEventListener('click', ev => { ev.preventDefault(); if (location.hash === '#/' || location.hash === '') ir(); else location.hash = '#/'; }));
  if (otraPagina) scrollTo(0, 0);
  $('#salir').onclick = async () => { await D.dejarDeEscuchar(); await D.salir(); location.hash = '#/acceso'; };
  armarTabs();
  armarIsla();
  const navL = $('.lv-lado > .lv-nav'); if (navL) { const mira = () => navL.classList.toggle('desborda', navL.scrollHeight - navL.scrollTop > navL.clientHeight + 4); mira(); navL.onscroll = mira; addEventListener('resize', mira, { passive: true }); }
  $('#salir2').onclick = async () => { await D.dejarDeEscuchar(); await D.salir(); location.hash = '#/acceso'; };
  moverIndicador();
}

// Menú arriba (isla en píldora, como Apple Music en iPad/Mac) o al lado; se recuerda en este navegador
const menuArriba = () => { try { return localStorage.getItem('reg-menu') === 'arriba'; } catch (_) { return false; } };
document.documentElement.classList.toggle('menu-arriba', menuArriba());
function armarIsla() {
  const isla = $('#lv-isla');
  const enl = [...document.querySelectorAll('.lv-nav a:not(.volver):not(.enc-nom)')];
  const volver = document.querySelector('.lv-nav a.volver');
  isla.insertAdjacentHTML('beforeend', (volver ? `<a href="${volver.getAttribute('href')}" class="lv-isla-volver" title="Volver al portal">${ico('atras')}</a>` : '') +
    enl.map(a => `<a href="${a.getAttribute('href')}" class="${a.classList.contains('activo') ? 'activo' : ''}">${(a.querySelector('span:not(.cuenta)')?.textContent || a.textContent).trim()}</a>`).join(''));
  document.querySelectorAll('.lv-cambia').forEach(b => b.onclick = () => {
    const arriba = b.dataset.menu === 'arriba';
    try { localStorage.setItem('reg-menu', arriba ? 'arriba' : 'lado'); } catch (_) {}
    document.documentElement.classList.add('menu-cambiando');
    document.documentElement.classList.toggle('menu-arriba', arriba);
    indAntes = null; moverIndicador();
    setTimeout(() => document.documentElement.classList.remove('menu-cambiando'), 700);
  });
  const pop = $('#lv-pop');
  $('#lv-cuenta').onclick = e => { e.stopPropagation(); pop.hidden = !pop.hidden; };
  document.addEventListener('click', e => { if (!pop.hidden && !pop.contains(e.target)) pop.hidden = true; });
  const act = isla.querySelector('a.activo'); if (act) act.scrollIntoView({ block: 'nearest', inline: 'center' });
}

// Menú inferior del celular: los 4 primeros del menú + "Más" (abre el menú completo como hoja)
function armarTabs() {
  const tabs = $('#lv-tabs'), lado = $('#lado'), velo = $('#lv-velo');
  // Menú lateral en pantallas bajas: si hay más opciones abajo, se insinúan con un desvanecido
  const navL = lado?.querySelector('.lv-nav');
  if (navL) { const marca = () => navL.classList.toggle('con-mas', navL.scrollHeight > navL.clientHeight + 4 && navL.scrollTop + navL.clientHeight < navL.scrollHeight - 4); marca(); setTimeout(marca, 400); setTimeout(marca, 1500); navL.onscroll = marca; window.onresize = marca; }
  const enl = [...document.querySelectorAll('.lv-nav a:not(.volver):not(.enc-nom)')];
  const com = enl.find(a => /\/comentarios$/.test(a.getAttribute('href')));
  const prim = com ? [...enl.filter(a => a !== com).slice(0, 3), com] : enl.slice(0, 4);
  const resto = enl.filter(a => !prim.includes(a));
  const masActivo = resto.some(a => a.classList.contains('activo')) || !!document.querySelector('.lv-nav a.volver');
  tabs.innerHTML = `<div class="lv-tabs-in"><span class="lv-tab-ind" aria-hidden="true"></span>${prim.map(a => `<a href="${a.getAttribute('href')}" class="${a.classList.contains('activo') ? 'activo' : ''}">${a.querySelector('svg')?.outerHTML || ''}<span>${(a.querySelector('span:not(.cuenta)')?.textContent || a.textContent).trim().replace(/^Base de precios$/, 'Precios').replace(/^Actas e informes$/, 'Actas').replace(/^Documentos enviados$/, 'Enviados').replace(/^Propuesta preliminar$/, 'Preliminar').replace(/^Programación$/, 'Gantt').replace(/^Coordinación administrativa$/, 'Admin.').replace(/^Coordinación técnica$/, 'Técnica')}</span></a>`).join('')}
    <button type="button" id="abrir-menu" class="${masActivo ? 'activo' : ''}"><svg class="ico-menu im-mas" viewBox="0 0 24 24" width="25" height="25" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2.1"/><circle cx="12" cy="12" r="2.1"/><circle cx="19" cy="12" r="2.1"/></svg><span>Más</span></button></div>`;
  const cerrar = () => { lado.classList.remove('abierto'); velo.classList.remove('si'); };
  $('#abrir-menu').onclick = e => { e.stopPropagation(); lado.classList.add('abierto'); velo.classList.add('si'); };
  velo.onclick = cerrar;
  lado.querySelectorAll('a').forEach(a => a.addEventListener('click', cerrar));
  // Burbuja de vidrio que se desliza a la pestaña tocada (como la barra de Apple) y gesto del ícono al tocar
  const caja = tabs.querySelector('.lv-tabs-in'), ind = caja.querySelector('.lv-tab-ind');
  const ir_ = (el, animar) => { if (!el) { ind.style.opacity = 0; return; }
    const d = { x: el.offsetLeft, w: el.offsetWidth };
    if (!animar) { ind.style.transition = 'none'; ind.style.transform = `translateX(${(tabAntes || d).x}px)`; ind.style.width = (tabAntes || d).w + 'px'; void ind.offsetWidth; ind.style.transition = ''; }
    ind.style.opacity = 1; requestAnimationFrame(() => { ind.style.transform = `translateX(${d.x}px)`; ind.style.width = d.w + 'px'; }); tabAntes = d; };
  ir_(caja.querySelector(':scope > .activo'), false);
  caja.querySelectorAll(':scope > a, :scope > button').forEach(el => {
    el.addEventListener('pointerdown', () => { el.classList.remove('toca'); void el.offsetWidth; el.classList.add('toca'); if (el.tagName === 'A') ir_(el, true); });
  });
}
let tabAntes = null;

// Indicador del menú que se desliza de la opción anterior a la nueva
let indAntes = null;
function moverIndicador() {
  const nav = document.querySelector('.lv-nav'), ind = nav?.querySelector('.lv-ind'), a = nav?.querySelector('a.activo');
  if (!ind) return;
  if (!a) { ind.style.opacity = 0; indAntes = null; return; }
  const dest = { top: a.offsetTop, h: a.offsetHeight };
  ind.style.transition = 'none';
  const ini = indAntes || dest;
  ind.style.transform = `translateY(${ini.top}px)`; ind.style.height = ini.h + 'px'; ind.style.opacity = 1;
  void ind.offsetWidth;
  ind.style.transition = '';
  requestAnimationFrame(() => { ind.style.transform = `translateY(${dest.top}px)`; ind.style.height = dest.h + 'px'; });
  indAntes = dest;
  const isla = document.querySelector('.lv-isla-in'), h = isla?.querySelector('.lv-ind-h'), b = isla?.querySelector('a.activo');
  if (h && b) {
    const d = { x: b.offsetLeft, w: b.offsetWidth }, i0 = islaAntes || d;
    h.style.transition = 'none'; h.style.transform = `translateX(${i0.x}px)`; h.style.width = i0.w + 'px'; h.style.opacity = 1; void h.offsetWidth; h.style.transition = '';
    requestAnimationFrame(() => { h.style.transform = `translateX(${d.x}px)`; h.style.width = d.w + 'px'; });
    islaAntes = d;
  } else if (h) { h.style.opacity = 0; islaAntes = null; }
}
let islaAntes = null;

// ---------------- Acceso ----------------
// Marco de las pantallas de ingreso: lema a la izquierda y tarjeta de vidrio a la derecha, sobre las burbujas de regenerativo
function marcoAcceso(form) {
  document.body.classList.add('ingreso');  // siempre con el estilo de ingreso (burbujas, vidrio, botones), venga de donde venga
  return `<div class="lv-acceso">
    <section class="lv-acc-hero">
      <a class="lv-acc-volver" href="https://regenerativo.co/"><span><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.5 4.5h-4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h4"/><path d="M19.5 12h-10"/><path d="M13 8.5 9.5 12l3.5 3.5"/></svg></span>Volver a regenerativo.co</a>
      <a href="#/" aria-label="Inicio del portal"><img class="lv-acc-simbolo" src="/assets/33b2a586a276.png" alt=""></a>
      <span class="lv-ceja">Portal de encargos</span>
      <div class="lv-acc-rota" aria-live="off">
        <div class="lv-acc-frase on"><h1>No intervenimos,<br>regeneramos.</h1><p class="lv-acc-cita">Génesis 1.27</p></div>
        <div class="lv-acc-frase" aria-hidden="true"><p class="lv-acc-h1">Together<br>is more.</p><p class="lv-acc-cita">Eclesiastés 4.9-12</p></div>
      </div>
      <ul class="lv-acc-puntos"><li><i></i>Propuestas, contratos y documentos</li><li><i></i>Avance y cronograma del encargo</li><li><i></i>Conversación directa con el equipo</li></ul>
    </section>
    ${form}
  </div>`;
}
function vistaAcceso() {
  let modo = sessionStorage.getItem('reg-modo-acceso') || 'cliente';
  const pintar = () => {
    const cli = modo === 'cliente';
    raiz.innerHTML = marcoAcceso(`<form class="lv-acc-card" id="f">
      <a href="#/" class="logo-reg" aria-label="regenerativo, inicio del portal">regenerativo</a>
      <h2>${cli ? 'Bienvenido a tu encargo' : 'Hola, equipo'}</h2>
      <div class="lv-seg ancho" role="tablist">
        <button type="button" class="${cli ? 'activo' : ''}" data-m="cliente">Clientes</button>
        <button type="button" class="${cli ? '' : 'activo'}" data-m="equipo">Equipo regenerativo</button>
      </div>
      ${cli
        ? `<label for="usuario">Nombre del encargo</label><input id="usuario" autocomplete="username" placeholder="Ej.: 20  I  PROYECTO" required>`
        : `<label for="usuario">Correo</label><input id="usuario" type="email" autocomplete="username" required>`}
      <label for="clave">${cli ? 'Acceso' : 'Contraseña'}</label><input id="clave" type="password" autocomplete="current-password" ${D.MODO_DEMO ? '' : 'required'}>
      <button class="btn full" type="submit">Ingresar <span aria-hidden="true">→</span></button>
      <div class="aviso" id="aviso"></div>
      ${cli ? '<p class="lv-acc-pie">¿No tienes tu acceso? Pídelo a regenerativo.</p>'
            : '<p class="lv-acc-pie"><a href="#/recuperar">Olvidé mi contraseña</a></p>'}
    </form>`);
    document.querySelectorAll('.lv-acc-card .lv-seg button').forEach(b => b.onclick = () => {
      modo = b.dataset.m; try { sessionStorage.setItem('reg-modo-acceso', modo); } catch (e) {} pintar();
    });
    $('#f').onsubmit = async e => {
      e.preventDefault();
      const btn = $('#f .btn.full'), txt = btn.innerHTML; btn.disabled = true; btn.classList.add('ocupado'); btn.innerHTML = 'Ingresando…'; $('#aviso').textContent = '';
      try {
        if (modo === 'cliente' && !$('#usuario').value.includes('@')) await D.ingresarCliente($('#usuario').value, $('#clave').value);  // con correo (@) siempre entra como equipo
        else await D.ingresar($('#usuario').value.trim(), $('#clave').value);
        location.hash = '#/';
      } catch (err) { $('#aviso').textContent = msg(err); btn.disabled = false; btn.classList.remove('ocupado'); btn.innerHTML = txt; }
    };
  };
  pintar();
}

function vistaNuevaClave(enlace) {
  document.body.classList.add('ingreso');
  if (enlace.error) {
    raiz.innerHTML = marcoAcceso(`<div class="lv-acc-card"><a href="#/" class="logo-reg" aria-label="regenerativo, inicio del portal">regenerativo</a><h2>El enlace ya no sirve</h2>
      <p class="lv-acc-txt">${esc(enlace.error)}. Pide una nueva invitación o usa "Olvidé mi contraseña".</p><a class="btn full" href="#/acceso">Ir al ingreso</a></div>`);
    return;
  }
  const bienvenida = enlace.tipo === 'invite';
  raiz.innerHTML = marcoAcceso(`<form class="lv-acc-card" id="f">
    <a href="#/" class="logo-reg" aria-label="regenerativo, inicio del portal">regenerativo</a>
    <h2>${bienvenida ? 'Bienvenido al portal' : 'Nueva contraseña'}</h2>
    <p class="lv-acc-txt">${bienvenida ? 'Crea tu contraseña para entrar a tus encargos.' : 'Escribe tu nueva contraseña.'}</p>
    <label for="c1">Contraseña (mínimo 8 caracteres)</label><input id="c1" type="password" autocomplete="new-password" minlength="8" required>
    <label for="c2">Repítela</label><input id="c2" type="password" autocomplete="new-password" minlength="8" required>
    <button class="btn full" type="submit">Guardar y entrar</button>
    <div class="aviso" id="aviso"></div>
  </form>`);
  $('#f').onsubmit = async e => {
    e.preventDefault();
    if ($('#c1').value !== $('#c2').value) { $('#aviso').textContent = 'Las contraseñas no coinciden.'; return; }
    try { await D.cambiarClave($('#c1').value); history.replaceState(null, '', location.pathname + '#/'); ir(); }
    catch (err) { $('#aviso').textContent = msg(err); }
  };
}

function vistaRecuperar() {
  raiz.innerHTML = marcoAcceso(`<form class="lv-acc-card" id="f">
    <a href="#/" class="logo-reg" aria-label="regenerativo, inicio del portal">regenerativo</a>
    <h2>Recuperar contraseña</h2>
    <p class="lv-acc-txt">Te enviaremos un enlace para crear una nueva.</p>
    <label for="email">Correo</label><input id="email" type="email" required>
    <button class="btn full" type="submit">Enviar enlace</button>
    <div class="aviso" id="aviso"></div>
    <p class="lv-acc-pie"><a href="#/acceso">Volver al ingreso</a></p>
  </form>`);
  $('#f').onsubmit = async e => {
    e.preventDefault();
    try { await D.recuperarClave($('#email').value.trim()); $('#aviso').style.color = 'var(--petroleo)'; $('#aviso').textContent = 'Si el correo está registrado, te llegará el enlace.'; }
    catch (err) { const b = $('#f button[type=submit]'); if (!esperaReenvio(err, b, $('#aviso'))) $('#aviso').textContent = msg(err); }
  };
}

// ---------------- Lista de encargos ----------------
// ---------------- Inicio del equipo: bienvenida, versículo y resumen ----------------
const VERSICULOS = [   // tal como están en regenerativo.co/about
  { titulo: 'No intervenimos, regeneramos.', lead: 'regenerativo es una práctica creativa que diseña desde la naturaleza.', texto: 'Diseñamos desde la naturaleza, no como referencia sino como principio. Entendemos el todo como un sistema vivo y respondemos con precisión a cada contexto.', cita: 'Génesis 1.27 RVC', verso: 'Y Dios creó al hombre a su imagen. Lo creó a imagen de Dios. Hombre y mujer los creó.' },
  { titulo: 'Together<br>is more.', mas: true, lead: 'Juntos es más.', texto: 'Creemos en lo colectivo: cada proyecto se hace con quienes lo habitan, con quienes lo materializan y con el lugar que lo recibe.', cita: 'Eclesiastés 4.9-12 RVC', verso: 'Dos son mejor que uno, porque sacan más provecho de sus esfuerzos. Si uno de ellos se tropieza, el otro lo levanta. ¡Pero ay de aquel que tropieza y no hay quien lo levante! Si dos se acuestan juntos, mutuamente se calientan; pero uno solo no puede calentarse. Uno solo puede ser vencido, pero dos presentan resistencia. El cordón de tres hilos no se rompe fácilmente.' },
];
async function vistaInicio(s) {
  const [festLista, lista, props, movs, honor, docs, coms, adicsMan] = await Promise.all([D.festivos(), D.encargos(), s.admin ? D.propuestas().catch(() => []) : [],
    s.facturacion ? D.finMovimientos().catch(() => []) : [], s.facturacion ? D.finPropuestasEncargos().catch(() => []) : [], s.facturacion ? D.finDocumentosCobro().catch(() => []) : [], s.admin ? D.comentariosAbiertos() : [],
    s.facturacion ? D.adicionalesTodos().catch(() => []) : []]);
  const fest = new Set(festLista.map(f => f.fecha));
  const hoy = new Date().toISOString().slice(0, 10), mes = hoy.slice(0, 7);
  // Encargos vigentes: en curso y por iniciar (aprobados que aún no empiezan)
  const activos = lista.filter(e => e.estado === 'activo' || e.estado === 'por_iniciar').map(e => ({ ...e, tiempo: tiempoTranscurrido(e, fest) }));
  const espera = props.filter(p => p.estado === 'en_espera'), borrador = props.filter(p => p.estado === 'borrador');
  const h = new Date().getHours();
  const saludo = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  // Cifras de la empresa
  const ok = movs.filter(x => (x.estado || 'confirmado') === 'confirmado');
  const pend = movs.filter(x => x.estado === 'por_confirmar');
  const suma = (l, t) => l.filter(x => x.tipo === t).reduce((a, x) => a + Number(x.valor), 0);
  const delMes = ok.filter(x => x.fecha.slice(0, 7) === mes);
  // Mismo cálculo que Finanzas (función común): así Inicio y Finanzas muestran el mismo por cobrar
  const porCobrar = lista.reduce((t, e) => t + cuentasEncargo(e, { props: honor, docs, adics: adicsMan, movs: ok }).porCobrar, 0);
  const enEspera = espera.reduce((a, p) => a + (Number(p.honorarios) || 0), 0);
  // Recordatorios: lo que pide una acción
  const R = [];
  const rec = (nivel, txt, sub, href) => R.push({ nivel, txt, sub, href });
  if (pend.length) rec('alto', `${pend.length} movimiento${pend.length > 1 ? 's' : ''} del correo por aprobar`, 'No cuentan en finanzas hasta que los apruebes', '#/finanzas#por-confirmar');
  coms.forEach(c => rec('alto', `${c.tipo === 'duda' ? 'Duda' : 'Comentario'} de ${c.autor_nombre || 'cliente'} en ${(c.encargo?.nombre || '').replace(/^\d{2}\s+I\s+/, '')}`, c.texto.length > 70 ? c.texto.slice(0, 70) + '…' : c.texto, c.encargo ? `#/${D.slugEncargo(c.encargo)}/comentarios` : '#/encargos'));
  const diasEnv = p => p.fecha_envio ? Math.round((new Date(hoy) - new Date(p.fecha_envio)) / 86400000) : null;
  const viejas = espera.filter(p => diasEnv(p) > 30);
  if (viejas.length) rec('medio', `${viejas.length} propuesta${viejas.length > 1 ? 's' : ''} en espera hace más de un mes`, 'Actualiza si despegaron o no', '#/propuestas');
  espera.filter(p => !(diasEnv(p) > 30)).forEach(p => { const d = p.fecha_envio ? 30 - diasEnv(p) : null;
    rec(d !== null && d <= 7 ? 'alto' : 'medio', `Hacer seguimiento a ${p.nombre}`, d !== null ? `${p.cliente?.nombre || 'Cliente'} · ${d > 0 ? d + ' días para decidir' : 'vence hoy'}` : `${p.cliente?.nombre || 'Cliente'} · falta la fecha de envío`, '#/propuestas'); });
  borrador.forEach(p => rec('medio', `Enviar la propuesta ${p.nombre}`, p.archivo_nombre ? 'Está en borrador' : 'Falta cargar el Word', '#/propuestas'));
  props.filter(p => p.estado !== 'borrador' && !p.fecha_envio && p.estado !== 'en_espera' && !(p.estado === 'despego' && !Number(p.honorarios))).forEach(p => rec('bajo', `Poner la fecha de envío de ${p.nombre}`, 'Propuestas preliminares', '#/propuestas'));
  activos.filter(e => !e.inicio).forEach(e => rec('medio', `Definir el inicio de ${e.nombre.replace(/^\d{2}\s+I\s+/, '')}`, 'Propuesta aprobada; el encargo aún no ha iniciado', `#/${D.slugEncargo(e)}`));
  activos.filter(e => e.inicio && !e.fin).forEach(e => rec('bajo', `Agregar la fecha de entrega de ${e.nombre.replace(/^\d{2}\s+I\s+/, '')}`, 'El encargo está en curso; con la fecha de entrega se mide el tiempo', `#/${D.slugEncargo(e)}`));
  activos.filter(e => e.fin && e.fin >= hoy && e.fin.slice(0, 7) === mes).forEach(e => rec('medio', `${e.nombre.replace(/^\d{2}\s+I\s+/, '')} termina el ${fecha(e.fin)}`, 'Fecha de fin este mes', `#/${D.slugEncargo(e)}`));
  activos.filter(e => e.fin && e.fin < hoy).forEach(e => rec('alto', `${e.nombre.replace(/^\d{2}\s+I\s+/, '')} pasó su fecha de fin`, `Terminaba el ${fecha(e.fin)}`, `#/${D.slugEncargo(e)}`));
  const prox = festLista.filter(f => f.fecha >= hoy).slice(0, 1)[0];
  // Recordatorio semanal fijo: comité regenerativo, todos los lunes a las 8:00 a. m. (hora local)
  const comite = (() => {
    const d = new Date(), h = d.getHours() * 60 + d.getMinutes();
    const dias = d.getDay() === 1 && h < 9 * 60 ? 0 : (8 - d.getDay()) % 7 || 7;
    d.setDate(d.getDate() + dias);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { hoy: dias === 0, txt: dias === 0 ? 'hoy' : dias === 1 ? 'mañana' : `el lunes ${fecha(iso)}`, festivo: fest.has(iso) };
  })();
  const orden = { alto: 0, medio: 1, bajo: 2 };
  R.sort((a, b) => orden[a.nivel] - orden[b.nivel]);
  // Seis meses de ingresos y gastos confirmados
  const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const seis = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 5 + i); const k = d.toISOString().slice(0, 7); const l = ok.filter(x => x.fecha.slice(0, 7) === k); return { mes: MESES[d.getMonth()], ing: suma(l, 'ingreso'), gas: suma(l, 'gasto') }; });
  const ingM = suma(delMes, 'ingreso'), gasM = suma(delMes, 'gasto'), totM = ingM + gasM || 1;
  const enCurso = activos.filter(e => e.estado === 'activo').length;
  const fechaLarga = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
  const html = `
    <div class="bento-hero">
      <section class="lv-card hero-about">
        ${anillos()}
        <div class="ha-in ha-rota">${VERSICULOS.map((v, i) => `<div class="ha-frase${i ? '' : ' on'}"${i ? ' aria-hidden="true"' : ''}>
          <span class="lv-ceja">Sobre regenerativo</span>
          <p class="ha-tit">${v.titulo}</p>
          <p class="ha-lead">${esc(v.lead)}</p>
          <p class="ha-txt">${esc(v.texto)}</p>
          <blockquote class="ha-verso">${esc(v.verso)}</blockquote>
          <p class="ha-cita">${esc(v.cita)}</p></div>`).join('')}
        </div>
      </section>
      <section class="lv-card lv-recs">
        <div class="lv-card-cab"><h3>Recordatorios</h3><span class="lv-cuenta">${R.length} pendiente${R.length === 1 ? '' : 's'}</span></div>
        <ul>
          <li><span class="lv-rec festivo"><span class="lv-punto comite${comite.hoy ? ' hoy' : ''}"></span><span class="lv-rec-t">Comité regenerativo ${comite.txt}, 8:00 a. m.${comite.festivo ? ' (es festivo)' : ''}<small>Todos los lunes</small></span></span></li>
          ${R.map(r => `<li><a class="lv-rec ${r.nivel}" href="${r.href}"><span class="lv-circ"></span><span class="lv-rec-t">${esc(r.txt)}</span><span class="lv-flecha">${ico('ver')}</span></a></li>`).join('')}
          ${prox ? `<li><span class="lv-rec festivo"><span class="lv-punto lima"></span><span class="lv-rec-t">Próximo festivo: ${fecha(prox.fecha)} — ${esc(prox.nombre)}</span></span></li>` : ''}
          </ul>
      </section>
    </div>
    <div class="bento-kpis">
      <a class="lv-card lv-kpi" href="#/encargos"><span class="lv-ceja">Encargos</span><b class="lv-num">${activos.length}</b><span class="lv-kpi-su">${enCurso} en curso · ${activos.length - enCurso} por iniciar</span></a>
      ${s.admin ? `<a class="lv-card lv-kpi" href="#/propuestas"><span class="lv-ceja">Propuestas</span><b class="lv-num">${espera.length}</b><span class="lv-kpi-su">en espera${enEspera ? ' · ' + cop(enEspera) : ''}</span></a>` : ''}
      ${s.facturacion ? `<a class="lv-card lv-kpi" href="#/finanzas"><span class="lv-ceja"><i class="lv-punto ing"></i>Ingresos del mes</span><b class="lv-num med ing">${cop(ingM)}</b><span class="lv-pill"><i style="width:${Math.round(ingM / totM * 100)}%"></i></span></a>
      <a class="lv-card lv-kpi" href="#/finanzas"><span class="lv-ceja"><i class="lv-punto gas"></i>Gastos del mes</span><b class="lv-num med gas">${cop(gasM)}</b><span class="lv-pill vino"><i style="width:${Math.round(gasM / totM * 100)}%"></i></span></a>` : ''}
    </div>
    ${s.facturacion ? `<section class="lv-card lv-pulso">
      <div><span class="lv-ceja">Pulso del estudio</span><h2>Seis meses, en una mirada.</h2>
        <p class="lv-pulso-dato">Por cobrar <b>${cop(porCobrar)}</b></p>
        <a class="lv-link" href="#/finanzas">Ver finanzas ${ico('ver')}</a></div>
      ${columnas(seis)}
    </section>` : ''}`;
  marco(s, { titulo: 'Inicio', ruta: 'Portal', activo: 'inicio', html, h1: `${saludo}, equipo.`, eyebrow: fechaLarga.charAt(0).toUpperCase() + fechaLarga.slice(1) });
}

// ---------- Comentarios y dudas del cliente ----------
const fechaHora = f => new Date(f).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
function formComentario(admin = false) {
  return `<form class="lv-com-f" id="f-com">
    ${admin ? '' : '<div class="lv-seg" id="tipo-com"><button type="button" data-t="duda" class="activo">Duda</button><button type="button" data-t="comentario">Comentario</button></div>'}
    <textarea name="texto" rows="3" required placeholder="${admin ? 'Escribe un mensaje para el cliente…' : 'Escribe aquí tu duda o comentario…'}"></textarea>
    <div class="lv-fila-fin"><span class="sub" id="com-estado"></span><button class="btn" type="submit">Enviar</button></div></form>`;
}
function itemComentario(c, admin) {
  const ini = (c.autor_nombre || 'C').split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase();
  return `<li class="lv-com ${c.estado}">
    <div class="lv-com-cab"><span class="lv-ava">${esc(ini)}</span><b>${esc(c.autor_nombre || 'Cliente')}</b>
      <span class="lv-chip ${c.estado === 'abierto' ? 'por-iniciar' : 'en-curso'}"><i></i>${c.estado === 'abierto' ? 'Sin resolver' : 'Resuelto'}</span>
      <span class="lv-tipo">${c.tipo === 'duda' ? 'Duda' : 'Comentario'}</span><time>${fechaHora(c.creado)}</time></div>
    <p class="lv-com-t">${esc(c.texto).replace(/\n/g, '<br>')}${c.editado ? ' <span class="sub">(editado)</span>' : ''}</p>
    ${!admin && !c.respuesta && c.estado === 'abierto' && c.autor_nombre !== 'regenerativo' ? `<div class="lv-com-acc"><button type="button" class="btn sec mini" data-com-editar="${c.id}">Editar</button><button type="button" class="btn sec mini" data-com-borrar="${c.id}">Eliminar</button></div>` : ''}
    ${c.respuesta ? `<div class="lv-resp"><b>regenerativo</b>${c.respondido ? ` <time>${fechaHora(c.respondido)}</time>` : ''}<p>${esc(c.respuesta).replace(/\n/g, '<br>')}</p></div>` : ''}
    ${admin && c.estado === 'resuelto' && c.autor_nombre !== 'regenerativo' ? `<button type="button" class="btn sec mini lv-reabrir" data-id="${c.id}">Reabrir</button>` : ''}
    ${admin && c.estado === 'abierto' ? `<form class="lv-resp-f" data-id="${c.id}"><textarea name="respuesta" rows="2" placeholder="Responder al cliente…">${esc(c.respuesta || '')}</textarea>
      <div class="lv-fila-fin"><label class="lv-check"><input type="checkbox" name="resolver" ${c.estado === 'resuelto' ? 'checked' : ''}><span>Resuelto</span></label><button class="btn sec" type="submit">Guardar</button></div></form>` : ''}
  </li>`;
}
function montarComentario(ctx) {
  const f = $('#f-com'); if (!f) return;
  let tipo = ctx.admin ? 'comentario' : 'duda';
  f.querySelectorAll('#tipo-com button').forEach(b => b.onclick = () => { tipo = b.dataset.t; f.querySelectorAll('#tipo-com button').forEach(x => x.classList.toggle('activo', x === b)); });
  f.onsubmit = async ev => {
    ev.preventDefault();
    const texto = f.texto.value.trim(); if (!texto) return;
    const est = $('#com-estado'), btn = f.querySelector('button[type=submit]');
    btn.disabled = true; est.textContent = 'Enviando…';
    try {
      const nombre = ctx.esCliente ? (ctx.e.cliente?.nombre || 'Cliente') : 'regenerativo';
      const r = await D.comentar(ctx.e.id, texto, tipo, nombre, !ctx.admin);
      est.textContent = ctx.admin ? 'Nota guardada.' : r.aviso?.enviado ? 'Enviado. El equipo ya recibió tu mensaje.' : 'Enviado. El equipo lo verá en el portal.';
      setTimeout(() => ctx.recargar(), 900);
    } catch (err) { est.textContent = msg(err); btn.disabled = false; }
  };
}
// Trazabilidad de correos: línea de tiempo de lo enviado al cliente y lo recibido de él
function vistaCorreos(lista, admin, e) {
  const env = lista.filter(c => c.direccion === 'enviado').length, rec = lista.length - env;
  const hora = f => new Date(f).toLocaleString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' });
  const mes = f => new Date(f).toLocaleDateString('es-CO', { month: 'long', year: 'numeric', timeZone: 'America/Bogota' });
  let ult = '';
  const filas = lista.map(c => {
    const m = mes(c.fecha); const cab = m !== ult ? `<li class="cor-mes">${esc(m)}</li>` : ''; ult = m;
    const quien = c.direccion === 'enviado' ? 'Para ' + (c.para || '') : 'De ' + (c.de || '');
    return `${cab}<li class="cor ${c.direccion}">
      <span class="cor-dir" title="${c.direccion === 'enviado' ? 'Enviado al cliente' : 'Recibido del cliente'}">${c.direccion === 'enviado' ? '↗' : '↙'}</span>
      <div class="cor-cuerpo"><div class="cor-cab"><b>${esc(c.asunto || '(sin asunto)')}</b></div>
        <div class="sub">${c.direccion === 'enviado' ? 'Enviado' : 'Recibido'} · ${esc(hora(c.fecha))}${c.adjuntos ? ' · con adjuntos' : ''} · ${esc(quien.length > 80 ? quien.slice(0, 80) + '…' : quien)}</div>
        ${admin && c.resumen ? `<p class="cor-res">${esc(c.resumen)}</p>` : ''}
        ${admin && c.web ? `<a class="lv-link" href="${esc(c.web)}" target="_blank" rel="noopener">Abrir en Outlook ${ico('ver')}</a>` : ''}</div></li>`;
  }).join('');
  const sinCorreo = admin && !e.cliente?.email ? `<p class="aviso">Este cliente no tiene correo en su ficha: agrégalo en Ajustes → Clientes para que sus correos aparezcan aquí.</p>` : '';
  return `<section class="panel"><div class="od-cab cor-top"><h3>Correos con el cliente</h3><span class="sub">${env} enviados · ${rec} recibidos · se actualiza cada hora</span></div>
    ${sinCorreo}${lista.length ? `<ul class="cor-linea">${filas}</ul>` : '<p class="sub">Todavía no hay correos con el cliente de este encargo.</p>'}</section>`;
}

function vistaComentarios(ctx, coms, pintar) {
  const { admin } = ctx;
  const ab = coms.filter(c => c.estado === 'abierto').length;
  pintar(`
    <section class="panel lv-duda"><h3>${admin ? 'Mensaje al cliente' : '¿Tienes una duda o un comentario?'}</h3>
      <p class="sub">${admin ? 'Queda en el historial del encargo y el cliente la ve.' : 'Le llega al equipo de regenerativo y te respondemos aquí mismo.'}</p>
      ${formComentario(admin)}</section>
    <section class="panel"><div class="lv-card-cab"><h3>Conversación</h3><span class="lv-cuenta">${ab} sin resolver</span></div>
      ${coms.length ? `<ul class="lv-hilo">${coms.map(c => itemComentario(c, admin)).join('')}</ul>` : '<p class="sub">Todavía no hay comentarios en este encargo.</p>'}</section>`);
  montarComentario(ctx);
  document.querySelectorAll('.lv-resp-f').forEach(f => f.onsubmit = async ev => {
    ev.preventDefault();
    const b = f.querySelector('button'); b.disabled = true;
    try { const r = await D.responderComentario(f.dataset.id, { respuesta: f.respuesta.value.trim() || null, estado: f.resolver.checked ? 'resuelto' : 'abierto' }); if (r && !r.enviado && r.motivo) alert('Respuesta guardada. No se envió el correo al cliente: ' + r.motivo); ctx.recargar(); }
    catch (err) { alert(msg(err)); b.disabled = false; }
  });
  // El cliente corrige o borra lo que escribió (solo mientras regenerativo no lo haya respondido)
  document.querySelectorAll('[data-com-editar]').forEach(b => b.onclick = () => {
    const c = coms.find(x => x.id === b.dataset.comEditar), li = b.closest('li');
    li.querySelector('.lv-com-acc').outerHTML = `<form class="lv-resp-f lv-edit-f"><textarea name="t" rows="3">${esc(c.texto)}</textarea>
      <div class="lv-fila-fin"><button type="button" class="btn sec" data-cancelar>Cancelar</button><button class="btn" type="submit">Guardar cambios</button></div></form>`;
    li.querySelector('.lv-com-t').hidden = true;
    const f = li.querySelector('.lv-edit-f'); f.t.focus();
    f.querySelector('[data-cancelar]').onclick = () => ctx.recargar();
    f.onsubmit = async ev => { ev.preventDefault(); const bt = f.querySelector('[type=submit]'); bt.disabled = true;
      try { await D.editarMiComentario(c.id, f.t.value); D.onedrive('aviso_comentario', { comentario_id: c.id }).catch(() => {}); ctx.recargar(); }
      catch (err) { alert(msg(err)); bt.disabled = false; } };
  });
  document.querySelectorAll('[data-com-borrar]').forEach(b => b.onclick = async () => {
    if (!await confirmar('¿Eliminar este comentario?\n\nNo se puede deshacer.', { ok: 'Eliminar', peligro: true })) return;
    b.disabled = true;
    try { await D.borrarMiComentario(b.dataset.comBorrar); ctx.recargar(); } catch (err) { alert(msg(err)); b.disabled = false; }
  });
  document.querySelectorAll('.lv-reabrir').forEach(b => b.onclick = async () => { b.disabled = true; try { await D.responderComentario(b.dataset.id, { estado: 'abierto' }); ctx.recargar(); } catch (err) { alert(msg(err)); b.disabled = false; } });
}
// Documentos del cliente: Enviados (DOC _ ENV) y Recibidos (DOC _ REC), cada uno con su explicación, agrupados por carpeta
// Toda carga de documentos del cliente termina: con la lista, vacía o con error y «Reintentar» (nunca queda cargando)
const conLimite = (p, ms = 25000) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('OneDrive tardó demasiado en responder.')), ms))]);
const _docsCli = new Map();   // lo enviado al cliente se guarda 2 minutos: Propuesta y Documentos usan la misma lectura
function enviadosDe(encId, fresco = false) {
  const c = _docsCli.get(encId);
  if (!fresco && c && Date.now() - c.t < 120000) return c.p;
  const p = conLimite(D.onedrive('cli_enviados', { encargo_id: encId })).then(r => r.archivos || []);
  _docsCli.set(encId, { t: Date.now(), p }); p.catch(() => _docsCli.delete(encId));
  return p;
}
const cargandoCli = t => `<p class="sub cargando-cli" role="status"><span class="giro" aria-hidden="true"></span>${t}</p>`;
const errorCli = (t, id) => `<div class="error-cli" role="alert"><p class="sub">${t}</p><button type="button" class="btn sec mini" data-reintentar="${id}">Reintentar</button></div>`;
const listaDocsCli = (l, pref) => {
  if (!l.length) return '';
  l.sort(porLlegada);  // se ordena la misma lista que usan los botones de descarga (los índices coinciden)
  const sub = a => (a.carpeta || '').split('/').slice(1).join(' / ');
  // Cada carpeta (y cada documento) se ordena por su fecha de llegada: lo más reciente arriba
  const fechaG = g => { const f = g ? fechaNombre(g.split(' / ')[0]) : null; return f ? f.fecha : l.filter(a => sub(a) === g).map(fechaLlegada).sort().pop() || ''; };
  const grupos = [...new Set(l.map(sub))].sort((a, b) => fechaG(b).localeCompare(fechaG(a)) || a.localeCompare(b));
  if (grupos.length < 2) return listaPlanaCli(l, pref);
  return grupos.map(g => { const idx = l.map((a, i) => [a, i]).filter(([a]) => sub(a) === g).sort(([a], [b]) => porLlegada(a, b));
    return `<details class="cli-carpeta" ${g ? '' : 'open'}><summary><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.2h7a2 2 0 0 1 2 2v7.8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/></svg><b>${esc(g || 'Documentos sueltos')}</b><span class="sub">${idx.length}</span></summary>${listaPlanaCli(idx.map(([a]) => a), pref).replace(new RegExp(`data-${pref}="(\\d+)"`, 'g'), (m, n) => `data-${pref}="${idx[+n][1]}"`)}</details>`; }).join('');
};
const listaPlanaCli = (l, pref) => l.length ? `<ul class="lv-docs">${l.map((a, i) => `<li><span class="lv-doc-ico">${(a.nombre.split('.').pop() || '').toUpperCase().slice(0, 4)}</span>
      <span class="lv-doc-t"><b>${esc(a.nombre.replace(/\.[^.]+$/, ''))}</b><span class="sub">${a.fecha ? fecha(a.fecha.slice(0, 10)) : ''}</span></span>
      <span class="lv-doc-acc">${/\.(docx?|xlsx?|pptx?)$/i.test(a.nombre) ? `<button class="btn sec mini" data-${pref}="${i}" data-pdf="1">PDF</button>` : ''}<button class="btn sec mini" data-${pref}="${i}">Descargar</button></span></li>`).join('')}</ul>` : '';
async function enviadosCliente(ctx, pintar) {
  pintar(`<section class="panel cli-docs" id="cli-env"><div class="cli-docs-cab"><h3>Enviados</h3><p class="sub">Documentos que regenerativo te ha enviado a ti o al personal requerido para el desarrollo del proyecto.</p></div><div class="cli-docs-l">${cargandoCli('Cargando documentos…')}</div></section>
    <section class="panel cli-docs" id="cli-rec"><div class="cli-docs-cab"><h3>Recibidos</h3><p class="sub">Documentos que tú o el personal requerido han compartido con nuestro equipo regenerativo.</p></div>
      <button type="button" class="btn mini cli-subir" id="cli-subir"><span class="mas">+</span> Compartir un documento</button><input type="file" id="cli-arch" multiple hidden aria-hidden="true" tabindex="-1"><p class="sub cli-subir-ayuda">PDF, imágenes, Word, Excel o planos, hasta 25 MB cada uno.</p><div class="aviso" id="cli-aviso" role="status" aria-live="polite"></div><div class="cli-docs-l">${cargandoCli('Cargando documentos…')}</div></section>`);
  const bajar = (l, pref, caja) => caja.querySelectorAll(`[data-${pref}]`).forEach(b => b.onclick = async () => {
    const a = l[+b.dataset[pref]]; const t = b.textContent; b.disabled = true; b.textContent = '…';
    try { const d = await conLimite(D.onedrive('cli_archivo', { encargo_id: ctx.e.id, ruta: a.ruta, pdf: !!b.dataset.pdf }), 60000); bajarBase64(d.base64, d.nombre); }
    catch (err) { alert('No se pudo descargar: ' + msg(err)); }
    b.disabled = false; b.textContent = t;
  });
  const cargar = async (accion, id, pref, vacio, fresco = false) => {
    const caja = $(`#${id} .cli-docs-l`); if (!caja) return;
    caja.innerHTML = cargandoCli('Cargando documentos…');
    try { const l = accion === 'cli_enviados' ? await enviadosDe(ctx.e.id, fresco) : ((await conLimite(D.onedrive(accion, { encargo_id: ctx.e.id }))).archivos || []);
      if (!document.body.contains(caja)) return;
      caja.innerHTML = listaDocsCli(l, pref) || `<p class="sub">${vacio}</p>`; bajar(l, pref, caja);
      const n = $(`#${id} .cli-n`); if (n) n.textContent = l.length ? String(l.length) : ''; }
    catch (err) { if (!document.body.contains(caja)) return; caja.innerHTML = errorCli('No se pudieron cargar los documentos en este momento.', id); caja.querySelector('[data-reintentar]').onclick = () => cargar(accion, id, pref, vacio, true); }
  };
  // Enviados y Recibidos se despliegan o se recogen tocando su título (Recibidos empieza recogido para no tener que bajar tanto)
  document.querySelectorAll('.cli-docs').forEach(sec => {
    const cab = sec.querySelector('.cli-docs-cab'); const h = cab.querySelector('h3');
    h.insertAdjacentHTML('beforeend', '<span class="cli-n"></span><svg class="cli-chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9.5l6 6 6-6"/></svg>');
    cab.setAttribute('role', 'button'); cab.tabIndex = 0;
    const plegar = v => { sec.classList.toggle('plegado', v); cab.setAttribute('aria-expanded', String(!v)); };
    plegar(sec.id === 'cli-rec');
    cab.onclick = () => plegar(!sec.classList.contains('plegado'));
    cab.onkeydown = ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); cab.onclick(); } };
  });
  cargar('cli_enviados', 'cli-env', 'ie', 'Aquí aparecerán los planos, informes y archivos a medida que te los enviemos.');
  cargar('cli_recibidos', 'cli-rec', 'ir', 'Todavía no has compartido documentos con nosotros.');
  $('#cli-subir').onclick = () => $('#cli-arch').click();
  $('#cli-arch').onchange = async ev => {
    const av = $('#cli-aviso'); const fs = [...ev.target.files]; if (!fs.length) return;   // si cancela, no pasa nada
    const btn = $('#cli-subir'); btn.disabled = true; let ok = 0; const malos = [];
    for (const [i, f] of fs.entries()) {
      if (f.size > 25e6) { malos.push(`${f.name} supera 25 MB (compártelo por correo)`); continue; }
      av.textContent = `Subiendo ${fs.length > 1 ? `${i + 1} de ${fs.length}: ` : ''}${f.name}…`;
      try { const b64 = await new Promise((ok2, no) => { const r = new FileReader(); r.onload = () => ok2(String(r.result).split(',')[1]); r.onerror = no; r.readAsDataURL(f); });
        await conLimite(D.onedrive('cli_subir', { encargo_id: ctx.e.id, nombre: f.name, base64: b64 }), 120000); ok++; }
      catch (err) { malos.push(`${f.name}: ${msg(err)}`); }
    }
    btn.disabled = false; ev.target.value = '';
    av.textContent = [ok ? `Listo: ${ok === 1 ? 'recibimos tu documento' : `recibimos ${ok} documentos`}. Ya aparece${ok === 1 ? '' : 'n'} en Recibidos.` : '', malos.length ? `No se pudo subir ${malos.join(' · ')}.` : ''].filter(Boolean).join(' ');
    cargar('cli_recibidos', 'cli-rec', 'ir', 'Todavía no has compartido documentos con nosotros.');
  };
}

// Propuesta para el cliente: el PDF que se le envió (carpeta Enviados); si no hay, el documento del portal
async function propuestaCliente(ctx, pintar, html, fresco = false) {
  pintar(`<section class="panel" id="cli-prop">${cargandoCli('Cargando la propuesta…')}</section>`);
  let l;
  try { l = (await enviadosDe(ctx.e.id, fresco)).filter(a => /\.pdf$/i.test(a.nombre) && (/propuesta/i.test(a.nombre) || /SCREG_/i.test(a.nombre))).sort((x, y) => (y.fecha || '').localeCompare(x.fecha || '')).slice(0, 1); }
  catch (err) {
    const c = $('#cli-prop'); if (!c) return;
    c.innerHTML = `<div class="cli-docs-cab"><h3>Propuesta preliminar</h3></div>${errorCli('No pudimos traer la propuesta en este momento. Puedes reintentar o buscarla en Documentos.', 'prop')}<p><a class="btn sec mini" href="${ctx.base}/enviados">Ir a Documentos</a></p>`;
    c.querySelector('[data-reintentar]').onclick = () => propuestaCliente(ctx, pintar, html, true);
    return;
  }
  // Si mientras cargaba se cambió de sección, no hay caja: no se pinta nada
  const caja = $('#cli-prop');
  if (!caja) return;
  if (!l.length) { if (html) { pintar(html.html); html.montar?.(); return; } caja.innerHTML = '<div class="cli-docs-cab"><h3>Propuesta preliminar</h3></div><p class="sub">Todavía no hay una propuesta para mostrar. Cuando te la enviemos aparecerá aquí y en Documentos.</p>'; return; }
  caja.innerHTML = `<div class="cli-docs-cab"><h3>Propuesta preliminar</h3><p class="sub">El documento que te enviamos.</p></div>${listaDocsCli(l, 'ip')}`;
  caja.querySelectorAll('[data-ip]').forEach(b => b.onclick = async () => {
    const a = l[+b.dataset.ip]; const t = b.textContent; b.disabled = true; b.textContent = 'Descargando…';
    try { const d = await conLimite(D.onedrive('cli_archivo', { encargo_id: ctx.e.id, ruta: a.ruta }), 60000); bajarBase64(d.base64, d.nombre); } catch (err) { alert('No se pudo descargar: ' + msg(err)); }
    b.disabled = false; b.textContent = t;
  });
}

// Presupuesto y Programación: el documento de la carpeta del encargo, solo para ver (se edita en OneDrive)
// ---------------- Programación: el cronograma se edita en Excel (carpeta PROGRAMACIÓN) y aquí se ve como Gantt ----------------
const fechaExcel = v => {
  if (v == null || v === '') return null;
  if (typeof v === 'number' || /^\d+(\.\d+)?$/.test(v)) { const d = new Date(Date.UTC(1899, 11, 30) + Math.round(Number(v)) * 864e5); return d.toISOString().slice(0, 10); }
  const m = String(v).trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/); if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const m2 = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/); return m2 ? m2[0] : null;
};
async function leerCronograma(base64) {
  await cargarJSZip();
  const zip = await JSZip.loadAsync(base64, { base64: true });
  const xml = async n => new DOMParser().parseFromString(await zip.file(n).async('string'), 'application/xml');
  const ss = []; if (zip.file('xl/sharedStrings.xml')) [...(await xml('xl/sharedStrings.xml')).getElementsByTagName('si')].forEach(si => ss.push([...si.getElementsByTagName('t')].map(t => t.textContent).join('')));
  const wb = await xml('xl/workbook.xml'), rels = await xml('xl/_rels/workbook.xml.rels');
  const hojas = [...wb.getElementsByTagName('sheet')].filter(h => h.getAttribute('state') !== 'hidden')
    .sort((a, b) => /gantt|cronograma|programaci/i.test(b.getAttribute('name')) - /gantt|cronograma|programaci/i.test(a.getAttribute('name')));
  const col = r => { let n = 0; for (const ch of r.replace(/\d+/g, '')) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
  for (const h of hojas) {
    const rid = [...h.attributes].find(x => /(^|:)id$/.test(x.name) && x.name !== 'sheetId')?.value;
    const t = [...rels.getElementsByTagName('Relationship')].find(r => r.getAttribute('Id') === rid)?.getAttribute('Target'); if (!t) continue;
    const hoja = await xml('xl/' + t.replace(/^\/?xl\//, ''));
    const grid = [...hoja.getElementsByTagName('row')].map(r => { const fila = []; [...r.getElementsByTagName('c')].forEach(c => { const v = c.getElementsByTagName('v')[0]?.textContent ?? c.getElementsByTagName('t')[0]?.textContent ?? ''; fila[col(c.getAttribute('r'))] = c.getAttribute('t') === 's' ? ss[Number(v)] : (c.getAttribute('t') === 'str' || c.getAttribute('t') === 'inlineStr' ? v : (v === '' ? '' : Number(v))); }); return fila; });
    // Encabezado de una fila, o de dos (p. ej. ESPERADO / REAL arriba e INICIO / FIN abajo, como en la plantilla de regenerativo)
    const txt = x => String(x ?? '').trim();
    const esIni = f => (f || []).some(x => /^(fecha )?(de )?(inicio|comienzo)/i.test(txt(x)));
    const iCab = grid.findIndex((f, i) => f.some(x => txt(x).length < 30 && /^(actividad|tarea|descripci|[ií]tem)/i.test(txt(x))) && (esIni(f) || esIni(grid[i + 1])));
    if (iCab < 0) continue;
    let cab, desde = iCab + 1;
    if (esIni(grid[iCab])) cab = grid[iCab].map(x => txt(x).toLowerCase());
    else {
      const arriba = grid[iCab], abajo = grid[iCab + 1], n = Math.max(arriba.length, abajo.length); let grupo = '';
      cab = Array.from({ length: n }, (_, i) => { if (txt(arriba[i])) grupo = txt(arriba[i]); else if (!txt(abajo[i])) grupo = ''; return `${grupo} ${txt(abajo[i])}`.trim().toLowerCase(); });
      desde = iCab + 2;
    }
    const busca = (re, no) => cab.findIndex(x => re.test(x) && !(no && no.test(x)));
    const cN = busca(/actividad|tarea|descripci/), cI = busca(/inicio|comienzo/, /real/), cF = busca(/fin|final|termina|entrega/, /real|inicio/), cD = busca(/d[ií]as|duraci/, /real/),
      cIR = busca(/inicio.*real|real.*inicio/), cFR = busca(/fin.*real|real.*fin/), cA = busca(/avance|progreso|%/), cP = busca(/^peso/), cR = busca(/responsable.*n°|responsable.*n[uú]m|^resp/, /nombre/);
    const tareas = [];
    for (const f of grid.slice(desde)) {
      if (/^total/i.test(txt(f[1] ?? f[0]))) break;
      const nombre = txt(f[cN]), ini = fechaExcel(f[cI]);
      if (!nombre || !ini) continue;
      const fin = cF >= 0 ? fechaExcel(f[cF]) : null;
      const dias = cD >= 0 ? Math.round(Number(f[cD]) || 0) : 0;
      let av = cA >= 0 ? Number(f[cA]) || 0 : null; if (av != null && av > 1) av = av / 100;
      let peso = cP >= 0 && txt(f[cP]) !== '' ? Number(f[cP]) : null; if (peso != null && peso > 1) peso = peso / 100;
      tareas.push({ nombre, inicio_esperado: ini, fin, dias_esperados: dias, inicio_real: cIR >= 0 ? fechaExcel(f[cIR]) : undefined, fin_real: cFR >= 0 ? fechaExcel(f[cFR]) : undefined, avance: av ?? undefined,
        peso_manual: cP >= 0 ? (isNaN(peso) ? null : peso) : undefined, resp_num: cR >= 0 && txt(f[cR]) !== '' ? Number(f[cR]) : (cR >= 0 ? null : undefined) });
    }
    // Responsables (tabla con RESPONSABLE y ROL) y datos generales (INICIO DE OBRA, FIN DE OBRA, DÍAS DE TRABAJO)
    let responsables;
    const iR = grid.findIndex((f, i) => i > iCab && f.some(x => /^responsable$/i.test(txt(x))) && f.some(x => /^rol/i.test(txt(x))));
    if (iR >= 0) {
      const cRn = grid[iR].findIndex(x => /^responsable$/i.test(txt(x))), cRr = grid[iR].findIndex(x => /^rol/i.test(txt(x)));
      responsables = [];
      for (const f of grid.slice(iR + 1)) { if (!f.length || txt(f[cRn - 1]) === '' && txt(f[cRn]) === '') break; if (txt(f[cRn])) responsables.push({ nombre: txt(f[cRn]), cargo: txt(f[cRr]) || null }); }
    }
    const junto = re => { for (const f of grid.slice(0, iCab)) { const i = f.findIndex(x => re.test(txt(x))); if (i >= 0) { const v = f.slice(i + 1, i + 3).find(x => txt(x) !== ''); return v ?? null; } } return undefined; };
    const general = { inicio: junto(/^inicio de obra/i), fin: junto(/^fin de obra/i), dias: junto(/^d[ií]as de trabajo/i) };
    return { tareas, responsables, general, encontrado: true };
  }
  return { tareas: [], encontrado: false };
}
async function programacionExcel(ctx, pintar) {
  // Equipo: ve y edita el Gantt del portal (cada cambio se pasa al Excel). La lectura del Excel la hace administración.
  if (!ctx.admin) { const v = await M.VISTAS.gantt({ ...ctx, alGuardar: () => D.onedrive('gantt_excel', { encargo_id: ctx.e.id }) }); pintar(v.html); if (v.montar) v.montar(); return; }
  pintar('<section class="panel visor" id="visor"><p class="sub">Leyendo el cronograma de la carpeta PROGRAMACIÓN…</p></section><div id="g-web"></div>');
  const el = $('#visor');
  // Cada cambio en el portal se escribe en el Excel antes de volver a pintar (así el Excel y el portal quedan iguales)
  const alGuardar = async () => { const r = await D.onedrive('gantt_excel', { encargo_id: ctx.e.id, crear: true }); if (!r?.archivo) throw new Error('No se pudo escribir en el Excel.'); };
  const pintarGantt = async (cab, nota = '') => {
    const v = await M.VISTAS.gantt({ ...ctx, editarTodo: true, alGuardar });
    el.innerHTML = cab + nota; $('#g-web').innerHTML = v.html; if (v.montar) v.montar();
  };
  let r; try { r = await D.onedrive('visor', { encargo_id: ctx.e.id, modulo: 'gantt' }); } catch (err) { el.innerHTML = `<p class="sub">No se pudo abrir la carpeta: ${esc(msg(err))}</p>`; return; }
  const a = r.archivo && /\.xlsx$/i.test(r.archivo.nombre) ? r.archivo : null;
  if (!a) {
    const cab0 = `<div class="visor-cab"><div><b>Cronograma</b><span class="sub">Todavía no hay Excel del cronograma en ${esc(r.carpeta || 'PROGRAMACIÓN')}. Se crea desde la plantilla de regenerativo al guardar el primer cambio, o con el botón.</span></div><button class="btn sec mini" id="g-crear">Crear Excel</button></div>`;
    await pintarGantt(matchMedia('(max-width: 700px)').matches ? cab0.replace(/<button class="btn sec mini" id="g-crear">Crear Excel<\/button>/, '') : cab0);
    if ($('#g-crear')) $('#g-crear').onclick = async ev => { ev.target.disabled = true; ev.target.textContent = 'Creando…'; try { await alGuardar(); ctx.recargar(); } catch (err) { alert('No se pudo crear el Excel: ' + msg(err)); ev.target.disabled = false; ev.target.textContent = 'Crear Excel'; } };
    return;
  }
  const cab = `<div class="visor-cab"><div><b>${esc(a.nombre.replace(/\.[^.]+$/, ''))}</b><span class="sub">Actualizado ${a.fecha ? fecha(a.fecha.slice(0, 10)) : ''} · lo que cambies aquí o en el Excel queda en los dos</span></div>${a.web ? `<a class="btn sec mini" href="${esc(a.web)}" target="_blank" rel="noopener">Abrir en Excel</a>` : ''}</div>`;
  let x = { tareas: [] };
  try { const f = await D.onedrive('archivo_encargo', { encargo_id: ctx.e.id, carpeta: r.carpeta, ruta: a.ruta }); x = await leerCronograma(f.base64); } catch (_) { x = null; }
  if (!x) return pintarGantt(cab, '<p class="sub">No se pudo leer el Excel; se muestra lo que hay en el portal.</p>');
  if (!x.encontrado) return pintarGantt(cab, '<p class="sub">No encontré en el Excel una tabla con columnas de actividad e inicio; se muestra lo que hay en el portal.</p>');
  const tareas = x.tareas;
  tareas.forEach(t => { if (!t.dias_esperados) t.dias_esperados = Math.max(1, t.fin ? diasDeTrabajo(t.inicio_esperado, t.fin, ctx.e.dias_trabajo, ctx.fest) : 1); delete t.fin; });
  // Datos generales del Excel → encargo (inicio, fin y días de trabajo)
  const g = x.general || {}, cambiosE = {};
  const dias = { 'lunes a viernes': 'lv', 'lunes a sábado': 'ls', 'lunes a sabado': 'ls', 'todos los días': 'todos', 'todos los dias': 'todos' }[String(g.dias ?? '').trim().toLowerCase()];
  for (const k of ['inicio', 'fin']) { const v = g[k] == null ? null : fechaExcel(g[k]); if (g[k] !== undefined && v && v !== ctx.e[k]) cambiosE[k] = v; }
  if (dias && dias !== ctx.e.dias_trabajo) cambiosE.dias_trabajo = dias;
  let cambio = false;
  if (Object.keys(cambiosE).length) { try { await D.actualizarEncargo(ctx.e.id, cambiosE); Object.assign(ctx.e, cambiosE); cambio = true; } catch (_) { /* sigue */ } }
  // Responsables del Excel → encargo
  let resp = ctx.e.responsables || [];
  if (x.responsables) {
    const firmaR = l => l.map(q => `${q.nombre}|${q.cargo || ''}`).join('¦');
    if (firmaR(x.responsables) !== firmaR(resp)) {
      try { await D.guardarResponsables(ctx.e.id, x.responsables); resp = await D.responsablesEncargo(ctx.e.id); ctx.e.responsables = resp; cambio = true; } catch (_) { /* sigue */ }
    }
  }
  // Actividades del Excel → portal (si cambiaron). Lo que el Excel no trae (fechas reales, avance) se conserva del portal.
  const antes = await D.ganttTareas(ctx.e.id).catch(() => []);
  const idResp = n => n == null ? null : (resp.find(q => q.numero === n)?.id || null);
  const filas = tareas.map((t, i) => { const v = antes.find(q => q.nombre === t.nombre) || {}; return { encargo_id: ctx.e.id, orden: i + 1, nombre: t.nombre, inicio_esperado: t.inicio_esperado, dias_esperados: t.dias_esperados,
    inicio_real: t.inicio_real !== undefined ? t.inicio_real : (v.inicio_real || null), fin_real: t.fin_real !== undefined ? t.fin_real : (v.fin_real || null), avance: t.avance !== undefined ? t.avance : (v.avance || 0),
    peso_manual: t.peso_manual !== undefined ? t.peso_manual : (v.peso_manual ?? null), responsable_id: t.resp_num !== undefined ? idResp(t.resp_num) : (v.responsable_id || null),
    presupuesto_actividad_id: v.presupuesto_actividad_id || null, notas: v.notas || null }; });
  const firma = l => l.map(t => [t.nombre, t.inicio_esperado, t.dias_esperados, t.inicio_real || '', t.fin_real || '', Math.round(Number(t.avance || 0) * 1000), t.peso_manual == null ? '' : Math.round(Number(t.peso_manual) * 1000), t.responsable_id || ''].join('|')).join('¦');
  if (firma(antes) !== firma(filas)) {
    try { await D.reemplazarTareas(ctx.e.id, filas); cambio = true; } catch (err) { el.innerHTML = cab + `<p class="sub">No se pudo actualizar el Gantt: ${esc(msg(err))}</p>`; return; }
  }
  await pintarGantt(cab, cambio ? '<p class="sub">Se trajeron al portal los cambios hechos en el Excel.</p>' : '');
}

async function visorDocumento(ctx, modulo, el) {
  el.innerHTML = '<p class="sub">Buscando el documento…</p>';
  let r; try { r = await D.onedrive('visor', { encargo_id: ctx.e.id, modulo }); } catch (err) { el.innerHTML = `<p class="sub">No se pudo abrir el documento: ${esc(msg(err))}</p>`; return false; }
  if (!r.archivo) { el.innerHTML = `<p class="sub">Todavía no hay un documento en la carpeta ${esc(r.carpeta || (modulo === 'gantt' ? 'PROGRAMACIÓN' : 'PRESUPUESTO'))}.</p>`; return false; }
  const a = r.archivo;
  el.innerHTML = `<div class="visor-cab"><div><b>${esc(a.nombre.replace(/\.[^.]+$/, ''))}</b><span class="sub">Actualizado ${a.fecha ? fecha(a.fecha.slice(0, 10)) : ''} · se edita en la carpeta y aquí se ve al día</span></div>${ctx.admin ? `<a class="btn mini sec" href="${esc(a.web)}" target="_blank" rel="noopener">Abrir en OneDrive ↗</a>` : ''}</div>
    ${a.vista ? `<div class="visor-marco"><iframe src="${esc(a.vista)}" title="${esc(a.nombre)}" loading="lazy" allowfullscreen></iframe></div>` : '<p class="sub">La vista previa no está disponible para este archivo.</p>'}`;
  return true;
}

// Fecha del encargo que se cambia en el sitio: clic → calendario → se guarda en el encargo (no en la propuesta)
function fechaEnc(e, campo, vacio, editable) {
  const v = e[campo];
  if (!editable) return v ? fecha(v) : vacio;
  return `<label class="lv-fecha ${v ? '' : 'falta'}" title="${campo === 'inicio' ? 'Fecha de inicio del encargo' : 'Fecha de entrega del encargo'} · clic para cambiarla" onclick="event.stopPropagation()">${v ? fecha(v) : vacio}${ico('editar')}<input type="date" data-efecha="${e.id}" data-campo="${campo}" data-otra="${(campo === 'inicio' ? e.fin : e.inicio) || ''}" value="${v || ''}" aria-label="${campo === 'inicio' ? 'Fecha de inicio' : 'Fecha de entrega'}"></label>`;
}
// Al tocar una fecha (o su lápiz) se abre una ventanita con el calendario visible: funciona igual en iPad, iPhone y computador
document.addEventListener('click', ev => {
  const l = ev.target.closest?.('.lv-fecha'); if (!l) return;
  ev.preventDefault(); ev.stopPropagation();
  const i = l.querySelector('input'); if (!i) return;
  const titulo = i.dataset.fprop ? 'Fecha de envío de la propuesta' : i.dataset.campo === 'inicio' ? 'Fecha de inicio' : 'Fecha de entrega';
  const fondo = document.createElement('div'); fondo.className = 'modal-fondo';
  fondo.innerHTML = `<form class="modal" id="ffecha" style="max-width:460px"><h2>${titulo}</h2>
    <input type="date" name="f" lang="es-CO" value="${esc(i.value || '')}" style="width:100%;font-size:17px;min-height:48px">
    <div class="aviso" id="aviso"></div>
    <div class="pie-modal pie-fecha"><button class="btn" type="submit">Guardar</button><button type="button" class="btn sec" id="cancelar">Cancelar</button>${i.value ? '<button type="button" class="btn sec" id="quitar">Quitar fecha</button>' : ''}</div></form>`;
  document.body.appendChild(fondo);
  const f = $('#ffecha', fondo), campo = $('input[name=f]', fondo);
  setTimeout(() => campo.focus(), 50);
  $('#cancelar', fondo).onclick = () => fondo.remove();
  fondo.addEventListener('click', e2 => { if (e2.target === fondo) fondo.remove(); });
  const guardar = v => { i.value = v; fondo.remove(); i.dispatchEvent(new Event('change', { bubbles: true })); };
  if ($('#quitar', fondo)) $('#quitar', fondo).onclick = () => guardar('');
  f.onsubmit = e2 => { e2.preventDefault(); if (!campo.value) { $('#aviso', fondo).textContent = 'Elige una fecha.'; return; } guardar(campo.value); };
}, true);
document.addEventListener('change', async ev => {
  const i = ev.target; if (!i.matches?.('[data-efecha]')) return;
  const campo = i.dataset.campo, v = i.value || null, otra = i.dataset.otra;
  if (v && otra && (campo === 'inicio' ? v > otra : v < otra)) { alert('La fecha de entrega no puede ser anterior al inicio.'); i.value = ''; return; }
  try { await D.actualizarEncargo(i.dataset.efecha, { [campo]: v }); ir(); } catch (err) { alert(msg(err)); }
});

// Fecha de envío de la propuesta preliminar, editable en el sitio (se guarda en la propuesta, la ven igual equipo y cliente)
const fechaProp = p => { const v = p.fecha_envio || p.fecha; return `<label class="lv-fecha ${v ? '' : 'falta'}" title="Fecha de envío de la propuesta preliminar · clic para cambiarla" onclick="event.stopPropagation()">${v ? fecha(v) : 'Sin fecha'}${ico('editar')}<input type="date" data-fprop="${p.id}" value="${v || ''}" aria-label="Fecha de la propuesta preliminar"></label>`; };
document.addEventListener('change', async ev => {
  const i = ev.target; if (!i.matches?.('[data-fprop]')) return;
  try { await D.actualizarPropuesta(i.dataset.fprop, { fecha_envio: i.value || null }); ir(); } catch (err) { alert(msg(err)); }
});

// Servicios del encargo o la propuesta (puede tener varios)
const servs = x => (x?.servicios?.length ? x.servicios : [x?.servicio?.nombre].filter(Boolean));
const checksServicios = (svc, x) => `<div class="ancho"><label>Servicios</label><div class="lv-checks">${svc.map(s => `<label class="lv-check"><input type="checkbox" name="servicios" value="${esc(s.nombre)}" data-sid="${s.id}" ${servs(x).includes(s.nombre) || (!servs(x).length && x?.servicio_id === s.id) ? 'checked' : ''}><span>${esc(s.nombre)}</span></label>`).join('')}</div></div>`;
function leerServicios(f, v) {
  const ch = [...f.querySelectorAll('input[name=servicios]:checked')];
  v.servicios = ch.map(c => c.value);
  v.servicio_id = ch[0]?.dataset.sid || null;
}

// Anillos que se dibujan (detalle gráfico del bloque About)
function anillos() {
  return `<svg class="anillos" viewBox="0 0 320 320" aria-hidden="true">${[44, 70, 96, 122, 148].map((r, i) => `<circle cx="160" cy="160" r="${r}" pathLength="1" class="an an${i}" style="--i:${i};transform:rotate(${-90 + i * 12}deg)"/>`).join('')}<circle cx="160" cy="160" r="5" class="an-centro"/></svg>`;
}
// Columnas pareadas de ingresos (azul) y gastos (vino) que crecen desde la base
function columnas(datos, alto = 150) {
  const max = Math.max(1, ...datos.flatMap(d => [d.ing, d.gas]));
  const ult = datos.length - 1;
  return `<div class="lv-cols-c"><div class="lv-cols-ley"><span class="lv-cols-info" data-info>${datos[ult].mes} · <b class="ing">+ ${cop(datos[ult].ing)}</b> <b class="gas">− ${cop(datos[ult].gas)}</b></span><span class="lv-ley"><i class="ing"></i>Ingresos</span><span class="lv-ley"><i class="gas"></i>Gastos</span></div>
    <div class="lv-cols" style="height:${alto}px">${datos.map((d, i) => `<button type="button" class="lv-col ${i === ult ? 'sel' : ''}" data-mes="${d.mes}" data-ing="${d.ing}" data-gas="${d.gas}" aria-label="${d.mes}: ingresos ${cop(d.ing)}, gastos ${cop(d.gas)}"><span class="lv-col-b"><i class="ing" style="height:${d.ing / max * 100}%;--i:${i}"></i><i class="gas" style="height:${d.gas / max * 100}%;--i:${i}"></i></span><span class="lv-col-m">${d.mes}</span></button>`).join('')}</div></div>`;
}
document.addEventListener('pointerover', ev => {
  const c = ev.target.closest?.('.lv-col'); if (!c) return;
  const caja = c.closest('.lv-cols-c'); caja.querySelectorAll('.lv-col').forEach(x => x.classList.toggle('sel', x === c));
  caja.querySelector('[data-info]').innerHTML = `${c.dataset.mes} · <b class="ing">+ ${cop(+c.dataset.ing)}</b> <b class="gas">− ${cop(+c.dataset.gas)}</b>`;
});

async function vistaEncargos(s) {
  const lista = await D.encargos();
  const admin = s.admin;
  if (!admin && lista.length === 1) { location.replace(`#/${D.slugEncargo(lista[0])}`); return; }
  const fest = new Set((await D.festivos()).map(f => f.fecha));
  const abiertos = admin ? await D.comentariosAbiertos() : [];
  const conTiempo = lista.map(e => ({ ...e, tiempo: tiempoTranscurrido(e, fest), dudas: abiertos.filter(c => c.encargo?.id === e.id).length }));
  const fase = faseEncargo;
  const F = [['todos', 'Todos'], ['por-iniciar', 'Por iniciar'], ['en-curso', 'En curso'], ['pausado', 'Pausados'], ['finalizado', 'Finalizados'], ['cerrado', 'Cancelados']]
    .map(([k, l]) => [k, l, k === 'todos' ? lista.length : conTiempo.filter(e => fase(e) === k).length]).filter(([k, , n]) => k === 'todos' || n);
  let filtro = 'todos';
  const html = `
    <div class="lv-filtros"><div class="lv-seg" id="seg">${F.map(([k, l, n]) => `<button type="button" data-f="${k}" class="${k === filtro ? 'activo' : ''}">${l}<i>${n}</i></button>`).join('')}</div>
      <label class="lv-buscar"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg><input id="buscar" placeholder="Buscar" aria-label="Buscar encargo"></label></div>
    <div id="tabla"></div>`;
  marco(s, { titulo: 'Encargos', ruta: 'Portal', activo: 'encargos', html, eyebrow: `${lista.length} encargo${lista.length === 1 ? '' : 's'}`,
    acciones: admin ? '<button class="btn" id="nuevo"><span class="mas">+</span> Nuevo encargo</button>' : '' });
  const ini = n => (n || '').split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase();
  const chip = e => { const f = fase(e); return `<span class="lv-chip ${f}"><i></i>${ESTADOS_ENCARGO[e.estado] || 'Por iniciar'}</span>`; };
  const pintar = () => {
    const q = $('#buscar').value.toLowerCase();
    const f = conTiempo.filter(e => (filtro === 'todos' || fase(e) === filtro) &&
      (!q || [e.nombre, e.codigo, e.cliente?.nombre].join(' ').toLowerCase().includes(q)));
    // Encargos agrupados por año, del más reciente al más viejo (año del nombre «26  I …», o del código SCREG_26…)
    const anioDe = e => { const m = (e.nombre || '').match(/^\s*(\d{2})\s+I\s/) || (e.codigo || '').match(/^[A-Z]+_(\d{2})/); return m ? 2000 + Number(m[1]) : Number((e.inicio || '').slice(0, 4)) || 0; };
    const anios = [...new Set(f.map(anioDe))].sort((a, b) => b - a);
    const tarjeta = (e, i) => {
      const t = Math.round((e.tiempo || 0) * 100), lugar = e.cliente?.ciudad || e.ciudad || '';
      const cov = [1, 2, 3, 5, 6, 7][[...String(e.id || e.nombre)].reduce((a, c) => a + c.charCodeAt(0), 0) % 6];
      return `<a class="lv-card lv-enc ${semaforo(e)}" href="#/${D.slugEncargo(e)}" style="--i:${i}">
        <div class="lv-enc-cov" aria-hidden="true"><img src="/assets/burbuja-b${cov}-max.webp" alt="" loading="lazy" decoding="async"></div>
        <div class="lv-enc-cab">${chip(e)}${e.dudas ? `<span class="lv-chip duda" title="Comentarios del cliente sin resolver"><i></i>${e.dudas} sin resolver</span>` : ''}<span class="lv-ir" aria-hidden="true"><span class="lv-ir-a"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.5 16.5 16.5 7.5M10 7.5h6.5V14"/></svg></span><span class="lv-ir-b"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.5 16.5 16.5 7.5M10 7.5h6.5V14"/></svg></span></span></div>
        <h2>${esc(e.nombre)}</h2>
        <p class="lv-enc-sub">${lugar ? esc(lugar) + ' · ' : ''}<span class="lv-fe-et">Inicio</span> ${e.inicio ? fecha(e.inicio) : 'Sin fecha'}</p>
        <div class="lv-enc-av"><span>${servs(e).map(esc).join(' · ') || 'Tiempo'}</span><b>${fase(e) === 'por-iniciar' ? '—' : e.tiempo == null ? '' : t + '%'}</b></div>
        <span class="lv-pill grande"><i style="width:${fase(e) === 'por-iniciar' ? 0 : e.tiempo == null ? 8 : t}%"></i></span>
        <div class="lv-enc-pie"><span class="lv-ava" title="${esc(e.cliente?.nombre || '')}">${ini(e.cliente?.nombre) || '·'}</span><span class="lv-enc-cli">${esc(e.cliente?.nombre || 'Sin cliente')}</span>
          <span class="lv-enc-fin"><small>Entrega</small>${e.fin ? fecha(e.fin) : 'Sin fecha'}</span>
          ${admin && webCarpeta(e) ? `<span class="lv-od" data-od="${esc(webCarpeta(e))}" title="Abrir folder en OneDrive">${ico('carpeta')}</span>` : ''}</div>
      </a>`; };
    let n = 0;
    $('#tabla').innerHTML = f.length ? anios.map(y => { const l = f.filter(e => anioDe(e) === y);
      return `<section class="enc-anio"><div class="enc-anio-cab"><h2>${y || 'Sin año'}</h2><span>${l.length} encargo${l.length === 1 ? '' : 's'}</span></div>
        <div class="lv-enc-grid">${l.map(e => tarjeta(e, n++)).join('')}</div></section>`; }).join('')
      : `<div class="vacio">${lista.length ? 'Ningún encargo coincide.' : 'Todavía no hay encargos.'}</div>`;
    document.querySelectorAll('[data-od]').forEach(x => x.onclick = ev => { ev.preventDefault(); ev.stopPropagation(); window.open(x.dataset.od, '_blank', 'noopener'); });
  };
  document.querySelectorAll('#seg button').forEach(b => b.onclick = () => { filtro = b.dataset.f; document.querySelectorAll('#seg button').forEach(x => x.classList.toggle('activo', x === b)); pintar(); });
  $('#buscar').oninput = pintar; pintar();
  if (admin) $('#nuevo').onclick = () => modalDesdeCotizacion();
}

// Semáforo del tiempo: rojo si ya pasó la fecha de fin y sigue activo, amarillo al pasar el 85 %
function semaforo(e) {
  if (e.estado !== 'activo' || !e.fin) return '';
  if (e.fin < new Date().toISOString().slice(0, 10)) return 'sem-rojo';
  return (e.tiempo || 0) >= 0.85 ? 'sem-amarillo' : 'sem-verde';
}
function kpi(et, va, su, barra) {
  return `<div class="kpi"><div class="et">${et}</div><div class="va">${va}</div><div class="su">${su || ''}</div>${barra !== undefined ? `<div class="barra"><i style="width:${Math.round(barra * 100)}%"></i></div>` : ''}</div>`;
}

function tiempoTranscurrido(e, fest) {
  if (!e.inicio || !e.fin) return null;
  const total = diasDeTrabajo(e.inicio, e.fin, e.dias_trabajo, fest);
  if (!total) return null;
  const corte = fechaCorte(e.fecha_corte);
  const fin = new Date(Math.min(corte, new Date(e.fin + 'T00:00:00')));
  return Math.min(1, Math.max(0, diasDeTrabajo(e.inicio, fin, e.dias_trabajo, fest) / total));
}

// ---------------- Nuevo encargo: siempre nace de una cotización existente ----------------
async function despegarYAbrir(p) {
  const codigo = await D.despegarPropuesta(p.id);
  const e = await D.encargo(codigo);
  if (!D.MODO_DEMO) {
    try { const r2 = await D.onedrive('despegar', { encargo_id: e.id }); alert(`Encargo creado.\nCarpeta en OneDrive: ${r2.carpeta} (estructura REG_TEM DOCUMENTAL)${r2.legales?.length ? '\nCopia en LEGALES/00 PROPUESTA: ' + r2.legales.join(', ') : ''}${r2.enviados?.carpeta ? '\nCopia para el cliente en ' + r2.enviados.carpeta + (r2.enviados.archivo ? ': ' + r2.enviados.archivo : '') : ''}`); }
    catch (e2) { alert('El encargo se creó, pero no se pudo crear la carpeta en OneDrive: ' + msg(e2)); }
  }
  location.hash = `#/${e ? D.slugEncargo(e) : codigo}`;
  return e;
}

async function modalDesdeCotizacion() {
  const lista = (await D.propuestas()).filter(p => !p.encargo_id && p.estado !== 'no_despego');
  const fondo = document.createElement('div');
  fondo.className = 'modal-fondo';
  fondo.innerHTML = `<form class="modal" id="fc">
    <h2>Nuevo encargo</h2>
    <p class="sub">Elige la propuesta que el cliente aceptó. El encargo se crea con su código de proyecto, toda su información y su carpeta en OneDrive.</p>
    ${lista.length ? `
    <label for="cot">Propuesta</label>
    <select id="cot" required><option value="">— Elegir propuesta —</option>
      ${lista.map(p => `<option value="${p.id}">${esc(p.codigo)} · ${esc(p.nombre)}${p.cliente ? ' · ' + esc(p.cliente.nombre) : ''}</option>`).join('')}
    </select>
    <dl class="datos" id="vista" style="margin-top:18px"></dl>` :
    `<div class="vacio">No hay propuestas pendientes. Primero crea la propuesta en <a href="#/propuestas">Propuestas preliminares</a>.</div>`}
    <div class="aviso" id="aviso"></div>
    <div class="pie-modal"><button type="button" class="btn sec" id="cancelar">Cancelar</button>${lista.length ? '<button class="btn" type="submit">Crear encargo</button>' : ''}</div>
  </form>`;
  document.body.appendChild(fondo);
  $('#cancelar', fondo).onclick = () => fondo.remove();
  fondo.querySelectorAll('a').forEach(a => a.addEventListener('click', () => fondo.remove()));
  if (!lista.length) return;
  const sel = $('#cot', fondo);
  sel.onchange = () => {
    const p = lista.find(x => x.id === sel.value);
    $('#vista', fondo).innerHTML = p ? `
      <dt>Código de proyecto</dt><dd>${esc(p.codigo.slice(6, 8))}  I  ${esc(p.nombre.toUpperCase())}</dd><dt>Código</dt><dd>${esc(p.codigo)}</dd>
      <dt>Cliente</dt><dd>${xxx(p.cliente?.nombre)}</dd>
      <dt>Servicios</dt><dd>${servs(p).map(esc).join(' · ') || '—'}</dd>
      <dt>Honorarios</dt><dd>${p.honorarios ? cop(p.honorarios) : '—'}</dd>` : '';
  };
  $('#fc', fondo).onsubmit = async ev => {
    ev.preventDefault();
    const p = lista.find(x => x.id === sel.value);
    if (!p) return;
    try { const btn = $('button[type=submit]', fondo); btn.disabled = true; await despegarYAbrir(p); fondo.remove(); ir(); }
    catch (err) { $('#aviso', fondo).textContent = msg(err); $('button[type=submit]', fondo).disabled = false; }
  };
}

// ---------------- Formulario de encargo ----------------
async function modalEncargo(e = null) {
  const [svc, cli] = await Promise.all([D.servicios(), D.clientes()]);
  const codigo = e?.codigo || await D.siguienteCodigo();
  const op = (lista, sel) => lista.map(x => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('');
  const opMap = (m, sel) => Object.entries(m).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${v}</option>`).join('');
  const fondo = document.createElement('div');
  fondo.className = 'modal-fondo';
  fondo.innerHTML = `<form class="modal" id="fe">
    <h2>${e ? 'Datos generales del encargo' : 'Nuevo encargo'}</h2>
    <p class="sub">Se escriben una sola vez y se usan en todos los documentos del encargo.</p>
    <div class="grilla-form">
      <div><label>Código</label><input name="codigo" value="${esc(codigo)}" required ${e ? 'readonly' : ''}></div>
      <div><label>Nombre del encargo</label><input name="nombre" value="${esc(e?.nombre || '')}" placeholder="20  I  PROYECTO" required></div>
      <div><label>Cliente</label><select name="cliente_id"><option value="">— Elegir —</option>${op(cli, e?.cliente_id)}<option value="__nuevo">+ Nuevo cliente…</option></select></div>
      ${checksServicios(svc, e)}
      <input type="hidden" name="tipo" value="${e?.tipo || 'ambos'}">
      <div><label>Etapa</label><select name="estado">${Object.entries(ESTADOS_ENCARGO).map(([k, l]) => `<option value="${k}" ${k === (e?.estado || 'por_iniciar') ? 'selected' : ''}>${l} · ${AYUDA_ESTADOS[k]}</option>`).join('')}</select></div>
      <div><label>Alcance</label><span class="alcance alcance-modal"><label class="lv-check"><input type="checkbox" name="tiene_diseno" ${e?.tiene_diseno !== false ? 'checked' : ''}> Diseño</label><label class="lv-check"><input type="checkbox" name="tiene_obra" ${e?.tiene_obra ? 'checked' : ''}> Obra</label></span></div>
      <div class="ancho"><label>Dirección</label><input name="direccion" value="${esc(e?.direccion || '')}"></div>
      <div><label>Ciudad</label><input name="ciudad" value="${esc(e?.ciudad || 'Bogotá')}"></div>
      <div><label>Área m²</label><input name="area_m2" type="number" step="0.01" value="${e?.area_m2 ?? ''}"></div>
      <div><label>Inicio</label><input name="inicio" type="date" value="${e?.inicio || ''}"></div>
      <div><label>Fin</label><input name="fin" type="date" value="${e?.fin || ''}"></div>
      <div><label>Días de trabajo</label><select name="dias_trabajo">${opMap(DIAS_TRABAJO, e?.dias_trabajo || 'lv')}</select></div>
      <div><label>Fecha de corte (vacía = hoy)</label><input name="fecha_corte" type="date" value="${e?.fecha_corte || ''}"></div>
    </div>
    <div class="aviso" id="aviso"></div>
    <div class="pie-modal"><button type="button" class="btn sec" id="cancelar">Cancelar</button><button class="btn" type="submit">Guardar</button></div>
  </form>`;
  document.body.appendChild(fondo);
  const f = $('#fe', fondo);
  $('#cancelar', fondo).onclick = () => fondo.remove();
  f.cliente_id.onchange = async () => {
    if (f.cliente_id.value !== '__nuevo') return;
    const nombre = await preguntar('Nombre o razón social del cliente', { ok: 'Crear cliente' });
    if (!nombre) { f.cliente_id.value = ''; return; }
    const c = await D.crearCliente({ tipo: 'empresa', nombre: nombre.trim() });
    f.cliente_id.insertAdjacentHTML('afterbegin', `<option value="${c.id}">${esc(c.nombre)}</option>`);
    f.cliente_id.value = c.id;
  };
  f.onsubmit = async ev => {
    ev.preventDefault();
    const v = Object.fromEntries(new FormData(f)); leerServicios(f, v);
    v.tiene_diseno = f.tiene_diseno.checked; v.tiene_obra = f.tiene_obra.checked;
    for (const k of ['area_m2', 'inicio', 'fin', 'fecha_corte', 'cliente_id']) if (v[k] === '') v[k] = null;
    if (v.estado === 'activo' && !v.inicio) v.inicio = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });  // En curso sin fecha: empieza hoy
    if (v.area_m2 !== null) v.area_m2 = Number(v.area_m2);
    if (v.inicio && v.fin && v.fin < v.inicio) { $('#aviso', fondo).textContent = 'La fecha de fin no puede ser anterior al inicio.'; return; }
    try {
      if (e) { delete v.codigo; await D.actualizarEncargo(e.id, v); }
      else await D.crearEncargo(v);
      fondo.remove();
      location.hash = `#/${e ? D.slugEncargo(e) : encodeURIComponent(v.codigo)}`;
      ir();
    } catch (err) { $('#aviso', fondo).textContent = msg(err); }
  };
}

// ---------------- Expediente del encargo ----------------
// Módulos del encargo. Cada módulo junta lo del portal (web) y su carpeta de OneDrive.
// Menú del encargo según la gestión documental (REG_TEM DOCUMENTAL): Legales reúne propuesta, contratos, adendas, actas, cobros y facturación
const MODULOS = [
  ['resumen', 'Resumen'], ['carpetas', 'Folder'], ['legales', 'Legales'], ['propuesta', 'Propuesta preliminar'],
  ['contrato', 'Contrato'], ['adendas', 'Adendas'],
  ['finanzas', 'Finanzas'], ['presupuesto', 'Presupuesto'], ['gantt', 'Programación'],
  ['informes', 'Coordinación administrativa'], ['tecnica', 'Coordinación técnica'], ['obra', 'Coordinación de obra'], ['enviados', 'Enviados'], ['recibidos', 'Recibidos'],
  ['correos', 'Correos'], ['comentarios', 'Comentarios'], ['resena', 'Reseña del proyecto'],
];
// Carpetas de OneDrive de cada módulo (plantilla REG_TEM DOCUMENTAL y, como respaldo, los nombres viejos).
// Cada grupo usa la primera carpeta que exista. "RUTA#0" = solo los archivos sueltos de esa carpeta.
const FUENTES = {
  legales: [['LEGALES/00 PROPUESTA', 'LEGALES/PROP _ ECONOMICAS'], ['LEGALES/01 CONTRATOS', 'LEGALES/OPS CONTRATOS'], ['LEGALES/02 ADENDAS', 'LEGALES#0'],
    ['LEGALES/03 ACTAS DE ENTREGA', 'LEGALES/04 ACTAS DE ENTREGA'], ['LEGALES/04 CUENTAS DE COBRO', 'LEGALES/05 CUENTAS DE COBRO', 'LEGALES/CUENTAS DE COBRO'], ['LEGALES/05 FACTURACION']],
  propuesta: [['LEGALES/00 PROPUESTA', 'LEGALES/PROP _ ECONOMICAS']],
  contrato: [['LEGALES/01 CONTRATOS', 'LEGALES/OPS CONTRATOS'], ['LEGALES/03 OTRO SI']],
  adendas: [['LEGALES/02 ADENDAS', 'LEGALES#0']],
  finanzas: [['LEGALES/04 CUENTAS DE COBRO', 'LEGALES/05 CUENTAS DE COBRO', 'LEGALES/CUENTAS DE COBRO']],
  presupuesto: [['PRESUPUESTO']],
  gantt: [['PROGRAMACIÓN', 'PROGRAMACION']],
  informes: [['COOR _ ADMIN', 'COORDINACION _ ADMINISTRATIVA']],
  tecnica: [['COOR _ TÉCNICA', 'COORDINACION _ TECNICA']],
  obra: [['COOR _ OBRA', 'COORDINACION _ OBRA']],
  enviados: [['DOC _ ENV', 'DOC _ ENVIADOS']],
  recibidos: [['DOC _ REC', 'DOC _ RECIBIDOS']],
};
const SIN_CONTEO = ['resumen', 'carpetas', 'ajustes', 'resena'];
const NO_DOC = ['comentarios', 'enviados'];
const CONTEO_TTL = 10 * 60 * 1000;
const conteoGuardado = id => { try { const c = JSON.parse(sessionStorage.getItem('reg-conteo-' + id)); if (c && Date.now() - c.t < CONTEO_TTL) return c.c; } catch (_) {} return null; };
const guardarConteo = (id, c) => { try { sessionStorage.setItem('reg-conteo-' + id, JSON.stringify({ t: Date.now(), c })); } catch (_) {} };
const ODWEB = 'https://netorgft18456367-my.sharepoint.com/personal/apardo_regenerativo_co/Documents/';
const webCarpeta = e => e.onedrive_carpeta ? ODWEB + e.onedrive_carpeta.split('/').map(encodeURIComponent).join('/') : '';

/** Valor del encargo: valor base (editable en el portal; si no, honorarios de la propuesta) + adicionales (adendas aprobadas y adicionales registrados a mano). */
function valorEncargo(prop, docs, e = {}, adics = []) {
  const aprob = d => ['aprobado', 'firmado'].includes(d.estado);
  const pw = docs.filter(d => d.tipo === 'propuesta' && aprob(d)).at(-1);
  const base = e.valor_base != null ? Number(e.valor_base) : Number(prop?.honorarios) || Number(pw?.contenido?.honorarios) || 0;
  const doc = docs.filter(d => d.tipo === 'adenda' && aprob(d)).sort((a, b) => a.numero - b.numero)
    .map(d => ({ valor: Number(d.contenido?.valor) || 0, nombre: d.contenido?.tipo || d.contenido?.descripcion || '', fecha: d.fecha || '' }));
  const man = adics.map(a => ({ id: a.id, valor: Number(a.valor) || 0, nombre: a.descripcion || '', fecha: a.fecha || '' }));
  const adic = [...doc, ...man].map((a, i) => ({ ...a, numero: i + 1 }));
  const sumaAdic = adic.reduce((s, a) => s + a.valor, 0);
  return { base, adic, sumaAdic, total: base + sumaAdic };
}

const numCOP = v => Number(String(v || '').replace(/\D/g, '')) || 0;
const fmtCOP = n => n ? Number(n).toLocaleString('es-CO').replace(/,/g, '.') : '';

/** Valor, adicionales e ingresos del encargo, editables a mano en el portal (sin depender de documentos). */
window.regModalValores = (...a) => modalValores(...a);
async function modalValores(e, prop, onListo) {
  const [docs, cats, encs] = await Promise.all([D.docsEncargo(e.id).catch(() => []), D.finCategorias().catch(() => []), D.encargos().catch(() => [e])]);
  let adics = await D.adicionalesEncargo(e.id).catch(() => []);
  let movs = await D.finMovimientosEncargo(e.id).catch(() => []);
  const fondo = document.createElement('div'); fondo.className = 'modal-fondo';
  const pintarM = () => {
    const v = valorEncargo(prop, docs, e, adics);
    const ingresos = movs.filter(m => m.tipo === 'ingreso' && (m.estado || 'confirmado') === 'confirmado');
    const rec = ingresos.reduce((a, m) => a + Number(m.valor), 0);
    const docAd = v.adic.filter(a => !a.id);
    fondo.innerHTML = `<div class="modal ancho modal-valores">
      <h2>Valor del encargo</h2><p class="sub">${esc(e.nombre)} · todo se edita aquí, sin cargar documentos.</p>
      <h3>Valor base</h3>
      <form class="mv-fila" id="f-base"><input name="base" inputmode="numeric" placeholder="Valor del encargo en COP" value="${v.base ? fmtCOP(v.base) : (e.valor_base != null && Number(e.valor_base) === 0) || (prop?.honorarios != null && Number(prop.honorarios) === 0) ? '0' : ''}"><span class="sub">COP</span><button class="btn sec">Guardar</button></form>
      <p class="sub mv-nota">${prop?.id ? 'Se guarda también como honorarios de la propuesta preliminar.' : 'Este encargo no tiene propuesta: el valor queda guardado en el encargo.'}</p>
      <h3>Adicionales</h3>
      <div class="mv-lista">
        ${docAd.map(a => `<div class="mv-item"><span><b>${esc(a.nombre || 'Adenda')}</b><small>Adenda aprobada (documento)</small></span><b class="num">+ ${cop(a.valor)}</b><span></span></div>`).join('')}
        ${adics.map(a => `<form class="mv-item ed" data-ad="${a.id}"><input name="descripcion" value="${esc(a.descripcion)}" required><input name="fecha" type="date" value="${a.fecha || ''}"><input name="valor" inputmode="numeric" value="${fmtCOP(a.valor)}" required class="num"><span class="mv-acc"><button class="btn mini sec" title="Guardar">Guardar</button><button type="button" class="btn mini sec peligro" data-borrar-ad="${a.id}" title="Borrar">Borrar</button></span></form>`).join('')}
        <form class="mv-item ed nuevo" id="f-ad"><input name="descripcion" placeholder="Nuevo adicional (p. ej. Ajuste de área)" required><input name="fecha" type="date" value="${new Date().toISOString().slice(0, 10)}"><input name="valor" inputmode="numeric" placeholder="Valor COP" required class="num"><span class="mv-acc"><button class="btn mini"><span class="mas">+</span> Agregar</button></span></form>
      </div>
      <h3>Ingresos recibidos</h3>
      <div class="mv-lista">
        ${ingresos.map(m => `<button type="button" class="mv-item clic" data-mov="${m.id}"><span><b>${esc(m.descripcion || m.categoria?.nombre || 'Ingreso')}</b><small>${fecha(m.fecha)}${m.medio ? ' · ' + esc(m.medio) : ''}</small></span><b class="num">${cop(m.valor)}</b><span class="mv-ed">${ico('editar')}</span></button>`).join('') || '<p class="sub">Todavía no hay ingresos registrados para este encargo.</p>'}
        <div class="mv-pie"><button type="button" class="btn mini" id="nuevo-ing"><span class="mas">+</span> Ingreso</button></div>
      </div>
      <ul class="leyenda-valor mv-resumen"><li>Valor total<b>${cop(v.total)}</b></li><li>Recibido<b>${cop(rec)}</b></li><li class="total">Por cobrar<b>${rec >= v.total && v.total > 0 ? cop(0) : e.pagado_total ? 'Saldado a mano' : cop(Math.max(0, v.total - rec))}</b></li></ul>
      <div class="aviso" id="mv-aviso"></div>
      <div class="pie-modal"><button type="button" class="btn" id="mv-cerrar">Listo</button></div>
    </div>`;
    const avisar = t => { $('#mv-aviso', fondo).textContent = t; };
    $('#f-base', fondo).onsubmit = async ev => {
      ev.preventDefault(); const crudo = ev.target.base.value.trim(); const n = crudo === '' ? null : numCOP(crudo);  // «0» es proyecto sin costo; vacío borra el valor
      try {
        if (prop?.id) { await D.actualizarPropuesta(prop.id, { honorarios: n }); prop.honorarios = n; if (e.valor_base != null) { await D.actualizarEncargo(e.id, { valor_base: null }); e.valor_base = null; } }
        else { await D.actualizarEncargo(e.id, { valor_base: n }); e.valor_base = n; }
        pintarM();
      } catch (err) { avisar(msg(err)); }
    };
    const leerAd = f => ({ encargo_id: e.id, descripcion: f.descripcion.value.trim(), fecha: f.fecha.value || null, valor: numCOP(f.valor.value) });
    $('#f-ad', fondo).onsubmit = async ev => { ev.preventDefault(); const a = leerAd(ev.target); if (!a.valor) return avisar('Escribe el valor del adicional.');
      try { await D.guardarAdicional(a); adics = await D.adicionalesEncargo(e.id); pintarM(); } catch (err) { avisar(msg(err)); } };
    fondo.querySelectorAll('[data-ad]').forEach(f => f.onsubmit = async ev => { ev.preventDefault();
      try { await D.guardarAdicional({ ...leerAd(f), id: f.dataset.ad }); adics = await D.adicionalesEncargo(e.id); pintarM(); } catch (err) { avisar(msg(err)); } });
    fondo.querySelectorAll('[data-borrar-ad]').forEach(b => b.onclick = async () => { if (!await confirmar('¿Borrar este adicional?', { ok: 'Borrar', peligro: true })) return;
      try { await D.borrarAdicional(b.dataset.borrarAd); adics = await D.adicionalesEncargo(e.id); pintarM(); } catch (err) { avisar(msg(err)); } });
    const recargarMovs = async () => { movs = await D.finMovimientosEncargo(e.id).catch(() => movs); document.body.appendChild(fondo); pintarM(); };
    fondo.querySelectorAll('[data-mov]').forEach(b => b.onclick = () => { fondo.remove(); modalMov(movs.find(m => m.id === b.dataset.mov), cats, encs, recargarMovs, () => document.body.appendChild(fondo)); });
    $('#nuevo-ing', fondo).onclick = () => { fondo.remove(); modalMov({ tipo: 'ingreso', fecha: new Date().toISOString().slice(0, 10), encargo_id: e.id }, cats, encs, recargarMovs, () => document.body.appendChild(fondo)); };
    $('#mv-cerrar', fondo).onclick = () => { fondo.remove(); onListo?.(); };
  };
  fondo.onclick = ev => { if (ev.target === fondo) { fondo.remove(); onListo?.(); } };
  pintarM(); document.body.appendChild(fondo);
}

async function vistaExpediente(s, codigo, seccion, sub) {
  const e = await D.encargo(codigo);
  if (!e) return marco(s, { titulo: 'Encargo no encontrado', html: `<div class="vacio">No existe el encargo ${esc(codigo)} o no tienes acceso. <a href="#/">Volver</a></div>` });
  const admin = s.admin;
  const base = `#/${D.slugEncargo(e)}`;
  const rol = admin ? 'admin' : await D.miRol(e.id);
  const esCliente = rol === 'cliente';
  const fest = new Set((await D.festivos()).map(f => f.fecha));
  const [docs, tareas, pres, movs, prop, coms] = await Promise.all([
    D.docsEncargo(e.id).catch(() => []), D.ganttTareas(e.id).catch(() => []), D.hayPresupuesto(e.id).catch(() => 0),
    s.facturacion ? D.finMovimientosEncargo(e.id).catch(() => []) : [], D.propuestaDeEncargo(e.id), D.comentarios(e.id).catch(() => [])]);
  const correos = await D.correosEncargo(e.id).catch(() => []);
  const adics = await D.adicionalesEncargo(e.id).catch(() => []);
  const pagos = esCliente ? await D.pagosEncargo(e.id).catch(() => []) : [];
  const movsOk = movs.filter(x => (x.estado || 'confirmado') === 'confirmado');
  const nTipo = t => docs.filter(d => d.tipo === t && (!esCliente || d.estado !== 'borrador')).length;
  const web = { propuesta: nTipo('propuesta'), contrato: nTipo('contrato'), adendas: nTipo('adenda'), informes: nTipo('informe'), presupuesto: pres, gantt: tareas.length, finanzas: movsOk.length, comentarios: coms.filter(c => c.estado === 'abierto').length, correos: correos.length };
  let od = admin ? (conteoGuardado(e.id) || {}) : {};
  const n = k => (web[k] || 0) + (od[k] || 0);
  const visible = k => {
    if (k === 'resumen' || k === 'comentarios') return true;
    if (!e.tiene_obra && (k === 'presupuesto' || k === 'obra')) return false;
    if (e.tiene_diseno === false && k === 'tecnica') return false;
    if (k === 'resena') return esCliente;
    if (k === 'enviados' && esCliente) return true;
    if (k === 'recibidos' && esCliente) return false;
    if (k === 'ajustes' || k === 'carpetas' || k === 'legales' || k === 'obra' || k === 'tecnica') return admin;
    if (k === 'finanzas') return s.facturacion;
    if (['contrato', 'adendas'].includes(k)) return false;
    if (k === 'propuesta') return esCliente && web[k] > 0;
    if (k === 'gantt' && esCliente) return true;   // el cliente siempre ve Programación (si no hay cronograma, se le dice)
    if (k === 'presupuesto' || k === 'gantt') return admin || web[k] > 0 || (od[k] || 0) > 0;
    return admin || web[k] > 0;
  };
  const pintaMenu = () => MODULOS.filter(([k]) => visible(k)).map(([k, nom]) => {
    if (esCliente && k === 'enviados') nom = 'Documentos';
    const c = SIN_CONTEO.includes(k) || (esCliente && k === 'enviados') ? null : n(k);
    if (admin && c === 0 && k !== seccion && k !== 'comentarios') return '';
    return `<a href="${k === 'resumen' ? base : base + '/' + k}" class="${k === seccion ? 'activo' : ''} ${c === 0 ? 'mod-vacio' : ''}">${icoMenu(k)}<span>${nom}</span>${c ? `<span class="cuenta">${c}</span>` : ''}</a>`;
  }).join('');
  const tiles = () => {
    const l = MODULOS.filter(([k]) => visible(k) && !SIN_CONTEO.includes(k) && k !== 'comentarios' && n(k) > 0);
    return l.length ? l.map(([k, nom]) => `<a class="tile" href="${base}/${k}"><b>${n(k)}</b><span>${nom}</span></a>`).join('') : '<p class="sub">Todavía no hay documentos en los módulos.</p>';
  };
  const nombreSec = esCliente && seccion === 'enviados' ? 'Documentos' : (MODULOS.find(m => m[0] === seccion) || [, 'Resumen'])[1];
  const encMarco = { nombre: e.nombre, href: base, volver: !esCliente };
  const pintar = (html, acciones = engranaje) => {
    marco(s, { titulo: esc(e.nombre), h1: seccion === 'resumen' ? esc(e.nombre) : nombreSec, menu: `<div id="menu-enc">${pintaMenu()}</div>`, enc: encMarco, html, acciones, eyebrow: seccion === 'resumen' ? ([e.cliente?.nombre, ...servs(e)].filter(Boolean).join(' · ') || 'Encargo') : e.nombre, bajada: seccion === 'resumen' ? [e.cliente?.nombre, e.servicio?.nombre].filter(Boolean).map(esc).join(' · ') : esc(e.nombre) });
    const bg = $('#ajustes-enc'); if (bg) bg.onclick = () => modalAjustesEncargo(e, prop);
    if (admin && !D.MODO_DEMO && !conteoGuardado(e.id)) {
      D.onedrive('conteos_encargo', { encargo_id: e.id, modulos: FUENTES }).then(c => {
        guardarConteo(e.id, c);
        if (JSON.stringify(c) === JSON.stringify(od)) return;
        od = c; const m = $('#menu-enc'); if (m) m.innerHTML = pintaMenu(); const t = $('#tiles'); if (t) t.innerHTML = tiles();
      }).catch(() => {});
    }
  };
  const abrirAjustes = seccion === 'ajustes' && admin;
  if (seccion === 'ajustes') { seccion = 'resumen'; history.replaceState(null, '', base); }
  const ctx = { e, s, admin, rol, esCliente, fest, base, sub, recargar: ir };
  const engranaje = admin && seccion === 'resumen' ? btnIco('ajustes', 'Ajustes del encargo', 'id="ajustes-enc"') : '';   // solo en el Resumen
  const valor = valorEncargo(prop, docs, e, adics);

  if (seccion === 'resumen') {
    const t = tiempoTranscurrido(e, fest);
    const total = e.inicio && e.fin ? diasDeTrabajo(e.inicio, e.fin, e.dias_trabajo, fest) : null;
    const hechos = e.inicio ? diasDeTrabajo(e.inicio, fechaCorte(e.fecha_corte), e.dias_trabajo, fest) : 0;
    const g = tareas.length ? await M.datosGantt(ctx).catch(() => null) : null;
    const rec = movsOk.filter(x => x.tipo === 'ingreso').reduce((a, x) => a + Number(x.valor), 0);
    const V = valor.total;
    // Proyecto propio: valor 0 escrito en el encargo o en la propuesta (0 no es «sin valor»)
    const sinCosto = !V && ((e.valor_base != null && e.valor_base !== '' && Number(e.valor_base) === 0) || (prop?.honorarios != null && prop.honorarios !== '' && Number(prop.honorarios) === 0));
    const seg = (v, c, tip) => v > 0 && V > 0 ? `<i style="width:${v / V * 100}%;background:${c}" title="${esc(tip)}"></i>` : '';
    const COL_AD = ['#7FC4D6', '#B9DDE7', '#5AA9BE', '#D4ECF2'];
    const xx = admin ? xxx : (v => v ? esc(v) : '—');  // el cliente no ve los XXX de datos pendientes
    const detallesEnc = `<section class="panel">
        <h3>Detalles del encargo</h3>
        <dl class="datos datos-2c">
          <dt>Cliente</dt><dd>${xx(e.cliente?.nombre)}</dd>
          <dt>Servicios</dt><dd>${servs(e).length ? servs(e).map(esc).join(' · ') : xx('')}</dd>
          <dt class="dt-fechas">Etapa</dt><dd class="dd-ancho">${admin ? `<span class="etapas" role="radiogroup" aria-label="Etapa del encargo">${Object.entries(ESTADOS_ENCARGO).map(([k, l]) => `<button type="button" role="radio" aria-checked="${k === e.estado}" class="etapa ${faseEncargo({ estado: k })}${k === e.estado ? ' activa' : ''}" data-etapa="${k}" title="${AYUDA_ESTADOS[k]}">${l}</button>`).join('')}</span>` : `<span class="lv-chip ${faseEncargo(e)}"><i></i>${ESTADOS_ENCARGO[e.estado] || 'Por iniciar'}</span>`}</dd>
          <dt>Alcance</dt><dd>${admin ? `<span class="alcance"><label class="lv-check"><input type="checkbox" data-alcance="tiene_diseno" ${e.tiene_diseno !== false ? 'checked' : ''}> Diseño</label><label class="lv-check"><input type="checkbox" data-alcance="tiene_obra" ${e.tiene_obra ? 'checked' : ''}> Obra</label></span>` : [e.tiene_diseno !== false ? 'Diseño' : '', e.tiene_obra ? 'Obra' : ''].filter(Boolean).join(' · ') || '—'}</dd>
          ${DETALLES_PROPUESTA.filter(([k]) => prop?.[k]).map(([k, tt]) => `<dt>${tt.replace(' del encargo', '')}</dt><dd>${esc(prop[k])}</dd>`).join('')}
          ${prop?.ubicacion ? '' : `<dt>Ubicación</dt><dd>${admin || e.direccion ? xx(e.direccion) + (e.ciudad ? ', ' + esc(e.ciudad) : '') : (e.ciudad ? esc(e.ciudad) : '—')}</dd>`}
          ${prop?.codigo ? `<dt>Código</dt><dd>${esc(prop.codigo)}</dd>` : ''}
          <dt class="dt-fechas">Fechas</dt><dd class="dd-fechas"><span><small>Propuesta preliminar</small>${admin && prop?.id ? fechaProp(prop) : prop?.fecha_envio || prop?.fecha ? fecha(prop.fecha_envio || prop.fecha) : 'Sin fecha'}</span><span><small>Inicio</small>${fechaEnc(e, 'inicio', 'Sin fecha', admin)}</span><span><small>Entrega</small>${fechaEnc(e, 'fin', 'Sin fecha', admin)}</span></dd>
          <dt>Responsables</dt><dd>${e.responsables.length ? e.responsables.map(r => esc(r.nombre)).join(', ') : (admin ? xxx('') : 'regenerativo')}</dd>
        </dl>
      </section>`;
    if (esCliente) {
      const DESC = { propuesta: 'Propuesta preliminar', contrato: 'Contrato firmado', presupuesto: 'Presupuesto de obra', gantt: 'Cronograma y avance', informes: 'Actas e informes de avance' };
      const mods = MODULOS.filter(([k]) => visible(k) && !SIN_CONTEO.includes(k) && !NO_DOC.includes(k) && n(k) > 0);
      const conAvance = !!(e.tiene_obra && g?.filas.length);
      const pagado = pagos.reduce((a, x) => a + Number(x.valor), 0);
      const panelPagos = V || pagos.length ? `<section class="panel"><div class="lv-card-cab"><h3>Pagos</h3><span class="lv-cuenta">${pagos.length} abono${pagos.length === 1 ? '' : 's'}</span></div>
          <div class="barra-apilada">${V ? `<i style="width:${Math.min(100, pagado / V * 100)}%;background:#0090B0"></i>` : ''}</div>
          <ul class="leyenda-valor">
            ${pagos.map(x => `<li><i style="background:#0090B0"></i>Abono del ${fecha(x.fecha)}<b>${cop(x.valor)}</b></li>`).join('')}
            <li class="total">Pagado<b>${cop(pagado)}</b></li>
            ${V ? `<li class="total">Pendiente<b>${pagado >= V || e.pagado_total ? cop(0) : cop(V - pagado)}</b></li>` : ''}
          </ul></section>` : '';
      const htmlCli = `
        <div class="kpis ${conAvance ? 'kpis-4' : 'kpis-3'}">
          ${kpi('Valor del encargo', V || (sinCosto) ? cop(V) : '—', sinCosto ? 'Proyecto propio, sin costo' : valor.adic.length ? `Propuesta + ${valor.adic.length} adicional${valor.adic.length > 1 ? 'es' : ''}` : 'Propuesta aprobada')}
          ${kpi('Pagado hasta ahora', cop(pagado), !V ? 'Abonos registrados' : pagado >= V ? 'Encargo pagado' : e.pagado_total ? 'Saldado' : `Pendiente ${cop(V - pagado)}`, V ? Math.min(1, pagado / V) : undefined)}
          ${kpi('Tiempo transcurrido', e.estado !== 'activo' ? (ESTADOS_ENCARGO[e.estado] || 'Por iniciar') : t == null ? 'En curso' : pct(t), total ? `${Math.max(0, total - hechos)} días de trabajo restantes` : (e.inicio ? `Desde el ${fecha(e.inicio)}` : 'Te avisamos la fecha de inicio'), t || 0)}
          ${conAvance ? kpi('Avance de la obra', pct(g.realTotal), `Esperado a la fecha ${pct(g.esperadoTotal)}`, g.realTotal) : ''}
        </div>
        ${detallesEnc}
        ${panelPagos}
        <section class="panel"><h3>Tus documentos</h3>
          <div class="tarjetas-cli">${mods.map(([k, nom]) => `<a class="tarjeta-cli" href="${base}/${k}"><span class="tc-ico">${ico('archivo')}</span><span class="tc-txt"><b>${DESC[k] || nom}</b><span class="sub">${n(k)} documento${n(k) === 1 ? '' : 's'} · ver y descargar</span></span><span class="tc-flecha">›</span></a>`).join('')}
            <a class="tarjeta-cli" href="${base}/enviados"><span class="tc-ico">${ico('descargar')}</span><span class="tc-txt"><b>Documentos</b><span class="sub">Enviados y recibidos del proyecto</span></span><span class="tc-flecha">›</span></a></div>
        </section>
        <section class="panel lv-duda">
          <div class="lv-card-cab"><h3>¿Tienes una duda?</h3><a class="lv-link" href="${base}/comentarios">Ver conversación ${ico('ver')}</a></div>
          <p class="sub">Escríbenos aquí: le llega al equipo de regenerativo y te respondemos en el portal.</p>
          ${formComentario()}
          ${coms.length ? `<ul class="lv-hilo corto">${coms.slice(0, 2).map(c => itemComentario(c, false)).join('')}</ul>` : ''}
        </section>`;
      pintar(htmlCli);
      return montarComentario(ctx);
    }
    const html = `
      <div class="kpis">
        ${kpi('Valor del encargo', V || (sinCosto) ? cop(V) : '—', sinCosto ? 'Proyecto propio, sin costo' : V ? (valor.adic.length ? `Propuesta + ${valor.adic.length} adicional${valor.adic.length > 1 ? 'es' : ''}` : 'Propuesta aprobada') : 'Sin valor registrado')}
        ${s.facturacion ? kpi('Recibido', cop(rec), V ? `${pct(rec / V)} del valor` : 'Ingresos registrados', V ? Math.min(1, rec / V) : undefined) : ''}
        ${s.facturacion ? kpi('Por cobrar', !V ? '—' : rec >= V ? cop(0) : e.pagado_total ? 'Saldado' : cop(V - rec), !V ? '' : rec < V && e.pagado_total ? 'Dado por saldado a mano, sin abono registrado' : 'Valor menos lo recibido') : ''}
        ${kpi('Tiempo transcurrido', e.estado !== 'activo' ? (ESTADOS_ENCARGO[e.estado] || 'Por iniciar') : t == null ? 'En curso' : pct(t), total ? `${Math.max(0, total - hechos)} días de trabajo restantes${e.tiene_obra && g?.filas.length ? ' · avance real ' + pct(g.realTotal) : ''}` : (e.inicio ? `Desde el ${fecha(e.inicio)} · falta la fecha de entrega` : 'Falta la fecha de entrega'), t || 0)}
      </div>
      <div class="dos">
        <section class="panel">
          <div class="panel-cab"><h3>Valor del encargo</h3>${admin ? '<button type="button" class="btn mini sec" id="editar-valor">Editar valor, adicionales e ingresos</button>' : ''}</div>
          ${V ? `<div class="barra-apilada">${seg(valor.base, '#00758F', 'Propuesta ' + cop(valor.base))}${valor.adic.map((a, i) => seg(a.valor, COL_AD[i % 4], `Adicional ${a.numero} ${cop(a.valor)}`)).join('')}</div>
            <ul class="leyenda-valor">
              <li><i style="background:#00758F"></i>Propuesta inicial<b>${cop(valor.base)}</b></li>
              ${valor.adic.map((a, i) => `<li><i style="background:${COL_AD[i % 4]}"></i>Adicional ${a.numero}${a.nombre ? ' · ' + esc(a.nombre) : ''}<b>+ ${cop(a.valor)}</b></li>`).join('')}
              <li class="total">Total<b>${cop(V)}</b></li>
            </ul>
            ${valor.adic.length ? `<p class="nota-valor">El encargo tiene ${valor.adic.length} adicional${valor.adic.length > 1 ? 'es' : ''} por ${cop(valor.sumaAdic)} sobre la propuesta.</p>` : ''}
            ${s.facturacion ? `<h4 class="sub-h">Pagos</h4><div class="barra-apilada">${seg(Math.min(rec, V), '#0090B0', 'Recibido ' + cop(rec))}</div>
              <ul class="leyenda-valor"><li><i style="background:#0090B0"></i>Recibido<b>${cop(rec)}</b></li><li><i style="background:#E6E6E6"></i>Por cobrar<b>${cop(Math.max(0, V - rec))}</b></li></ul>` : ''}`
          : sinCosto ? '<p class="sub">Proyecto propio, sin costo (valor 0 COP).</p>' : `<p class="sub">No hay valor registrado.${admin ? ' Usa «Editar valor, adicionales e ingresos» para escribirlo.' : ''}</p>`}
        </section>
        ${admin ? `<section class="panel folder-proy"><h3>Folder del proyecto</h3>
          ${webCarpeta(e) ? `<a class="folder-link" href="${esc(webCarpeta(e))}" target="_blank" rel="noopener"><span class="folder-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.2h7a2 2 0 0 1 2 2v7.8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/></svg></span><span><b>${esc(e.nombre)}</b><small>Abrir en OneDrive</small></span><span class="folder-flecha">↗</span></a>` : '<p class="sub">El encargo aún no tiene carpeta conectada.</p>'}
        </section>` : `<section class="panel"><h3>Documentos</h3><div class="tiles" id="tiles">${tiles()}</div></section>`}
      </div>
      ${detallesEnc}`;
    pintar(html);
    if (abrirAjustes) modalAjustesEncargo(e, prop);
    const bv = $('#editar-valor'); if (bv) bv.onclick = () => modalValores(e, prop, ir);
    document.querySelectorAll('[data-etapa]').forEach(b => b.onclick = async () => {
      if (b.dataset.etapa === e.estado) return;
      const cambio = { estado: b.dataset.etapa };
      if (cambio.estado === 'activo' && !e.inicio) cambio.inicio = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
      document.querySelectorAll('[data-etapa]').forEach(x => x.disabled = true);
      try { await D.actualizarEncargo(e.id, cambio); ir(); } catch (err) { alert(msg(err)); document.querySelectorAll('[data-etapa]').forEach(x => x.disabled = false); }
    });
    document.querySelectorAll('[data-alcance]').forEach(c => c.onchange = async () => {
      c.disabled = true;
      try { await D.actualizarEncargo(e.id, { [c.dataset.alcance]: c.checked }); ir(); } catch (err) { alert(msg(err)); c.checked = !c.checked; c.disabled = false; }
    });
    return;
  }

  if (seccion === 'carpetas' && admin) {
    pintar('<section class="panel od" id="od"></section>');
    return panelOneDrive($('#od'), e, [['']], { titulo: 'Folders del encargo' });
  }
  if (seccion === 'comentarios') return vistaComentarios(ctx, coms, pintar);
  if (seccion === 'correos') return pintar(vistaCorreos(correos, admin, e));
  if (seccion === 'enviados' && !admin) return enviadosCliente(ctx, pintar);
  if (seccion === 'enviados' || seccion === 'recibidos') {
    if (!admin) { location.hash = base; return; }
    pintar('<section class="panel od" id="od"></section>');
    return panelOneDrive($('#od'), e, FUENTES[seccion], { titulo: seccion === 'enviados' ? 'Enviados al cliente · DOC _ ENV' : 'Recibidos del cliente · DOC _ REC', envios: true });
  }
  if (seccion === 'finanzas' && s.facturacion) return finanzasEncargo(ctx, movsOk, valor, pintar);
  if ((seccion === 'obra' || seccion === 'tecnica') && admin) {
    pintar('<section class="panel od" id="od"></section>');
    return panelOneDrive($('#od'), e, FUENTES[seccion], { titulo: seccion === 'obra' ? 'Coordinación de obra · 00 INFORMES OBRA y personal' : 'Coordinación técnica · 00 INFORMES TÉCNICOS, ARQ, MEP y STR' });
  }
  if (seccion === 'legales' && admin) {
    pintar('<section class="panel od" id="od"></section>');
    return panelOneDrive($('#od'), e, FUENTES.legales, { titulo: 'Legales · propuesta, contratos, adendas, actas, cobros y facturación' });
  }
  if (seccion === 'resena') {
    const mias = coms.filter(c => c.tipo === 'resena');
    pintar(`<section class="panel resena"><h3>¿Cómo fue trabajar con regenerativo?</h3>
      <p class="sub">Cuéntanos qué te gustó, qué podemos mejorar y cómo te sentiste en el proceso. Nos ayuda a crecer y a cuidar mejor cada encargo.</p>
      <form id="f-resena"><div class="estrellas" role="radiogroup" aria-label="Calificación">${[1, 2, 3, 4, 5].map(n => `<button type="button" class="estrella" data-n="${n}" aria-label="${n} de 5">${icoMenu('resena')}</button>`).join('')}</div>
        <textarea id="t-resena" rows="5" placeholder="Tu reseña del proyecto, comentarios y mejoras para regenerativo…" required></textarea>
        <button class="btn" type="submit">Enviar reseña</button><div class="aviso" id="a-resena"></div></form></section>
      ${mias.length ? `<section class="panel"><h3>Tus reseñas</h3>${mias.map(c => `<div class="resena-item"><span class="estrellas mini">${'★'.repeat(c.calificacion || 0)}<i>${'★'.repeat(5 - (c.calificacion || 0))}</i></span><p>${esc(c.texto)}</p><span class="sub">${fecha(c.creado.slice(0, 10))}</span></div>`).join('')}</section>` : ''}`);
    let cal = 0;
    document.querySelectorAll('.estrella').forEach(b => b.onclick = () => { cal = +b.dataset.n; document.querySelectorAll('.estrella').forEach(x => x.classList.toggle('on', +x.dataset.n <= cal)); });
    $('#f-resena').onsubmit = async ev => {
      ev.preventDefault(); const t = $('#t-resena').value.trim(); if (!t) return;
      const b = ev.target.querySelector('button[type=submit]'); b.disabled = true;
      try { await D.comentar(e.id, t, 'resena', e.cliente?.nombre || '', true, cal || null); $('#a-resena').textContent = '¡Gracias! Tu reseña nos llegó.'; setTimeout(ir, 1200); }
      catch (err) { $('#a-resena').textContent = msg(err); b.disabled = false; }
    };
    return;
  }
  if (seccion === 'propuesta' && esCliente) {
    const v = web.propuesta > 0 && M.VISTAS.propuesta ? await M.VISTAS.propuesta(ctx) : null;
    return propuestaCliente(ctx, pintar, v);
  }
  if (seccion === 'gantt' && esCliente) {
    const v = web.gantt > 0 ? await M.VISTAS.gantt(ctx) : null;
    pintar(v ? v.html : '<div class="vacio">Este encargo todavía no tiene cronograma de obra.</div>');
    if (v?.montar) v.montar();
    return;
  }
  if (seccion === 'gantt' && !D.MODO_DEMO) return programacionExcel(ctx, pintar);
  if ((seccion === 'presupuesto' || seccion === 'gantt') && !D.MODO_DEMO) {
    const v = web[seccion] > 0 && M.VISTAS[seccion] ? await M.VISTAS[seccion](ctx) : null;
    pintar(`<section class="panel visor" id="visor"></section>${v ? `<section class="panel"><h3>${seccion === 'gantt' ? 'Programación en el portal' : 'Presupuesto en el portal'}</h3></section>` + v.html : ''}`);
    if (v?.montar) v.montar();
    return visorDocumento(ctx, seccion, $('#visor'));
  }

  if (M.VISTAS[seccion]) {
    const conWeb = web[seccion] > 0;
    const v = conWeb ? await M.VISTAS[seccion](ctx) : null;
    const conOd = admin && FUENTES[seccion];
    pintar((conOd ? '<section class="panel od" id="od"></section>' : '') + (v ? v.html : conOd ? '' : `<div class="vacio">Todavía no hay documentos en este módulo.</div>`));
    if (v?.montar) v.montar();
    if (conOd) panelOneDrive($('#od'), e, FUENTES[seccion], { titulo: 'Documentos en OneDrive' });
    return;
  }
  location.hash = base;
}

// ---------------- Finanzas del encargo ----------------
async function finanzasEncargo(ctx, movs, valor, pintar) {
  const { e, admin } = ctx;
  const [cats, encs] = await Promise.all([D.finCategorias(), D.encargos()]);
  const de = t => movs.filter(x => x.tipo === t);
  const suma = l => l.reduce((a, x) => a + Number(x.valor), 0);
  const ings = de('ingreso'), gass = de('gasto');
  const rec = suma(ings), gas = suma(gass), V = valor.total;
  // Gastos por categoría y subcategoría (las de MONAI)
  const grupos = {};
  gass.forEach(x => { const c = x.categoria?.nombre || 'Sin categoría'; const sc = x.subcategoria || 'Sin subcategoría'; (grupos[c] ||= { total: 0, subs: {} }).total += Number(x.valor); grupos[c].subs[sc] = (grupos[c].subs[sc] || 0) + Number(x.valor); });
  const ordenG = Object.entries(grupos).sort((a, b) => b[1].total - a[1].total);
  const tabla = (l, tipo) => l.length ? `<div class="tabla-cont"><table class="t-compacta t-fin-enc"><thead><tr><th>Fecha</th><th>Concepto</th><th class="num">Valor</th></tr></thead><tbody>
      ${l.map(x => `<tr class="clic" data-mov="${x.id}"><td>${fecha(x.fecha)}</td><td>${esc(x.descripcion || '')}<span class="sub fin-fecha">${fecha(x.fecha)}</span><span class="sub fin-det">${tipo === 'gasto' ? esc([x.categoria?.nombre, x.subcategoria].filter(Boolean).join(' · ')) : esc(x.medio || '')}</span></td>
        <td class="num ${x.tipo}">${x.tipo === 'ingreso' ? '+' : '−'}&nbsp;${cop(x.valor)}</td></tr>`).join('')}
      <tr class="total"><td></td><td>Total</td><td class="num">${cop(suma(l))}</td></tr></tbody></table></div>`
    : `<p class="sub">${tipo === 'gasto' ? 'Sin gastos asignados a este encargo. En Finanzas, al registrar o editar un gasto, elige «Pertenece a» este encargo; o agrégalo aquí.' : 'Sin ingresos registrados para este encargo.'}</p>`;
  const html = `
    <div class="kpis">
      ${kpi('Recibido', cop(rec), V ? `${pct(rec / V)} de ${cop(V)}` : 'Ingresos del encargo', V ? Math.min(1, rec / V) : undefined)}
      ${kpi('Por cobrar', !V ? '—' : rec >= V ? cop(0) : e.pagado_total ? 'Saldado' : cop(V - rec), !V ? '' : rec < V && e.pagado_total ? 'Dado por saldado a mano, sin abono registrado' : 'Valor menos lo recibido')}
      ${kpi('Gastos del encargo', cop(gas), rec ? `${pct(gas / rec)} de lo recibido` : `${gass.length} gasto${gass.length === 1 ? '' : 's'}`, rec ? Math.min(1, gas / rec) : undefined)}
      ${kpi('Utilidad', cop(rec - gas), V ? `Si se cobra todo: ${cop(V - gas)}` : 'Recibido menos gastos')}
    </div>
    ${ordenG.length ? `<section class="panel"><h3>Gastos por categoría</h3>
      <div class="gastos-cat">${ordenG.map(([c, g]) => `<div class="gc-fila"><div class="gc-cab"><span class="mov-ico gasto">${icoCatF(c)}</span><b>${esc(c)}</b><span class="num">${cop(g.total)}</span></div>
        <div class="gc-barra"><i style="width:${gas ? g.total / gas * 100 : 0}%"></i></div>
        <div class="gc-subs">${Object.entries(g.subs).sort((a, b) => b[1] - a[1]).map(([n, v]) => `<span>${esc(n)} <b>${cop(v)}</b></span>`).join('')}</div></div>`).join('')}</div></section>` : ''}
    <div class="dos">
      <section class="panel"><div class="od-cab"><h3 class="tit-ing">Ingresos</h3><button class="btn sec mini btn-ing" data-nuevo="ingreso">+ Ingreso</button></div>${tabla(ings, 'ingreso')}</section>
      <section class="panel"><div class="od-cab"><h3 class="tit-gas">Gastos</h3><button class="btn mini btn-gas" data-nuevo="gasto">+ Gasto</button></div>${tabla(gass, 'gasto')}</section>
    </div>
    ${admin ? `<section class="panel cc-nueva"><div class="od-cab"><h3>Cuenta de cobro</h3>${e.pagado_total ? '' : '<button class="btn mini" id="cc-nueva" aria-label="Nueva cuenta de cobro"><span class="mas">+</span> Nueva<span class="cc-largo"> cuenta de cobro</span></button>'}</div>
      <p class="sub">${e.pagado_total ? 'Este encargo ya está pagado: no lleva más cuentas de cobro.' : 'Se arma con el membrete de regenerativo y los datos del encargo, y queda en Word y PDF en LEGALES / 04 CUENTAS DE COBRO.'}</p></section>` : ''}
    ${admin ? '<section class="panel od" id="od"></section>' : ''}`;
  pintar(html);
  if ($('#cc-nueva')) $('#cc-nueva').onclick = () => modalCuentaCobro(e);
  document.querySelectorAll('[data-nuevo]').forEach(b => b.onclick = () => modalMov({ tipo: b.dataset.nuevo, fecha: new Date().toISOString().slice(0, 10), encargo_id: e.id }, cats, encs, ir));
  document.querySelectorAll('[data-mov]').forEach(tr => tr.onclick = () => modalMov(movs.find(x => x.id === tr.dataset.mov), cats, encs, ir));
  if (admin) panelOneDrive($('#od'), e, FUENTES.finanzas, { titulo: 'Cuentas de cobro' });
}

// ---------------- Cuenta de cobro: formulario corto; el documento se arma en el servidor ----------------
async function modalCuentaCobro(e) {
  const fondo = document.createElement('div'); fondo.className = 'modal-fondo';
  fondo.innerHTML = `<form class="modal" id="fcc" style="max-width:560px"><h2>Nueva cuenta de cobro</h2><p class="sub" id="cc-sub">Cargando los datos del encargo…</p>
    <div class="campos-cc" hidden>
      <label>Concepto<input name="concepto" required placeholder="Ej.: Anticipo, 50 % del valor total del trabajo"></label>
      <label>Valor (COP)<input name="valor" inputmode="numeric" required placeholder="Ej.: 2.200.000"></label>
      <label>Fecha<input type="date" name="fecha" lang="es-CO" value="${new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10)}"></label>
      <p class="sub" style="margin:14px 0 4px">Datos del cliente (lo que cambies queda guardado en su ficha; lo vacío sale como XXX)</p>
      <label>Documento (NIT o C.C.)<input name="documento"></label>
      <label>Correo<input name="email" type="email"></label>
      <label>Teléfono<input name="telefono"></label>
      <label>Dirección<input name="direccion"></label>
    </div>
    <div class="aviso" id="cc-aviso"></div>
    <div class="pie-modal"><button class="btn" type="submit" disabled>Generar Word y PDF</button><button type="button" class="btn sec" id="cc-cancelar">Cancelar</button></div></form>`;
  document.body.appendChild(fondo);
  const f = $('#fcc', fondo), av = t => { $('#cc-aviso', fondo).textContent = t; };
  $('#cc-cancelar', fondo).onclick = () => fondo.remove();
  const sep = v => String(v).replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  f.valor.addEventListener('input', () => { f.valor.value = sep(f.valor.value); });
  try {
    const d = await D.cuentaCobro({ accion: 'datos', encargo_id: e.id });
    if (d.pagado) { $('#cc-sub', fondo).textContent = 'Este encargo ya está pagado: no lleva más cuentas de cobro.'; return; }
    $('#cc-sub', fondo).textContent = `Será la cuenta de cobro No. ${d.numero} de ${e.nombre}.`;
    ['documento', 'email', 'telefono', 'direccion'].forEach(k => { f[k].value = d.cliente?.[k] || ''; });
    $('.campos-cc', fondo).hidden = false; f.querySelector('[type=submit]').disabled = false; f.concepto.focus();
  } catch (err) { $('#cc-sub', fondo).textContent = msg(err); return; }
  f.onsubmit = async ev => {
    ev.preventDefault();
    const valor = Number(f.valor.value.replace(/\D/g, ''));
    if (!f.concepto.value.trim()) return av('Escribe el concepto.');
    if (!valor) return av('Escribe el valor a cobrar.');
    const b = f.querySelector('[type=submit]'); b.disabled = true; b.textContent = 'Generando…'; av('');
    try {
      const r = await D.cuentaCobro({ accion: 'crear', encargo_id: e.id, concepto: f.concepto.value.trim(), valor, fecha: f.fecha.value,
        cliente: { documento: f.documento.value.trim(), email: f.email.value.trim(), telefono: f.telefono.value.trim(), direccion: f.direccion.value.trim() } });
      f.innerHTML = `<h2>Cuenta de cobro No. ${esc(r.numero)} lista</h2><p class="sub">Quedó en LEGALES / 04 CUENTAS DE COBRO como «${esc(r.nombre)}».</p>
        <div class="pie-modal"><a class="btn" href="${esc(r.pdf)}" target="_blank" rel="noopener">Ver PDF</a><a class="btn sec" href="${esc(r.word)}" target="_blank" rel="noopener">Abrir Word</a><button type="button" class="btn sec" id="cc-ok">Cerrar</button></div>`;
      $('#cc-ok', fondo).onclick = () => { fondo.remove(); olvidarConteos(); ir(); };
    } catch (err) { b.disabled = false; b.textContent = 'Generar Word y PDF'; av(msg(err)); }
  };
}

// ---------------- Documentos de OneDrive: lista compacta, las carpetas se despliegan en el sitio ----------------
const tipoDoc = n => /\.pdf$/i.test(n) ? 'PDF' : /\.xlsx?$/i.test(n) ? 'Excel' : /\.docx?$/i.test(n) ? 'Word' : /\.(png|jpe?g|webp)$/i.test(n) ? 'Imagen' : (n.includes('.') ? n.split('.').pop().toUpperCase() : '');
const tamano = b => b == null ? '' : b >= 1e9 ? (b / 1e9).toFixed(1) + ' GB' : b >= 1e6 ? Math.round(b / 1e6) + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' KB';
const fechaNombre = n => { const m = n.match(/^(\d{4})[\s_](\d{2})[\s_](\d{2})\s*[-_]?\s*(.*)$/); return m ? { fecha: `${m[1]}-${m[2]}-${m[3]}`, resto: m[4] || n } : null; };
// Fecha de llegada de un documento o carpeta: la fecha del nombre (AAAA MM DD _ …) o, si no tiene, la de OneDrive
const fechaLlegada = x => /^X{4}/i.test(x.nombre || '') ? '' : fechaNombre(x.nombre || '')?.fecha || (x.fecha || '').slice(0, 10) || '';
const porLlegada = (a, b) => fechaLlegada(b).localeCompare(fechaLlegada(a)) || (b.fecha || '').localeCompare(a.fecha || '') || a.nombre.localeCompare(b.nombre);
const MAX_DESCARGA = 25e6;

async function panelOneDrive(el, e, grupos, { titulo = 'OneDrive', envios = false } = {}) {
  const cab = (extra = '', abrir = '') => `<div class="od-cab"><h3>${titulo}</h3><span class="sub">${extra}</span>${abrir ? enlaceIco('abrir', 'Abrir folder en OneDrive', esc(abrir)) : ''}</div>`;
  if (D.MODO_DEMO) { el.innerHTML = cab() + '<p class="sub">En el portal real aquí aparecen los archivos de esta carpeta de OneDrive.</p>'; return; }
  el.innerHTML = cab('Leyendo OneDrive…');
  const explorarOd = ruta => e ? D.onedrive('explorar', { encargo_id: e.id, ruta }) : D.onedrive('explorar_reg', { ruta });
  const bajarOd = ruta => e ? D.onedrive('archivo_encargo', { encargo_id: e.id, carpeta: '', ruta }) : D.onedrive('archivo_reg', { ruta });
  const NO_EXISTE = /not.?found|could not be found|itemNotFound|no existe/i;
  let errOd = null;
  const leer = async g => { for (const cand of g) { const [ruta, p] = cand.split('#'); try { return { ruta, soloArchivos: p === '0', ...(await explorarOd(ruta)) }; } catch (err) { if (!NO_EXISTE.test(msg(err))) errOd = err; } } return null; };
  let bloques;
  try { bloques = (await Promise.all(grupos.map(leer))).filter(Boolean); }
  catch (err) { el.innerHTML = cab() + `<p class="sub">No se pudo leer OneDrive: ${esc(msg(err))}</p>`; return; }
  // Folders (REG): primero las carpetas ZL, luego los proyectos del año más reciente al más viejo; obsoletos y archivos al final
  const grupoReg = x => { const n = (x.nombre || '').toUpperCase();
    if (!x.carpeta) return 6; if (n.startsWith('ZL')) return 0; if (/GESTION INTEGRAL/.test(n)) return 1;
    if (/OBSOLETO/.test(n)) return 5; if (/^\d{2}[\s_]/.test(n)) return 2; return 3; };
  const anioReg = x => Number((x.nombre || '').match(/^(\d{2})[\s_]/)?.[1] || 0);
  const porReg = (a, b) => grupoReg(a) - grupoReg(b) || anioReg(b) - anioReg(a) || a.nombre.localeCompare(b.nombre, 'es', { numeric: true });
  const ordenar = l => envios ? [...l].sort(porLlegada) : e ? l : [...l].sort(porReg);  // Enviados y Recibidos: lo más reciente arriba, por fecha de llegada
  const fila = (x, ruta, nivel) => {
    const r = ruta ? `${ruta}/${x.nombre}` : x.nombre;
    const f = fechaNombre(x.nombre);
    const nom = f && (envios || x.carpeta) ? f.resto : x.nombre;
    const meta = x.carpeta ? `${f ? fecha(f.fecha) + ' · ' : ''}${x.n ?? 0} elemento${x.n === 1 ? '' : 's'}` : [tipoDoc(x.nombre), x.fecha ? fecha(x.fecha.slice(0, 10)) : '', tamano(x.tamano)].filter(Boolean).join(' · ');
    return `<div class="od-fila${x.carpeta ? ' es-carpeta' : ''}" style="--n:${nivel}" ${x.carpeta ? `data-abre="${esc(r)}" data-nivel="${nivel}"` : ''}>
      <span class="od-ico">${ico(x.carpeta ? 'carpeta' : 'archivo')}</span>
      <span class="od-nom" title="${esc(x.nombre)}">${esc(nom)}</span>
      <span class="od-meta">${meta}</span>
      <span class="od-acc">${enlaceIco('abrir', 'Abrir en OneDrive', esc(x.web))}${!x.carpeta && (x.tamano || 0) < MAX_DESCARGA ? btnIco('descargar', 'Descargar', `data-bajar="${esc(r)}"`) : ''}</span>
    </div>${x.carpeta ? '<div class="od-hijos" hidden></div>' : ''}`;
  };
  const filas = (items, ruta, nivel) => ordenar(items).map(x => fila(x, ruta, nivel)).join('');
  if (!bloques.length) { el.innerHTML = cab() + `<p class="sub">${errOd ? (/desconocida/i.test(msg(errOd)) ? 'La conexión con OneDrive se está actualizando: en unos minutos aparecen aquí los documentos.' : 'No se pudo leer OneDrive: ' + esc(msg(errOd))) : 'Esta carpeta todavía no existe en OneDrive.'}</p>`; return; }
  const items = b => b.soloArchivos ? b.items.filter(x => !x.carpeta) : b.items;
  const totalN = bloques.reduce((a, b) => a + items(b).length, 0);
  const uno = bloques.length === 1;
  el.innerHTML = cab(`${totalN} elemento${totalN === 1 ? '' : 's'}${uno && bloques[0].ruta ? ' · ' + esc(bloques[0].ruta.split('/').pop()) : ''}`, uno ? bloques[0].web : '') +
    bloques.map(b => (uno ? '' : `<div class="od-grupo">${esc(b.ruta.split('/').pop())}${enlaceIco('abrir', 'Abrir folder en OneDrive', esc(b.web))}</div>`) +
      (items(b).length ? `<div class="od-lista">${filas(items(b), b.ruta, 0)}</div>` : '<p class="sub od-vacia">Carpeta vacía.</p>')).join('');
  el.onclick = async ev => {
    if (ev.target.closest('a')) return;
    const bj = ev.target.closest('[data-bajar]');
    if (bj) {
      const t = bj.innerHTML; bj.disabled = true; bj.textContent = '…';
      try { const x = await bajarOd(bj.dataset.bajar); bajarBase64(x.base64, x.nombre); }
      catch (err) { alert(msg(err)); } finally { bj.disabled = false; bj.innerHTML = t; }
      return;
    }
    const f = ev.target.closest('[data-abre]'); if (!f) return;
    const h = f.nextElementSibling;
    f.classList.toggle('abierta');
    if (!h.hidden) { h.hidden = true; return; }
    h.hidden = false;
    if (h.dataset.cargado) return;
    h.innerHTML = '<p class="sub od-cargando">Cargando…</p>';
    try { const r = await explorarOd(f.dataset.abre); h.dataset.cargado = '1'; h.innerHTML = r.items.length ? filas(r.items, f.dataset.abre, Number(f.dataset.nivel) + 1) : `<p class="sub od-vacia" style="--n:${Number(f.dataset.nivel) + 1}">Carpeta vacía.</p>`; }
    catch (err) { h.innerHTML = `<p class="sub">${esc(msg(err))}</p>`; }
  };
}

// ---------------- Ajustes del encargo ----------------
function modalAjustesEncargo(e, prop) {
    document.querySelector('.modal-ajustes')?.closest('.modal-fondo')?.remove();
    const fondo = document.createElement('div'); fondo.className = 'modal-fondo';
    const $f = sel => fondo.querySelector(sel);
    const cerrar = () => { fondo.remove(); removeEventListener('hashchange', cerrar); };
    addEventListener('hashchange', cerrar);   // al cambiar de página se cierra
    const recargar = () => { cerrar(); ir(); };
    const html = `<div class="modal ancho modal-ajustes" role="dialog" aria-label="Ajustes del encargo">
      <div class="aj-cab"><div><h2>Ajustes del encargo</h2><p class="sub">${esc(e.nombre)}</p></div>${btnIco('x', 'Cerrar', 'id="aj-cerrar"')}</div>
      <div class="aj-rapidos">
        <button type="button" class="aj-rap" id="editar"><span>${ico('editar')}</span><b>Datos generales</b><small>Nombre, cliente, servicios, etapa, alcance, fechas y días de trabajo</small></button>
        <button type="button" class="aj-rap" id="aj-valor"><span>${ico('excel')}</span><b>Valor del encargo</b><small>Valor, adicionales e ingresos</small></button>
      </div>
      <div class="dos">
        <section class="panel">
          <h3>Responsables</h3>
          <p class="sub" style="margin-top:-6px">El Gantt elige al responsable por su número; si cambias un nombre aquí, se actualiza en todo el encargo.</p>
          <div class="tabla-cont"><table><thead><tr><th style="width:52px">N°</th><th>Nombre</th><th class="col-opc">Cargo</th><th style="width:40px"></th></tr></thead>
          <tbody id="resp"></tbody></table></div>
          <div style="display:flex;gap:8px;margin-top:12px"><button class="btn sec" id="agregar"><span class="mas">+</span> Agregar responsable</button><button class="btn" id="guardar-resp">Guardar</button></div>
          <div class="aviso" id="aviso-resp"></div>
        </section>
        <section class="panel">
          <h3>Acceso del cliente</h3>
          <p class="sub" style="margin-top:-6px">El cliente entra en la pestaña "Clientes" con el nombre del encargo y esta contraseña. Solo puede ver este encargo. Al cambiarla, todos los que tenían la anterior quedan fuera.</p>
          <dl class="datos acceso-datos" style="margin:10px 0 4px"><dt>Usuario</dt><dd class="det"><span id="acc-u">${esc(e.nombre)}</span> <button type="button" class="btn mini sec copiar" data-copiar="acc-u">Copiar</button></dd>
            <dt>Contraseña</dt><dd class="det">${e.acceso_clave ? `<span id="acc-c" class="clave-vis">${esc(e.acceso_clave)}</span> <button type="button" class="btn mini sec copiar" data-copiar="acc-c">Copiar</button>` : e.cliente_usuario_id ? '<span class="sub">Asignada antes; cámbiala para verla aquí</span>' : '—'}</dd>
            <dt>Estado</dt><dd class="det">${e.cliente_usuario_id ? 'Activo' : '<span class="xxx">Sin acceso asignado</span>'}</dd></dl>
          ${e.cliente_usuario_id && e.acceso_clave ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 14px"><button type="button" class="btn mini" id="copiar-todo">Copiar acceso completo</button><a class="btn mini sec" id="compartir-correo" href="mailto:${esc(e.cliente?.email || '')}?subject=${encodeURIComponent('Tu acceso al portal de ' + e.nombre)}&body=${encodeURIComponent(`Hola${e.cliente?.nombre ? ' ' + e.cliente.nombre : ''},\n\nYa puedes ver tu encargo en el portal de regenerativo:\nhttps://regenerativo.co/portal/\n\nEntra en la pestaña Clientes con:\nNombre del encargo: ${e.nombre}\nContraseña: ${e.acceso_clave}\n\nUn abrazo,\nregenerativo`)}">Compartir por correo</a></div>` : ''}
          <label>${e.cliente_usuario_id ? 'Nueva contraseña' : 'Contraseña'} (mínimo 8 caracteres)</label>
          <input id="clave-cliente" type="text" autocomplete="off" minlength="8">
          <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
            <button class="btn" id="asignar-clave">${e.cliente_usuario_id ? 'Cambiar contraseña' : 'Asignar contraseña'}</button>
            ${e.cliente_usuario_id ? '<button class="btn sec" id="quitar-clave">Quitar acceso</button>' : ''}
          </div>
          <div class="aviso" id="aviso-cli"></div>
          <label style="margin-top:18px">Correo del cliente para avisos</label>
          <p class="sub" style="margin:2px 0 8px">Le llega un correo cuando hay documentos nuevos en Enviados o cuando respondes su duda. Varios correos, separados por coma.</p>
          <div class="fila-correo"><input id="correo-aviso" type="text" inputmode="email" autocomplete="off" value="${esc(e.cliente?.email || '')}" placeholder="correo@cliente.com"><button class="btn sec" id="guardar-correo" ${e.cliente?.id || e.cliente_id ? '' : 'disabled title="El encargo no tiene cliente"'}>Guardar</button></div>
          <div class="aviso" id="aviso-correo"></div>
        </section>
        <section class="panel">
          <h3>Invitar equipo</h3>
          <p class="sub" style="margin-top:-6px">Le llega un correo para crear su contraseña. Equipo: edita avances y fechas reales.</p>
          <div class="grilla-form">
            <div><label>Correo</label><input id="inv-email" type="email"></div>
            <div><label>Rol</label><select id="inv-rol"><option value="equipo">Equipo</option><option value="cliente">Cliente (con su propio correo)</option></select></div>
          </div>
          <button class="btn" id="invitar" style="margin-top:14px">Enviar invitación</button>
          <div class="aviso" id="aviso-inv"></div>
        </section>
      </div></div>`;
    fondo.innerHTML = html; document.body.appendChild(fondo);
    fondo.onclick = ev => { if (ev.target === fondo) cerrar(); };
    $f('#aj-cerrar').onclick = cerrar;
    $f('#editar').onclick = () => { cerrar(); modalEncargo(e); };
    $f('#aj-valor').onclick = () => { cerrar(); modalValores(e, prop, ir); };
    $f('#guardar-correo').onclick = async () => {
      const v = $f('#correo-aviso').value.split(/[,;\s]+/).map(x => x.trim().toLowerCase()).filter(Boolean);
      const mal = v.filter(x => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
      if (mal.length) { $f('#aviso-correo').textContent = 'Revisa este correo: ' + mal.join(', '); return; }
      try { await D.actualizarCliente(e.cliente?.id || e.cliente_id, { email: v.join(', ') || null }); $f('#aviso-correo').textContent = v.length ? 'Guardado. Los avisos le llegarán a ' + v.join(', ') + '.' : 'Guardado. El cliente no recibirá avisos por correo.'; }
      catch (err) { $f('#aviso-correo').textContent = msg(err); }
    };
    const copiarTxt = async (t, b) => { try { await navigator.clipboard.writeText(t); } catch (err) { const r = document.createRange(); const sp = document.createElement('span'); sp.textContent = t; document.body.append(sp); r.selectNodeContents(sp); getSelection().removeAllRanges(); getSelection().addRange(r); document.execCommand('copy'); sp.remove(); } const o = b.textContent; b.textContent = 'Copiado ✓'; setTimeout(() => b.textContent = o, 1600); };
    fondo.querySelectorAll('[data-copiar]').forEach(b => b.onclick = () => copiarTxt($f('#' + b.dataset.copiar).textContent, b));
    const ct = $f('#copiar-todo'); if (ct) ct.onclick = () => copiarTxt(`Portal de regenerativo: https://regenerativo.co/portal/\nPestaña: Clientes\nNombre del encargo: ${e.nombre}\nContraseña: ${e.acceso_clave}`, ct);
    let resp = e.responsables.map(r => ({ ...r }));
    const pintar = () => {
      $f('#resp').innerHTML = resp.length ? resp.map((r, i) => `<tr>
        <td>${i + 1}</td>
        <td><input data-i="${i}" data-k="nombre" value="${esc(r.nombre || '')}" placeholder="Nombre"></td>
        <td class="col-opc"><input data-i="${i}" data-k="cargo" value="${esc(r.cargo || '')}" placeholder="Cargo"></td>
        <td><button class="btn sec" data-quitar="${i}" title="Quitar" style="padding:6px 10px">×</button></td></tr>`).join('')
        : `<tr><td colspan="4" class="sub">Sin responsables todavía.</td></tr>`;
      fondo.querySelectorAll('#resp input').forEach(inp => inp.oninput = () => resp[inp.dataset.i][inp.dataset.k] = inp.value);
      fondo.querySelectorAll('[data-quitar]').forEach(b => b.onclick = () => { resp.splice(+b.dataset.quitar, 1); pintar(); });
    };
    pintar();
    $f('#agregar').onclick = () => { resp.push({ nombre: '', cargo: '' }); pintar(); };
    $f('#guardar-resp').onclick = async () => {
      try { await D.guardarResponsables(e.id, resp.filter(r => r.nombre.trim())); $f('#aviso-resp').style.color = 'var(--petroleo)'; $f('#aviso-resp').textContent = 'Responsables guardados.'; }
      catch (err) { $f('#aviso-resp').textContent = msg(err); }
    };
    $f('#asignar-clave').onclick = async () => {
      const clave = $f('#clave-cliente').value;
      if (clave.length < 8) { $f('#aviso-cli').textContent = 'La contraseña debe tener al menos 8 caracteres.'; return; }
      try { await D.asignarAccesoCliente(e.id, clave); recargar(); }
      catch (err) { $f('#aviso-cli').textContent = msg(err); }
    };
    const q = $f('#quitar-clave');
    if (q) q.onclick = async () => {
      try { await D.asignarAccesoCliente(e.id, null, true); recargar(); }
      catch (err) { $f('#aviso-cli').textContent = msg(err); }
    };
    $f('#invitar').onclick = async () => {
      try { await D.invitar($f('#inv-email').value.trim(), e.id, $f('#inv-rol').value); $f('#aviso-inv').style.color = 'var(--petroleo)'; $f('#aviso-inv').textContent = 'Invitación enviada.'; }
      catch (err) { $f('#aviso-inv').style.color = ''; $f('#aviso-inv').textContent = msg(err); }
    };
}

// ---------------- Ajustes generales ----------------
async function vistaAjustes(s, qs) {
  const [fest, us, encs, od, clis] = await Promise.all([D.festivos(), D.usuarios().catch(() => []), D.encargos(),
    D.MODO_DEMO ? { conectado: false } : D.onedrive('estado').catch(e => ({ error: e.message })), D.clientes().catch(() => [])]);
  const msjOd = { ok: 'OneDrive quedó conectado.', error: 'No se pudo conectar OneDrive. Vuelve a intentar.', expirado: 'La autorización tardó demasiado. Vuelve a intentar.' }[qs?.get('onedrive')] || '';
  const ROL = { admin: 'Administración', facturacion: 'Facturación', equipo: 'Equipo', cliente: 'Cliente' };
  const html = `
    ${msjOd ? `<div class="aviso-ej">${msjOd}</div>` : ''}
    <div class="estado-od ${od?.conectado ? 'ok' : 'no'}"><span class="punto"></span>${od?.conectado ? `OneDrive conectado · ${esc(od.cuenta || '')}` : 'OneDrive sin conectar'}
      <button class="btn sec mini" id="od-conectar">${od?.conectado ? 'Volver a conectar' : 'Conectar'}</button></div>
    <section class="panel">
      <div class="od-cab"><h3>Usuarios</h3><span class="sub">${us.length} · las invitaciones se envían desde el engranaje de cada encargo</span></div>
      <div class="tabla-cont"><table class="t-compacta t-ajustes"><thead><tr><th>Usuario</th><th>Rol</th><th class="col-opc">Encargos</th><th></th></tr></thead>
      <tbody>${us.map(u => `<tr><td><b>${esc(u.nombre || u.email)}</b>${u.nombre || u.telefono ? `<div class="sub">${u.nombre ? esc(u.email || '') : ''}${u.nombre && u.telefono ? ' · ' : ''}${u.telefono ? esc(u.telefono) : ''}</div>` : ''}</td>
        <td>${u.roles.length ? u.roles.map(r => `<span class="etiqueta">${ROL[r] || esc(r)}</span>`).join(' ') : u.encargos.length ? `<span class="etiqueta">${ROL[u.encargos[0].rol] || esc(u.encargos[0].rol)}</span>` : '—'}</td>
        <td class="col-opc sub">${u.encargos.map(x => esc(x.nombre)).join(', ') || '—'}</td>
        <td class="acciones-fila">${btnIco('editar', 'Editar usuario', `data-us="${u.id}"`)}</td></tr>`).join('') || '<tr><td colspan="4" class="sub">Sin usuarios.</td></tr>'}</tbody></table></div>
    </section>
    <section class="panel">
      <div class="od-cab"><h3>Accesos de clientes</h3><span class="sub">Pestaña Clientes del acceso · nombre del encargo y contraseña</span></div>
      <div class="tabla-cont"><table class="t-compacta t-ajustes t-accesos"><thead><tr><th>Encargo</th><th>Contraseña</th><th class="col-opc">Estado</th><th></th></tr></thead>
      <tbody>${encs.map(x => `<tr><td><b>${esc(x.nombre)}</b><div class="sub">${esc(x.cliente?.nombre || '')}</div></td>
        <td>${x.acceso_clave ? `<span class="clave-vis">${esc(x.acceso_clave)}</span> <button type="button" class="btn mini sec copiar" data-copia="${esc(x.acceso_clave)}">Copiar</button>` : x.cliente_usuario_id ? '<span class="sub">Asignada antes</span>' : '—'}</td>
        <td class="col-opc">${x.cliente_usuario_id ? '<span class="etiqueta despego">Activo</span>' : '<span class="etiqueta">Sin acceso</span>'}</td>
        <td class="acciones-fila"><a class="btn mini sec" href="#/${D.slugEncargo(x)}/ajustes">Gestionar</a></td></tr>`).join('')}</tbody></table></div>
    </section>
    <section class="panel"><div class="od-cab"><h3>Clientes</h3><span class="sub">${clis.length} · datos que usan las propuestas, contratos y avisos por correo</span><button type="button" class="btn mini sec" id="cli-nuevo" style="margin-left:auto">+ Nuevo cliente</button></div>
      <div class="tabla-cont"><table class="t-compacta t-ajustes"><thead><tr><th>Cliente</th><th class="col-opc">Documento</th><th class="col-opc">Correo</th><th class="col-opc">Teléfono</th><th></th></tr></thead>
      <tbody>${clis.map(c => `<tr><td><b>${esc(c.nombre)}</b><div class="sub">${c.tipo === 'empresa' ? 'Empresa' : 'Persona'}${c.representante ? ' · ' + esc(c.representante) : ''}</div></td>
        <td class="col-opc">${c.documento ? esc((c.tipo_documento ? c.tipo_documento + ' ' : '') + c.documento) : '<span class="xxx">XXX</span>'}</td>
        <td class="col-opc">${c.email ? esc(c.email) : '<span class="xxx">Sin correo</span>'}</td>
        <td class="col-opc">${esc(c.telefono || '—')}</td>
        <td class="acciones-fila">${btnIco('editar', 'Editar cliente', `data-cli="${c.id}"`)}</td></tr>`).join('') || '<tr><td colspan="5" class="sub">Sin clientes.</td></tr>'}</tbody></table></div></section>
    <section class="panel"><div class="od-cab"><h3>Festivos</h3><span class="sub">Colombia · cuentan para los días de trabajo de los encargos</span></div>
      <div id="calendario"></div>
      ${D.MODO_DEMO ? '<button class="btn sec mini" id="reiniciar" style="margin-top:12px">Reiniciar datos de ejemplo</button>' : ''}</section>`;
  marco(s, { titulo: 'Ajustes', h1: 'Ajustes', eyebrow: 'Usuarios y acceso', ruta: 'Ajustes generales', activo: 'ajustes', html, bajada: 'Usuarios y acceso a las cuentas.' });
  calendarioFestivos($('#calendario'), fest);
  const r = $('#reiniciar'); if (r) r.onclick = () => { D.reiniciarDemo(); location.hash = '#/'; ir(); };
  $('#od-conectar').onclick = async () => { try { location.href = (await D.onedrive('url')).url; } catch (e) { alert(msg(e)); } };
  document.querySelectorAll('[data-us]').forEach(b => b.onclick = () => modalUsuario(us.find(u => u.id === b.dataset.us)));
  document.querySelectorAll('[data-cli]').forEach(b => b.onclick = () => modalCliente(clis.find(c => c.id === b.dataset.cli)));
  $('#cli-nuevo').onclick = () => modalCliente(null);
  document.querySelectorAll('[data-copia]').forEach(b => b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.copia); } catch (err) {} const o = b.textContent; b.textContent = 'Copiado ✓'; setTimeout(() => b.textContent = o, 1600); });
}

// Calendario mensual de festivos: un punto en cada festivo, flechas para cambiar de mes
function calendarioFestivos(el, fest) {
  const MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const hoy = new Date().toISOString().slice(0, 10);
  const porFecha = Object.fromEntries(fest.map(f => [f.fecha, f.nombre]));
  let a = new Date().getFullYear(), m = new Date().getMonth();
  const pintar = () => {
    const pad = n => String(n).padStart(2, '0');
    const primero = (new Date(a, m, 1).getDay() + 6) % 7, dias = new Date(a, m + 1, 0).getDate();
    const celdas = [...Array(primero).fill(''), ...Array.from({ length: dias }, (_, i) => i + 1)];
    const delMes = fest.filter(f => f.fecha.startsWith(`${a}-${pad(m + 1)}`));
    el.innerHTML = `<div class="cal">
      <div class="cal-cab"><button type="button" class="cal-flecha" data-d="-1" aria-label="Mes anterior">‹</button><b>${MES[m]} ${a}</b><button type="button" class="cal-flecha" data-d="1" aria-label="Mes siguiente">›</button></div>
      <div class="cal-grilla">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(d => `<span class="cal-dsem">${d}</span>`).join('')}
        ${celdas.map(d => { if (!d) return '<span></span>'; const f = `${a}-${pad(m + 1)}-${pad(d)}`, fe = porFecha[f];
          return `<span class="cal-dia${fe ? ' festivo' : ''}${f === hoy ? ' hoy' : ''}" ${fe ? `title="${esc(fe)}"` : ''}>${d}${fe ? '<i></i>' : ''}</span>`; }).join('')}</div>
      <ul class="cal-lista">${delMes.length ? delMes.map(f => `<li><i></i><b>${Number(f.fecha.slice(8))}</b> ${esc(f.nombre)}</li>`).join('') : '<li class="sub">Sin festivos este mes.</li>'}</ul></div>`;
    el.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { m += Number(b.dataset.d); if (m < 0) { m = 11; a--; } if (m > 11) { m = 0; a++; } pintar(); });
  };
  pintar();
}

// Clientes: los datos legales y de contacto quedan en un solo lugar (propuestas, contratos, avisos)
function modalCliente(c) {
  const fondo = document.createElement('div'); fondo.className = 'modal-fondo';
  const v = k => esc(c?.[k] || '');
  fondo.innerHTML = `<form class="modal" id="fcli"><h2>${c ? 'Cliente' : 'Nuevo cliente'}</h2>
    <div class="grilla-form">
      <div class="ancho"><label>Nombre o razón social</label><input name="nombre" required value="${v('nombre')}"></div>
      <div><label>Tipo</label><select name="tipo"><option value="persona"${c?.tipo !== 'empresa' ? ' selected' : ''}>Persona</option><option value="empresa"${c?.tipo === 'empresa' ? ' selected' : ''}>Empresa</option></select></div>
      <div><label>Tipo de documento</label><select name="tipo_documento">${['', 'CC', 'NIT', 'CE', 'Pasaporte'].map(t => `<option${(c?.tipo_documento || '') === t ? ' selected' : ''} value="${t}">${t || '—'}</option>`).join('')}</select></div>
      <div><label>Número de documento</label><input name="documento" value="${v('documento')}"></div>
      <div><label>Representante legal</label><input name="representante" value="${v('representante')}"></div>
      <div><label>Documento del representante</label><input name="documento_representante" value="${v('documento_representante')}"></div>
      <div><label>Correo (varios separados por coma)</label><input name="email" value="${v('email')}"></div>
      <div><label>Teléfono</label><input name="telefono" value="${v('telefono')}"></div>
      <div><label>Ciudad</label><input name="ciudad" value="${v('ciudad')}"></div>
      <div><label>Dirección</label><input name="direccion" value="${v('direccion')}"></div>
    </div>
    <div class="aviso" id="aviso"></div>
    <div class="pie-modal"><button type="button" class="btn sec" id="cancelar">Cancelar</button><button class="btn" type="submit">Guardar</button></div></form>`;
  document.body.appendChild(fondo);
  $('#cancelar', fondo).onclick = () => fondo.remove();
  $('#fcli', fondo).onsubmit = async ev => {
    ev.preventDefault();
    const d = Object.fromEntries([...new FormData(ev.target)].map(([k, x]) => [k, String(x).trim() || null]));
    if (!d.nombre) { $('#aviso', fondo).textContent = 'Escribe el nombre del cliente.'; return; }
    if (d.email && !d.email.split(',').every(x => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x.trim()))) { $('#aviso', fondo).textContent = 'Revisa el correo: no parece válido.'; return; }
    d.tipo = d.tipo || 'persona';
    try { if (c) await D.actualizarCliente(c.id, d); else await D.crearCliente(d); fondo.remove(); ir(); }
    catch (err) { $('#aviso', fondo).textContent = msg(err); }
  };
}

function modalUsuario(u) {
  const fondo = document.createElement('div'); fondo.className = 'modal-fondo';
  fondo.innerHTML = `<form class="modal" id="fus"><h2>Usuario</h2><p class="sub">${esc(u.email || '')}</p>
    <div class="grilla-form"><div><label>Nombre</label><input name="nombre" value="${esc(u.nombre || '')}"></div><div><label>Teléfono</label><input name="telefono" value="${esc(u.telefono || '')}"></div></div>
    <p class="sub" style="margin-top:14px">Para dar acceso a un encargo, invita a la persona desde el engranaje (Ajustes) del encargo.</p>
    <div class="aviso" id="aviso"></div>
    <div class="pie-modal"><button type="button" class="btn sec" id="cancelar">Cancelar</button><button class="btn" type="submit">Guardar</button></div></form>`;
  document.body.appendChild(fondo);
  $('#cancelar', fondo).onclick = () => fondo.remove();
  $('#fus', fondo).onsubmit = async ev => {
    ev.preventDefault();
    const v = Object.fromEntries(new FormData(ev.target));
    try { await D.actualizarPerfil(u.id, { nombre: v.nombre.trim() || null, telefono: v.telefono.trim() || null }); fondo.remove(); ir(); }
    catch (err) { $('#aviso', fondo).textContent = msg(err); }
  };
}

// ---------------- Propuestas preliminares ----------------
// ---------------- Marketing: ideas de mejora para la web, se aprueban o descartan ----------------
const EST_IDEA = { pendiente: 'Por decidir', aprobada: 'Aprobada', hecha: 'Hecha', descartada: 'Descartada' };
let mkFiltro = 'pendiente';
async function vistaMarketing(s) {
  let lista = [];
  try { lista = await D.marketingIdeas(); } catch (e) { return marco(s, { titulo: 'Marketing', ruta: 'Portal', activo: 'marketing', eyebrow: 'Ideas para la web', html: `<div class="vacio">${/marketing_ideas|relation|schema cache/i.test(msg(e)) ? 'La pestaña de Marketing se está activando. Vuelve a abrirla en un momento.' : esc(msg(e))}</div>` }); }
  const n = k => lista.filter(x => x.estado === k).length;
  const html = `
    <p class="sub mk-intro">Ideas para mejorar cada parte de la web. Apruébalas o descártalas; las aprobadas se montan en regenerativo.co.</p>
    <div class="lv-filtros"><div class="lv-seg" id="mk-seg">${['pendiente', 'aprobada', 'hecha', 'descartada', ''].map(k => `<button type="button" data-f="${k}" class="${mkFiltro === k ? 'activo' : ''}">${k ? { pendiente: 'Por decidir', aprobada: 'Aprobadas', hecha: 'Hechas', descartada: 'Descartadas' }[k] : 'Todas'}<i>${k ? n(k) : lista.length}</i></button>`).join('')}</div></div>
    <div id="mk-lista"></div>`;
  marco(s, { titulo: 'Marketing', ruta: 'Portal', activo: 'marketing', html, eyebrow: 'Ideas para la web',
    acciones: '<button class="btn" id="mk-nueva"><span class="mas">+</span> Nueva idea</button>' });
  const pintar = () => {
    const f = lista.filter(x => !mkFiltro || x.estado === mkFiltro);
    const areas = [...new Set(f.map(x => x.area))];
    $('#mk-lista').innerHTML = f.length ? areas.map(ar => `
      <section class="panel mk-area"><h3>${esc(ar)}</h3><ul class="mk-ideas">${f.filter(x => x.area === ar).map(x => `
        <li class="mk-idea" data-id="${x.id}">
          <div class="mk-txt"><b>${esc(x.titulo)}</b><p class="sub">${esc(x.detalle)}</p>${x.nota ? `<p class="sub mk-nota">Nota: ${esc(x.nota)}</p>` : ''}</div>
          <div class="mk-acc"><span class="etiqueta mk-${x.estado}">${EST_IDEA[x.estado]}</span>
            ${x.estado === 'pendiente' ? `<button type="button" class="btn mini" data-mk="aprobada">Aprobar</button><button type="button" class="btn sec mini" data-mk="descartada">Descartar</button>` : ''}
            ${x.estado === 'aprobada' ? `<button type="button" class="btn sec mini" data-mk="pendiente">Volver a decidir</button>` : ''}
            ${x.estado === 'descartada' ? `<button type="button" class="btn sec mini" data-mk="pendiente">Recuperar</button>` : ''}
          </div></li>`).join('')}</ul></section>`).join('')
      : `<div class="vacio">${mkFiltro === 'pendiente' ? 'No hay ideas por decidir.' : 'No hay ideas en este grupo.'}</div>`;
    document.querySelectorAll('[data-mk]').forEach(b => b.onclick = async () => {
      const id = b.closest('[data-id]').dataset.id, est = b.dataset.mk;
      let nota = null;
      if (est === 'descartada') { nota = await preguntar('¿Por qué la descartas?\n\nOpcional: una nota corta para no volver a proponerla.', { opcional: true, ok: 'Descartar' }); if (nota === null) return; }
      b.disabled = true;
      try { await D.decidirIdea(id, est, nota || null); const x = lista.find(y => y.id === id); Object.assign(x, { estado: est, nota: nota || null }); vistaMarketing(s); }
      catch (e) { b.disabled = false; alert(msg(e)); }
    });
  };
  document.querySelectorAll('#mk-seg button').forEach(b => b.onclick = () => { mkFiltro = b.dataset.f; document.querySelectorAll('#mk-seg button').forEach(y => y.classList.toggle('activo', y === b)); pintar(); });
  $('#mk-nueva').onclick = async () => {
    const titulo = await preguntar('Nueva idea para la web\n\nEscribe la idea en una frase.', { ok: 'Siguiente' }); if (!titulo) return;
    const area = await preguntar('¿En qué parte de la web?\n\nInicio, Encargos, About, Contacto, Google o Instagram.', { valor: 'Inicio', ok: 'Guardar' }); if (!area) return;
    try { await D.crearIdea({ titulo: titulo.trim(), area: area.trim(), detalle: '', orden: 1000 }); mkFiltro = 'pendiente'; vistaMarketing(s); } catch (e) { alert(msg(e)); }
  };
  pintar();
}

async function vistaPropuestas(s) {
  const lista = await D.propuestas();
  const n = k => lista.filter(p => p.estado === k).length;
  const html = `
    <div class="lv-filtros"><div class="lv-seg" id="seg"><button type="button" data-f="" class="activo">Todas<i>${lista.length}</i></button>${Object.entries(D.ESTADOS_PROPUESTA).filter(([k]) => n(k)).map(([k, v]) => `<button type="button" data-f="${k}">${v}<i>${n(k)}</i></button>`).join('')}</div>
      <label class="lv-buscar"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg><input id="buscar" placeholder="Buscar" aria-label="Buscar propuesta"></label></div>
    <div id="tabla"></div>`;
  let est = '';
  marco(s, { titulo: 'Propuestas', ruta: 'Portal', activo: 'propuestas', html, eyebrow: 'Propuestas preliminares',
    acciones: '<button class="btn" id="nueva"><span class="mas">+</span> Nueva propuesta</button>' });
  const pintar = () => {
    const q = $('#buscar').value.toLowerCase();
    const f = lista.filter(p => (!est || p.estado === est) && (!q || [p.nombre, p.codigo, p.cliente?.nombre].join(' ').toLowerCase().includes(q)));
    $('#tabla').innerHTML = f.length ? `
      <div class="tabla-cont"><table class="t-prop">
        <thead><tr><th class="col-opc">Código</th><th>Propuesta</th><th class="col-opc">Cliente</th><th class="num col-opc">Honorarios</th><th class="col-opc">Enviada</th><th>Estado</th><th></th></tr></thead>
        <tbody>${f.map(p => `
          <tr style="--acc-w:${((accionesPropuesta(p).match(/<(button|a) /g) || []).length) * 40 + 8}px">
            <td class="sub col-opc">${esc(p.codigo)}</td>
            <td class="prop-nombre" data-abrir="${p.id}" title="Ver la descripción de la propuesta"><b>${esc(p.nombre)}</b><div class="sub">${servs(p).map(esc).join(' · ') || 'Sin servicio'}<span class="solo-movil"> · ${esc(p.codigo)}</span></div><div class="sub solo-movil">${esc(p.cliente?.nombre || 'Sin cliente')} · ${p.honorarios ? cop(p.honorarios) : 'Sin valor'} · ${p.fecha_envio ? 'Enviada ' + fecha(p.fecha_envio) : 'Sin fecha de envío'}</div></td>
            <td class="col-opc">${xxx(p.cliente?.nombre)}</td>
            <td class="num col-opc">${p.honorarios ? cop(p.honorarios) : '—'}</td>
            <td class="col-opc">${`<label class="fecha-envio" title="Fecha de envío · clic para cambiarla">${p.fecha_envio ? fecha(p.fecha_envio) : '<span class="xxx">Sin fecha</span>'}${ico('editar')}<input type="date" data-fenvio="${p.id}" value="${p.fecha_envio || ''}" aria-label="Fecha de envío"></label>${p.estado === 'en_espera' && p.fecha_envio ? `<div class="sub">${quedan(p.fecha_envio)}</div>` : ''}`}</td>
            <td><span class="etiqueta ${p.estado}">${D.ESTADOS_PROPUESTA[p.estado]}</span><div class="doc-estado revisando" data-docs="${p.id}">Revisando documentos…</div>${p.estado === 'no_despego' && p.motivo ? `<div class="sub">${esc(p.motivo)}</div>` : ''}</td>
            <td class="acciones-fila">${accionesPropuesta(p)}</td>
          </tr>`).join('')}</tbody></table></div>`
      : `<div class="vacio">${lista.length ? 'Ninguna propuesta coincide.' : 'Todavía no hay propuestas preliminares.'}</div>`;
    document.querySelectorAll('[data-acc]').forEach(b => b.onclick = () => accion(b.dataset.acc, lista.find(p => p.id === b.dataset.id)));
    // Tocar el nombre de la propuesta abre su descripción (los mismos detalles del botón «Detalles»)
    document.querySelectorAll('[data-abrir]').forEach(td => td.onclick = () => modalPropuesta(lista.find(p => p.id === td.dataset.abrir)));
    // Documentos de cada propuesta (Word y PDF) leídos de su carpeta en OneDrive
    document.querySelectorAll('[data-docs]').forEach(async el => {
      const pintarDocs = a => {
        const w = a.some(x => /\.docx?$/i.test(x.nombre)), f = a.some(x => /\.pdf$/i.test(x.nombre));
        el.className = 'doc-estado ' + (w && f ? 'si' : 'no');
        el.textContent = w && f ? 'Documentos cargados' : w ? 'Falta el PDF' : f ? 'Falta el Word' : 'Sin documentos';
        el.title = a.map(x => x.nombre).join(' · ') || 'No hay Word ni PDF en la carpeta de la propuesta';
      };
      const k = 'reg-docs-' + el.dataset.docs;
      try { const c = JSON.parse(sessionStorage.getItem(k)); if (c && Date.now() - c.t < 600000) return pintarDocs(c.a); } catch (_) {}
      if (D.MODO_DEMO) return pintarDocs([]);
      try { const r = await D.onedrive('archivos_propuesta', { propuesta_id: el.dataset.docs }); try { sessionStorage.setItem(k, JSON.stringify({ t: Date.now(), a: r.archivos })); } catch (_) {} pintarDocs(r.archivos); }
      catch (_) { el.className = 'doc-estado'; el.textContent = 'Documentos sin revisar'; }
    });
    document.querySelectorAll('.fecha-envio').forEach(l => l.onclick = () => { const i = l.querySelector('input'); try { i.showPicker(); } catch (_) { i.focus(); } });
    document.querySelectorAll('[data-fenvio]').forEach(inp => inp.onchange = async () => {
      try { await D.actualizarPropuesta(inp.dataset.fenvio, { fecha_envio: inp.value || null }); ir(); } catch (err) { alert(msg(err)); }
    });
  };
  const accion = async (acc, p) => {
    try {
      const hoy = new Date().toISOString().slice(0, 10);
      if (acc === 'enviar') await D.actualizarPropuesta(p.id, { estado: 'en_espera', fecha_envio: hoy });
      if (acc === 'no') {
        const motivo = await preguntar('¿Por qué no despegó?\n\nOpcional: escribe el motivo o deja el espacio vacío.', { ok: 'Guardar', opcional: true });
        if (motivo === null) return;
        await D.actualizarPropuesta(p.id, { estado: 'no_despego', fecha_decision: hoy, motivo: motivo || 'Sin motivo' });
      }
      if (acc === 'reabrir') await D.actualizarPropuesta(p.id, { estado: 'en_espera', fecha_envio: hoy, motivo: null, fecha_decision: null });
      if (acc === 'despego') {
        if (!await confirmar(`¿${p.nombre} despegó?\n\nSe crea el encargo con toda la información de la cotización.`, { ok: 'Sí, despegó' })) return;
        await despegarYAbrir(p); return;
      }
      if (acc === 'eliminar') {
        if (!await confirmar(`¿Eliminar la propuesta ${p.codigo} · ${p.nombre}?\n\nSe borra del portal y su carpeta en OneDrive (ZL_REG_PROPUESTAS) pasa a la papelera, donde se puede recuperar durante 93 días.`, { ok: 'Eliminar', peligro: true })) return;
        const r = await D.onedrive('eliminar_propuesta', { propuesta_id: p.id });
        alert(r.carpeta ? `Propuesta eliminada.\nCarpeta enviada a la papelera de OneDrive: ${r.carpeta}` : 'Propuesta eliminada. No tenía carpeta en OneDrive.');
        ir(); return;
      }
      if (acc === 'editar') { modalPropuesta(p); return; }
      if (acc === 'ver') { const e3 = await D.encargo(p.codigo); location.hash = `#/${e3 ? D.slugEncargo(e3) : p.codigo}`; return; }
      ir();
    } catch (err) { alert(msg(err)); }
  };
  document.querySelectorAll('#seg button').forEach(b => b.onclick = () => { est = b.dataset.f; document.querySelectorAll('#seg button').forEach(x => x.classList.toggle('activo', x === b)); pintar(); });
  $('#buscar').oninput = pintar; pintar();
  $('#nueva').onclick = () => modalPropuesta();
}

function quedan(fechaEnvio) {
  const d = 30 - Math.round((new Date() - new Date(fechaEnvio + 'T00:00:00')) / 86400000);
  return d > 0 ? `${d} días para decidir` : 'Vence hoy';
}

function accionesPropuesta(p) {
  const b = (acc, icono, txt, cls = 'sec') => btnIco(icono, txt, `data-acc="${acc}" data-id="${p.id}"`, cls);
  const ed = b('editar', 'detalles', 'Detalles');
  const del = b('eliminar', 'borrar', 'Eliminar', 'sec peligro');
  if (p.estado === 'borrador') return ed + b('enviar', 'enviar', 'Marcar enviada') + del;
  if (p.estado === 'en_espera') return ed + b('despego', 'check', 'Despegó', 'ok') + b('no', 'x', 'No despegó') + del;
  if (p.estado === 'despego') return ed + b('ver', 'ver', 'Ver encargo');
  return b('reabrir', 'reabrir', 'Reabrir') + del;
}

// Campos de "Detalles técnicos del encargo" y "Proyecto" (igual que en el Word SCREG_2XXXX_PROPUESTA)
const DETALLES_PROPUESTA = [
  ['propietario', 'Nombre del propietario'], ['ubicacion_propietario', 'Ubicación del propietario'],
  ['documento_cliente', 'Documento del cliente', 'ancho'],
  ['ubicacion', 'Ubicación del encargo'], ['direccion', 'Dirección del encargo'],
  ['area_predio', 'Área predio'], ['area_licencia', 'Área construida en licencia'],
  ['area_existente', 'Área construida existente'], ['area_intervenida', 'Área intervenida'],
  ['categoria_trabajo', 'Categoría de trabajo', 'ancho'],
];

const aBase64 = archivo => new Promise((ok, mal) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = mal; r.readAsDataURL(archivo); });

// Lee la propuesta económica en Word (.docx) y saca los datos de la página 2 ("Detalles técnicos del encargo")
async function leerPropuestaWord(archivo) {
  await cargarJSZip();
  const zip = await JSZip.loadAsync(archivo);
  const xml = new DOMParser().parseFromString(await zip.file('word/document.xml').async('string'), 'application/xml');
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const texto = n => [...n.getElementsByTagNameNS(W, 't')].map(t => t.textContent).join('').replace(/\s+/g, ' ').trim();
  const pares = [];
  for (const par of xml.getElementsByTagNameNS(W, 'p')) { const t = texto(par); const i = t.indexOf(':'); if (i > 2 && i < 60) pares.push([t.slice(0, i), t.slice(i + 1).trim()]); }
  for (const fila of xml.getElementsByTagNameNS(W, 'tr')) { const c = [...fila.getElementsByTagNameNS(W, 'tc')].map(texto); if (c.length >= 2 && c[0] && c[1]) pares.push([c[0], c[1]]); }
  const buscar = re => (pares.find(([k, v]) => re.test(k.toLowerCase()) && v) || [])[1] || '';
  const r = {
    propietario: buscar(/nombre del propietario/), ubicacion_propietario: buscar(/ubicaci[oó]n del propietario/),
    cliente: buscar(/nombre del cliente/), documento_cliente: buscar(/documento del cliente/), ubicacion: buscar(/ubicaci[oó]n del encargo/), direccion: buscar(/direcci[oó]n del encargo/),
    area_predio: buscar(/[áa]rea( del)? predio/), area_licencia: buscar(/licencia/), area_existente: buscar(/existente/),
    area_intervenida: buscar(/intervenida/), categoria_trabajo: buscar(/categor[ií]a de trabajo/),
    servicios: buscar(/categor[ií]a de servicios|servicios regenerativo/), encargo: buscar(/^encargo$/),
  };
  // Honorarios: fila que sigue al encabezado "VALOR TOTAL"
  const filas = [...xml.getElementsByTagNameNS(W, 'tr')].map(f => [...f.getElementsByTagNameNS(W, 'tc')].map(texto));
  const h = filas.findIndex(c => c.some(x => /valor total/i.test(x)));
  if (h >= 0 && filas[h + 1]) { const v = filas[h + 1].filter(Boolean).at(-1) || ''; const n = v.replace(/[^\d]/g, ''); if (n) r.honorarios = Number(n); }
  // Si hay descuento, el valor final es el de "COSTOS REGENERATIVO SIN IVA" (o el TOTAL del plan de pagos)
  const final = filas.find(c => /costos? regenerativo/i.test(c[0] || '')) || filas.find(c => /^total$/i.test((c[0] || '').trim()));
  if (final) { const n = (final.filter(Boolean).at(-1) || '').replace(/[^\d]/g, ''); if (n) r.honorarios = Number(n); }
  const m = archivo.name.toUpperCase().match(/SCREG_\d{5}/); if (m) r.codigo = m[0];
  return r;
}

const cargarJSZip = async () => { if (!window.JSZip) await new Promise((ok, mal) => { const sc = document.createElement('script'); sc.src = 'js/vendor/jszip.min.js'; sc.onload = ok; sc.onerror = () => mal(new Error('No se pudo cargar el lector de Word.')); document.head.appendChild(sc); }); };

function bajarBase64(base64, nombre) {
  const b = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([b])); a.download = nombre;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

// Reescribe en el Word los valores de la página 2 ("Etiqueta: valor" y filas de tabla) y devuelve el .docx en base64
const ETIQUETAS_WORD = {
  propietario: /^nombre del propietario$/, ubicacion_propietario: /^ubicaci[oó]n del propietario$/,
  ubicacion: /^ubicaci[oó]n del encargo$/, direccion: /^direcci[oó]n del encargo$/,
  area_predio: /^[áa]rea( del)? predio$/, area_licencia: /licencia/, area_existente: /existente/,
  area_intervenida: /intervenida/, categoria_trabajo: /^categor[ií]a de trabajo$/,
  documento_cliente: /^documento del cliente$/, cliente_nombre: /^nombre del cliente$/,
};
// Valores para la página 2 del Word: los detalles + el nombre del cliente elegido. En un Word nuevo (desde la plantilla) lo vacío queda XXX.
function valoresWord(v, nuevo, nombreCli) {
  const o = Object.fromEntries(DETALLES_PROPUESTA.map(([k]) => [k, v[k] || (nuevo ? 'XXX' : '')]));
  if (nombreCli) o.cliente_nombre = nombreCli; else if (nuevo) o.cliente_nombre = 'XXX';
  return o;
}
async function escribirPropuestaWord(base64, valores) {
  await cargarJSZip();
  const zip = await JSZip.loadAsync(base64, { base64: true });
  const xml = new DOMParser().parseFromString(await zip.file('word/document.xml').async('string'), 'application/xml');
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const ts = n => [...n.getElementsByTagNameNS(W, 't')];
  const poner = (t, txt) => { t.textContent = txt; t.setAttribute('xml:space', 'preserve'); };
  const clave = etiqueta => { const e = etiqueta.toLowerCase().replace(/\s+/g, ' ').trim(); return Object.keys(ETIQUETAS_WORD).find(k => k in valores && ETIQUETAS_WORD[k].test(e)); };
  let cambios = 0;
  for (const par of xml.getElementsByTagNameNS(W, 'p')) {
    const nodos = ts(par); let acum = '', i = -1;
    for (let j = 0; j < nodos.length; j++) { const pos = nodos[j].textContent.indexOf(':'); if (pos >= 0) { acum += nodos[j].textContent.slice(0, pos); i = j; break; } acum += nodos[j].textContent; }
    if (i < 0 || acum.length > 60) continue;
    const k = clave(acum); if (!k) continue;
    const v = valores[k] || ''; const t = nodos[i]; const pos = t.textContent.indexOf(':');
    if (i + 1 < nodos.length && pos === t.textContent.length - 1) { poner(nodos[i + 1], ' ' + v); nodos.slice(i + 2).forEach(n => poner(n, '')); }
    else { poner(t, t.textContent.slice(0, pos + 1) + ' ' + v); nodos.slice(i + 1).forEach(n => poner(n, '')); }
    cambios++;
  }
  for (const fila of xml.getElementsByTagNameNS(W, 'tr')) {
    const celdas = [...fila.getElementsByTagNameNS(W, 'tc')]; if (celdas.length < 2) continue;
    const k = clave(ts(celdas[0]).map(t => t.textContent).join('')); if (!k) continue;
    const nodos = ts(celdas[1]); if (!nodos.length) continue;
    poner(nodos[0], valores[k] || ''); nodos.slice(1).forEach(n => poner(n, '')); cambios++;
  }
  if (!cambios) throw new Error('No encontré en el Word los campos de la página 2.');
  zip.file('word/document.xml', new XMLSerializer().serializeToString(xml));
  return await zip.generateAsync({ type: 'base64' });
}

async function modalPropuesta(p = null) {
  const [svc, cli] = await Promise.all([D.servicios(), D.clientes()]);
  const codigo = p?.codigo || await D.siguienteCodigo();
  const op = (l, sel) => l.map(x => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('');
  const fondo = document.createElement('div');
  fondo.className = 'modal-fondo';
  fondo.innerHTML = `<form class="modal ancho" id="fp">
    <h2>${p ? 'Propuesta preliminar' : 'Nueva propuesta preliminar'}</h2>
    <p class="sub">Sube la propuesta económica en Word y el portal toma los datos de la página 2 (detalles técnicos del encargo). Se guarda en su carpeta de OneDrive con el código de propuesta. Si el cliente acepta, se crea el encargo con el código de proyecto.</p>
    <div id="docs"></div>
    <label for="word">${p?.archivo_nombre ? 'Reemplazar propuesta económica (Word .docx)' : 'Propuesta económica (Word .docx)'}</label><input id="word" type="file" accept=".docx">
    <div class="aviso" id="aviso-word" style="color:var(--tinta2)">${p?.archivo_nombre ? '' : 'El Word es opcional: puedes llenar y editar los datos aquí; el documento se carga cuando esté listo (o te lo carga Claude).'}</div>
    <fieldset id="datos" style="border:0;padding:0;margin:0;min-width:0">
    <div class="grilla-form">
      <div><label>Código</label><input name="codigo" value="${esc(codigo)}" required ${p ? 'readonly' : ''}></div>
      <div><label>Nombre del proyecto (en mayúsculas)</label><input name="nombre" value="${esc(p?.nombre || '')}" placeholder="PROYECTO" required style="text-transform:uppercase"></div>
      <div class="ancho"><label>Código de proyecto (cuando despegue)</label><input id="codproy" readonly tabindex="-1" value=""></div>
      <div><label>Cliente</label><select name="cliente_id"><option value="">— Elegir —</option>${op(cli, p?.cliente_id)}<option value="__nuevo">+ Nuevo cliente…</option></select></div>
      ${checksServicios(svc, p)}
      <input type="hidden" name="tipo" value="${p?.tipo || 'ambos'}">
      <div><label>Fecha de envío</label><input name="fecha_envio" type="date" value="${p?.fecha_envio || ''}"></div>
      <div><label>Valor total final, con descuento, sin IVA (COP)</label><input name="honorarios" inputmode="numeric" placeholder="8.200.000" value="${p?.honorarios ? Number(p.honorarios).toLocaleString('es-CO').replace(/,/g, '.') : ''}"></div>
    </div>
    <h3 style="margin:28px 0 0">Detalles técnicos del encargo</h3>
    <div class="grilla-form">
      ${DETALLES_PROPUESTA.map(([k, t, c]) => `<div class="${c || ''}"><label>${t}</label><input name="${k}" value="${esc(p?.[k] || '')}"${k === 'documento_cliente' ? ' placeholder="NIT o cédula (p. ej. NIT 830.018.957-3) · No aplica · XXX si aún no lo tienes"' : ''}></div>`).join('')}
    </div>
    ${p?.archivo_nombre ? '<p class="sub" style="margin-top:12px">Si cambias los detalles técnicos, el Word de la propuesta económica se actualiza en OneDrive al guardar.</p>' : ''}
    </fieldset>
    <div class="aviso" id="aviso"></div>
    <div class="pie-modal"><button type="button" class="btn sec" id="cancelar">Cancelar</button><button class="btn" type="submit">${p ? 'Guardar' : 'Crear propuesta'}</button></div>
  </form>`;
  document.body.appendChild(fondo);
  const f = $('#fp', fondo);
  const docs = $('#docs', fondo);
  if (p?.archivo_nombre) {
    const tipo = n => /\.pdf$/i.test(n) ? 'PDF' : /\.xlsx?$/i.test(n) ? 'Excel' : 'Word';
    const pintarDocs = lista => {
      docs.innerHTML = `<h3 style="margin:8px 0 6px">Documentos de la propuesta</h3>
        <div class="od-lista prop-docs">${lista.map((a, i) => `<div class="od-fila"><div class="od-nom"><b>${esc(a.nombre)}</b><span class="sub">${tipo(a.nombre)}</span></div>
          <div class="od-acc">${a.web ? enlaceIco('abrir', 'Abrir en OneDrive', esc(a.web)) : ''}${btnIco('descargar', 'Descargar ' + tipo(a.nombre), `data-bajar="${i}"`)}</div></div>`).join('')}</div>
        <p class="sub" id="sinc" style="margin-top:8px"></p>`;
      const bajar = async (b, pdf) => {
        const a = lista[b.dataset.bajar ?? b.dataset.pdf]; const t = b.innerHTML; b.disabled = true; b.textContent = '…';
        try {
          if (D.MODO_DEMO) throw new Error('En modo demostración no hay OneDrive: la descarga funciona en el portal real.');
          const r = await D.onedrive('archivo_propuesta', { propuesta_id: p.id, nombre: a.nombre, pdf }); bajarBase64(r.base64, r.nombre);
        } catch (err) { alert(msg(err)); } finally { b.disabled = false; b.innerHTML = t; }
      };
      docs.querySelectorAll('[data-bajar]').forEach(b => b.onclick = () => bajar(b, false));
      docs.querySelectorAll('[data-pdf]').forEach(b => b.onclick = () => bajar(b, true));
    };
    if (D.MODO_DEMO) pintarDocs([{ nombre: p.archivo_nombre, web: '' }]);
    else {
      docs.innerHTML = '<p class="sub">Buscando documentos en OneDrive…</p>';
      D.onedrive('archivos_propuesta', { propuesta_id: p.id })
        .then(r => { pintarDocs(r.archivos?.length ? r.archivos : [{ nombre: p.archivo_nombre, web: p.archivo_web }]); sincronizarDesdeWord(); })
        .catch(err => { docs.innerHTML = `<p class="sub">No se pudieron leer los documentos: ${esc(msg(err))}</p>`; });
    }
  }
  // Si el Word se editó en OneDrive (por ejemplo, terminado con Claude), el portal toma sus datos al abrir
  async function sincronizarDesdeWord() {
    const aviso = $('#sinc', fondo);
    try {
      aviso.textContent = 'Comparando con el Word de OneDrive…';
      const w = await D.onedrive('descargar_propuesta', { propuesta_id: p.id });
      const r = await leerPropuestaWord(new File([Uint8Array.from(atob(w.base64), c => c.charCodeAt(0))], w.nombre));
      const cambios = {};
      for (const [k] of DETALLES_PROPUESTA) if (r[k] && r[k] !== (p[k] || '')) { cambios[k] = r[k]; f[k].value = r[k]; }
      if (r.honorarios && Number(r.honorarios) !== Number(p.honorarios || 0)) { cambios.honorarios = r.honorarios; f.honorarios.value = Number(r.honorarios).toLocaleString('es-CO').replace(/,/g, '.'); }
      if (Object.keys(cambios).length) { await D.actualizarPropuesta(p.id, cambios); Object.assign(p, cambios); aviso.style.color = 'var(--petroleo)'; aviso.textContent = `Datos actualizados desde el Word de OneDrive (${Object.keys(cambios).length}).`; }
      else aviso.textContent = 'Los datos coinciden con el Word de OneDrive.';
    } catch (err) { aviso.textContent = 'No se pudo comparar con el Word: ' + msg(err); }
  }
  $('#cancelar', fondo).onclick = () => fondo.remove();
  f.honorarios.oninput = () => { const n = f.honorarios.value.replace(/\D/g, ''); f.honorarios.value = n ? Number(n).toLocaleString('es-CO').replace(/,/g, '.') : ''; };
  const codProy = () => { const n = f.nombre.value.trim().toUpperCase().replace(/^\d{2}\s+I\s+/, ''); $('#codproy', fondo).value = `${(f.codigo.value.match(/_(\d{2})/) || [, '26'])[1]}  I  ${n || 'NOMBRE'}`; };
  f.nombre.oninput = codProy; f.codigo.oninput = codProy; codProy();
  let archivoWord = null, clienteNuevo = '';
  $('#word', fondo).onchange = async ev => {
    const a = ev.target.files[0]; if (!a) return;
    const av = $('#aviso-word', fondo); av.style.color = ''; av.textContent = 'Leyendo la propuesta…';
    try {
      const r = await leerPropuestaWord(a); archivoWord = a;
      const fa = a.name.match(/(20\d{2})[ _.-](\d{2})[ _.-](\d{2})/); if (fa && !f.fecha_envio.value) f.fecha_envio.value = `${fa[1]}-${fa[2]}-${fa[3]}`;
      if (r.codigo && !p) f.codigo.value = r.codigo;
      const nombre = (r.encargo || '').toUpperCase().replace(/\s*I\s*/g, ' ').replace(/\s+/g, ' ').trim();
      if (nombre && !f.nombre.value) f.nombre.value = nombre;
      for (const [k] of DETALLES_PROPUESTA) if (r[k]) f[k].value = r[k];
      if (r.honorarios) f.honorarios.value = Number(r.honorarios).toLocaleString('es-CO').replace(/,/g, '.');
      if (r.cliente) {
        const c = cli.find(x => x.nombre.toLowerCase() === r.cliente.toLowerCase());
        if (c) f.cliente_id.value = c.id; else { clienteNuevo = r.cliente; f.cliente_id.value = ''; }
      }
      if (r.servicios) { const txt = r.servicios.toLowerCase(); f.querySelectorAll('input[name=servicios]').forEach(c => { if (txt.includes(c.value.toLowerCase())) c.checked = true; }); }
      codProy(); $('#datos', fondo).disabled = false;
      av.style.color = 'var(--petroleo)';
      av.textContent = 'Datos cargados desde la propuesta. Revísalos y guarda.' + (clienteNuevo ? ` El cliente "${clienteNuevo}" no existe todavía: se crea al guardar.` : '');
    } catch (err) { av.textContent = 'No se pudo leer el Word: ' + msg(err); }
  };
  f.cliente_id.onchange = async () => {
    if (f.cliente_id.value !== '__nuevo') return;
    const nombre = await preguntar('Nombre o razón social del cliente', { ok: 'Crear cliente' });
    if (!nombre) { f.cliente_id.value = ''; return; }
    const c = await D.crearCliente({ tipo: 'empresa', nombre: nombre.trim().toUpperCase() });
    f.cliente_id.insertAdjacentHTML('afterbegin', `<option value="${c.id}">${esc(c.nombre)}</option>`);
    f.cliente_id.value = c.id;
  };
  f.onsubmit = async ev => {
    ev.preventDefault();
    const v = Object.fromEntries(new FormData(f)); leerServicios(f, v);
    if (archivoWord && D.MODO_DEMO) v.archivo_nombre = archivoWord.name;
    v.nombre = v.nombre.trim().toUpperCase().replace(/^\d{2}\s+I\s+/, '');
    v.honorarios = v.honorarios ? Number(v.honorarios.replace(/\D/g, '')) : null;
    v.fecha_envio = v.fecha_envio || null;
    if (!v.cliente_id && clienteNuevo) { const c = await D.crearCliente({ tipo: 'persona', nombre: clienteNuevo.trim().toUpperCase() }); v.cliente_id = c.id; }
    if (!v.cliente_id) v.cliente_id = null;
    const nombreCli = cli.find(c => c.id === v.cliente_id)?.nombre || (clienteNuevo ? clienteNuevo.trim().toUpperCase() : null);
    for (const [k] of DETALLES_PROPUESTA) v[k] = (v[k] || '').trim() || null;
    // El documento de la propuesta alimenta la ficha del cliente cuando esta no lo tiene
    const docCli = v.documento_cliente && !/^(xxx|no aplica|n\/a)$/i.test(v.documento_cliente) ? v.documento_cliente : null;
    const fichaCli = cli.find(c => c.id === v.cliente_id);
    if (docCli && fichaCli && !fichaCli.documento) {
      const m = docCli.match(/^(NIT|CC|C\.C\.?|CE|Pasaporte)\s*:?\s*(.+)$/i);
      D.actualizarCliente(fichaCli.id, m ? { tipo_documento: m[1].toUpperCase().replace(/C\.C\.?/, 'CC'), documento: m[2].trim() } : { documento: docCli }).catch(() => {});
    }
    try {
      const n = p ? (delete v.codigo, await D.actualizarPropuesta(p.id, v)) : await D.crearPropuesta(v);
      if (!D.MODO_DEMO) {
        try {
          const cambio = p && !archivoWord && p.archivo_nombre && (DETALLES_PROPUESTA.some(([k]) => (p[k] || null) !== v[k]) || (p.cliente_id || null) !== v.cliente_id);
          let r;
          if (archivoWord) r = await D.onedrive('subir_propuesta', { propuesta_id: n.id, nombre: archivoWord.name, base64: await aBase64(archivoWord) });
          else if (cambio) {
            const w = await D.onedrive('descargar_propuesta', { propuesta_id: n.id });
            const base64 = await escribirPropuestaWord(w.base64, valoresWord(v, false, (p.cliente_id || null) !== v.cliente_id ? nombreCli : null));
            r = await D.onedrive('subir_propuesta', { propuesta_id: n.id, nombre: w.nombre, base64 });
            alert('Propuesta guardada y Word actualizado en OneDrive.');
          } else {
            r = await D.onedrive('propuesta', { propuesta_id: n.id });
            // Word nuevo desde la plantilla: se le escriben los detalles de la página 2 que ya se llenaron
            if (r.word) {
              try {
                const w = await D.onedrive('descargar_propuesta', { propuesta_id: n.id });
                const base64 = await escribirPropuestaWord(w.base64, valoresWord(v, true, nombreCli));
                await D.onedrive('subir_propuesta', { propuesta_id: n.id, nombre: w.nombre, base64 });
              } catch (_) { /* el Word queda con la plantilla tal cual */ }
            }
          }
          if (!p || archivoWord) alert(`Propuesta guardada.\nOneDrive: ${r.ruta || r.carpeta}`);
        } catch (e2) { alert('La propuesta se guardó, pero no se pudo guardar en OneDrive: ' + msg(e2)); }
      }
      fondo.remove(); ir();
    } catch (err) { $('#aviso', fondo).textContent = msg(err); }
  };
}

// ---------------- Base de precios ----------------
async function vistaBasePrecios(s, pestana) {
  const v = await M.vistaBase(s.admin, pestana === 'insumos' ? 'insumos' : 'apu');
  marco(s, { titulo: 'Base de precios', eyebrow: 'Común a todos los encargos', ruta: 'Portal · común a todos los encargos', activo: 'base', html: v.html });
  if (v.montar) v.montar(ir);
}

// Nombres como "26  I  REFORMA 102": el HTML junta los espacios dobles en uno; se fijan con espacio duro para que se vean dos
(() => {
  const fijar = raizN => {
    const w = document.createTreeWalker(raizN, NodeFilter.SHOW_TEXT, { acceptNode: t => /\S {2,}\S/.test(t.data) && !t.parentElement?.closest('script,style,textarea,pre,code') ? 1 : 3 });
    const l = []; while (w.nextNode()) l.push(w.currentNode);
    l.forEach(t => { t.data = t.data.replace(/(\S) {2}(?=\S)/g, '$1\u00a0 ').replace(/(\S) {3,}(?=\S)/g, (m, a) => a + '\u00a0 '.repeat(Math.floor((m.length - 1) / 2)) + ((m.length - 1) % 2 ? ' ' : '')); });
  };
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) fijar(n); else if (n.nodeType === 3 && n.parentElement) fijar(n.parentElement); }))).observe(document.body, { childList: true, subtree: true });
  fijar(document.body);
})();

// Títulos que aparecen palabra por palabra (mismo gesto de regenerativo.co)
(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const partir = () => document.querySelectorAll('h1:not([data-w])').forEach(h => {
    h.dataset.w = '1';
    if (h.querySelector('img,svg,input,a,button')) return;
    let n = 0;
    const rec = nodo => [...nodo.childNodes].forEach(c => {
      if (c.nodeType === 3) {
        const partes = c.textContent.split(/(\s+)/);
        const fr = document.createDocumentFragment();
        partes.forEach(p => {
          if (!p) return;
          if (/^\s+$/.test(p)) { fr.appendChild(document.createTextNode(p)); return; }
          const w = document.createElement('span'); w.className = 'lv-w';
          const i = document.createElement('span'); i.style.setProperty('--wd', (n++ * 70) + 'ms'); i.textContent = p;
          w.appendChild(i); fr.appendChild(w);
        });
        c.replaceWith(fr);
      } else if (c.nodeType === 1 && c.tagName !== 'BR') rec(c);
    });
    rec(h);
  });
  new MutationObserver(partir).observe(document.body, { childList: true, subtree: true });
  partir();
})();

// Acceso: alterna "No intervenimos, regeneramos." y "Together is more." con un desvanecido lento
setInterval(() => {
  const fr = document.querySelectorAll('.lv-acc-frase');
  if (fr.length < 2 || document.hidden) return;
  const i = [...fr].findIndex(f => f.classList.contains('on'));
  fr[i].classList.remove('on'); fr[i].setAttribute('aria-hidden', 'true');
  const n = fr[(i + 1) % fr.length]; n.classList.add('on'); n.removeAttribute('aria-hidden');
}, 6500);

// Inicio: "Sobre regenerativo" alterna sus dos frases con un desvanecido muy lento (cada 20 s)
setInterval(() => {
  const fr = document.querySelectorAll('.ha-frase');
  if (fr.length < 2 || document.hidden) return;
  const i = [...fr].findIndex(f => f.classList.contains('on'));
  fr[i].classList.remove('on'); fr[i].setAttribute('aria-hidden', 'true');
  const n = fr[(i + 1) % fr.length]; n.classList.add('on'); n.removeAttribute('aria-hidden');
}, 20000);
