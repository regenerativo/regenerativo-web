import * as D from './datos.js?v=22';
import * as M from './modulos.js?v=22';
import { vistaFinanzas } from './finanzas.js?v=22';
import { cop, fecha, pct, diasDeTrabajo, fechaCorte, DIAS_TRABAJO, TIPOS, ESTADOS_ENCARGO } from './formato.js?v=22';

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
let cargando = null;

const MODULOS = [
  ['resumen', 'Resumen', true],
  ['brief', 'Brief', true], ['propuesta', 'Propuesta económica', true], ['contrato', 'Contrato', true], ['adendas', 'Adendas', true],
  ['presupuesto', 'Presupuesto', true], ['gantt', 'Gantt', true], ['informes', 'Informes', true],
  ['ajustes', 'Ajustes del encargo', true],
];
const FASE = { brief: 2, propuesta: 2, contrato: 3, adendas: 3, presupuesto: 4, gantt: 5, informes: 5 };

// ---------------- Router ----------------
window.addEventListener('hashchange', ir);
ir();

async function ir() {
  clearTimeout(cargando);
  cargando = setTimeout(() => document.body.classList.add('cargando'), 150);
  try { await irSeguro(); }
  catch (err) {
    console.error(err);
    raiz.innerHTML = `<div class="acceso"><div class="acceso-caja"><img src="/assets/33b2a586a276.png" alt=""><h1>Sin conexión</h1><p>${esc(msg(err))}</p>
      <button class="btn full" onclick="location.reload()">Reintentar</button></div></div>`;
  } finally { clearTimeout(cargando); document.body.classList.remove('cargando'); }
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
    if (p.length === 0) return await vistaEncargos(s);
    if (p[0] === 'encargos' && p[1]) return await vistaExpediente(s, decodeURIComponent(p[1]), p[2] || 'resumen', p[3]);
    const RESERVADAS = ['finanzas', 'base-precios', 'ajustes', 'propuestas', 'acceso', 'recuperar', 'nueva-clave', 'encargos'];
    if (p[0] && !RESERVADAS.includes(p[0])) return await vistaExpediente(s, decodeURIComponent(p[0]), p[1] || 'resumen', p[2]);
    if (p[0] === 'finanzas' && s.facturacion) {
      const v = await vistaFinanzas(p[1], p[2]);
      marco(s, { titulo: 'Finanzas', ruta: 'Portal · solo perfil de facturación', activo: 'finanzas', html: v.html });
      v.montar(ir); return;
    }
    if (p[0] === 'base-precios' && s.admin) return await vistaBasePrecios(s, p[1]);
    if (p[0] === 'ajustes' && s.admin) return await vistaAjustes(s, qs);
    if (p[0] === 'propuestas' && s.admin) return await vistaPropuestas(s);
    return marco(s, { titulo: 'Página no encontrada', html: `<div class="vacio">Esta página no existe. <a href="#/">Volver a los encargos</a></div>` });
  } catch (err) {
    console.error(err);
    marco(s, { titulo: 'Algo salió mal', html: `<div class="vacio">${esc(msg(err))}<br><br><a href="#/">Volver a los encargos</a></div>` });
  }
}

// ---------------- Marco general ----------------
function marco(s, { titulo, ruta = '', acciones = '', html, menu = null, activo = '' }) {
  const esCli = s.email.endsWith('@clientes.portal.regenerativo.co');
  const enlacesGen = esCli ? '' : `
    <div class="grupo">Portal</div>
    ${s.admin ? `<a href="#/propuestas" class="${activo === 'propuestas' ? 'activo' : ''}">Propuestas preliminares</a>` : ''}
    ${s.soloFinanzas ? '' : `<a href="#/" class="${activo === 'encargos' ? 'activo' : ''}">Encargos</a>`}
    ${s.facturacion ? `<a href="#/finanzas" class="${activo === 'finanzas' ? 'activo' : ''}">Finanzas</a>` : ''}
    ${s.admin ? `<a href="#/base-precios" class="${activo === 'base' ? 'activo' : ''}">Base de precios</a>` : ''}
    ${s.admin ? `<a href="#/ajustes" class="${activo === 'ajustes' ? 'activo' : ''}">Ajustes generales</a>` : ''}`;
  const tituloPag = ruta.includes(' / ') ? ruta.split(' / ').pop() : titulo;
  const subPag = '';
  raiz.innerHTML = `
  <header class="barra-web">
    <div class="barra-web-in">
      <div class="barra-izq"><button class="menu-movil" id="abrir-menu" aria-label="Menú">☰</button><span class="barra-enc">${titulo}</span></div>
      <a href="#/" class="logo-reg" aria-label="regenerativo, inicio">regenerativo</a>
    </div>
  </header>
  <div class="app">
    <nav class="lado" id="lado">
      ${menu || ''}
      ${enlacesGen}
      <div class="pie">${s.email.endsWith('@clientes.portal.regenerativo.co') ? 'Acceso de cliente' : esc(s.email)}<br><button id="salir">Cerrar sesión</button></div>
    </nav>
    <div class="main">
      ${D.MODO_DEMO ? '<div class="demo">Modo demostración: los datos son de ejemplo y se guardan solo en este navegador.</div>' : ''}
      <div class="titulo-pag">
        <div><h1>${tituloPag}</h1>${subPag ? `<p>${subPag}</p>` : ''}</div>
        <div class="acciones">${acciones}</div>
      </div>
      <main class="cont">${html}</main>
      <footer class="remate">
        <div class="remate-fin">
          <span class="porx"><span class="p1">Por</span><span class="ln"></span><span class="p2">regenerativo</span></span>
          <span class="g c">No intervenimos, regeneramos.</span>
          <span class="g d">© ${new Date().getFullYear()} regenerativo</span>
        </div>
      </footer>
    </div>
  </div>`;
  $('#salir').onclick = async () => { await D.salir(); location.hash = '#/acceso'; };
  $('#abrir-menu').onclick = e => { e.stopPropagation(); $('#lado').classList.toggle('abierto'); };
  document.body.onclick = e => { const l = $('#lado'); if (l && l.classList.contains('abierto') && !l.contains(e.target)) l.classList.remove('abierto'); };
}

