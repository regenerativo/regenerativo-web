import * as D from './datos.js?v=33';
import * as M from './modulos.js?v=33';
import { vistaFinanzas, modalMov } from './finanzas.js?v=33';
import { cop, fecha, pct, diasDeTrabajo, fechaCorte, DIAS_TRABAJO, TIPOS, ESTADOS_ENCARGO } from './formato.js?v=33';
import { ico, btnIco, enlaceIco } from './iconos.js?v=33';

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
    let esCliente = s.email.endsWith('@clientes.portal.regenerativo.co');
    if (!esCliente && !s.admin && p.length === 0) { const l = await D.encargos(); const roles = await Promise.all(l.slice(0, 5).map(e => D.miRol(e.id))); esCliente = roles.length > 0 && roles.every(r => r === 'cliente'); }
    if (p.length === 0) return esCliente ? await vistaEncargos(s) : await vistaInicio(s);
    if (p[0] === 'encargos' && !p[1]) return await vistaEncargos(s);
    if (p[0] === 'encargos' && p[1]) return await vistaExpediente(s, decodeURIComponent(p[1]), p[2] || 'resumen', p[3]);
    const RESERVADAS = ['folders', 'finanzas', 'base-precios', 'ajustes', 'propuestas', 'acceso', 'recuperar', 'nueva-clave', 'encargos'];
    if (p[0] && !RESERVADAS.includes(p[0])) return await vistaExpediente(s, decodeURIComponent(p[0]), p[1] || 'resumen', p[2]);
    if (p[0] === 'finanzas' && s.facturacion) {
      const v = await vistaFinanzas(p[1], p[2]);
      marco(s, { titulo: 'Finanzas', ruta: 'Portal · solo perfil de facturación', activo: 'finanzas', html: v.html, bajada: 'Ingresos, gastos y lo que falta por cobrar.' });
      v.montar(ir); return;
    }
    if (p[0] === 'base-precios' && s.admin) return await vistaBasePrecios(s, p[1]);
    if (p[0] === 'ajustes' && s.admin) return await vistaAjustes(s, qs);
    if (p[0] === 'propuestas' && s.admin) return await vistaPropuestas(s);
    if (p[0] === 'folders' && s.admin) {
      marco(s, { titulo: 'Folders', ruta: 'Folders', activo: 'folders', html: '<section class="panel od" id="od"></section>', bajada: 'Toda la carpeta REG de OneDrive: encargos, gestión integral y librerías.' });
      return panelOneDrive($('#od'), null, [['']], { titulo: 'REG' });
    }
    return marco(s, { titulo: 'Página no encontrada', html: `<div class="vacio">Esta página no existe. <a href="#/">Volver a los encargos</a></div>` });
  } catch (err) {
    console.error(err);
    marco(s, { titulo: 'Algo salió mal', html: `<div class="vacio">${esc(msg(err))}<br><br><a href="#/">Volver a los encargos</a></div>` });
  }
}