// ---------------- Acceso ----------------
function vistaAcceso() {
  let modo = sessionStorage.getItem('reg-modo-acceso') || 'cliente';
  const pintar = () => {
    const cli = modo === 'cliente';
    raiz.innerHTML = `
    <div class="acceso"><form class="acceso-caja" id="f">
      <img src="/assets/33b2a586a276.png" alt="regenerativo">
      <h1>Portal de encargos</h1>
      <div class="pestanas">
        <button type="button" class="${cli ? 'activa' : ''}" data-m="cliente">Clientes</button>
        <button type="button" class="${cli ? '' : 'activa'}" data-m="equipo">Equipo regenerativo</button>
      </div>
      ${cli
        ? `<label for="usuario">Nombre del encargo</label><input id="usuario" autocomplete="username" placeholder="Ej.: 20  I  PROYECTO" required>`
        : `<label for="usuario">Correo</label><input id="usuario" type="email" autocomplete="username" required>`}
      <label for="clave">${cli ? 'Acceso' : 'Contraseña'}</label><input id="clave" type="password" autocomplete="current-password" ${D.MODO_DEMO ? '' : 'required'}>
      <button class="btn full" type="submit">Ingresar</button>
      <div class="aviso" id="aviso"></div>
      ${cli ? '<p class="sub" style="margin:18px 0 0">¿No tienes tu acceso? Pídelo a regenerativo.</p>'
            : '<p style="margin:18px 0 0;font-size:13px"><a href="#/recuperar">Olvidé mi contraseña</a></p>'}
      <div class="firma"><span class="por">Por</span><span class="linea"></span><span class="reg">regenerativo</span></div>
    </form></div>`;
    document.querySelectorAll('.pestanas button').forEach(b => b.onclick = () => {
      modo = b.dataset.m; try { sessionStorage.setItem('reg-modo-acceso', modo); } catch (e) {} pintar();
    });
    $('#f').onsubmit = async e => {
      e.preventDefault();
      const btn = $('#f .btn.full'); btn.disabled = true; $('#aviso').textContent = '';
      try {
        if (modo === 'cliente') await D.ingresarCliente($('#usuario').value, $('#clave').value);
        else await D.ingresar($('#usuario').value.trim(), $('#clave').value);
        location.hash = '#/';
      } catch (err) { $('#aviso').textContent = msg(err); btn.disabled = false; }
    };
  };
  pintar();
}

function vistaNuevaClave(enlace) {
  document.body.classList.add('ingreso');
  if (enlace.error) {
    raiz.innerHTML = `<div class="acceso"><div class="acceso-caja"><img src="/assets/33b2a586a276.png" alt=""><h1>El enlace ya no sirve</h1>
      <p>${esc(enlace.error)}. Pide una nueva invitación o usa "Olvidé mi contraseña".</p><a class="btn full" href="#/acceso">Ir al ingreso</a></div></div>`;
    return;
  }
  const bienvenida = enlace.tipo === 'invite';
  raiz.innerHTML = `
  <div class="acceso"><form class="acceso-caja" id="f">
    <img src="/assets/33b2a586a276.png" alt="regenerativo">
    <h1>${bienvenida ? 'Bienvenido al portal' : 'Nueva contraseña'}</h1>
    <p>${bienvenida ? 'Crea tu contraseña para entrar a tus encargos.' : 'Escribe tu nueva contraseña.'}</p>
    <label for="c1">Contraseña (mínimo 8 caracteres)</label><input id="c1" type="password" autocomplete="new-password" minlength="8" required>
    <label for="c2">Repítela</label><input id="c2" type="password" autocomplete="new-password" minlength="8" required>
    <button class="btn full" type="submit">Guardar y entrar</button>
    <div class="aviso" id="aviso"></div>
  </form></div>`;
  $('#f').onsubmit = async e => {
    e.preventDefault();
    if ($('#c1').value !== $('#c2').value) { $('#aviso').textContent = 'Las contraseñas no coinciden.'; return; }
    try { await D.cambiarClave($('#c1').value); history.replaceState(null, '', location.pathname + '#/'); ir(); }
    catch (err) { $('#aviso').textContent = msg(err); }
  };
}

function vistaRecuperar() {
  raiz.innerHTML = `
  <div class="acceso"><form class="acceso-caja" id="f">
    <img src="/assets/33b2a586a276.png" alt="regenerativo">
    <h1>Recuperar contraseña</h1>
    <p>Te enviaremos un enlace para crear una nueva.</p>
    <label for="email">Correo</label><input id="email" type="email" required>
    <button class="btn full" type="submit">Enviar enlace</button>
    <div class="aviso" id="aviso"></div>
    <p style="margin:18px 0 0;font-size:13px"><a href="#/acceso">Volver al ingreso</a></p>
  </form></div>`;
  $('#f').onsubmit = async e => {
    e.preventDefault();
    try { await D.recuperarClave($('#email').value.trim()); $('#aviso').style.color = 'var(--petroleo)'; $('#aviso').textContent = 'Si el correo está registrado, te llegará el enlace.'; }
    catch (err) { const b = $('#f button[type=submit]'); if (!esperaReenvio(err, b, $('#aviso'))) $('#aviso').textContent = msg(err); }
  };
}

// ---------------- Lista de encargos ----------------
async function vistaEncargos(s) {
  const lista = await D.encargos();
  const admin = s.admin;
  if (!admin && lista.length === 1) { location.replace(`#/${D.slugEncargo(lista[0])}`); return; }
  const fest = new Set((await D.festivos()).map(f => f.fecha));
  const conTiempo = lista.map(e => ({ ...e, tiempo: tiempoTranscurrido(e, fest) }));
  const activos = conTiempo.filter(e => e.estado === 'activo');
  const html = `
    <div class="kpis">
      ${kpi('Encargos activos', activos.length, `${lista.length} en total`)}
      ${kpi('Pausados', lista.filter(e => e.estado === 'pausado').length, 'En espera')}
      ${kpi('Cerrados', lista.filter(e => e.estado === 'cerrado').length, 'Terminados')}
      ${kpi('Por terminar este mes', activos.filter(e => e.fin && e.fin.slice(0, 7) === new Date().toISOString().slice(0, 7)).length, 'Fecha de fin en el mes')}
    </div>
    <div class="filtros">
      <input id="buscar" placeholder="Buscar por nombre, código o cliente">
      <select id="festado"><option value="">Todos los estados</option>${Object.entries(ESTADOS_ENCARGO).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
    </div>
    <div id="tabla"></div>`;
  marco(s, { titulo: 'Encargos', ruta: 'Portal', activo: 'encargos', html,
    acciones: admin ? '<button class="btn" id="nuevo">+ Nuevo encargo</button>' : '' });
  const pintar = () => {
    const q = $('#buscar').value.toLowerCase(), est = $('#festado').value;
    const f = conTiempo.filter(e => (!est || e.estado === est) &&
      (!q || [e.nombre, e.codigo, e.cliente?.nombre].join(' ').toLowerCase().includes(q)));
    $('#tabla').innerHTML = f.length ? `
      <div class="tabla-cont"><table>
        <thead><tr><th>Encargo</th><th class="col-opc">Cliente</th><th class="col-opc">Inicio</th><th class="col-opc">Fin</th><th>Tiempo</th><th>Estado</th></tr></thead>
        <tbody>${f.map(e => `
          <tr class="clic" data-c="${D.slugEncargo(e)}">
            <td><b>${esc(e.nombre)}</b><div class="sub">${esc(e.servicio?.nombre || '')}</div></td>
            <td class="col-opc">${xxx(e.cliente?.nombre)}</td>
            <td class="col-opc">${fecha(e.inicio)}</td><td class="col-opc">${fecha(e.fin)}</td>
            <td style="min-width:90px">${pct(e.tiempo)}<div class="barra"><i style="width:${Math.round((e.tiempo || 0) * 100)}%"></i></div></td>
            <td><span class="etiqueta ${e.estado}">${ESTADOS_ENCARGO[e.estado] || e.estado}</span></td>
          </tr>`).join('')}</tbody></table></div>`
      : `<div class="vacio">${lista.length ? 'Ningún encargo coincide con la búsqueda.' : 'Todavía no hay encargos.'}</div>`;
    document.querySelectorAll('tr.clic').forEach(tr => tr.onclick = () => location.hash = `#/${tr.dataset.c}`);
  };
  $('#buscar').oninput = pintar; $('#festado').onchange = pintar; pintar();
  if (admin) $('#nuevo').onclick = () => modalEncargo();
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
      <div><label>Cotización</label><input name="codigo" value="${esc(codigo)}" required ${e ? 'readonly' : ''}></div>
      <div><label>Nombre del encargo</label><input name="nombre" value="${esc(e?.nombre || '')}" placeholder="20  I  PROYECTO" required></div>
      <div><label>Cliente</label><select name="cliente_id"><option value="">— Elegir —</option>${op(cli, e?.cliente_id)}<option value="__nuevo">+ Nuevo cliente…</option></select></div>
      <div><label>Servicio</label><select name="servicio_id">${op(svc, e?.servicio_id)}</select></div>
      <input type="hidden" name="tipo" value="${e?.tipo || 'ambos'}">
      <div><label>Estado</label><select name="estado">${opMap(ESTADOS_ENCARGO, e?.estado || 'activo')}</select></div>
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
    const nombre = prompt('Nombre o razón social del cliente');
    if (!nombre) { f.cliente_id.value = ''; return; }
    const c = await D.crearCliente({ tipo: 'empresa', nombre: nombre.trim() });
    f.cliente_id.insertAdjacentHTML('afterbegin', `<option value="${c.id}">${esc(c.nombre)}</option>`);
    f.cliente_id.value = c.id;
  };
  f.onsubmit = async ev => {
    ev.preventDefault();
    const v = Object.fromEntries(new FormData(f));
    for (const k of ['area_m2', 'inicio', 'fin', 'fecha_corte', 'cliente_id']) if (v[k] === '') v[k] = null;
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

// ---------------- Expediente ----------------
async function vistaExpediente(s, codigo, seccion, sub) {
  const e = await D.encargo(codigo);
  if (!e) return marco(s, { titulo: 'Encargo no encontrado', html: `<div class="vacio">No existe el encargo ${esc(codigo)} o no tienes acceso. <a href="#/">Volver a los encargos</a></div>` });
  const admin = await D.esAdmin();
  const base = `#/${D.slugEncargo(e)}`;
  const rol = s.admin ? 'admin' : await D.miRol(e.id);
  const visibles = MODULOS.filter(([k]) => moduloAplica(k, e.tipo) && (k !== 'ajustes' || admin) && !(k === 'adendas' && rol === 'cliente'));
  const menu = visibles.map(([k, n, listo]) =>
    `<a href="${k === 'resumen' ? base : base + '/' + k}" class="${k === seccion ? 'activo' : ''}">${n}${listo ? '' : '<span class="pronto">Próximamente</span>'}</a>`).join('');
  const nombreSec = (MODULOS.find(m => m[0] === seccion) || [, 'Resumen'])[1];
  const comun = { s, menu, ruta: `Encargos / ${esc(e.codigo)} / ${nombreSec}`, titulo: esc(e.nombre) };
  const fest = new Set((await D.festivos()).map(f => f.fecha));

  const ctx = { e, s, admin, rol, esCliente: rol === 'cliente', fest, base, sub, recargar: ir };
  if (M.VISTAS[seccion]) {
    const v = await M.VISTAS[seccion](ctx);
    marco(s, { ...comun, ruta: `Encargos / ${esc(e.codigo)} / ${nombreSec}`, html: v.html });
    if (v.montar) v.montar();
    return;
  }
  if (seccion === 'resumen') {
    const ind = await M.indicadores(ctx);
    const t = tiempoTranscurrido(e, fest);
    const total = e.inicio && e.fin ? diasDeTrabajo(e.inicio, e.fin, e.dias_trabajo, fest) : null;
    const corte = fechaCorte(e.fecha_corte);
    const hechos = e.inicio ? diasDeTrabajo(e.inicio, corte, e.dias_trabajo, fest) : 0;
    const html = `
      <div class="kpis">
        ${kpi('Tiempo transcurrido', pct(t), `Corte al ${fecha(corte)}`, t || 0)}
        ${kpi('Días de trabajo', total ?? '—', total ? `${Math.max(0, total - hechos)} restantes · ${DIAS_TRABAJO[e.dias_trabajo]}` : 'Faltan fechas')}
        ${kpi('Avance real', ind.avance != null ? pct(ind.avance) : '—', ind.avance != null ? `Esperado al corte ${pct(ind.esperado)}` : 'Sin cronograma todavía', ind.avance || 0)}
        ${kpi('Valor del contrato', ind.contrato ? cop(ind.contrato) : '—', ind.contrato ? 'Propuesta + adendas aprobadas' : 'Sin propuesta aprobada')}
      </div>
      <div class="dos">
        <section class="panel">
          <h3>Detalles técnicos del encargo</h3>
          <dl class="datos">
            <dt>Encargo</dt><dd class="det">${esc(e.nombre)}</dd>
            <dt>Cliente</dt><dd class="det">${xxx(e.cliente?.nombre)}</dd>
            <dt>Servicio</dt><dd class="det">${xxx(e.servicio?.nombre)}</dd>
            <dt>Ubicación</dt><dd class="det">${xxx(e.direccion)}${e.ciudad ? ', ' + esc(e.ciudad) : ''}</dd>
            <dt>Área</dt><dd class="det">${e.area_m2 ? esc(e.area_m2) + ' m²' : xxx('')}</dd>
            <dt>Inicio · Fin</dt><dd class="det">${fecha(e.inicio)} · ${fecha(e.fin)}</dd>
            <dt>Días de trabajo</dt><dd class="det">${DIAS_TRABAJO[e.dias_trabajo] || ''}</dd>
            <dt>Responsables</dt><dd class="det">${e.responsables.length ? e.responsables.map(r => `${r.numero}. ${esc(r.nombre)}`).join('<br>') : xxx('')}</dd>
          </dl>
        </section>
        <section class="panel">
          <h3>Módulos</h3>
          <div class="modulos">${visibles.filter(([k]) => FASE[k]).map(([k, n]) =>
            `<a class="modulo" href="${base}/${k}"><b>${n}</b><span>Abrir</span></a>`).join('')}</div>
        </section>
      </div>`;
    return marco({ ...s }, { ...comun, html, acciones: admin ? `<a class="btn sec" href="${base}/ajustes">Editar datos</a>` : '' });
  }

  if (seccion === 'ajustes') {
    if (!admin) { location.hash = base; return; }
    const html = `
      <div class="dos">
        <section class="panel">
          <h3>Datos generales</h3>
          <p class="sub" style="margin-top:-6px">Nombre, cliente, fechas, días de trabajo y fecha de corte.</p>
          <button class="btn sec" id="editar">Editar datos generales</button>
        </section>
        <section class="panel">
          <h3>Responsables</h3>
          <p class="sub" style="margin-top:-6px">El Gantt elige al responsable por su número; si cambias un nombre aquí, se actualiza en todo el encargo.</p>
          <div class="tabla-cont"><table><thead><tr><th style="width:52px">N°</th><th>Nombre</th><th class="col-opc">Cargo</th><th style="width:40px"></th></tr></thead>
          <tbody id="resp"></tbody></table></div>
          <div style="display:flex;gap:8px;margin-top:12px"><button class="btn sec" id="agregar">+ Agregar responsable</button><button class="btn" id="guardar-resp">Guardar</button></div>
          <div class="aviso" id="aviso-resp"></div>
        </section>
        <section class="panel">
          <h3>Acceso del cliente</h3>
          <p class="sub" style="margin-top:-6px">El cliente entra en la pestaña "Clientes" con el nombre del encargo y esta contraseña. Solo puede ver este encargo. Al cambiarla, todos los que tenían la anterior quedan fuera.</p>
          <dl class="datos" style="margin:10px 0 4px"><dt>Usuario</dt><dd class="det">${esc(e.nombre)}</dd>
            <dt>Estado</dt><dd class="det">${e.cliente_usuario_id ? 'Activo' : '<span class="xxx">Sin acceso asignado</span>'}</dd></dl>
          <label>${e.cliente_usuario_id ? 'Nueva contraseña' : 'Contraseña'} (mínimo 8 caracteres)</label>
          <input id="clave-cliente" type="text" autocomplete="off" minlength="8">
          <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
            <button class="btn" id="asignar-clave">${e.cliente_usuario_id ? 'Cambiar contraseña' : 'Asignar contraseña'}</button>
            ${e.cliente_usuario_id ? '<button class="btn sec" id="quitar-clave">Quitar acceso</button>' : ''}
          </div>
          <div class="aviso" id="aviso-cli"></div>
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
      </div>`;
    marco(s, { ...comun, html });
    $('#editar').onclick = () => modalEncargo(e);
    let resp = e.responsables.map(r => ({ ...r }));
    const pintar = () => {
      $('#resp').innerHTML = resp.length ? resp.map((r, i) => `<tr>
        <td>${i + 1}</td>
        <td><input data-i="${i}" data-k="nombre" value="${esc(r.nombre || '')}" placeholder="Nombre"></td>
        <td class="col-opc"><input data-i="${i}" data-k="cargo" value="${esc(r.cargo || '')}" placeholder="Cargo"></td>
        <td><button class="btn sec" data-quitar="${i}" title="Quitar" style="padding:6px 10px">×</button></td></tr>`).join('')
        : `<tr><td colspan="4" class="sub">Sin responsables todavía.</td></tr>`;
      document.querySelectorAll('#resp input').forEach(inp => inp.oninput = () => resp[inp.dataset.i][inp.dataset.k] = inp.value);
      document.querySelectorAll('[data-quitar]').forEach(b => b.onclick = () => { resp.splice(+b.dataset.quitar, 1); pintar(); });
    };
    pintar();
    $('#agregar').onclick = () => { resp.push({ nombre: '', cargo: '' }); pintar(); };
    $('#guardar-resp').onclick = async () => {
      try { await D.guardarResponsables(e.id, resp.filter(r => r.nombre.trim())); $('#aviso-resp').style.color = 'var(--petroleo)'; $('#aviso-resp').textContent = 'Responsables guardados.'; }
      catch (err) { $('#aviso-resp').textContent = msg(err); }
    };
    $('#asignar-clave').onclick = async () => {
      const clave = $('#clave-cliente').value;
      if (clave.length < 8) { $('#aviso-cli').textContent = 'La contraseña debe tener al menos 8 caracteres.'; return; }
      try { await D.asignarAccesoCliente(e.id, clave); ir(); }
      catch (err) { $('#aviso-cli').textContent = msg(err); }
    };
    const q = $('#quitar-clave');
    if (q) q.onclick = async () => {
      try { await D.asignarAccesoCliente(e.id, null, true); ir(); }
      catch (err) { $('#aviso-cli').textContent = msg(err); }
    };
    $('#invitar').onclick = async () => {
      try { await D.invitar($('#inv-email').value.trim(), e.id, $('#inv-rol').value); $('#aviso-inv').style.color = 'var(--petroleo)'; $('#aviso-inv').textContent = 'Invitación enviada.'; }
      catch (err) { $('#aviso-inv').style.color = ''; $('#aviso-inv').textContent = msg(err); }
    };
    return;
  }

  // Módulos de fases siguientes
  return marco(s, { ...comun, html: `<div class="vacio"><b>${nombreSec}</b><br>Este módulo llega en la fase ${FASE[seccion] || ''}.</div>` });
}

function moduloAplica() { return true; }   // todos los encargos tienen todos los módulos (el servicio no limita módulos)

// ---------------- Ajustes generales ----------------
async function vistaAjustes(s, qs) {
  const [svc, cli, fest, od] = await Promise.all([D.servicios(), D.clientes(), D.festivos(), D.onedrive('estado').catch(e => ({ error: e.message }))]);
  const msjOd = { ok: 'OneDrive quedó conectado.', error: 'No se pudo conectar. Revisa que la clave secreta esté en Supabase y vuelve a intentar.', expirado: 'La autorización tardó demasiado. Vuelve a intentar.' }[qs?.get('onedrive')] || '';
  const anio = String(new Date().getFullYear());
  const html = `
    <section class="panel od-panel"><h3>OneDrive</h3>
      ${msjOd ? `<div class="aviso-ej">${msjOd}</div>` : ''}
      ${od?.conectado ? `<p>Conectado con <b>${esc(od.cuenta || '')}</b>. Al marcar <b>Despegó</b> se crea la carpeta del encargo en REG con su estructura, y los documentos del portal se guardan en su carpeta.</p>
        <button class="btn sec mini" id="od-conectar">Volver a conectar</button>`
      : `<p class="sub">${od?.secreto === false ? 'Falta guardar la clave secreta MS_CLIENT_SECRET en Supabase.' : 'Autoriza una sola vez con apardo@regenerativo.co.'}</p>
        <button class="btn" id="od-conectar" ${od?.secreto === false ? 'disabled' : ''}>Conectar OneDrive</button>`}
    </section>
    <div class="dos">
      <section class="panel"><h3>Clientes</h3>
        <div class="tabla-cont"><table><thead><tr><th>Nombre</th><th class="col-opc">Tipo</th><th>Documento</th></tr></thead>
        <tbody>${cli.map(c => `<tr><td>${xxx(c.nombre)}</td><td class="col-opc">${c.tipo === 'empresa' ? 'Empresa' : 'Persona'}</td><td>${xxx(c.documento)}</td></tr>`).join('')}</tbody></table></div>
      </section>
      <section class="panel"><h3>Servicios</h3>
        <div class="tabla-cont"><table><thead><tr><th>N°</th><th>Servicio</th></tr></thead>
        <tbody>${svc.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x.nombre)}</td></tr>`).join('')}</tbody></table></div>
      </section>
      <section class="panel"><h3>Festivos ${anio}</h3>
        <div class="tabla-cont"><table><thead><tr><th>Fecha</th><th>Festivo</th></tr></thead>
        <tbody>${fest.filter(f => f.fecha.startsWith(anio)).map(f => `<tr><td>${fecha(f.fecha)}</td><td>${esc(f.nombre)}</td></tr>`).join('')}</tbody></table></div>
      </section>
      <section class="panel"><h3>Membrete</h3>
        <p class="sub">Servicio y "Servicios" arriba a la izquierda; código del encargo _ fecha arriba a la derecha; banda gris; pie "Por ＿ regenerativo" e info@regenerativo.co · @_regenerativo_ · +57 320 215 0932. Se aplica a los documentos imprimibles desde la fase 2.</p>
        ${D.MODO_DEMO ? '<button class="btn sec" id="reiniciar" style="margin-top:12px">Reiniciar datos de ejemplo</button>' : ''}
      </section>
    </div>`;
  marco(s, { titulo: 'Ajustes generales', ruta: 'Portal', activo: 'ajustes', html });
  const r = $('#reiniciar'); if (r) r.onclick = () => { D.reiniciarDemo(); location.hash = '#/'; ir(); };
  const oc = $('#od-conectar'); if (oc) oc.onclick = async () => { try { location.href = (await D.onedrive('url')).url; } catch (e) { alert(e.message); } };
}

// ---------------- Propuestas preliminares ----------------
async function vistaPropuestas(s) {
  const lista = await D.propuestas();
  const n = k => lista.filter(p => p.estado === k).length;
  const html = `
    <div class="kpis">
      ${kpi('En borrador', n('borrador'), 'Sin enviar')}
      ${kpi('En espera', n('en_espera'), 'Enviadas · 30 días para decidir')}
      ${kpi('Despegaron', n('despego'), 'Ya son encargos')}
      ${kpi('No despegaron', n('no_despego'), 'Archivadas')}
    </div>
    <div class="filtros">
      <input id="buscar" placeholder="Buscar por nombre, código o cliente">
      <select id="festado"><option value="">Todas</option>${Object.entries(D.ESTADOS_PROPUESTA).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
    </div>
    <div id="tabla"></div>`;
  marco(s, { titulo: 'Propuestas preliminares', ruta: 'Portal', activo: 'propuestas', html,
    acciones: '<button class="btn" id="nueva">+ Nueva propuesta</button>' });
  const pintar = () => {
    const q = $('#buscar').value.toLowerCase(), est = $('#festado').value;
    const f = lista.filter(p => (!est || p.estado === est) && (!q || [p.nombre, p.codigo, p.cliente?.nombre].join(' ').toLowerCase().includes(q)));
    $('#tabla').innerHTML = f.length ? `
      <div class="tabla-cont"><table>
        <thead><tr><th class="col-opc">Cotización</th><th>Propuesta</th><th class="col-opc">Cliente</th><th class="num col-opc">Honorarios</th><th class="col-opc">Enviada</th><th>Estado</th><th></th></tr></thead>
        <tbody>${f.map(p => `
          <tr>
            <td class="sub col-opc">${esc(p.codigo)}</td>
            <td><b>${esc(p.nombre)}</b><div class="sub">${esc(p.servicio?.nombre || '')}<span class="solo-movil"> · ${esc(p.codigo)}</span></div></td>
            <td class="col-opc">${xxx(p.cliente?.nombre)}</td>
            <td class="num col-opc">${p.honorarios ? cop(p.honorarios) : '—'}</td>
            <td class="col-opc">${p.fecha_envio ? fecha(p.fecha_envio) + (p.estado === 'en_espera' ? `<div class="sub">${quedan(p.fecha_envio)}</div>` : '') : '—'}</td>
            <td><span class="etiqueta ${p.estado}">${D.ESTADOS_PROPUESTA[p.estado]}</span>${p.estado === 'no_despego' && p.motivo ? `<div class="sub">${esc(p.motivo)}</div>` : ''}</td>
            <td class="acciones-fila">${accionesPropuesta(p)}</td>
          </tr>`).join('')}</tbody></table></div>`
      : `<div class="vacio">${lista.length ? 'Ninguna propuesta coincide.' : 'Todavía no hay propuestas preliminares.'}</div>`;
    document.querySelectorAll('[data-acc]').forEach(b => b.onclick = () => accion(b.dataset.acc, lista.find(p => p.id === b.dataset.id)));
  };
  const accion = async (acc, p) => {
    try {
      const hoy = new Date().toISOString().slice(0, 10);
      if (acc === 'enviar') await D.actualizarPropuesta(p.id, { estado: 'en_espera', fecha_envio: hoy });
      if (acc === 'no') {
        const motivo = prompt('¿Por qué no despegó? (opcional)') ?? null;
        if (motivo === null) return;
        await D.actualizarPropuesta(p.id, { estado: 'no_despego', fecha_decision: hoy, motivo: motivo || 'Sin motivo' });
      }
      if (acc === 'reabrir') await D.actualizarPropuesta(p.id, { estado: 'en_espera', fecha_envio: hoy, motivo: null, fecha_decision: null });
      if (acc === 'despego') {
        if (!confirm(`¿${p.nombre} despegó? Se crea el encargo ${p.codigo}.`)) return;
        const codigo = await D.despegarPropuesta(p.id);
        try { const e = await D.encargo(codigo); const r2 = await D.onedrive('despegar', { encargo_id: e.id }); alert(`Carpeta creada en OneDrive: ${r2.carpeta}${r2.movidos?.length ? '\nPropuesta movida a LEGALES/PROP _ ECONOMICAS: ' + r2.movidos.join(', ') : ''}`); }
        catch (e2) { alert('El encargo se creó, pero no se pudo crear la carpeta en OneDrive: ' + e2.message); }
        location.hash = `#/${codigo}/ajustes`; return;
      }
      if (acc === 'ver') { const e3 = await D.encargo(p.codigo); location.hash = `#/${e3 ? D.slugEncargo(e3) : p.codigo}`; return; }
      ir();
    } catch (err) { alert(msg(err)); }
  };
  $('#buscar').oninput = pintar; $('#festado').onchange = pintar; pintar();
  $('#nueva').onclick = () => modalPropuesta();
}