// ---------------- Marco general ----------------
function marco(s, { titulo, ruta = '', acciones = '', html, menu = null, activo = '', enc = null, h1 = '', bajada = '' }) {
  const esCli = s.email.endsWith('@clientes.portal.regenerativo.co');
  const enlacesGen = esCli || enc ? '' : `
    ${s.soloFinanzas ? '' : `<a href="#/" class="${activo === 'inicio' ? 'activo' : ''}">Inicio</a>`}
    ${s.admin ? `<a href="#/propuestas" class="${activo === 'propuestas' ? 'activo' : ''}">Propuestas</a>` : ''}
    ${s.soloFinanzas ? '' : `<a href="#/encargos" class="${activo === 'encargos' ? 'activo' : ''}">Encargos</a>`}
    ${s.facturacion ? `<a href="#/finanzas" class="${activo === 'finanzas' ? 'activo' : ''}">Finanzas</a>` : ''}
    ${s.admin ? `<a href="#/folders" class="${activo === 'folders' ? 'activo' : ''}">Folders</a>` : ''}
    ${s.admin ? `<a href="#/base-precios" class="${activo === 'base' ? 'activo' : ''}">Base de precios</a>` : ''}
    ${s.admin ? `<a href="#/ajustes" class="${activo === 'ajustes' ? 'activo' : ''}">Ajustes</a>` : ''}`;
  const cabEnc = enc ? `${enc.volver && !esCli ? `<a class="volver" href="#/encargos">${ico('atras')}Portal</a>` : ''}<a class="enc-nom" href="${enc.href}">${esc(enc.nombre)}</a>` : '';
  const tituloPag = h1 || (ruta.includes(' / ') ? ruta.split(' / ').pop() : titulo);
  const subPag = bajada;
  raiz.innerHTML = `
  <header class="barra-web">
    <div class="barra-web-in">
      <div class="barra-izq"><button class="menu-movil" id="abrir-menu" aria-label="Menú">☰</button><span class="barra-enc">${titulo}</span></div>
      <a href="#/" class="logo-reg" aria-label="regenerativo, inicio">regenerativo</a>
    </div>
  </header>
  <div class="app">
    <nav class="lado" id="lado">
      ${cabEnc}
      ${menu || ''}
      ${enlacesGen}
      <div class="pie"><span class="pie-correo" title="${esc(s.email)}">${s.email.endsWith('@clientes.portal.regenerativo.co') ? 'Acceso de cliente' : esc(s.email)}</span><button id="salir">Cerrar sesión</button></div>
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
// ---------------- Inicio del equipo: bienvenida, versículo y resumen ----------------
const VERSICULOS = [   // tal como están en regenerativo.co/about
  { titulo: 'No intervenimos, regeneramos.', lead: 'regenerativo es una práctica creativa que diseña desde la naturaleza.', texto: 'Diseñamos desde la naturaleza, no como referencia sino como principio. Entendemos el todo como un sistema vivo y respondemos con precisión a cada contexto.', cita: 'Génesis 1.27' },
  { titulo: 'Together<br>is more.', mas: true, lead: 'Juntos es más.', texto: 'Creemos en lo colectivo: cada proyecto se hace con quienes lo habitan, con quienes lo materializan y con el lugar que lo recibe.', cita: 'Eclesiastés 4.9-12' },
];
async function vistaInicio(s) {
  const festLista = await D.festivos();
  const fest = new Set(festLista.map(f => f.fecha));
  const [lista, props, movs, honor, docs] = await Promise.all([D.encargos(), s.admin ? D.propuestas().catch(() => []) : [],
    s.facturacion ? D.finMovimientos().catch(() => []) : [], s.facturacion ? D.finPropuestasEncargos().catch(() => []) : [], s.facturacion ? D.finDocumentosCobro().catch(() => []) : []]);
  const hoy = new Date().toISOString().slice(0, 10), mes = hoy.slice(0, 7);
  const activos = lista.filter(e => e.estado === 'activo').map(e => ({ ...e, tiempo: tiempoTranscurrido(e, fest) }));
  const espera = props.filter(p => p.estado === 'en_espera'), borrador = props.filter(p => p.estado === 'borrador');
  const dia = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const V = VERSICULOS[dia % VERSICULOS.length];
  const h = new Date().getHours();
  const saludo = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  // Cifras de la empresa
  const ok = movs.filter(x => (x.estado || 'confirmado') === 'confirmado');
  const pend = movs.filter(x => x.estado === 'por_confirmar');
  const suma = (l, t) => l.filter(x => x.tipo === t).reduce((a, x) => a + Number(x.valor), 0);
  const delMes = ok.filter(x => x.fecha.slice(0, 7) === mes);
  const aprob = d => ['aprobado', 'firmado'].includes(d.estado);
  const porCobrar = lista.reduce((t, e) => {
    const v = (Number(honor.find(p => p.encargo_id === e.id)?.honorarios) || 0) + docs.filter(d => d.encargo_id === e.id && d.tipo === 'adenda' && aprob(d)).reduce((a, d) => a + (Number(d.contenido?.valor) || 0), 0);
    return t + Math.max(0, v - suma(ok.filter(x => x.encargo_id === e.id), 'ingreso'));
  }, 0);
  const enEspera = espera.reduce((a, p) => a + (Number(p.honorarios) || 0), 0);
  // Recordatorios: lo que pide una acción
  const R = [];
  const rec = (nivel, txt, sub, href) => R.push({ nivel, txt, sub, href });
  if (pend.length) rec('alto', `${pend.length} movimiento${pend.length > 1 ? 's' : ''} del correo por aprobar`, 'No cuentan en finanzas hasta que los apruebes', '#/finanzas#por-confirmar');
  espera.forEach(p => { const d = p.fecha_envio ? 30 - Math.round((new Date(hoy) - new Date(p.fecha_envio)) / 86400000) : null;
    rec(d !== null && d <= 7 ? 'alto' : 'medio', `Hacer seguimiento a ${p.nombre}`, d !== null ? `${p.cliente?.nombre || 'Cliente'} · ${d > 0 ? d + ' días para decidir' : 'vence hoy'}` : `${p.cliente?.nombre || 'Cliente'} · falta la fecha de envío`, '#/propuestas'); });
  borrador.forEach(p => rec('medio', `Enviar la propuesta ${p.nombre}`, p.archivo_nombre ? 'Está en borrador' : 'Falta cargar el Word', '#/propuestas'));
  props.filter(p => p.estado !== 'borrador' && !p.fecha_envio && p.estado !== 'en_espera').forEach(p => rec('bajo', `Poner la fecha de envío de ${p.nombre}`, 'Propuestas preliminares', '#/propuestas'));
  activos.filter(e => !e.inicio).forEach(e => rec('medio', `Definir el inicio de ${e.nombre.replace(/^\d{2}\s+I\s+/, '')}`, 'Propuesta aprobada; el encargo aún no ha iniciado', `#/${D.slugEncargo(e)}/ajustes`));
  activos.filter(e => e.inicio && !e.fin).forEach(e => rec('bajo', `Agregar la fecha de entrega de ${e.nombre.replace(/^\d{2}\s+I\s+/, '')}`, 'El encargo está en curso; con la fecha de entrega se mide el tiempo', `#/${D.slugEncargo(e)}/ajustes`));
  activos.filter(e => e.fin && e.fin >= hoy && e.fin.slice(0, 7) === mes).forEach(e => rec('medio', `${e.nombre.replace(/^\d{2}\s+I\s+/, '')} termina el ${fecha(e.fin)}`, 'Fecha de fin este mes', `#/${D.slugEncargo(e)}`));
  activos.filter(e => e.fin && e.fin < hoy).forEach(e => rec('alto', `${e.nombre.replace(/^\d{2}\s+I\s+/, '')} pasó su fecha de fin`, `Terminaba el ${fecha(e.fin)}`, `#/${D.slugEncargo(e)}`));
  const prox = festLista.filter(f => f.fecha >= hoy).slice(0, 1)[0];
  const orden = { alto: 0, medio: 1, bajo: 2 };
  R.sort((a, b) => orden[a.nivel] - orden[b.nivel]);
  const cifra = (et, va, su, href) => `<a class="cifra-emp" href="${href}"><span class="ce-et">${et}</span><span class="ce-va">${va}</span><span class="ce-su">${su}</span></a>`;
  const html = `
    <section class="about">
      <span class="ab-eti">${saludo.toUpperCase()}, EQUIPO</span>
      <h2 class="ab-tit">${V.titulo}${V.mas ? '<img src="/assets/reg-plus3.png" alt="+++">' : ''}</h2>
      <div class="ab-txt"><p>${esc(V.lead)}</p><p class="gris">${esc(V.texto)}</p><p class="gris cita">${esc(V.cita)}</p></div>
    </section>
    <div class="inicio-grid">
      <section class="panel">
        <div class="od-cab"><h3>Recordatorios</h3><span class="sub">${R.length ? R.length + ' por atender' : ''}</span></div>
        ${R.length ? `<div class="recordatorios">${R.map(r => `<a class="rec ${r.nivel}" href="${r.href}"><i></i><span class="rec-txt"><b>${esc(r.txt)}</b><span class="sub">${esc(r.sub)}</span></span><span class="rec-ir">›</span></a>`).join('')}</div>`
          : '<p class="sub">Todo al día. No hay pendientes.</p>'}
        ${prox ? `<p class="prox-fest"><i></i>Próximo festivo: <b>${fecha(prox.fecha)}</b> · ${esc(prox.nombre)}</p>` : ''}
      </section>
      <section class="panel">
        <h3>Así va regenerativo</h3>
        <div class="cifras-emp">
          ${s.facturacion ? cifra('Por cobrar', cop(porCobrar), 'Encargos, propuestas y adicionales', '#/finanzas') : ''}
          ${s.facturacion ? cifra('Balance del mes', `${suma(delMes, 'ingreso') - suma(delMes, 'gasto') < 0 ? '−' : ''}${cop(Math.abs(suma(delMes, 'ingreso') - suma(delMes, 'gasto')))}`, `Ingresos ${cop(suma(delMes, 'ingreso'))}`, '#/finanzas') : ''}
          ${s.admin ? cifra('Propuestas en espera', espera.length ? cop(enEspera) : '0', `${espera.length} enviada${espera.length === 1 ? '' : 's'} · ${borrador.length} en borrador`, '#/propuestas') : ''}
          ${cifra('Encargos activos', activos.length, `${lista.length} en total`, '#/encargos')}
        </div>
      </section>
    </div>`;
  marco(s, { titulo: 'Inicio', ruta: 'Portal', activo: 'inicio', html, bajada: 'La visión general de regenerativo y lo que necesita tu atención.' });
}

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
  marco(s, { titulo: 'Encargos', ruta: 'Portal', activo: 'encargos', html, bajada: 'Cada encargo con su tiempo, su estado y su carpeta.',
    acciones: admin ? '<button class="btn" id="nuevo">+ Nuevo encargo</button>' : '' });
  const pintar = () => {
    const q = $('#buscar').value.toLowerCase(), est = $('#festado').value;
    const f = conTiempo.filter(e => (!est || e.estado === est) &&
      (!q || [e.nombre, e.codigo, e.cliente?.nombre].join(' ').toLowerCase().includes(q)));
    $('#tabla').innerHTML = f.length ? `
      <div class="tabla-cont"><table>
        <thead><tr><th>Encargo</th><th class="col-opc">Cliente</th><th class="col-opc">Inicio</th><th class="col-opc">Fin</th><th>Tiempo</th><th>Estado</th>${admin ? '<th></th>' : ''}</tr></thead>
        <tbody>${f.map(e => `
          <tr class="clic" data-c="${D.slugEncargo(e)}">
            <td><b>${esc(e.nombre)}</b><div class="sub">${esc(e.servicio?.nombre || '')}</div></td>
            <td class="col-opc">${xxx(e.cliente?.nombre)}</td>
            <td class="col-opc">${fecha(e.inicio)}</td><td class="col-opc">${fecha(e.fin)}</td>
            <td style="min-width:90px">${!e.inicio || e.inicio > new Date().toISOString().slice(0, 10) ? 'Por iniciar' : e.tiempo == null ? (e.estado === 'activo' ? 'En curso' : '—') : pct(e.tiempo)}<div class="barra ${semaforo(e)}"><i style="width:${Math.round((e.tiempo || 0) * 100)}%"></i></div></td>
            <td><span class="etiqueta ${e.estado}">${ESTADOS_ENCARGO[e.estado] || e.estado}</span></td>
            ${admin ? `<td class="acciones-fila">${webCarpeta(e) ? enlaceIco('carpeta', 'Abrir folder en OneDrive', esc(webCarpeta(e))) : ''}</td>` : ''}
          </tr>`).join('')}</tbody></table></div>`
      : `<div class="vacio">${lista.length ? 'Ningún encargo coincide con la búsqueda.' : 'Todavía no hay encargos.'}</div>`;
    document.querySelectorAll('tr.clic').forEach(tr => tr.onclick = ev => { if (!ev.target.closest('a')) location.hash = `#/${tr.dataset.c}`; });
  };
  $('#buscar').oninput = pintar; $('#festado').onchange = pintar; pintar();
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
    try { const r2 = await D.onedrive('despegar', { encargo_id: e.id }); alert(`Encargo creado.\nCarpeta en OneDrive: ${r2.carpeta} (estructura REG_TEM DOCUMENTAL)${r2.movidos?.length ? '\nPropuesta movida a LEGALES/00 PROPUESTA: ' + r2.movidos.join(', ') : ''}`); }
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
      <dt>Código de proyecto</dt><dd>${esc(p.codigo.slice(6, 8))}  I  ${esc(p.nombre.toUpperCase())}</dd><dt>Código de propuesta</dt><dd>${esc(p.codigo)}</dd>
      <dt>Cliente</dt><dd>${xxx(p.cliente?.nombre)}</dd>
      <dt>Servicio</dt><dd>${esc(p.servicio?.nombre || '—')}</dd>
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
      <div><label>Código de propuesta</label><input name="codigo" value="${esc(codigo)}" required ${e ? 'readonly' : ''}></div>
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