function quedan(fechaEnvio) {
  const d = 30 - Math.round((new Date() - new Date(fechaEnvio + 'T00:00:00')) / 86400000);
  return d > 0 ? `${d} días para decidir` : 'Vence hoy';
}

function accionesPropuesta(p) {
  const b = (acc, txt, cls = 'sec') => `<button class="btn ${cls} mini" data-acc="${acc}" data-id="${p.id}">${txt}</button>`;
  if (p.estado === 'borrador') return b('enviar', 'Marcar enviada');
  if (p.estado === 'en_espera') return b('despego', '✓ Despegó', 'ok') + b('no', 'No despegó');
  if (p.estado === 'despego') return b('ver', 'Ver encargo');
  return b('reabrir', 'Reabrir');
}

async function modalPropuesta() {
  const [svc, cli] = await Promise.all([D.servicios(), D.clientes()]);
  const codigo = await D.siguienteCodigo();
  const op = l => l.map(x => `<option value="${x.id}">${esc(x.nombre)}</option>`).join('');
  const fondo = document.createElement('div');
  fondo.className = 'modal-fondo';
  fondo.innerHTML = `<form class="modal" id="fp">
    <h2>Nueva propuesta preliminar</h2>
    <p class="sub">Si despega, se vuelve encargo con el mismo código y el nombre "${esc(codigo.slice(6, 8))}  I  NOMBRE".</p>
    <div class="grilla-form">
      <div><label>Código</label><input name="codigo" value="${esc(codigo)}" required></div>
      <div><label>Nombre (en mayúsculas)</label><input name="nombre" placeholder="PROYECTO" required style="text-transform:uppercase"></div>
      <div><label>Cliente</label><select name="cliente_id"><option value="">— Elegir —</option>${op(cli)}<option value="__nuevo">+ Nuevo cliente…</option></select></div>
      <div><label>Servicio</label><select name="servicio_id">${op(svc)}</select></div>
      <input type="hidden" name="tipo" value="ambos">
      <div><label>Honorarios (COP)</label><input name="honorarios" inputmode="numeric" placeholder="8.200.000"></div>
    </div>
    <div class="aviso" id="aviso"></div>
    <div class="pie-modal"><button type="button" class="btn sec" id="cancelar">Cancelar</button><button class="btn" type="submit">Crear propuesta</button></div>
  </form>`;
  document.body.appendChild(fondo);
  const f = $('#fp', fondo);
  $('#cancelar', fondo).onclick = () => fondo.remove();
  f.honorarios.oninput = () => { const n = f.honorarios.value.replace(/\D/g, ''); f.honorarios.value = n ? Number(n).toLocaleString('es-CO').replace(/,/g, '.') : ''; };
  f.cliente_id.onchange = async () => {
    if (f.cliente_id.value !== '__nuevo') return;
    const nombre = prompt('Nombre o razón social del cliente');
    if (!nombre) { f.cliente_id.value = ''; return; }
    const c = await D.crearCliente({ tipo: 'empresa', nombre: nombre.trim().toUpperCase() });
    f.cliente_id.insertAdjacentHTML('afterbegin', `<option value="${c.id}">${esc(c.nombre)}</option>`);
    f.cliente_id.value = c.id;
  };
  f.onsubmit = async ev => {
    ev.preventDefault();
    const v = Object.fromEntries(new FormData(f));
    v.nombre = v.nombre.trim().toUpperCase().replace(/^\d{2}\s+I\s+/, '');
    v.honorarios = v.honorarios ? Number(v.honorarios.replace(/\D/g, '')) : null;
    if (!v.cliente_id) v.cliente_id = null;
    try { await D.crearPropuesta(v); fondo.remove(); ir(); }
    catch (err) { $('#aviso', fondo).textContent = msg(err); }
  };
}

// ---------------- Base de precios ----------------
async function vistaBasePrecios(s, pestana) {
  const v = await M.vistaBase(s.admin, pestana === 'insumos' ? 'insumos' : 'apu');
  marco(s, { titulo: 'Base de precios', ruta: 'Portal · común a todos los encargos', activo: 'base', html: v.html });
  if (v.montar) v.montar(ir);
}