// ---------------- Expediente del encargo ----------------
// Módulos del encargo. Cada módulo junta lo del portal (web) y su carpeta de OneDrive.
const MODULOS = [
  ['resumen', 'Resumen'], ['carpetas', 'Folders'],
  ['propuesta', 'Propuesta'], ['contrato', 'Contrato'], ['adendas', 'Adendas'],
  ['finanzas', 'Finanzas'], ['presupuesto', 'Presupuesto'], ['gantt', 'Programación'],
  ['informes', 'Actas e informes'], ['enviados', 'Enviados'], ['recibidos', 'Recibidos'],
  ['ajustes', 'Ajustes'],
];
// Carpetas de OneDrive de cada módulo (plantilla REG_TEM DOCUMENTAL y, como respaldo, los nombres viejos).
// Cada grupo usa la primera carpeta que exista. "RUTA#0" = solo los archivos sueltos de esa carpeta.
const FUENTES = {
  propuesta: [['LEGALES/00 PROPUESTA', 'LEGALES/PROP _ ECONOMICAS']],
  contrato: [['LEGALES/01 CONTRATOS', 'LEGALES/OPS CONTRATOS'], ['LEGALES/03 OTRO SI']],
  adendas: [['LEGALES/02 ADENDAS', 'LEGALES#0']],
  finanzas: [['LEGALES/05 CUENTAS DE COBRO', 'LEGALES/CUENTAS DE COBRO']],
  presupuesto: [['PRESUPUESTO']],
  gantt: [['PROGRAMACIÓN', 'PROGRAMACION']],
  informes: [['COOR _ ADMIN', 'COORDINACION _ ADMINISTRATIVA']],
  enviados: [['DOC _ ENV', 'DOC _ ENVIADOS']],
  recibidos: [['DOC _ REC', 'DOC _ RECIBIDOS']],
};
const SIN_CONTEO = ['resumen', 'carpetas', 'ajustes'];
const CONTEO_TTL = 10 * 60 * 1000;
const conteoGuardado = id => { try { const c = JSON.parse(sessionStorage.getItem('reg-conteo-' + id)); if (c && Date.now() - c.t < CONTEO_TTL) return c.c; } catch (_) {} return null; };
const guardarConteo = (id, c) => { try { sessionStorage.setItem('reg-conteo-' + id, JSON.stringify({ t: Date.now(), c })); } catch (_) {} };
const ODWEB = 'https://netorgft18456367-my.sharepoint.com/personal/apardo_regenerativo_co/Documents/';
const webCarpeta = e => e.onedrive_carpeta ? ODWEB + e.onedrive_carpeta.split('/').map(encodeURIComponent).join('/') : '';

/** Valor del encargo: honorarios de la propuesta + adicionales (adendas aprobadas). */
function valorEncargo(prop, docs) {
  const aprob = d => ['aprobado', 'firmado'].includes(d.estado);
  const pw = docs.filter(d => d.tipo === 'propuesta' && aprob(d)).at(-1);
  const base = Number(prop?.honorarios) || Number(pw?.contenido?.honorarios) || 0;
  const adic = docs.filter(d => d.tipo === 'adenda' && aprob(d)).sort((a, b) => a.numero - b.numero)
    .map(d => ({ numero: d.numero, valor: Number(d.contenido?.valor) || 0, nombre: d.contenido?.tipo || d.contenido?.descripcion || '' }));
  const sumaAdic = adic.reduce((s, a) => s + a.valor, 0);
  return { base, adic, sumaAdic, total: base + sumaAdic };
}

async function vistaExpediente(s, codigo, seccion, sub) {
  const e = await D.encargo(codigo);
  if (!e) return marco(s, { titulo: 'Encargo no encontrado', html: `<div class="vacio">No existe el encargo ${esc(codigo)} o no tienes acceso. <a href="#/">Volver</a></div>` });
  const admin = s.admin;
  const base = `#/${D.slugEncargo(e)}`;
  const rol = admin ? 'admin' : await D.miRol(e.id);
  const esCliente = rol === 'cliente';
  const fest = new Set((await D.festivos()).map(f => f.fecha));
  const [docs, tareas, pres, movs, prop] = await Promise.all([
    D.docsEncargo(e.id).catch(() => []), D.ganttTareas(e.id).catch(() => []), D.hayPresupuesto(e.id).catch(() => 0),
    s.facturacion ? D.finMovimientosEncargo(e.id).catch(() => []) : [], admin ? D.propuestaDeEncargo(e.id) : null]);
  const movsOk = movs.filter(x => (x.estado || 'confirmado') === 'confirmado');
  const nTipo = t => docs.filter(d => d.tipo === t && (!esCliente || d.estado !== 'borrador')).length;
  const web = { propuesta: nTipo('propuesta'), contrato: nTipo('contrato'), adendas: nTipo('adenda'), informes: nTipo('informe'), presupuesto: pres, gantt: tareas.length, finanzas: movsOk.length };
  let od = admin ? (conteoGuardado(e.id) || {}) : {};
  const n = k => (web[k] || 0) + (od[k] || 0);
  const visible = k => {
    if (k === 'resumen') return true;
    if (k === 'ajustes' || k === 'carpetas') return admin;
    if (k === 'finanzas') return s.facturacion;
    if (k === 'adendas' && esCliente) return false;
    return admin || web[k] > 0;
  };
  const pintaMenu = () => MODULOS.filter(([k]) => visible(k)).map(([k, nom]) => {
    const c = SIN_CONTEO.includes(k) ? null : n(k);
    return `<a href="${k === 'resumen' ? base : base + '/' + k}" class="${k === seccion ? 'activo' : ''} ${c === 0 ? 'mod-vacio' : ''}">${nom}${c ? `<span class="cuenta">${c}</span>` : ''}</a>`;
  }).join('');
  const tiles = () => {
    const l = MODULOS.filter(([k]) => visible(k) && !SIN_CONTEO.includes(k) && n(k) > 0);
    return l.length ? l.map(([k, nom]) => `<a class="tile" href="${base}/${k}"><b>${n(k)}</b><span>${nom}</span></a>`).join('') : '<p class="sub">Todavía no hay documentos en los módulos.</p>';
  };
  const nombreSec = (MODULOS.find(m => m[0] === seccion) || [, 'Resumen'])[1];
  const encMarco = { nombre: e.nombre, href: base, volver: !esCliente };
  const pintar = (html, acciones = '') => {
    marco(s, { titulo: esc(e.nombre), h1: seccion === 'resumen' ? esc(e.nombre) : nombreSec, menu: `<div id="menu-enc">${pintaMenu()}</div>`, enc: encMarco, html, acciones, bajada: seccion === 'resumen' ? [e.cliente?.nombre, e.servicio?.nombre].filter(Boolean).map(esc).join(' · ') : esc(e.nombre) });
    if (admin && !D.MODO_DEMO && !conteoGuardado(e.id)) {
      D.onedrive('conteos_encargo', { encargo_id: e.id, modulos: FUENTES }).then(c => {
        guardarConteo(e.id, c);
        if (JSON.stringify(c) === JSON.stringify(od)) return;
        od = c; const m = $('#menu-enc'); if (m) m.innerHTML = pintaMenu(); const t = $('#tiles'); if (t) t.innerHTML = tiles();
      }).catch(() => {});
    }
  };
  const ctx = { e, s, admin, rol, esCliente, fest, base, sub, recargar: ir };
  const valor = valorEncargo(prop, docs);

  if (seccion === 'resumen') {
    const t = tiempoTranscurrido(e, fest);
    const total = e.inicio && e.fin ? diasDeTrabajo(e.inicio, e.fin, e.dias_trabajo, fest) : null;
    const hechos = e.inicio ? diasDeTrabajo(e.inicio, fechaCorte(e.fecha_corte), e.dias_trabajo, fest) : 0;
    const g = tareas.length ? await M.datosGantt(ctx).catch(() => null) : null;
    const rec = movsOk.filter(x => x.tipo === 'ingreso').reduce((a, x) => a + Number(x.valor), 0);
    const V = valor.total;
    const seg = (v, c, tip) => v > 0 && V > 0 ? `<i style="width:${v / V * 100}%;background:${c}" title="${esc(tip)}"></i>` : '';
    const COL_AD = ['#7FC4D6', '#B9DDE7', '#5AA9BE', '#D4ECF2'];
    if (esCliente) {
      const DESC = { propuesta: 'Propuesta económica', contrato: 'Contrato firmado', presupuesto: 'Presupuesto de obra', gantt: 'Cronograma y avance', informes: 'Actas e informes de avance' };
      const mods = MODULOS.filter(([k]) => visible(k) && !SIN_CONTEO.includes(k) && n(k) > 0);
      const htmlCli = `
        <div class="kpis kpis-3">
          ${kpi('Valor del encargo', V ? cop(V) : '—', valor.adic.length ? `Propuesta + ${valor.adic.length} adicional${valor.adic.length > 1 ? 'es' : ''}` : 'Propuesta aprobada')}
          ${kpi('Tiempo transcurrido', !e.inicio ? 'Por iniciar' : t == null ? (e.estado === 'activo' ? 'En curso' : '—') : pct(t), total ? `${Math.max(0, total - hechos)} días de trabajo restantes` : '', t || 0)}
          ${kpi('Avance de la obra', g?.filas.length ? pct(g.realTotal) : '—', g?.filas.length ? `Esperado al corte ${pct(g.esperadoTotal)}` : 'Aún sin cronograma', g?.filas.length ? g.realTotal : undefined)}
        </div>
        <section class="panel"><h3>Tus documentos</h3>
          ${mods.length ? `<div class="tarjetas-cli">${mods.map(([k, nom]) => `<a class="tarjeta-cli" href="${base}/${k}"><span class="tc-ico">${ico('archivo')}</span><span class="tc-txt"><b>${DESC[k] || nom}</b><span class="sub">${n(k)} documento${n(k) === 1 ? '' : 's'} · ver y descargar</span></span><span class="tc-flecha">›</span></a>`).join('')}</div>`
            : '<p class="sub">Aquí aparecerán los documentos de tu encargo a medida que te los enviemos.</p>'}
        </section>
        <section class="panel"><h3>Tu encargo</h3>
          <dl class="datos datos-2c"><dt>Encargo</dt><dd>${esc(e.nombre)}</dd><dt>Servicio</dt><dd>${xxx(e.servicio?.nombre)}</dd>
          <dt>Inicio · fin</dt><dd>${fecha(e.inicio)} · ${fecha(e.fin)}</dd><dt>Equipo</dt><dd>${e.responsables.length ? e.responsables.map(r => esc(r.nombre)).join(', ') : 'Regenerativo'}</dd></dl>
        </section>`;
      return pintar(htmlCli);
    }
    const html = `
      <div class="kpis">
        ${kpi('Valor del encargo', V ? cop(V) : '—', V ? (valor.adic.length ? `Propuesta + ${valor.adic.length} adicional${valor.adic.length > 1 ? 'es' : ''}` : 'Propuesta aprobada') : 'Sin valor registrado')}
        ${s.facturacion ? kpi('Recibido', cop(rec), V ? `${pct(rec / V)} del valor` : 'Ingresos registrados', V ? Math.min(1, rec / V) : undefined) : ''}
        ${s.facturacion ? kpi('Por cobrar', V ? cop(Math.max(0, V - rec)) : '—', V ? 'Valor menos lo recibido' : '') : ''}
        ${kpi('Tiempo transcurrido', !e.inicio ? 'Por iniciar' : t == null ? (e.estado === 'activo' ? 'En curso' : '—') : pct(t), total ? `${Math.max(0, total - hechos)} días de trabajo restantes${g?.filas.length ? ' · avance real ' + pct(g.realTotal) : ''}` : (e.inicio ? `Desde el ${fecha(e.inicio)} · falta la fecha de entrega` : 'Falta la fecha de entrega'), t || 0)}
      </div>
      <div class="dos">
        <section class="panel">
          <h3>Valor del encargo</h3>
          ${V ? `<div class="barra-apilada">${seg(valor.base, '#00758F', 'Propuesta ' + cop(valor.base))}${valor.adic.map((a, i) => seg(a.valor, COL_AD[i % 4], `Adicional ${a.numero} ${cop(a.valor)}`)).join('')}</div>
            <ul class="leyenda-valor">
              <li><i style="background:#00758F"></i>Propuesta inicial<b>${cop(valor.base)}</b></li>
              ${valor.adic.map((a, i) => `<li><i style="background:${COL_AD[i % 4]}"></i>Adicional ${a.numero}${a.nombre ? ' · ' + esc(a.nombre) : ''}<b>+ ${cop(a.valor)}</b></li>`).join('')}
              <li class="total">Total<b>${cop(V)}</b></li>
            </ul>
            ${valor.adic.length ? `<p class="nota-valor">El encargo tiene ${valor.adic.length} adicional${valor.adic.length > 1 ? 'es' : ''} por ${cop(valor.sumaAdic)} sobre la propuesta.</p>` : ''}
            ${s.facturacion ? `<h4 class="sub-h">Pagos</h4><div class="barra-apilada">${seg(Math.min(rec, V), '#0090B0', 'Recibido ' + cop(rec))}</div>
              <ul class="leyenda-valor"><li><i style="background:#0090B0"></i>Recibido<b>${cop(rec)}</b></li><li><i style="background:#E6E6E6"></i>Por cobrar<b>${cop(Math.max(0, V - rec))}</b></li></ul>` : ''}`
          : `<p class="sub">No hay honorarios registrados. ${admin ? 'Se toman de la propuesta (Propuestas preliminares) y de las adendas aprobadas.' : ''}</p>`}
        </section>
        <section class="panel"><h3>Documentos</h3><div class="tiles" id="tiles">${tiles()}</div>
          ${admin && webCarpeta(e) ? `<p class="sub" style="margin-top:12px"><a href="${esc(webCarpeta(e))}" target="_blank" rel="noopener">Abrir la carpeta del encargo en OneDrive ↗</a></p>` : ''}
        </section>
      </div>
      <section class="panel">
        <h3>Detalles del encargo</h3>
        <dl class="datos datos-2c">
          <dt>Cliente</dt><dd>${xxx(e.cliente?.nombre)}</dd>
          <dt>Servicio</dt><dd>${xxx(e.servicio?.nombre)}</dd>
          ${DETALLES_PROPUESTA.filter(([k]) => prop?.[k]).map(([k, tt]) => `<dt>${tt.replace(' del encargo', '')}</dt><dd>${esc(prop[k])}</dd>`).join('')}
          ${prop?.ubicacion ? '' : `<dt>Ubicación</dt><dd>${xxx(e.direccion)}${e.ciudad ? ', ' + esc(e.ciudad) : ''}</dd>`}
          <dt>Inicio · fin</dt><dd>${fecha(e.inicio)} · ${fecha(e.fin)}</dd>
          ${prop && admin ? `<dt>Código</dt><dd>${esc(prop.codigo)}</dd>` : ''}
          <dt>Responsables</dt><dd>${e.responsables.length ? e.responsables.map(r => esc(r.nombre)).join(', ') : xxx('')}</dd>
        </dl>
      </section>`;
    pintar(html, admin ? btnIco('editar', 'Editar datos del encargo', 'id="editar-enc"') : '');
    const be = $('#editar-enc'); if (be) be.onclick = () => modalEncargo(e);
    return;
  }

  if (seccion === 'carpetas' && admin) {
    pintar('<section class="panel od" id="od"></section>');
    return panelOneDrive($('#od'), e, [['']], { titulo: 'Folders del encargo' });
  }
  if (seccion === 'enviados' || seccion === 'recibidos') {
    if (!admin) { location.hash = base; return; }
    pintar('<section class="panel od" id="od"></section>');
    return panelOneDrive($('#od'), e, FUENTES[seccion], { titulo: seccion === 'enviados' ? 'Envíos al cliente' : 'Recibidos del cliente', envios: true });
  }
  if (seccion === 'finanzas' && s.facturacion) return finanzasEncargo(ctx, movsOk, valor, pintar);
  if (seccion === 'ajustes' && admin) return ajustesEncargo(s, e, pintar);

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
  const suma = t => movs.filter(x => x.tipo === t).reduce((a, x) => a + Number(x.valor), 0);
  const rec = suma('ingreso'), gas = suma('gasto'), V = valor.total;
  const html = `
    <div class="kpis">
      ${kpi('Valor del encargo', V ? cop(V) : '—', valor.adic.length ? `Incluye ${cop(valor.sumaAdic)} en adicionales` : 'Propuesta aprobada')}
      ${kpi('Recibido', cop(rec), V ? pct(rec / V) + ' del valor' : '', V ? Math.min(1, rec / V) : undefined)}
      ${kpi('Por cobrar', V ? cop(Math.max(0, V - rec)) : '—', '')}
      ${kpi('Gastos del encargo', cop(gas), rec ? `Neto ${cop(rec - gas)}` : '')}
    </div>
    <section class="panel"><div class="od-cab"><h3>Movimientos</h3><div class="barra-acc">${btnIco('mas', 'Agregar ingreso', 'data-nuevo="ingreso"', '')}<button class="btn sec mini" data-nuevo="gasto">+ Gasto</button></div></div>
      ${movs.length ? `<div class="tabla-cont"><table class="t-compacta"><thead><tr><th>Fecha</th><th>Concepto</th><th class="col-opc">Categoría</th><th class="num">Valor</th></tr></thead><tbody>
        ${movs.map(x => `<tr class="clic" data-mov="${x.id}"><td>${fecha(x.fecha)}</td><td>${esc(x.descripcion || '')}</td><td class="col-opc sub">${esc(x.categoria?.nombre || (x.tipo === 'socio' ? 'Personal / socio' : ''))}</td>
          <td class="num ${x.tipo}">${x.tipo === 'ingreso' ? '+' : x.tipo === 'gasto' ? '−' : ''} ${cop(x.valor)}</td></tr>`).join('')}</tbody></table></div>`
      : '<p class="sub">Sin ingresos ni gastos registrados para este encargo.</p>'}
    </section>
    ${admin ? '<section class="panel od" id="od"></section>' : ''}`;
  pintar(html);
  document.querySelectorAll('[data-nuevo]').forEach(b => b.onclick = () => modalMov({ tipo: b.dataset.nuevo, fecha: new Date().toISOString().slice(0, 10), encargo_id: e.id }, cats, encs, ir));
  document.querySelectorAll('[data-mov]').forEach(tr => tr.onclick = () => modalMov(movs.find(x => x.id === tr.dataset.mov), cats, encs, ir));
  if (admin) panelOneDrive($('#od'), e, FUENTES.finanzas, { titulo: 'Cuentas de cobro' });
}

// ---------------- Documentos de OneDrive: lista compacta, las carpetas se despliegan en el sitio ----------------
const tipoDoc = n => /\.pdf$/i.test(n) ? 'PDF' : /\.xlsx?$/i.test(n) ? 'Excel' : /\.docx?$/i.test(n) ? 'Word' : /\.(png|jpe?g|webp)$/i.test(n) ? 'Imagen' : (n.includes('.') ? n.split('.').pop().toUpperCase() : '');
const tamano = b => b == null ? '' : b >= 1e9 ? (b / 1e9).toFixed(1) + ' GB' : b >= 1e6 ? Math.round(b / 1e6) + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' KB';
const fechaNombre = n => { const m = n.match(/^(\d{4})\s(\d{2})\s(\d{2})\s*[-_]?\s*(.*)$/); return m ? { fecha: `${m[1]}-${m[2]}-${m[3]}`, resto: m[4] || n } : null; };
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
  const ordenar = l => envios ? [...l].sort((a, b) => b.nombre.localeCompare(a.nombre)) : l;
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
function ajustesEncargo(s, e, pintarPag) {
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
    pintarPag(html);
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
}

// ---------------- Ajustes generales ----------------
async function vistaAjustes(s, qs) {
  const [svc, cli, fest, us, encs, od] = await Promise.all([D.servicios(), D.clientes(), D.festivos(), D.usuarios().catch(() => []), D.encargos(),
    D.MODO_DEMO ? { conectado: false } : D.onedrive('estado').catch(e => ({ error: e.message }))]);
  const msjOd = { ok: 'OneDrive quedó conectado.', error: 'No se pudo conectar OneDrive. Vuelve a intentar.', expirado: 'La autorización tardó demasiado. Vuelve a intentar.' }[qs?.get('onedrive')] || '';
  const anio = String(new Date().getFullYear());
  const nEnc = id => encs.filter(e => e.cliente_id === id).length;
  const ROL = { admin: 'Administración', facturacion: 'Facturación', equipo: 'Equipo', cliente: 'Cliente' };
  const html = `
    ${msjOd ? `<div class="aviso-ej">${msjOd}</div>` : ''}
    <div class="estado-od ${od?.conectado ? 'ok' : 'no'}"><span class="punto"></span>${od?.conectado ? `OneDrive conectado · ${esc(od.cuenta || '')}` : 'OneDrive sin conectar'}
      <button class="btn sec mini" id="od-conectar">${od?.conectado ? 'Volver a conectar' : 'Conectar'}</button></div>
    <section class="panel">
      <div class="od-cab"><h3>Usuarios</h3><span class="sub">${us.length} · las invitaciones se envían desde Ajustes de cada encargo</span></div>
      <div class="tabla-cont"><table class="t-compacta"><thead><tr><th>Usuario</th><th>Rol</th><th class="col-opc">Encargos</th><th></th></tr></thead>
      <tbody>${us.map(u => `<tr><td><b>${esc(u.nombre || u.email)}</b><div class="sub">${esc(u.email || '')}${u.telefono ? ' · ' + esc(u.telefono) : ''}</div></td>
        <td>${u.roles.length ? u.roles.map(r => `<span class="etiqueta">${ROL[r] || esc(r)}</span>`).join(' ') : u.encargos.length ? `<span class="etiqueta">${ROL[u.encargos[0].rol] || esc(u.encargos[0].rol)}</span>` : '—'}</td>
        <td class="col-opc sub">${u.encargos.map(x => esc(x.nombre)).join(', ') || '—'}</td>
        <td class="acciones-fila">${btnIco('editar', 'Editar usuario', `data-us="${u.id}"`)}</td></tr>`).join('') || '<tr><td colspan="4" class="sub">Sin usuarios.</td></tr>'}</tbody></table></div>
    </section>
    <section class="panel"><div class="od-cab"><h3>Festivos</h3><span class="sub">Colombia · cuentan para los días de trabajo de los encargos</span></div>
      <div id="calendario"></div>
      ${D.MODO_DEMO ? '<button class="btn sec mini" id="reiniciar" style="margin-top:12px">Reiniciar datos de ejemplo</button>' : ''}</section>`;
  marco(s, { titulo: 'Ajustes generales', ruta: 'Ajustes generales', activo: 'ajustes', html, bajada: 'Usuarios y acceso a las cuentas.' });
  calendarioFestivos($('#calendario'), fest);
  const r = $('#reiniciar'); if (r) r.onclick = () => { D.reiniciarDemo(); location.hash = '#/'; ir(); };
  $('#od-conectar').onclick = async () => { try { location.href = (await D.onedrive('url')).url; } catch (e) { alert(msg(e)); } };
  document.querySelectorAll('[data-us]').forEach(b => b.onclick = () => modalUsuario(us.find(u => u.id === b.dataset.us)));
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

function modalCliente(c) {
  const fondo = document.createElement('div'); fondo.className = 'modal-fondo';
  const campo = (k, t, cls = '') => `<div class="${cls}"><label>${t}</label><input name="${k}" value="${esc(c?.[k] || '')}"></div>`;
  fondo.innerHTML = `<form class="modal" id="fcli"><h2>${c ? 'Editar cliente' : 'Nuevo cliente'}</h2>
    <div class="grilla-form">
      <div class="ancho"><label>Nombre o razón social</label><input name="nombre" required value="${esc(c?.nombre || '')}" style="text-transform:uppercase"></div>
      <div><label>Tipo</label><select name="tipo"><option value="empresa" ${c?.tipo === 'empresa' ? 'selected' : ''}>Empresa</option><option value="persona" ${c?.tipo === 'persona' ? 'selected' : ''}>Persona</option></select></div>
      ${campo('tipo_documento', 'Tipo de documento')}${campo('documento', 'Documento')}
      ${campo('representante', 'Representante')}${campo('documento_representante', 'Documento del representante')}
      ${campo('email', 'Correo')}${campo('telefono', 'Teléfono')}
      ${campo('direccion', 'Dirección', 'ancho')}${campo('ciudad', 'Ciudad')}
    </div><div class="aviso" id="aviso"></div>
    <div class="pie-modal"><button type="button" class="btn sec" id="cancelar">Cancelar</button><button class="btn" type="submit">Guardar</button></div></form>`;
  document.body.appendChild(fondo);
  $('#cancelar', fondo).onclick = () => fondo.remove();
  $('#fcli', fondo).onsubmit = async ev => {
    ev.preventDefault();
    const v = Object.fromEntries(new FormData(ev.target));
    for (const k in v) v[k] = v[k].trim() || null;
    v.nombre = (v.nombre || '').toUpperCase();
    try { c ? await D.actualizarCliente(c.id, v) : await D.crearCliente(v); fondo.remove(); ir(); }
    catch (err) { $('#aviso', fondo).textContent = msg(err); }
  };
}

function modalUsuario(u) {
  const fondo = document.createElement('div'); fondo.className = 'modal-fondo';
  fondo.innerHTML = `<form class="modal" id="fus"><h2>Usuario</h2><p class="sub">${esc(u.email || '')}</p>
    <div class="grilla-form"><div><label>Nombre</label><input name="nombre" value="${esc(u.nombre || '')}"></div><div><label>Teléfono</label><input name="telefono" value="${esc(u.telefono || '')}"></div></div>
    <p class="sub" style="margin-top:14px">Para dar acceso a un encargo, invita a la persona desde Ajustes del encargo.</p>
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
  marco(s, { titulo: 'Propuestas preliminares', ruta: 'Portal', activo: 'propuestas', html, bajada: 'Propuestas económicas antes de que el encargo despegue.',
    acciones: '<button class="btn" id="nueva">+ Nueva propuesta</button>' });
  const pintar = () => {
    const q = $('#buscar').value.toLowerCase(), est = $('#festado').value;
    const f = lista.filter(p => (!est || p.estado === est) && (!q || [p.nombre, p.codigo, p.cliente?.nombre].join(' ').toLowerCase().includes(q)));
    $('#tabla').innerHTML = f.length ? `
      <div class="tabla-cont"><table class="t-prop">
        <thead><tr><th class="col-opc">Código de propuesta</th><th>Propuesta</th><th class="col-opc">Cliente</th><th class="num col-opc">Honorarios</th><th class="col-opc">Enviada</th><th>Estado</th><th></th></tr></thead>
        <tbody>${f.map(p => `
          <tr>
            <td class="sub col-opc">${esc(p.codigo)}</td>
            <td><b>${esc(p.nombre)}</b><div class="sub">${esc(p.servicio?.nombre || 'Sin servicio')}<span class="solo-movil"> · ${esc(p.codigo)}</span></div></td>
            <td class="col-opc">${xxx(p.cliente?.nombre)}</td>
            <td class="num col-opc">${p.honorarios ? cop(p.honorarios) : '—'}</td>
            <td class="col-opc">${p.estado === 'borrador' ? '—' : `<label class="fecha-envio" title="Fecha de envío · clic para cambiarla">${p.fecha_envio ? fecha(p.fecha_envio) : '<span class="xxx">Sin fecha</span>'}${ico('editar')}<input type="date" data-fenvio="${p.id}" value="${p.fecha_envio || ''}" aria-label="Fecha de envío"></label>${p.estado === 'en_espera' && p.fecha_envio ? `<div class="sub">${quedan(p.fecha_envio)}</div>` : ''}`}</td>
            <td><span class="etiqueta ${p.estado}">${D.ESTADOS_PROPUESTA[p.estado]}</span><div class="doc-estado revisando" data-docs="${p.id}">Revisando documentos…</div>${p.estado === 'no_despego' && p.motivo ? `<div class="sub">${esc(p.motivo)}</div>` : ''}</td>
            <td class="acciones-fila">${accionesPropuesta(p)}</td>
          </tr>`).join('')}</tbody></table></div>`
      : `<div class="vacio">${lista.length ? 'Ninguna propuesta coincide.' : 'Todavía no hay propuestas preliminares.'}</div>`;
    document.querySelectorAll('[data-acc]').forEach(b => b.onclick = () => accion(b.dataset.acc, lista.find(p => p.id === b.dataset.id)));
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
        const motivo = prompt('¿Por qué no despegó? (opcional)') ?? null;
        if (motivo === null) return;
        await D.actualizarPropuesta(p.id, { estado: 'no_despego', fecha_decision: hoy, motivo: motivo || 'Sin motivo' });
      }
      if (acc === 'reabrir') await D.actualizarPropuesta(p.id, { estado: 'en_espera', fecha_envio: hoy, motivo: null, fecha_decision: null });
      if (acc === 'despego') {
        if (!confirm(`¿${p.nombre} despegó? Se crea el encargo con toda la información de la cotización.`)) return;
        await despegarYAbrir(p); return;
      }
      if (acc === 'eliminar') {
        if (!confirm(`¿Eliminar la propuesta ${p.codigo} · ${p.nombre}?\n\nSe borra del portal y su carpeta en OneDrive (ZL_REG_PROPUESTAS) pasa a la papelera, donde se puede recuperar durante 93 días.`)) return;
        const r = await D.onedrive('eliminar_propuesta', { propuesta_id: p.id });
        alert(r.carpeta ? `Propuesta eliminada.\nCarpeta enviada a la papelera de OneDrive: ${r.carpeta}` : 'Propuesta eliminada. No tenía carpeta en OneDrive.');
        ir(); return;
      }
      if (acc === 'editar') { modalPropuesta(p); return; }
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
    cliente: buscar(/nombre del cliente/), ubicacion: buscar(/ubicaci[oó]n del encargo/), direccion: buscar(/direcci[oó]n del encargo/),
    area_predio: buscar(/[áa]rea( del)? predio/), area_licencia: buscar(/licencia/), area_existente: buscar(/existente/),
    area_intervenida: buscar(/intervenida/), categoria_trabajo: buscar(/categor[ií]a de trabajo/),
    servicios: buscar(/categor[ií]a de servicios|servicios regenerativo/), encargo: buscar(/^encargo$/),
  };
  // Honorarios: fila que sigue al encabezado "VALOR TOTAL"
  const filas = [...xml.getElementsByTagNameNS(W, 'tr')].map(f => [...f.getElementsByTagNameNS(W, 'tc')].map(texto));
  const h = filas.findIndex(c => c.some(x => /valor total/i.test(x)));
  if (h >= 0 && filas[h + 1]) { const v = filas[h + 1].filter(Boolean).at(-1) || ''; const n = v.replace(/[^\d]/g, ''); if (n) r.honorarios = Number(n); }
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
};
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
    <div class="aviso" id="aviso-word">${p?.archivo_nombre ? '' : 'Carga primero la propuesta económica: los datos se habilitan cuando esté cargada.'}</div>
    <fieldset id="datos" style="border:0;padding:0;margin:0;min-width:0" ${p?.archivo_nombre ? '' : 'disabled'}>
    <div class="grilla-form">
      <div><label>Código de propuesta</label><input name="codigo" value="${esc(codigo)}" required ${p ? 'readonly' : ''}></div>
      <div><label>Nombre del proyecto (en mayúsculas)</label><input name="nombre" value="${esc(p?.nombre || '')}" placeholder="PROYECTO" required style="text-transform:uppercase"></div>
      <div class="ancho"><label>Código de proyecto (cuando despegue)</label><input id="codproy" readonly tabindex="-1" value=""></div>
      <div><label>Cliente</label><select name="cliente_id"><option value="">— Elegir —</option>${op(cli, p?.cliente_id)}<option value="__nuevo">+ Nuevo cliente…</option></select></div>
      <div><label>Servicio</label><select name="servicio_id">${op(svc, p?.servicio_id)}</select></div>
      <input type="hidden" name="tipo" value="${p?.tipo || 'ambos'}">
      <div><label>Fecha de envío</label><input name="fecha_envio" type="date" value="${p?.fecha_envio || ''}"></div>
      <div><label>Honorarios (COP)</label><input name="honorarios" inputmode="numeric" placeholder="8.200.000" value="${p?.honorarios ? Number(p.honorarios).toLocaleString('es-CO').replace(/,/g, '.') : ''}"></div>
    </div>
    <h3 style="margin:28px 0 0">Detalles técnicos del encargo</h3>
    <div class="grilla-form">
      ${DETALLES_PROPUESTA.map(([k, t, c]) => `<div class="${c || ''}"><label>${t}</label><input name="${k}" value="${esc(p?.[k] || '')}"></div>`).join('')}
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
        <div class="od-lista">${lista.map((a, i) => `<div class="od-fila"><div class="od-nom"><b>${esc(a.nombre)}</b><span class="sub">${tipo(a.nombre)}</span></div>
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
      if (r.servicios) { const sv = svc.find(x => r.servicios.toLowerCase().includes(x.nombre.toLowerCase())); if (sv) f.servicio_id.value = sv.id; }
      codProy(); $('#datos', fondo).disabled = false;
      av.style.color = 'var(--petroleo)';
      av.textContent = 'Datos cargados desde la propuesta. Revísalos y guarda.' + (clienteNuevo ? ` El cliente "${clienteNuevo}" no existe todavía: se crea al guardar.` : '');
    } catch (err) { av.textContent = 'No se pudo leer el Word: ' + msg(err); }
  };
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
    if ($('#datos', fondo).disabled) { $('#aviso', fondo).textContent = 'Primero carga la propuesta económica en Word.'; return; }
    const v = Object.fromEntries(new FormData(f));
    if (archivoWord && D.MODO_DEMO) v.archivo_nombre = archivoWord.name;
    v.nombre = v.nombre.trim().toUpperCase().replace(/^\d{2}\s+I\s+/, '');
    v.honorarios = v.honorarios ? Number(v.honorarios.replace(/\D/g, '')) : null;
    v.fecha_envio = v.fecha_envio || null;
    if (!v.cliente_id && clienteNuevo) { const c = await D.crearCliente({ tipo: 'persona', nombre: clienteNuevo.trim().toUpperCase() }); v.cliente_id = c.id; }
    if (!v.cliente_id) v.cliente_id = null;
    for (const [k] of DETALLES_PROPUESTA) v[k] = (v[k] || '').trim() || null;
    try {
      const n = p ? (delete v.codigo, await D.actualizarPropuesta(p.id, v)) : await D.crearPropuesta(v);
      if (!D.MODO_DEMO) {
        try {
          const cambio = p && !archivoWord && p.archivo_nombre && DETALLES_PROPUESTA.some(([k]) => (p[k] || null) !== v[k]);
          let r;
          if (archivoWord) r = await D.onedrive('subir_propuesta', { propuesta_id: n.id, nombre: archivoWord.name, base64: await aBase64(archivoWord) });
          else if (cambio) {
            const w = await D.onedrive('descargar_propuesta', { propuesta_id: n.id });
            const base64 = await escribirPropuestaWord(w.base64, Object.fromEntries(DETALLES_PROPUESTA.map(([k]) => [k, v[k]])));
            r = await D.onedrive('subir_propuesta', { propuesta_id: n.id, nombre: w.nombre, base64 });
            alert('Propuesta guardada y Word actualizado en OneDrive.');
          } else r = await D.onedrive('propuesta', { propuesta_id: n.id });
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
  marco(s, { titulo: 'Base de precios', ruta: 'Portal · común a todos los encargos', activo: 'base', html: v.html });
  if (v.montar) v.montar(ir);
}
