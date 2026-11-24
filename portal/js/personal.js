// Finanzas personales de Andrés: lo mismo que tenía en MONAI (categorías y etiquetas en inglés, como él las escribe),
// con Movimientos y Rendimiento como las finanzas de regenerativo. Tres tipos: ingreso, gasto y ahorro (el ahorro no cuenta como gasto).
import * as D from './datos.js?v=174';
import { cop, fecha, iso } from './formato.js?v=174';
import { btnIco, ico } from './iconos.js?v=174';
import { barras } from './finanzas.js?v=174';

const $ = (s, r = document) => r.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const mesDe = f => (f || '').slice(0, 7);
const compacto = n => { const a = Math.abs(n), s = n < 0 ? '−' : ''; return s + (a >= 1e6 ? (a / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 1 }) + ' M' : a >= 1e3 ? Math.round(a / 1e3) + ' mil' : String(Math.round(a))); };
const horaTxt = h => { const [H, M] = String(h).split(':').map(Number); return `${(H % 12) || 12}:${String(M).padStart(2, '0')} ${H < 12 ? 'a. m.' : 'p. m.'}`; };
const conHora = x => fecha(x.fecha) + (x.hora ? ' · ' + horaTxt(x.hora) : '');
const masReciente = (a, b) => (a.fecha + (a.hora || '')) < (b.fecha + (b.hora || '')) ? 1 : -1;
const TIPOS = { ingreso: 'Ingreso', gasto: 'Gasto', ahorro: 'Ahorro' };
const SIGNO = { ingreso: '+', gasto: '−', ahorro: '' };
const ESTADO = { vista: 'mov', graf: 'anio', eti: '', presModo: 'base', presVista: 'mes', abierto: '', crecIng: 0, crecGas: 0, aclarar: false };
const emoji = c => `<span class="per-emo" style="--c:${esc(c?.color || '#BFBFBF')}">${esc(c?.emoji || '·')}</span>`;
const DIEZMO = ['ministerio_diezmo', 'savings_diezmo'];
const esDiezmo = x => (x.etiquetas || []).some(t => DIEZMO.includes(t)) || /diezmo/i.test(x.descripcion || '');
const mkMes = (y, mm) => `${y}-${String(mm).padStart(2, '0')}`;
const num = v => Number(String(v ?? '').replace(/\D/g, '')) || 0;
const miles = v => v ? Math.round(v).toLocaleString('es-CO').replace(/,/g, '.') : '';

export async function vistaPersonal(mesSel) {
  const [cats, etis, movs, pres, fijos, proys, items, aj, notas] = await Promise.all([D.perCategorias(), D.perEtiquetas(), D.perMovimientos(), D.perPresupuesto(), D.perFijos(), D.perProyectos(), D.perItems(), D.perAjustes().catch(() => null), D.perNotas().catch(() => null)]);
  // Esperado de una categoría en un mes: el ajuste de ese mes o, si no hay, el plan base
  const espDe = (cid, k) => { const o = pres.find(p => p.categoria_id === cid && p.mes === k); const b = pres.find(p => p.categoria_id === cid && !p.mes); return Number((o ?? b)?.valor || 0); };
  const catDe = id => cats.find(c => c.id === id);
  const hoy = new Date();
  const modoAnio = /^\d{4}$/.test(mesSel || '');
  const mes = modoAnio ? (iso(hoy).slice(0, 4) === mesSel ? iso(hoy).slice(0, 7) : `${mesSel}-12`) : /^\d{4}-\d{2}$/.test(mesSel || '') ? mesSel : iso(hoy).slice(0, 7);
  const [a, m] = mes.split('-').map(Number);
  const mesTxt = modoAnio ? `Año ${a}` : `${MESES[m - 1]} ${a}`;
  const eyebrow = modoAnio ? `Todo el año ${a}` : `${MESES[m - 1]} de ${a}`;
  const enPeriodo = x => modoAnio ? (x.fecha || '').slice(0, 4) === String(a) : mesDe(x.fecha) === mes;
  const conEti = x => !ESTADO.eti || (x.etiquetas || []).includes(ESTADO.eti);
  const delPer = movs.filter(x => enPeriodo(x) && conEti(x)).sort(masReciente);
  const suma = (l, t) => l.filter(x => x.tipo === t).reduce((s, x) => s + Number(x.valor), 0);
  const ing = suma(delPer, 'ingreso'), gas = suma(delPer, 'gasto'), aho = suma(delPer, 'ahorro');
  const disp = ing - gas - aho;
  const anioHoy = hoy.getFullYear();
  const anioMin = Math.min(anioHoy, ...movs.map(x => Number((x.fecha || '').slice(0, 4))).filter(Boolean));
  const anios = Array.from({ length: anioHoy - anioMin + 1 }, (_, i) => anioHoy - i);
  const activas = cats.filter(c => c.activa !== false);
  const ids = new Set(cats.map(c => c.id));

  // Columnas por categoría: ingresos | gastos (con presupuesto) | ahorro
  const colDe = c => ({ ...c, pres: modoAnio ? Array.from({ length: 12 }, (_, i) => espDe(c.id, mkMes(a, i + 1))).reduce((s, v) => s + v, 0) : espDe(c.id, mes), v: delPer.filter(x => x.categoria_id === c.id).reduce((s, x) => s + Number(x.valor), 0) });
  const cIng = activas.filter(c => c.tipo === 'ingreso').map(colDe);
  const cGas = activas.filter(c => c.tipo === 'gasto').map(colDe).sort((x, y) => y.v - x.v);
  const cAho = activas.filter(c => c.tipo === 'ahorro').map(colDe);
  ['ingreso', 'gasto', 'ahorro'].forEach(t => { const v = delPer.filter(x => x.tipo === t && !ids.has(x.categoria_id)).reduce((s, x) => s + Number(x.valor), 0);
    if (v) ({ ingreso: cIng, gasto: cGas, ahorro: cAho })[t].push({ id: '', nombre: 'Sin categoría', tipo: t, emoji: '·', color: '#BFBFBF', pres: 0, v }); });
  const maxC = Math.max(1, ...[...cIng, ...cGas, ...cAho].map(c => Math.max(c.v, c.pres)));
  const H = 190;
  const col = c => { const exc = c.tipo === 'gasto' && c.pres && c.v > c.pres;
    return `<button class="mon-col per-col ${c.tipo === 'ingreso' ? 'ing' : ''} t-${c.tipo}" data-cat="${c.id}" data-tipo="${c.tipo}" title="Ver ${esc(c.nombre)}">
      <div class="mon-barra" style="height:${H}px">${c.tipo === 'gasto' && c.pres ? `<div class="mon-pres" style="height:${c.pres / maxC * H}px"></div>` : ''}<div class="mon-gasto ${c.tipo === 'ingreso' ? 'mon-ingreso' : c.tipo === 'ahorro' ? 'mon-ahorro' : ''} ${exc ? 'exc' : ''}" style="height:${Math.max(c.v ? 8 : 0, Math.max(0, c.v) / maxC * H)}px"></div></div>
      <div class="mon-ico">${emoji(c)}</div><div class="mon-val">${compacto(c.v)}</div>
      <div class="mon-pct ${exc ? 'xxx' : ''}">${c.tipo === 'gasto' ? (c.pres ? Math.round(c.v / c.pres * 100) + ' %' : '—') : TIPOS[c.tipo].toLowerCase()}</div>
      <div class="mon-nom">${esc(c.nombre)}</div></button>`; };
  // Etiquetas usadas en el periodo, por categoría (como las subcategorías de MONAI)
  const desglose = [...cIng, ...cGas, ...cAho].filter(c => c.v && c.id).map(c => {
    const o = {}; delPer.filter(x => x.categoria_id === c.id).forEach(x => (x.etiquetas || []).forEach(t => { o[t] = (o[t] || 0) + Number(x.valor); }));
    return { c, l: Object.entries(o).sort((p, q) => q[1] - p[1]) };
  }).filter(d => d.l.length);
  const presTot = cGas.reduce((s, c) => s + c.pres, 0);

  // Año: ingresos, gastos, ahorro y disponible por mes
  const serieAnio = Array.from({ length: 12 }, (_, i) => { const k = `${a}-${String(i + 1).padStart(2, '0')}`; const l = movs.filter(x => mesDe(x.fecha) === k && conEti(x)); return { k, ing: suma(l, 'ingreso'), gas: suma(l, 'gasto'), aho: suma(l, 'ahorro') }; });
  const serie6 = Array.from({ length: 6 }, (_, i) => { const d = new Date(a, m - 6 + i, 1); const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; const l = movs.filter(x => mesDe(x.fecha) === k && conEti(x)); return { k, ing: suma(l, 'ingreso'), gas: suma(l, 'gasto'), aho: suma(l, 'ahorro') }; });
  const nc = v => (v < 0 ? '−' : '') + cop(Math.abs(v)).replace(' COP', '');
  const tot = serieAnio.reduce((t, x) => ({ ing: t.ing + x.ing, gas: t.gas + x.gas, aho: t.aho + x.aho }), { ing: 0, gas: 0, aho: 0 });
  const tablaAnio = `<div class="tabla-cont"><table class="t-compacta t-anio"><thead><tr><th>Mes</th><th class="num">Ingresos</th><th class="num">Gastos</th><th class="num">Ahorro</th><th class="num">Disponible <span class="sub">COP</span></th></tr></thead><tbody>
    ${serieAnio.map(x => { const [, mm] = x.k.split('-').map(Number); const d = x.ing - x.gas - x.aho, vacio = !x.ing && !x.gas && !x.aho;
      return `<tr class="clic${x.k === mes && !modoAnio ? ' mes-actual' : ''}${vacio ? ' mes-vacio' : ''}" data-ir-mes="${x.k}"><td><span class="m-largo">${MESES[mm - 1]}</span><span class="m-corto">${MESES[mm - 1].slice(0, 3)}</span></td><td class="num ingreso">${x.ing ? nc(x.ing) : '—'}</td><td class="num gasto">${x.gas ? nc(x.gas) : '—'}</td><td class="num ahorro">${x.aho ? nc(x.aho) : '—'}</td><td class="num ${d < 0 ? 'xxx' : ''}">${vacio ? '—' : nc(d)}</td></tr>`; }).join('')}
    <tr class="total"><td>Total ${a}</td><td class="num">${nc(tot.ing)}</td><td class="num">${nc(tot.gas)}</td><td class="num">${nc(tot.aho)}</td><td class="num ${tot.ing - tot.gas - tot.aho < 0 ? 'xxx' : ''}">${nc(tot.ing - tot.gas - tot.aho)}</td></tr></tbody></table></div>`;

  const etiTxt = l => (l || []).map(t => `<span class="per-eti">#${esc(t)}</span>`).join('');
  const fila = x => { const c = catDe(x.categoria_id);
    return `<button class="mov-fila" data-editar="${x.id}" data-buscar="${esc([x.descripcion, c?.nombre, ...(x.etiquetas || []), x.medio, x.valor].join(' ').toLowerCase())}">
      <span class="mov-ico per">${emoji(c)}</span>
      <span class="mov-txt"><b>${esc(x.descripcion || c?.nombre || '')}</b><span class="sub">${conHora(x)} · ${esc(c?.nombre || 'Sin categoría')}</span>${(x.etiquetas || []).length ? `<span class="per-etis">${etiTxt(x.etiquetas)}</span>` : ''}</span>
      <span class="mov-der"><span class="mov-val ${x.tipo}">${SIGNO[x.tipo]} ${cop(x.valor)}</span></span></button>`; };

  const VISTAS = [['mov', 'Movimientos'], ['pres', 'Presupuesto'], ['proy', 'Proyecciones'], ['rend', 'Rendimiento']];
  const selector = `<div class="rend-sel per-vistas" role="group" aria-label="Vista de finanzas personales">${VISTAS.map(([k, t]) => `<button type="button" class="chip-f${ESTADO.vista === k ? ' on' : ''}" data-vista="${k}">${t}</button>`).join('')}</div>`;
  // Por aclarar: movimientos sin etiqueta y posibles repetidos (misma fecha, valor y categoría) que no has revisado
  const clave = x => `${x.fecha}|${x.valor}|${x.categoria_id}`;
  const cuenta = {}; movs.forEach(x => { cuenta[clave(x)] = (cuenta[clave(x)] || 0) + 1; });
  const dudosos = movs.filter(x => !x.revisado && (!(x.etiquetas || []).length || cuenta[clave(x)] > 1)).sort(masReciente);
  const prefDe = c => (c?.nombre || '').toLowerCase().replace(/s$/, '').slice(0, 5);
  const aclarar = dudosos.length ? `<section class="panel per-aclarar${ESTADO.aclarar ? ' abierto' : ''}"><button type="button" class="per-acl-cab" id="acl-tog"><h3>Por aclarar <span class="pend-n">${dudosos.length}</span></h3><span class="sub">Sin etiqueta o posibles repetidos. Ponles etiqueta o márcalos como revisados para tener todo claro.</span><span class="per-acl-fl">${ESTADO.aclarar ? '−' : '+'}</span></button>
    ${ESTADO.aclarar ? `<div class="lista-filas">${dudosos.slice(0, 25).map(x => { const c = catDe(x.categoria_id), rep = cuenta[clave(x)] > 1;
      const sug = etis.map(t => t.nombre).filter(t => prefDe(c) && t.startsWith(prefDe(c)));
      return `<div class="per-acl-fila" data-acl="${x.id}"><span class="mov-ico per">${emoji(c)}</span><span class="mov-txt"><b>${esc(x.descripcion || '—')}</b><span class="sub">${conHora(x)} · ${esc(c?.nombre || 'Sin categoría')} · ${SIGNO[x.tipo]} ${cop(x.valor)}${rep ? ' · <b class="xxx">posible repetido</b>' : ''}</span>
        <span class="per-etis">${!(x.etiquetas || []).length ? sug.map(t => `<button type="button" class="per-eti-t" data-poner="${esc(t)}">#${esc(t)}</button>`).join('') : etiTxt(x.etiquetas)}</span></span>
        <span class="per-acl-acc"><button type="button" class="btn sec mini" data-ok-acl>${rep ? 'Son distintos' : 'Así está bien'}</button><button type="button" class="btn sec mini" data-ed-acl>Editar</button></span></div>`; }).join('')}</div>${dudosos.length > 25 ? `<p class="sub">Y ${dudosos.length - 25} más: se van mostrando a medida que aclaras estos.</p>` : ''}` : ''}</section>` : '';
  const filtros = `<div class="mon-filtros">
      <label class="per-sel"><span>Año</span><select id="sel-anio" aria-label="Año">${anios.map(y => `<option value="${y}" ${y === a ? 'selected' : ''}>${y}</option>`).join('')}</select></label>
      <label class="per-sel"><span>Mes</span><select id="sel-mes" aria-label="Mes"><option value="" ${modoAnio ? 'selected' : ''}>Todo el año</option>${MESES.map((n, i) => `<option value="${String(i + 1).padStart(2, '0')}" ${!modoAnio && i + 1 === m ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="per-sel per-proy"><span>Etiqueta</span><select id="sel-eti"><option value="">Todas</option>${etis.map(t => `<option value="${esc(t.nombre)}" ${t.nombre === ESTADO.eti ? 'selected' : ''}>#${esc(t.nombre)}</option>`).join('')}</select></label></div>`;

  const htmlMov = aclarar + `
    <div class="fin-mon">
      <section class="mon">
        <div class="mon-total">
          <div class="mon-et">Disponible ${modoAnio ? 'del año' : 'del mes'}</div>
          <div class="mon-cifra">${disp < 0 ? '−' : '+'}${cop(Math.abs(disp)).replace(' COP', '')}<span>COP</span></div>
          <div class="mon-pills"><span class="pill-ing">+ ${cop(ing)}</span><span class="pill-gas">− ${cop(gas)}</span><span class="pill-aho">${cop(aho)} ahorro</span></div>
          ${ESTADO.eti ? `<div class="mon-sal"><span>Filtrado por <b>#${esc(ESTADO.eti)}</b></span></div>` : ''}
          ${filtros}
        </div>
        <div class="mon-cols">${cIng.map(col).join('')}${cIng.length ? '<span class="mon-sep" aria-hidden="true"></span>' : ''}${cGas.map(col).join('')}${cAho.length ? '<span class="mon-sep" aria-hidden="true"></span>' : ''}${cAho.map(col).join('')}</div>
        ${desglose.length ? `<div class="mon-sub">${desglose.map(d => `<div class="ms-fila"><span class="ms-cat">${emoji(d.c)} ${esc(d.c.nombre)}</span><span class="ms-chips">${d.l.map(([n, v]) => `<button type="button" class="ms-chip" data-eti="${esc(n)}">#${esc(n)} <b>${compacto(v)}</b></button>`).join('')}</span></div>`).join('')}</div>` : ''}
        <p class="sub mon-ley">Ingresos &nbsp; <span class="ley-pres"></span>Esperado &nbsp; <span class="ley-gas"></span>Gastado &nbsp; <span class="ley-aho"></span>Ahorro${presTot ? ` &nbsp;·&nbsp; ${Math.round(gas / presTot * 100)} % de lo esperado` : ''}</p>
        <div class="mon-mas"><button class="btn sec mini btn-ing" data-nuevo="ingreso">+ Ingreso</button><button class="btn sec mini btn-aho" data-nuevo="ahorro">+ Ahorro</button><button class="btn mini btn-gas" data-nuevo="gasto">+ Gasto</button></div>
      </section>
      <section class="panel fin-lado">
        <div class="od-cab"><h3>Movimientos del ${modoAnio ? 'año' : 'mes'}</h3><span class="sub">${delPer.length}</span></div>
        ${delPer.length > 3 ? '<input type="search" id="buscar-mov" class="buscar-mov" placeholder="Buscar: concepto, categoría, #etiqueta, valor…">' : ''}
        ${delPer.length ? `<div class="lista-filas">${delPer.map(fila).join('')}</div>` : `<p class="sub">No hay movimientos ${modoAnio ? 'este año' : 'este mes'}${ESTADO.eti ? ' con esa etiqueta' : ''}.</p>`}
      </section>
    </div>
    <section class="panel panel-anio"><div class="od-cab"><h3>Ingresos y gastos</h3><span class="graf-vistas" role="group" aria-label="Periodo"><button type="button" class="chip-f${ESTADO.graf === 'anio' ? ' on' : ''}" data-graf="anio">Año ${a}</button><button type="button" class="chip-f${ESTADO.graf === 'seis' ? ' on' : ''}" data-graf="seis">6 meses</button></span></div>
      ${ESTADO.graf === 'anio' ? barras(serieAnio) + tablaAnio : barras(serie6)}</section>`;

  const ctx = { movs, cats, etis, pres, fijos, proys, items, aj, notas, a, m, mes, modoAnio, suma, catDe, espDe };
  const html = selector + (ESTADO.vista === 'rend' ? rendimiento(ctx) : ESTADO.vista === 'pres' ? vistaPres(ctx) : ESTADO.vista === 'proy' ? vistaProy(ctx) : htmlMov);
  return { html, eyebrow, mesTxt, rend: ESTADO.vista !== 'mov', montar: recargar => {
    const ir = (y, mm) => { location.hash = `#/personal/${mm ? `${y}-${mm}` : y}`; };
    document.querySelectorAll('[data-vista]').forEach(b => b.onclick = () => { ESTADO.vista = b.dataset.vista; recargar(); });
    const bg = $('#per-ajustes'); if (bg) bg.onclick = () => ajustes(cats, etis, movs, mesTxt, recargar);
    if (ESTADO.vista === 'pres') return montarPres(ctx, recargar);
    if (ESTADO.vista === 'proy') return montarProy(ctx, recargar);
    if (ESTADO.vista !== 'mov') return;
    const at = $('#acl-tog'); if (at) at.onclick = () => { ESTADO.aclarar = !ESTADO.aclarar; const y = scrollY; recargar(); requestAnimationFrame(() => scrollTo(0, y)); };
    document.querySelectorAll('[data-acl]').forEach(f => {
      const id = f.dataset.acl, quieto = async cambios => { f.style.opacity = .4; await D.perGuardar({ id, ...cambios }); const y = scrollY; await recargar(); scrollTo(0, y); };
      f.querySelectorAll('[data-poner]').forEach(b => b.onclick = () => quieto({ etiquetas: [b.dataset.poner] }));
      f.querySelector('[data-ok-acl]').onclick = () => quieto({ revisado: true });
      f.querySelector('[data-ed-acl]').onclick = () => modalMov(movs.find(x => x.id === id), cats, etis, recargar, proys);
    });
    $('#sel-anio').onchange = () => ir($('#sel-anio').value, $('#sel-mes').value);
    $('#sel-mes').onchange = () => ir($('#sel-anio').value, $('#sel-mes').value);
    $('#sel-eti').onchange = () => { ESTADO.eti = $('#sel-eti').value; recargar(); };
    document.querySelectorAll('[data-eti]').forEach(b => b.onclick = () => { ESTADO.eti = ESTADO.eti === b.dataset.eti ? '' : b.dataset.eti; recargar(); });
    document.querySelectorAll('[data-nuevo]').forEach(b => b.onclick = () => modalMov({ tipo: b.dataset.nuevo, fecha: iso(new Date()), etiquetas: [] }, cats, etis, recargar, proys));
    document.querySelectorAll('[data-editar]').forEach(b => b.onclick = () => modalMov(movs.find(x => x.id === b.dataset.editar), cats, etis, recargar, proys));
    document.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => {
      const t = b.dataset.tipo, id = b.dataset.cat, c = catDe(id);
      const l = delPer.filter(x => x.tipo === t && (id ? x.categoria_id === id : !ids.has(x.categoria_id)));
      const f = document.createElement('div'); f.className = 'modal-fondo';
      f.innerHTML = `<div class="modal modal-cat"><div class="mc-cab"><span class="mc-ico">${emoji(c)}</span><div><span class="lv-ceja">${TIPOS[t]} · ${esc(mesTxt)}</span><h2>${esc(c?.nombre || 'Sin categoría')}</h2></div><b class="mc-tot ${t}">${SIGNO[t]} ${cop(l.reduce((s, x) => s + Number(x.valor), 0))}</b></div>
        ${l.length ? `<div class="lista-filas">${l.map(fila).join('')}</div>` : '<p class="sub">Sin movimientos en este periodo.</p>'}
        <div class="pie-modal"><button type="button" class="btn sec" data-cerrar>Cerrar</button><button type="button" class="btn" data-agregar><span class="mas">+</span> ${TIPOS[t]}</button></div></div>`;
      document.body.appendChild(f);
      f.onclick = ev => { if (ev.target === f || ev.target.closest('[data-cerrar]')) f.remove(); };
      f.querySelector('[data-agregar]').onclick = () => { f.remove(); modalMov({ tipo: t, fecha: iso(new Date()), categoria_id: id || null, etiquetas: [] }, cats, etis, recargar, proys); };
      f.querySelectorAll('[data-editar]').forEach(r => r.onclick = () => { f.remove(); modalMov(movs.find(x => x.id === r.dataset.editar), cats, etis, recargar, proys); });
    });
    const bm = $('#buscar-mov'); if (bm) bm.oninput = () => { const t = bm.value.toLowerCase().replace(/^#/, '').trim(); document.querySelectorAll('.fin-lado .mov-fila[data-buscar]').forEach(f => { f.hidden = !!t && !f.dataset.buscar.includes(t); }); };
    document.querySelectorAll('[data-graf]').forEach(b => b.onclick = () => { ESTADO.graf = b.dataset.graf; const y = scrollY; recargar(); requestAnimationFrame(() => scrollTo(0, y)); });
    document.querySelectorAll('[data-ir-mes]').forEach(tr => tr.onclick = () => { location.hash = `#/personal/${tr.dataset.irMes}`; scrollTo(0, 0); });
    document.querySelectorAll('.g-col').forEach(c => {
      c.onmouseenter = () => { const t = $('#tip-fin'); t.innerHTML = c.dataset.tip; t.style.display = 'block'; };
      c.onmousemove = ev => { const t = $('#tip-fin'), r = c.closest('.graf').getBoundingClientRect(); t.style.left = (ev.clientX - r.left + 12) + 'px'; t.style.top = (ev.clientY - r.top - 10) + 'px'; };
      c.onmouseleave = () => { $('#tip-fin').style.display = 'none'; };
    });
  } };
}

// ── Rendimiento: resultado, ahorro, diezmo y en qué se va la plata ──
function rendimiento({ movs, cats, a, m, mes, suma, catDe, espDe }) {
  const mk = (y, mm) => `${y}-${String(mm).padStart(2, '0')}`;
  const ant = m === 1 ? mk(a - 1, 12) : mk(a, m - 1);
  const delM = k => movs.filter(x => mesDe(x.fecha) === k);
  const anio = movs.filter(x => (x.fecha || '').startsWith(String(a)));
  const ing = suma(delM(mes), 'ingreso'), gas = suma(delM(mes), 'gasto'), aho = suma(delM(mes), 'ahorro');
  const yIng = suma(anio, 'ingreso'), yGas = suma(anio, 'gasto'), yAho = suma(anio, 'ahorro');
  const pct = (n, d) => d ? Math.round(n / d * 100) : 0;
  // Diezmo: 10 % de lo que entra; lo dado = movimientos con #ministerio_diezmo o #savings_diezmo
  const diez = l => l.filter(esDiezmo).reduce((s, x) => s + Number(x.valor), 0);
  const dMes = diez(delM(mes)), dAnio = diez(anio), metaMes = Math.round(ing * 0.1), metaAnio = Math.round(yIng * 0.1);
  const porCat = k => { const o = {}; delM(k).filter(x => x.tipo === 'gasto').forEach(x => { const c = catDe(x.categoria_id)?.nombre || 'Sin categoría'; o[c] = (o[c] || 0) + Number(x.valor); }); return o; };
  const cA = porCat(mes), cB = porCat(ant);
  const filas = [...new Set([...Object.keys(cA), ...Object.keys(cB)])].map(n => ({ n, v: cA[n] || 0, p: cB[n] || 0, c: cats.find(c => c.nombre === n) })).sort((x, y) => y.v - x.v);
  const maxCat = Math.max(1, ...filas.map(f => Math.max(f.v, f.p)));
  const pEti = {}; delM(mes).filter(x => x.tipo === 'gasto').forEach(x => (x.etiquetas || []).forEach(t => { pEti[t] = (pEti[t] || 0) + Number(x.valor); }));
  const etiL = Object.entries(pEti).sort((p, q) => q[1] - p[1]).slice(0, 10), maxE = Math.max(1, ...etiL.map(e => e[1]));
  const nM = matchMedia('(max-width: 600px)').matches ? 6 : 12;
  const serie = Array.from({ length: nM }, (_, i) => { const d = new Date(a, m - nM + i, 1); const k = mk(d.getFullYear(), d.getMonth() + 1); return { k, ing: suma(delM(k), 'ingreso'), gas: suma(delM(k), 'gasto') }; });
  const obs = [];
  if (ing && ing < gas + aho) obs.push(['alto', `Este mes salió más de lo que entró: ingresos ${cop(ing)}, gastos ${cop(gas)} y ahorro ${cop(aho)}.`]);
  if (metaMes && dMes < metaMes) obs.push(['medio', `Diezmo del mes: llevas ${cop(dMes)} de ${cop(metaMes)} (10 % de los ingresos). Faltan ${cop(metaMes - dMes)}.`]);
  if (metaMes && dMes >= metaMes) obs.push(['bien', `Diezmo del mes completo: ${cop(dMes)} de ${cop(metaMes)}.`]);
  filas.filter(f => f.p >= 100000 && f.v > f.p * 1.3).slice(0, 3).forEach(f => obs.push(['medio', `${f.n} subió ${pct(f.v - f.p, f.p)} % frente al mes anterior (${cop(f.p)} → ${cop(f.v)}).`]));
  // Dónde mejorar: contra lo esperado, gastos pequeños que se repiten y transporte
  const mej = [];
  const ult3 = [1, 2, 3].map(i => { const d = new Date(a, m - 1 - i, 1); return mk(d.getFullYear(), d.getMonth() + 1); });
  cats.filter(c => c.tipo === 'gasto').forEach(c => { const e = espDe(c.id, mes), r = cA[c.nombre] || 0;
    if (e && r > e) obs.push(['alto', `${c.nombre} pasó lo esperado: ${cop(r)} de ${cop(e)}.`]);
    const veces = ult3.filter(k => { const ek = espDe(c.id, k); return ek && (porCat(k)[c.nombre] || 0) > ek; }).length;
    if (veces >= 2) mej.push(`${c.nombre} se pasó de lo esperado en ${veces} de los últimos 3 meses: o ajustas el plan a lo real o buscas dónde recortar.`); });
  const peq = {}; delM(mes).filter(x => x.tipo === 'gasto' && Number(x.valor) <= 30000).forEach(x => { const k = (x.etiquetas || [])[0] ? '#' + x.etiquetas[0] : (x.descripcion || 'sin concepto').toLowerCase(); peq[k] = peq[k] || { n: 0, v: 0 }; peq[k].n++; peq[k].v += Number(x.valor); });
  Object.entries(peq).filter(([, o]) => o.n >= 4).sort((p, q) => q[1].v - p[1].v).slice(0, 3).forEach(([k, o]) => mej.push(`Gastos pequeños que se repiten: ${k} ${o.n} veces este mes, ${cop(o.v)}. A la mitad, ahorrarías ${cop(Math.round(o.v / 2))} al mes.`));
  const tx = t => delM(mes).filter(x => (x.etiquetas || []).includes(t)).reduce((s, x) => s + Number(x.valor), 0);
  const ub = tx('transport_uber-taxi'), pu = tx('transport_public');
  if (ub > 100000 && ub > pu * 3) mej.push(`En transporte, Uber y taxi suman ${cop(ub)} y el público ${cop(pu)}. Cada trayecto que pases a público baja este número.`);
  const ahoEsp = cats.filter(c => c.tipo === 'ahorro').reduce((s, c) => s + espDe(c.id, mes), 0);
  if (ahoEsp && aho < ahoEsp) mej.push(`Ahorro del mes: ${cop(aho)} de ${cop(ahoEsp)} esperados. Apártalo apenas entre el ingreso, no al final del mes.`);
  if (!mej.length) mej.push('Sin puntos de mejora claros este mes. Con el presupuesto lleno, aquí aparecerán las comparaciones contra lo esperado.');
  const sinCat = delM(mes).filter(x => !x.categoria_id).length;
  if (sinCat) obs.push(['bajo', `${sinCat} movimiento${sinCat > 1 ? 's' : ''} de este mes sin categoría.`]);
  if (ing && pct(aho, ing) >= 10) obs.push(['bien', `Este mes ahorraste el ${pct(aho, ing)} % de tus ingresos.`]);
  if (!obs.length) obs.push(['bien', 'Sin alertas este mes.']);
  const kpi = (t, v, s, cls = '') => `<div class="kpi ${cls}"><div class="et">${t}</div><div class="va">${v}</div><div class="su">${s}</div></div>`;
  return `
  <div class="kpis kpis-4 rend-kpis">
    ${kpi('Resultado del mes', cop(ing - gas), `Ingresos menos gastos · ${MESES[m - 1]}`, ing - gas < 0 ? 'neg' : '')}
    ${kpi('Ahorrado del mes', cop(aho), ing ? `${pct(aho, ing)} % de los ingresos` : 'Sin ingresos este mes')}
    ${kpi('Ahorrado en el año', cop(yAho), yIng ? `${pct(yAho, yIng)} % de los ingresos de ${a}` : `${a}`)}
    ${kpi('Diezmo del mes', `${cop(dMes)}`, metaMes ? `Meta ${cop(metaMes)} · ${pct(dMes, metaMes)} %` : 'Sin ingresos este mes', metaMes && dMes < metaMes ? 'neg' : '')}
  </div>
  <section class="panel"><h3>Observaciones</h3><ul class="rend-obs">${obs.map(([n, t]) => `<li class="${n}"><i></i><span>${esc(t)}</span></li>`).join('')}</ul></section>
  <section class="panel"><h3>Dónde mejorar</h3><ul class="rend-obs">${mej.map(t => `<li class="medio"><i></i><span>${esc(t)}</span></li>`).join('')}</ul></section>
  <section class="panel per-diezmo"><h3>Diezmo</h3><p class="sub">10 % de los ingresos. Cuenta lo marcado con #ministerio_diezmo o #savings_diezmo, o con «diezmo» en el concepto.</p>
    <div class="dos-kpi">
      <div><span class="lv-ceja">${MESES[m - 1]}</span><b>${cop(dMes)}</b><span class="sub">de ${cop(metaMes)}</span><span class="barra"><i style="width:${Math.min(100, pct(dMes, metaMes || 1))}%"></i></span></div>
      <div><span class="lv-ceja">Año ${a}</span><b>${cop(dAnio)}</b><span class="sub">de ${cop(metaAnio)}</span><span class="barra"><i style="width:${Math.min(100, pct(dAnio, metaAnio || 1))}%"></i></span></div>
    </div></section>
  <section class="panel"><h3>Últimos ${nM} meses</h3>${barras(serie)}</section>
  <div class="dos">
    <section class="panel"><h3>Gasto por categoría</h3><p class="sub">${MESES[m - 1]} contra el mes anterior</p>
      ${filas.length ? `<ul class="rend-cat">${filas.map(f => `<li><span class="rend-cn">${emoji(f.c)} ${esc(f.n)}</span><span class="rend-b"><i style="width:${f.v / maxCat * 100}%"></i><s style="width:${f.p / maxCat * 100}%"></s></span><span class="rend-v">${cop(f.v)}${f.p ? `<em class="${f.v > f.p ? 'sube' : 'baja'}">${f.v > f.p ? '▲' : '▼'} ${Math.abs(pct(f.v - f.p, f.p))} %</em>` : ''}</span></li>`).join('')}</ul>` : '<p class="sub">Sin gastos este mes.</p>'}</section>
    <section class="panel"><h3>Gasto por etiqueta</h3><p class="sub">${MESES[m - 1]} · las 10 etiquetas con más gasto</p>
      ${etiL.length ? `<ul class="rend-cat">${etiL.map(([t, v]) => `<li><span class="rend-cn">#${esc(t)}</span><span class="rend-b"><i style="width:${v / maxE * 100}%"></i></span><span class="rend-v">${cop(v)}</span></li>`).join('')}</ul>` : '<p class="sub">Sin gastos etiquetados este mes.</p>'}</section>
  </div>`;
}

// ── Nuevo o editar movimiento: categoría según el tipo y etiquetas como en MONAI ──
export function modalMov(m, cats, etis, recargar, proys = []) {
  const f0 = document.createElement('div'); f0.className = 'modal-fondo';
  const sel = new Set(m.etiquetas || []);
  const opsCat = t => cats.filter(c => c.tipo === t && (c.activa !== false || c.id === m.categoria_id)).map(c => `<option value="${c.id}" ${c.id === m.categoria_id ? 'selected' : ''}>${esc(c.emoji || '')} ${esc(c.nombre)}</option>`).join('');
  f0.innerHTML = `<form class="modal" id="pm">
    <h2>${m.id ? 'Editar' : 'Nuevo'} ${TIPOS[m.tipo].toLowerCase()}</h2>
    <div class="grilla-form">
      <div><label>Tipo</label><select name="tipo">${Object.entries(TIPOS).map(([k, v]) => `<option value="${k}" ${k === m.tipo ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div><label>Valor (COP)</label><input name="valor" inputmode="numeric" required value="${m.valor != null && m.valor !== '' ? (Number(m.valor) < 0 ? '-' : '') + Math.abs(Number(m.valor)).toLocaleString('es-CO').replace(/,/g, '.') : ''}"></div>
      <div><label>Fecha</label><input name="fecha" type="date" required value="${m.fecha || ''}"></div>
      <div><label>Hora</label><input name="hora" type="time" value="${m.hora ? String(m.hora).slice(0, 5) : ''}"></div>
      <div class="ancho"><label>Categoría</label><select name="categoria_id" required>${opsCat(m.tipo)}</select></div>
      <div class="ancho"><label>Concepto</label><input name="descripcion" value="${esc(m.descripcion || '')}" placeholder="UBER - casa a la oficina"></div>
      <div class="ancho"><label>Etiquetas</label><div class="per-etis-ed" id="pm-etis"></div></div>
      ${proys.filter(p => p.estado !== 'cerrado' || p.id === m.proyecto_id).length ? `<div class="ancho"><label>Proyecto personal</label><select name="proyecto_id"><option value="">Ninguno</option>${proys.filter(p => p.estado !== 'cerrado' || p.id === m.proyecto_id).map(p => `<option value="${p.id}" ${p.id === m.proyecto_id ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select></div>` : ''}
      <div><label>Medio de pago</label><input name="medio" list="per-medios" value="${esc(m.medio || '')}" placeholder="Tarjeta, Nequi…"><datalist id="per-medios"><option value="Tarjeta débito"><option value="Tarjeta crédito"><option value="Efectivo"><option value="Transferencia"><option value="Nequi"><option value="Daviplata"></datalist></div>
    </div>
    <div class="aviso" id="pm-aviso"></div>
    <div class="pie-modal">${m.id ? '<button type="button" class="btn sec" id="pm-borrar" style="margin-right:auto">Borrar</button>' : ''}<button type="button" class="btn sec" id="pm-cancelar">Cancelar</button><button class="btn" type="submit">Guardar</button></div>
  </form>`;
  document.body.appendChild(f0);
  const f = $('#pm', f0);
  // Etiquetas: primero las de la categoría elegida (por su prefijo, p. ej. Variable → variable_*), luego las demás
  const pref = () => (cats.find(c => c.id === f.categoria_id.value)?.nombre || '').toLowerCase().replace(/s$/, '').replace(/^debt$/, 'debt').slice(0, 5);
  const pintarEtis = () => { const p = pref(); const todas = [...new Set([...etis.map(t => t.nombre), ...sel])];
    const prop = todas.filter(t => p && t.startsWith(p)), otras = todas.filter(t => !(p && t.startsWith(p)));
    const chip = t => `<button type="button" class="per-eti-t${sel.has(t) ? ' on' : ''}" data-t="${esc(t)}">#${esc(t)}</button>`;
    $('#pm-etis', f0).innerHTML = `${prop.map(chip).join('')}${prop.length && otras.length ? '<span class="per-eti-sep"></span>' : ''}${otras.map(chip).join('')}`;
    f0.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { const t = b.dataset.t; sel.has(t) ? sel.delete(t) : sel.add(t); b.classList.toggle('on'); }); };
  pintarEtis();
  f.tipo.onchange = () => { f.categoria_id.innerHTML = opsCat(f.tipo.value); pintarEtis(); };
  f.categoria_id.onchange = pintarEtis;
  f.valor.oninput = () => { const neg = f.valor.value.trim().startsWith('-'); const n = f.valor.value.replace(/\D/g, ''); f.valor.value = n ? (neg ? '-' : '') + Number(n).toLocaleString('es-CO').replace(/,/g, '.') : (neg ? '-' : ''); };
  $('#pm-cancelar', f0).onclick = () => f0.remove();
  const b = $('#pm-borrar', f0); if (b) b.onclick = async () => { if (b.dataset.seguro !== '1') { b.dataset.seguro = '1'; b.textContent = '¿Borrar? Toca otra vez'; return; } await D.perBorrar(m.id); f0.remove(); recargar(); };
  f.onsubmit = async ev => {
    ev.preventDefault();
    const v = Object.fromEntries(new FormData(f));
    const n = Number(v.valor.replace(/\D/g, '')) * (v.valor.trim().startsWith('-') ? -1 : 1);
    if (!n) { $('#pm-aviso', f0).textContent = 'Escribe el valor.'; return; }
    const reg = { tipo: v.tipo, valor: n, fecha: v.fecha, hora: v.hora || null, categoria_id: v.categoria_id || null, descripcion: v.descripcion.trim() || null, medio: v.medio.trim() || null, etiquetas: [...sel], ...(f.proyecto_id ? { proyecto_id: v.proyecto_id || null } : {}), ...(m.fijo_id ? { fijo_id: m.fijo_id } : {}) };
    if (m.id) reg.id = m.id;
    try { await D.perGuardar(reg); f0.remove(); recargar(); } catch (err) { $('#pm-aviso', f0).textContent = err.message; }
  };
}

// ── Engranaje: alertas, categorías y etiquetas ──
function ajustes(cats, etis, movs, mesTxt, recargar) {
  const f = document.createElement('div'); f.className = 'modal-fondo';
  f.innerHTML = `<div class="modal modal-opciones" role="dialog" aria-label="Ajustes de finanzas personales"><div class="aj-cab"><div><h2>Ajustes</h2><p class="sub">${esc(mesTxt)}</p></div>${btnIco('x', 'Cerrar', 'data-cerrar')}</div>
    <div class="aj-rapidos">
      <button type="button" class="aj-rap" data-op="alertas"><span>${ico('enviar')}</span><b>Alertas al correo</b><small>Avisos de presupuesto, pagos fijos y proyectos</small></button>
      <button type="button" class="aj-rap" data-op="cats"><span>${ico('editar')}</span><b>Categorías</b><small>Nombre, tipo y emoji</small></button>
      <button type="button" class="aj-rap" data-op="etis"><span>${ico('editar')}</span><b>Etiquetas</b><small>Crear o quitar etiquetas</small></button>
    </div></div>`;
  const cerrar = () => { f.remove(); removeEventListener('hashchange', cerrar); };
  addEventListener('hashchange', cerrar);
  f.onclick = ev => { if (ev.target === f || ev.target.closest('[data-cerrar]')) return cerrar();
    const op = ev.target.closest('[data-op]')?.dataset.op; if (!op) return; cerrar();
    if (op === 'alertas') modalAlertas(recargar);
    if (op === 'cats') modalCategorias(recargar);
    if (op === 'etis') modalEtiquetas(movs, recargar);
  };
  document.body.appendChild(f);
}
async function modalCategorias(recargar) {
  const f = document.createElement('div'); f.className = 'modal-fondo';
  const pintar = async () => {
    const cats = await D.perCategorias();
    const tipoSel = t => `<select name="tipo" aria-label="Tipo">${Object.entries(TIPOS).map(([k, v]) => `<option value="${k}" ${k === t ? 'selected' : ''}>${v}</option>`).join('')}</select>`;
    f.innerHTML = `<div class="modal ancho modal-cats"><h2>Categorías</h2><p class="sub">El tipo decide cómo cuenta: el ahorro no suma a los gastos. Desactiva las que no uses; sus movimientos se conservan.</p>
      ${cats.map(c => `<form class="cat-fila per-cat${c.activa !== false ? '' : ' inactiva'}" data-id="${c.id}"><input name="emoji" class="per-emo-in" value="${esc(c.emoji || '')}" aria-label="Emoji"><input name="nombre" value="${esc(c.nombre)}" required aria-label="Nombre">${tipoSel(c.tipo)}<label class="lv-check"><input type="checkbox" name="activa" ${c.activa !== false ? 'checked' : ''}> Activa</label><button class="btn mini sec">Guardar</button></form>`).join('')}
      <h3>Nueva categoría</h3>
      <form class="cat-fila per-cat nueva" id="pc-nueva"><input name="emoji" class="per-emo-in" placeholder="🙂" aria-label="Emoji"><input name="nombre" placeholder="Nombre" required>${tipoSel('gasto')}<span></span><button class="btn mini"><span class="mas">+</span> Agregar</button></form>
      <div class="aviso" id="pc-av"></div><div class="pie-modal"><button type="button" class="btn" id="pc-listo">Listo</button></div></div>`;
    const av = t => { $('#pc-av', f).textContent = t; };
    f.querySelectorAll('form[data-id]').forEach(x => x.onsubmit = async ev => { ev.preventDefault();
      try { await D.perActualizarCategoria(x.dataset.id, { nombre: x.nombre.value.trim(), emoji: x.emoji.value.trim() || null, tipo: x.tipo.value, activa: x.activa.checked }); av('Guardado.'); pintar(); } catch (err) { av(err.message); } });
    $('#pc-nueva', f).onsubmit = async ev => { ev.preventDefault(); const x = ev.target;
      try { await D.perCrearCategoria({ nombre: x.nombre.value.trim(), emoji: x.emoji.value.trim() || null, tipo: x.tipo.value, orden: Math.max(0, ...cats.map(c => c.orden || 0)) + 1 }); pintar(); } catch (err) { av(err.message); } };
    $('#pc-listo', f).onclick = () => { f.remove(); recargar(); };
  };
  f.onclick = ev => { if (ev.target === f) { f.remove(); recargar(); } };
  document.body.appendChild(f); await pintar();
}
async function modalEtiquetas(movs, recargar) {
  const f = document.createElement('div'); f.className = 'modal-fondo';
  const pintar = async () => {
    const etis = await D.perEtiquetas();
    const uso = t => movs.filter(x => (x.etiquetas || []).includes(t)).length;
    f.innerHTML = `<div class="modal ancho"><h2>Etiquetas</h2><p class="sub">Un movimiento puede tener varias. Quitar una etiqueta no la borra de los movimientos que ya la tienen.</p>
      <form class="per-eti-nueva" id="pe-n"><input name="n" placeholder="#nueva_etiqueta" required><button class="btn mini"><span class="mas">+</span> Crear</button></form>
      <div class="per-etis-lista">${etis.map(t => `<span class="per-eti-t">#${esc(t.nombre)} <small>${uso(t.nombre)}</small><button type="button" data-quitar="${t.id}" aria-label="Quitar ${esc(t.nombre)}">×</button></span>`).join('')}</div>
      <div class="aviso" id="pe-av"></div><div class="pie-modal"><button type="button" class="btn" id="pe-listo">Listo</button></div></div>`;
    $('#pe-n', f).onsubmit = async ev => { ev.preventDefault(); const n = ev.target.n.value.trim().replace(/^#/, '').replace(/\s+/g, '_'); if (!n) return;
      try { await D.perCrearEtiqueta(n); pintar(); } catch (err) { $('#pe-av', f).textContent = err.message; } };
    f.querySelectorAll('[data-quitar]').forEach(b => b.onclick = async () => { await D.perBorrarEtiqueta(b.dataset.quitar); pintar(); });
    $('#pe-listo', f).onclick = () => { f.remove(); recargar(); };
  };
  f.onclick = ev => { if (ev.target === f) { f.remove(); recargar(); } };
  document.body.appendChild(f); await pintar();
}


// ── Presupuesto: esperado contra real por categoría (como el Gantt), pagos fijos y proyección del año y del lustro ──
function vistaPres({ movs, cats, fijos, pres, aj, notas, a, m, mes, modoAnio, suma, espDe }) {
  const activas = cats.filter(c => c.activa !== false);
  const delM = k => movs.filter(x => mesDe(x.fecha) === k);
  const realCat = (cid, k) => delM(k).filter(x => x.categoria_id === cid).reduce((s, x) => s + Number(x.valor), 0);
  const base = cid => pres.find(p => p.categoria_id === cid && !p.mes);
  const ajuste = cid => pres.find(p => p.categoria_id === cid && p.mes === mes);
  const espT = (t, k) => activas.filter(c => c.tipo === t).reduce((s, c) => s + espDe(c.id, k), 0);
  const ing = suma(delM(mes), 'ingreso'), gas = suma(delM(mes), 'gasto'), aho = suma(delM(mes), 'ahorro');
  const dz = delM(mes).filter(esDiezmo).reduce((s, x) => s + Number(x.valor), 0);
  const fila = (t, e, r, bueno) => { const mx = Math.max(e, r, 1), pasa = bueno === 'menos' ? r > e && e : r < e;
    return `<div class="pp-res"><span class="pp-t">${t}</span><span class="pp-barras"><i class="pp-esp" style="width:${e / mx * 100}%"></i><i class="pp-real ${pasa ? 'mal' : 'bien'}" style="width:${r / mx * 100}%"></i></span><span class="pp-v"><b>${cop(r)}</b><span class="sub">de ${cop(e)}</span></span></div>`; };
  const resumen = `<section class="panel"><div class="od-cab"><h3>Esperado contra real</h3></div>
    ${fila('Ingresos', espT('ingreso', mes), ing, 'mas')}${fila('Gastos', espT('gasto', mes), gas, 'menos')}${fila('Ahorro', espT('ahorro', mes), aho, 'mas')}${fila('Diezmo (10 % de lo que entró)', Math.round(ing * 0.1), dz, 'mas')}
    <p class="sub mon-ley"><span class="ley-esp"></span>Esperado &nbsp; <span class="ley-real"></span>Real</p></section>`;
  const sinBase = activas.filter(c => !base(c.id));
  const editaMes = ESTADO.presModo === 'mes';
  const grupo = (t, titulo) => { const l = activas.filter(c => c.tipo === t); if (!l.length) return '';
    return `<tr class="pp-grupo"><td colspan="6">${titulo}</td></tr>${l.map(c => { const e = espDe(c.id, mes), r = realCat(c.id, mes), d = t === 'gasto' ? e - r : r - e, pc = e ? Math.round(r / e * 100) : null, mx = Math.max(e, r, 1);
      const val = editaMes ? (ajuste(c.id)?.valor ?? '') : (base(c.id)?.valor ?? '');
      return `<tr class="${t === 'gasto' && e && r > e ? 'pp-pasa' : ''}"><td>${emoji(c)} ${esc(c.nombre)}${editaMes && ajuste(c.id) ? ' <span class="sub">(solo este mes)</span>' : ''}</td>
        <td class="num"><input class="cant pp-in" data-pres="${c.id}" inputmode="numeric" value="${miles(Number(val))}" placeholder="${editaMes ? miles(Number(base(c.id)?.valor || 0)) || '0' : '0'}" aria-label="Esperado de ${esc(c.nombre)}"></td>
        <td class="num">${cop(r)}</td><td class="num ${d < 0 ? 'xxx' : ''}">${e ? (d < 0 ? '−' : '+') + cop(Math.abs(d)).replace(' COP', '') : '—'}</td><td class="num col-opc">${pc == null ? '—' : pc + ' %'}</td>
        <td class="col-opc pp-gantt"><span class="pp-barras"><i class="pp-esp" style="width:${e / mx * 100}%"></i><i class="pp-real ${t === 'gasto' ? (e && r > e ? 'mal' : 'bien') : (r >= e ? 'bien' : 'mal')}" style="width:${r / mx * 100}%"></i></span></td></tr>`; }).join('')}`; };
  const tabla = `<section class="panel"><div class="od-cab"><h3>Por categoría</h3><span class="graf-vistas" role="group" aria-label="Qué editas"><button type="button" class="chip-f${editaMes ? '' : ' on'}" data-pmodo="base">Plan base</button><button type="button" class="chip-f${editaMes ? ' on' : ''}" data-pmodo="mes">Solo ${MESES[m - 1]}</button></span></div>
    <p class="sub">${editaMes ? `Lo que escribas aquí cambia solo ${MESES[m - 1]} de ${a}. Vacío = usa el plan base.` : 'El plan base se repite todos los meses. Para un mes distinto (diciembre, un viaje), cambia a «Solo este mes».'}</p>
    ${sinBase.length && !editaMes ? `<div class="aviso-ej">${sinBase.length} categoría${sinBase.length > 1 ? 's' : ''} sin plan. <button type="button" class="btn sec mini" id="pp-sugerir">Proponer con el promedio real de los últimos 3 meses</button></div>` : ''}
    <div class="tabla-cont"><table class="t-compacta pp-tabla"><thead><tr><th>Categoría</th><th class="num">Esperado</th><th class="num">Real</th><th class="num">Diferencia</th><th class="num col-opc">%</th><th class="col-opc">Esperado / real</th></tr></thead><tbody>
    ${grupo('ingreso', 'Ingresos')}${grupo('gasto', 'Gastos')}${grupo('ahorro', 'Ahorro')}</tbody></table></div><span class="sub" id="pp-guarda" aria-live="polite"></span></section>`;
  // Pagos fijos del mes
  const hoyD = Number(iso(new Date()).slice(8, 10)), esMesHoy = mes === iso(new Date()).slice(0, 7);
  const pagado = f => delM(mes).find(x => x.fijo_id === f.id || (f.categoria_id && x.categoria_id === f.categoria_id && (!f.etiqueta || (x.etiquetas || []).includes(f.etiqueta)) && String(x.descripcion || '').toLowerCase().includes(String(f.nombre).toLowerCase())));
  const fijosHtml = `<section class="panel"><div class="od-cab"><h3>Pagos fijos de ${MESES[m - 1]}</h3><span class="sub">${fijos.filter(f => f.activo && pagado(f)).length} de ${fijos.filter(f => f.activo).length} pagados</span></div>
    ${fijos.length ? `<div class="lista-filas">${fijos.map(f => { const p = pagado(f), c = cats.find(k => k.id === f.categoria_id), falta = f.dia - hoyD;
      const est = p ? `<span class="etiqueta despego">Pagado ${fecha(p.fecha).slice(0, 5)}</span>` : !esMesHoy ? '<span class="etiqueta">Sin registrar</span>' : falta < 0 ? `<span class="etiqueta xxx">Venció el ${f.dia}</span>` : `<span class="etiqueta">Vence ${falta === 0 ? 'hoy' : `en ${falta} día${falta > 1 ? 's' : ''}`}</span>`;
      return `<div class="per-fijo${f.activo ? '' : ' inactivo'}"><span class="mov-ico per">${emoji(c)}</span><span class="mov-txt"><b>${esc(f.nombre)}</b><span class="sub">Día ${f.dia} · ${esc(c?.nombre || 'Sin categoría')}${f.etiqueta ? ' · #' + esc(f.etiqueta) : ''}</span></span>
        <span class="mov-der"><span class="mov-val gasto">${cop(f.valor)}</span>${est}</span>
        <span class="per-acl-acc">${!p && f.activo ? `<button type="button" class="btn mini" data-pagar="${f.id}">Registrar pago</button>` : ''}<button type="button" class="btn sec mini" data-fijo-ed="${f.id}">Editar</button></span></div>`; }).join('')}</div>` : '<p class="sub">Agrega tus pagos fijos (arriendo, servicios, suscripciones, cuotas) para ver cada mes cuáles faltan y recibir el aviso antes de que venzan.</p>'}
    <button type="button" class="btn sec mini" id="fijo-nuevo"><span class="mas">+</span> Pago fijo</button></section>`;
  // Proyección del año: lo real de los meses que pasaron y lo esperado de los que faltan
  const hoyMes = iso(new Date()).slice(0, 7);
  const proyAnio = (y, t) => Array.from({ length: 12 }, (_, i) => { const k = mkMes(y, i + 1); const r = suma(delM(k), t), e = espT(t, k);
    return k < hoyMes ? r : k === hoyMes ? Math.max(r, e) : e; }).reduce((s, v) => s + v, 0);
  const planAnio = (y, t) => Array.from({ length: 12 }, (_, i) => espT(t, mkMes(y, i + 1))).reduce((s, v) => s + v, 0);
  const tAnio = ['ingreso', 'gasto', 'ahorro'].map(t => ({ t, plan: planAnio(a, t), proy: proyAnio(a, t) }));
  const dispP = tAnio[0].proy - tAnio[1].proy - tAnio[2].proy, dispPl = tAnio[0].plan - tAnio[1].plan - tAnio[2].plan;
  const anual = `<section class="panel"><h3>Proyección ${a}</h3><p class="sub">Meses pasados con lo real; los que faltan, con lo esperado.</p>
    <div class="tabla-cont"><table class="t-compacta"><thead><tr><th></th><th class="num">Plan del año</th><th class="num">Cierre proyectado</th></tr></thead><tbody>
    ${tAnio.map(x => `<tr><td>${TIPOS[x.t]}s</td><td class="num">${cop(x.plan)}</td><td class="num ${x.t}">${cop(x.proy)}</td></tr>`).join('').replace('Ahorros', 'Ahorro')}
    <tr class="total"><td>Disponible</td><td class="num ${dispPl < 0 ? 'xxx' : ''}">${dispPl < 0 ? '−' : ''}${cop(Math.abs(dispPl))}</td><td class="num ${dispP < 0 ? 'xxx' : ''}">${dispP < 0 ? '−' : ''}${cop(Math.abs(dispP))}</td></tr></tbody></table></div></section>`;
  // Lustro: 5 años con el plan base y con la tendencia de los últimos 6 meses
  const baseMes = t => activas.filter(c => c.tipo === t).reduce((s, c) => s + Number(base(c.id)?.valor || 0), 0);
  const ult6 = Array.from({ length: 6 }, (_, i) => { const d = new Date(a, m - 1 - i - 1, 1); return mkMes(d.getFullYear(), d.getMonth() + 1); });
  const tend = t => ult6.reduce((s, k) => s + suma(delM(k), t), 0) / 6;
  let acu = 0, acuT = 0;
  const lustro = Array.from({ length: 5 }, (_, i) => { const y = a + i, fI = (1 + ESTADO.crecIng / 100) ** i, fG = (1 + ESTADO.crecGas / 100) ** i;
    const ingY = i === 0 ? tAnio[0].proy : baseMes('ingreso') * 12 * fI, gasY = i === 0 ? tAnio[1].proy : baseMes('gasto') * 12 * fG, ahoY = i === 0 ? tAnio[2].proy : baseMes('ahorro') * 12 * fI;
    acu += ahoY; acuT += tend('ahorro') * 12;
    return { y, ingY, gasY, ahoY, d: ingY - gasY - ahoY, acu, acuT }; });
  const lus = `<section class="panel"><div class="od-cab"><h3>Lustro ${a}–${a + 4}</h3></div>
    <p class="sub">${a} con el cierre proyectado; desde ${a + 1}, el plan base × 12. Ajusta cuánto crecen al año tus ingresos y tus gastos.</p>
    <div class="pp-crec"><label class="per-sel"><span>Ingresos crecen al año</span><input id="pp-ci" inputmode="decimal" value="${ESTADO.crecIng}"> %</label><label class="per-sel"><span>Gastos crecen al año</span><input id="pp-cg" inputmode="decimal" value="${ESTADO.crecGas}"> %</label></div>
    <div class="tabla-cont"><table class="t-compacta"><thead><tr><th>Año</th><th class="num">Ingresos</th><th class="num">Gastos</th><th class="num">Ahorro</th><th class="num">Disponible</th><th class="num">Ahorro acumulado</th><th class="num col-opc">Acumulado según tendencia</th></tr></thead><tbody>
    ${lustro.map(x => `<tr><td>${x.y}</td><td class="num ingreso">${nc(x.ingY)}</td><td class="num gasto">${nc(x.gasY)}</td><td class="num ahorro">${nc(x.ahoY)}</td><td class="num ${x.d < 0 ? 'xxx' : ''}">${nc(x.d)}</td><td class="num"><b>${nc(x.acu)}</b></td><td class="num col-opc">${nc(x.acuT)}</td></tr>`).join('')}
    </tbody></table></div>${!baseMes('ingreso') && !baseMes('gasto') ? '<p class="sub">Llena el plan base para que el lustro tenga números.</p>' : ''}</section>`;
  const umb = (aj?.umbrales?.length ? aj.umbrales : [80, 100]).slice().sort((x, y) => x - y);
  const periodo = `<div class="pp-periodo"><div class="pp-mesnav"><button type="button" class="btn sec mini ico" data-pmes="-1" aria-label="Anterior" title="Anterior">${FLECHA}</button><b>${ESTADO.presVista === 'anio' ? a : `${MESES[m - 1]} ${a}`}</b><button type="button" class="btn sec mini ico pp-sig" data-pmes="1" aria-label="Siguiente" title="Siguiente">${FLECHA}</button></div>
    <span class="graf-vistas" role="group" aria-label="Vista"><button type="button" class="chip-f${ESTADO.presVista === 'mes' ? ' on' : ''}" data-pvista="mes">Mensual</button><button type="button" class="chip-f${ESTADO.presVista === 'anio' ? ' on' : ''}" data-pvista="anio">Anual</button></span>
    <button type="button" class="pp-umb" id="pp-umb" title="Cambiar cuándo te aviso">${aj?.alertas === false ? 'Alertas apagadas' : `Aviso al correo al ${umb.map(u => u + ' %').join(', ').replace(/, ([^,]*)$/, ' y $1')}`} · cambiar</button></div>`;
  if (ESTADO.presVista === 'anio') {
    // Anual: cada categoría mes a mes (como un Gantt de colores) y la proyección
    const hoyK = iso(new Date()).slice(0, 7);
    const espA = t => Array.from({ length: 12 }, (_, i) => espT(t, mkMes(a, i + 1))).reduce((x, v) => x + v, 0);
    const realA = t => movs.filter(x => x.tipo === t && (x.fecha || '').startsWith(String(a))).reduce((x, v) => x + Number(v.valor), 0);
    const ingA = realA('ingreso'), dzA = movs.filter(x => (x.fecha || '').startsWith(String(a)) && esDiezmo(x)).reduce((x, v) => x + Number(v.valor), 0);
    const resA = `<section class="panel"><div class="od-cab"><h3>Esperado contra real · ${a}</h3></div>
      ${fila('Ingresos', espA('ingreso'), ingA, 'mas')}${fila('Gastos', espA('gasto'), realA('gasto'), 'menos')}${fila('Ahorro', espA('ahorro'), realA('ahorro'), 'mas')}${fila('Diezmo (10 % de lo que entró)', Math.round(ingA * 0.1), dzA, 'mas')}
      <p class="sub mon-ley"><span class="ley-esp"></span>Esperado del año &nbsp; <span class="ley-real"></span>Real a la fecha</p></section>`;
    const celda = (c, k) => { const e = espDe(c.id, k), r = realCat(c.id, k); const fut = k > hoyK;
      const cls = fut ? 'fut' : !e ? (r ? 'sin' : 'vacia') : c.tipo === 'gasto' ? (r > e ? 'mal' : r >= e * 0.8 ? 'cerca' : 'bien') : (r >= e ? 'bien' : 'cerca');
      return `<td class="pp-c ${cls}" data-ir-k="${k}" title="${esc(c.nombre)} · ${MESES[Number(k.slice(5)) - 1]}: ${cop(r)} de ${cop(e)}">${fut ? (e ? compacto(e) : '') : r ? compacto(r) : (e ? '0' : '')}</td>`; };
    const grupoA = (t, titulo) => { const l = activas.filter(c => c.tipo === t); if (!l.length) return '';
      return `<tr class="pp-grupo"><td colspan="14">${titulo}</td></tr>${l.map(c => { const eA = Array.from({ length: 12 }, (_, i) => espDe(c.id, mkMes(a, i + 1))).reduce((x, v) => x + v, 0);
        const rA = movs.filter(x => x.categoria_id === c.id && (x.fecha || '').startsWith(String(a))).reduce((x, v) => x + Number(v.valor), 0);
        return `<tr><td class="pp-cn">${emoji(c)} ${esc(c.nombre)}</td>${Array.from({ length: 12 }, (_, i) => celda(c, mkMes(a, i + 1))).join('')}<td class="num pp-tot ${t === 'gasto' && eA && rA > eA ? 'xxx' : ''}">${compacto(rA)}<span class="sub">de ${compacto(eA)}</span></td></tr>`; }).join('')}`; };
    const mapa = `<section class="panel"><h3>Mes a mes</h3><p class="sub">Cada casilla es lo real del mes. <span class="pp-ley bien"></span>dentro de lo esperado &nbsp;<span class="pp-ley cerca"></span>cerca del tope &nbsp;<span class="pp-ley mal"></span>se pasó &nbsp;<span class="pp-ley fut"></span>lo esperado de los meses que vienen. Toca una casilla para ver ese mes.</p>
      <div class="tabla-cont"><table class="t-compacta pp-mapa"><thead><tr><th>Categoría</th>${MESES.map(n => `<th class="num">${n.slice(0, 3)}</th>`).join('')}<th class="num">Año</th></tr></thead><tbody>${grupoA('ingreso', 'Ingresos')}${grupoA('gasto', 'Gastos')}${grupoA('ahorro', 'Ahorro')}</tbody></table></div></section>`;
    return periodo + resA + mapa + anual + lus + notasHtml(notas);
  }
  return periodo + resumen + tabla + fijosHtml + notasHtml(notas);
}
const nc = v => (v < 0 ? '−' : '') + cop(Math.abs(v)).replace(' COP', '');
const FLECHA = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 6l-6 6 6 6"/></svg>';
// Notas libres del presupuesto: textos sueltos, sin pago ni categoría
function notasHtml(notas) {
  if (notas == null) return '';
  const cuando = n => new Date(n.actualizado || n.creado).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
  return `<section class="panel pp-notas"><div class="od-cab"><h3>Notas</h3><span class="sub">${notas.length || ''}</span></div>
    <form id="nota-nueva" class="pp-nota-nueva"><textarea name="texto" rows="2" placeholder="Escribe una nota del presupuesto: una idea, un recordatorio, una decisión…" required></textarea><button class="btn mini"><span class="mas">+</span> Agregar</button></form>
    ${notas.map(n => `<div class="pp-nota" data-nota="${n.id}"><p>${esc(n.texto).replace(/\n/g, '<br>')}</p><span class="sub">${cuando(n)}</span><span class="per-acl-acc"><button type="button" class="btn sec mini" data-nota-ed>Editar</button><button type="button" class="btn sec mini" data-nota-borrar>Borrar</button></span></div>`).join('')}</section>`;
}
function montarPres({ movs, cats, etis, proys, fijos, mes }, recargar) {
  const quieto = async fn => { const y = scrollY; await fn(); await recargar(); requestAnimationFrame(() => scrollTo(0, y)); };
  document.querySelectorAll('[data-pvista]').forEach(b => b.onclick = () => quieto(async () => { ESTADO.presVista = b.dataset.pvista; }));
  document.querySelectorAll('[data-pmes]').forEach(b => b.onclick = () => { const [y, mm] = mes.split('-').map(Number); const d = ESTADO.presVista === 'anio' ? new Date(y + Number(b.dataset.pmes), mm - 1, 1) : new Date(y, mm - 1 + Number(b.dataset.pmes), 1); location.hash = `#/personal/${mkMes(d.getFullYear(), d.getMonth() + 1)}`; });
  document.querySelectorAll('[data-ir-k]').forEach(td => td.onclick = () => { ESTADO.presVista = 'mes'; location.hash = `#/personal/${td.dataset.irK}`; });
  const pu = $('#pp-umb'); if (pu) pu.onclick = () => modalAlertas(recargar);
  const nn = $('#nota-nueva'); if (nn) nn.onsubmit = ev => { ev.preventDefault(); const t = nn.texto.value.trim(); if (t) quieto(() => D.perGuardarNota({ texto: t })); };
  document.querySelectorAll('[data-nota]').forEach(d => {
    d.querySelector('[data-nota-borrar]').onclick = ev => { const b = ev.target; if (b.dataset.seguro !== '1') { b.dataset.seguro = '1'; b.textContent = '¿Borrar?'; return; } quieto(() => D.perBorrarNota(d.dataset.nota)); };
    d.querySelector('[data-nota-ed]').onclick = () => { const p = d.querySelector('p'); const txt = p.innerText;
      p.outerHTML = `<form class="pp-nota-nueva"><textarea name="texto" rows="3">${esc(txt)}</textarea><button class="btn mini">Guardar</button></form>`;
      const f = d.querySelector('form'); f.texto.focus(); f.onsubmit = ev => { ev.preventDefault(); const t = f.texto.value.trim(); if (t) quieto(() => D.perGuardarNota({ id: d.dataset.nota, texto: t })); }; };
  });
  document.querySelectorAll('[data-pmodo]').forEach(b => b.onclick = () => quieto(async () => { ESTADO.presModo = b.dataset.pmodo; }));
  document.querySelectorAll('[data-pres]').forEach(inp => {
    inp.oninput = () => { const n = inp.value.replace(/\D/g, ''); inp.value = n ? Number(n).toLocaleString('es-CO').replace(/,/g, '.') : ''; };
    inp.onchange = () => quieto(async () => { $('#pp-guarda').textContent = 'Guardando…'; await D.perPonerPresupuesto(inp.dataset.pres, ESTADO.presModo === 'mes' ? mes : null, inp.value === '' ? null : num(inp.value)); });
  });
  const sg = $('#pp-sugerir'); if (sg) sg.onclick = () => quieto(async () => {
    sg.disabled = true; sg.textContent = 'Calculando…';
    const [y, mm] = mes.split('-').map(Number);
    const meses = [1, 2, 3].map(i => { const d = new Date(y, mm - 1 - i, 1); return mkMes(d.getFullYear(), d.getMonth() + 1); });
    const presAct = await D.perPresupuesto();
    for (const c of cats.filter(c => c.activa !== false && !presAct.some(p => p.categoria_id === c.id && !p.mes))) {
      const prom = meses.reduce((s, k) => s + movs.filter(x => x.categoria_id === c.id && mesDe(x.fecha) === k).reduce((t, x) => t + Number(x.valor), 0), 0) / 3;
      await D.perPonerPresupuesto(c.id, null, Math.round(prom / 1000) * 1000);
    }
  });
  const ci = $('#pp-ci'), cg = $('#pp-cg');
  if (ci) ci.onchange = () => quieto(async () => { ESTADO.crecIng = Number(String(ci.value).replace(',', '.')) || 0; });
  if (cg) cg.onchange = () => quieto(async () => { ESTADO.crecGas = Number(String(cg.value).replace(',', '.')) || 0; });
  document.querySelectorAll('[data-pagar]').forEach(b => b.onclick = () => { const f = fijos.find(x => x.id === b.dataset.pagar), c = cats.find(k => k.id === f.categoria_id);
    modalMov({ tipo: c?.tipo || 'gasto', valor: f.valor, fecha: iso(new Date()), categoria_id: f.categoria_id, descripcion: f.nombre, etiquetas: f.etiqueta ? [f.etiqueta] : [], fijo_id: f.id }, cats, etis, recargar, proys); });
  const fn = $('#fijo-nuevo'); if (fn) fn.onclick = () => modalFijo({ dia: 1, activo: true }, cats, recargar);
  document.querySelectorAll('[data-fijo-ed]').forEach(b => b.onclick = () => modalFijo(fijos.find(x => x.id === b.dataset.fijoEd), cats, recargar));
}
async function modalFijo(fj, cats, recargar) {
  const etis = await D.perEtiquetas();
  const f0 = document.createElement('div'); f0.className = 'modal-fondo';
  f0.innerHTML = `<form class="modal" id="pf"><h2>${fj.id ? 'Editar' : 'Nuevo'} pago fijo</h2><div class="grilla-form">
    <div class="ancho"><label>Nombre</label><input name="nombre" required value="${esc(fj.nombre || '')}" placeholder="ETB internet"></div>
    <div><label>Valor (COP)</label><input name="valor" inputmode="numeric" value="${miles(Number(fj.valor || 0))}"></div>
    <div><label>Día de pago</label><input name="dia" type="number" min="1" max="31" value="${fj.dia || 1}"></div>
    <div><label>Categoría</label><select name="categoria_id">${cats.filter(c => c.activa !== false).map(c => `<option value="${c.id}" ${c.id === fj.categoria_id ? 'selected' : ''}>${esc(c.emoji || '')} ${esc(c.nombre)}</option>`).join('')}</select></div>
    <div><label>Etiqueta</label><select name="etiqueta"><option value="">Ninguna</option>${etis.map(t => `<option value="${esc(t.nombre)}" ${t.nombre === fj.etiqueta ? 'selected' : ''}>#${esc(t.nombre)}</option>`).join('')}</select></div>
    <div class="ancho"><label class="lv-check"><input type="checkbox" name="activo" ${fj.activo !== false ? 'checked' : ''}> Activo</label></div></div>
    <div class="aviso" id="pf-av"></div>
    <div class="pie-modal">${fj.id ? '<button type="button" class="btn sec" id="pf-borrar" style="margin-right:auto">Borrar</button>' : ''}<button type="button" class="btn sec" id="pf-c">Cancelar</button><button class="btn">Guardar</button></div></form>`;
  document.body.appendChild(f0);
  const f = $('#pf', f0);
  f.valor.oninput = () => { const n = f.valor.value.replace(/\D/g, ''); f.valor.value = n ? Number(n).toLocaleString('es-CO').replace(/,/g, '.') : ''; };
  $('#pf-c', f0).onclick = () => f0.remove();
  const b = $('#pf-borrar', f0); if (b) b.onclick = async () => { if (b.dataset.seguro !== '1') { b.dataset.seguro = '1'; b.textContent = '¿Borrar? Toca otra vez'; return; } await D.perBorrarFijo(fj.id); f0.remove(); recargar(); };
  f.onsubmit = async ev => { ev.preventDefault();
    const r = { nombre: f.nombre.value.trim(), valor: num(f.valor.value), dia: Math.min(31, Math.max(1, Number(f.dia.value) || 1)), categoria_id: f.categoria_id.value || null, etiqueta: f.etiqueta.value || null, activo: f.activo.checked };
    if (fj.id) r.id = fj.id;
    try { await D.perGuardarFijo(r); f0.remove(); recargar(); } catch (err) { $('#pf-av', f0).textContent = err.message; } };
}

// ── Proyecciones presupuestales: presupuestos de proyectos personales armados con las categorías ──
function vistaProy({ movs, cats, proys, items }) {
  const hoy = iso(new Date());
  const ESTP = { plan: 'En plan', activo: 'Activo', cerrado: 'Cerrado' };
  const tarjeta = p => {
    const its = items.filter(i => i.proyecto_id === p.id), total = its.reduce((s, i) => s + Number(i.valor), 0);
    const ml = movs.filter(x => x.proyecto_id === p.id), apartado = ml.filter(x => x.tipo === 'ahorro').reduce((s, x) => s + Number(x.valor), 0), gastado = ml.filter(x => x.tipo === 'gasto').reduce((s, x) => s + Number(x.valor), 0);
    const falta = Math.max(0, total - apartado - gastado);
    const meses = p.fecha_meta ? Math.max(1, Math.ceil((new Date(p.fecha_meta) - new Date(hoy)) / (30.44 * 864e5))) : null;
    const abierto = ESTADO.abierto === p.id;
    const porCat = {}; its.forEach(i => { const c = cats.find(k => k.id === i.categoria_id); const n = c?.nombre || 'Sin categoría'; porCat[n] = (porCat[n] || 0) + Number(i.valor); });
    const gasCat = n => ml.filter(x => x.tipo === 'gasto' && (cats.find(k => k.id === x.categoria_id)?.nombre || 'Sin categoría') === n).reduce((s, x) => s + Number(x.valor), 0);
    return `<section class="panel pp-proy${abierto ? ' abierto' : ''}${p.estado === 'cerrado' ? ' cerrado' : ''}">
      <button type="button" class="pp-proy-cab" data-abrir-p="${p.id}"><span><b>${esc(p.nombre)}</b><span class="sub">${ESTP[p.estado]}${p.fecha_meta ? ' · meta ' + fecha(p.fecha_meta) : ''}${meses && p.estado !== 'cerrado' ? ` · ${meses} mes${meses > 1 ? 'es' : ''}` : ''}</span></span>
        <span class="pp-proy-num"><b>${cop(total)}</b><span class="sub">${total ? Math.round((apartado + gastado) / total * 100) : 0} % cubierto</span></span></button>
      <span class="pp-barras"><i class="pp-esp" style="width:100%"></i><i class="pp-real bien" style="width:${total ? Math.min(100, (apartado + gastado) / total * 100) : 0}%"></i></span>
      <div class="pp-proy-kpi"><span>Apartado <b>${cop(apartado)}</b></span><span>Gastado <b>${cop(gastado)}</b></span><span>Falta <b>${cop(falta)}</b></span>${meses && falta && p.estado !== 'cerrado' ? `<span>Ahorro mensual necesario <b>${cop(Math.ceil(falta / meses / 1000) * 1000)}</b></span>` : ''}</div>
      ${abierto ? `<div class="pp-proy-det">
        <div class="grilla-form pp-proy-datos" data-pdatos="${p.id}">
          <div class="ancho"><label>Nombre</label><input name="nombre" value="${esc(p.nombre)}"></div>
          <div><label>Fecha meta</label><input name="fecha_meta" type="date" value="${p.fecha_meta || ''}"></div>
          <div><label>Estado</label><select name="estado">${Object.entries(ESTP).map(([k, v]) => `<option value="${k}" ${k === p.estado ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
          <div class="ancho"><label>Descripción</label><input name="descripcion" value="${esc(p.descripcion || '')}" placeholder="Para qué es y qué incluye"></div></div>
        <div class="tabla-cont"><table class="t-compacta pp-items"><thead><tr><th>Categoría</th><th>Concepto</th><th class="num">Valor</th><th></th></tr></thead><tbody>
          ${its.map(i => `<tr data-item="${i.id}"><td><select name="categoria_id">${cats.filter(c => c.tipo === 'gasto').map(c => `<option value="${c.id}" ${c.id === i.categoria_id ? 'selected' : ''}>${esc(c.emoji || '')} ${esc(c.nombre)}</option>`).join('')}</select></td><td><input name="concepto" value="${esc(i.concepto)}"></td><td class="num"><input class="cant" name="valor" inputmode="numeric" value="${miles(Number(i.valor))}"></td><td><button type="button" class="g-borrar" data-borrar-item="${i.id}" aria-label="Quitar">×</button></td></tr>`).join('')}
          <tr class="pp-nuevo" data-nuevo-item="${p.id}"><td><select name="categoria_id">${cats.filter(c => c.tipo === 'gasto').map(c => `<option value="${c.id}">${esc(c.emoji || '')} ${esc(c.nombre)}</option>`).join('')}</select></td><td><input name="concepto" placeholder="Nuevo rubro"></td><td class="num"><input class="cant" name="valor" inputmode="numeric" placeholder="0"></td><td><button type="button" class="btn mini" data-agregar-item>+</button></td></tr>
          <tr class="total"><td colspan="2">Total</td><td class="num">${cop(total)}</td><td></td></tr></tbody></table></div>
        ${Object.keys(porCat).length ? `<ul class="rend-cat">${Object.entries(porCat).sort((x, y) => y[1] - x[1]).map(([n, v]) => { const g = gasCat(n); return `<li><span class="rend-cn">${esc(n)}</span><span class="rend-b"><i style="width:${Math.min(100, g / v * 100)}%"></i></span><span class="rend-v">${cop(g)} de ${cop(v)}</span></li>`; }).join('')}</ul>` : ''}
        <p class="sub">Para que cuente aquí, al registrar un gasto o un ahorro elige este proyecto en «Proyecto personal».</p>
        ${ml.length ? `<div class="lista-filas">${ml.slice(0, 12).map(x => `<div class="per-fijo"><span class="mov-txt"><b>${esc(x.descripcion || '')}</b><span class="sub">${fecha(x.fecha)} · ${TIPOS[x.tipo]}</span></span><span class="mov-val ${x.tipo}">${cop(x.valor)}</span></div>`).join('')}</div>` : ''}
        <div class="pie-modal"><button type="button" class="btn sec mini" data-borrar-p="${p.id}">Borrar proyecto</button></div></div>` : ''}
    </section>`;
  };
  return `<section class="panel"><h3>Proyecciones presupuestales</h3><p class="sub">Arma el presupuesto de un proyecto personal con tus categorías, ponle fecha meta y mira cuánto tienes que apartar cada mes.</p>
    <form class="per-eti-nueva" id="pp-nuevo-p"><input name="nombre" placeholder="Nuevo proyecto: viaje, estudio, carro…" required><input name="fecha_meta" type="date" aria-label="Fecha meta"><button class="btn mini"><span class="mas">+</span> Crear</button></form></section>
    ${proys.length ? proys.slice().sort((x, y) => (x.estado === 'cerrado') - (y.estado === 'cerrado')).map(tarjeta).join('') : '<div class="vacio">Todavía no hay proyectos.</div>'}`;
}
function montarProy({ items }, recargar) {
  const quieto = async fn => { const y = scrollY; await fn(); await recargar(); requestAnimationFrame(() => scrollTo(0, y)); };
  $('#pp-nuevo-p').onsubmit = ev => { ev.preventDefault(); const f = ev.target; quieto(async () => { const p = await D.perGuardarProyecto({ nombre: f.nombre.value.trim(), fecha_meta: f.fecha_meta.value || null, estado: 'plan' }); ESTADO.abierto = p.id; }); };
  document.querySelectorAll('[data-abrir-p]').forEach(b => b.onclick = () => quieto(async () => { ESTADO.abierto = ESTADO.abierto === b.dataset.abrirP ? '' : b.dataset.abrirP; }));
  document.querySelectorAll('[data-pdatos]').forEach(g => g.querySelectorAll('input, select').forEach(i => i.onchange = () => quieto(() => D.perGuardarProyecto({ id: g.dataset.pdatos, [i.name]: i.value || null }))));
  document.querySelectorAll('[data-item]').forEach(tr => tr.querySelectorAll('input, select').forEach(i => {
    if (i.name === 'valor') i.oninput = () => { const n = i.value.replace(/\D/g, ''); i.value = n ? Number(n).toLocaleString('es-CO').replace(/,/g, '.') : ''; };
    i.onchange = () => quieto(() => D.perGuardarItem({ id: tr.dataset.item, [i.name]: i.name === 'valor' ? num(i.value) : i.value }));
  }));
  document.querySelectorAll('[data-nuevo-item]').forEach(tr => { const v = tr.querySelector('[name=valor]');
    v.oninput = () => { const n = v.value.replace(/\D/g, ''); v.value = n ? Number(n).toLocaleString('es-CO').replace(/,/g, '.') : ''; };
    tr.querySelector('[data-agregar-item]').onclick = () => { const c = tr.querySelector('[name=concepto]').value.trim(); if (!c) { tr.querySelector('[name=concepto]').focus(); return; }
      quieto(() => D.perGuardarItem({ proyecto_id: tr.dataset.nuevoItem, categoria_id: tr.querySelector('[name=categoria_id]').value, concepto: c, valor: num(v.value), orden: items.filter(i => i.proyecto_id === tr.dataset.nuevoItem).length + 1 })); }; });
  document.querySelectorAll('[data-borrar-item]').forEach(b => b.onclick = () => quieto(() => D.perBorrarItem(b.dataset.borrarItem)));
  document.querySelectorAll('[data-borrar-p]').forEach(b => b.onclick = () => { if (b.dataset.seguro !== '1') { b.dataset.seguro = '1'; b.textContent = '¿Borrar el proyecto? Toca otra vez'; return; } quieto(() => D.perBorrarProyecto(b.dataset.borrarP)); });
}

// ── Alertas al correo personal ──
async function modalAlertas(recargar) {
  const aj = (await D.perAjustes()) || {};
  const f0 = document.createElement('div'); f0.className = 'modal-fondo';
  f0.innerHTML = `<form class="modal" id="pa"><h2>Alertas al correo</h2>
    <p class="sub">Una revisión cada día a las 7:00 a. m. Te escribe solo cuando hay algo nuevo: una categoría que llega a uno de tus % de aviso (de lo esperado del mes), un pago fijo que vence en 3 días o venció, el resumen del mes el día 1 y proyectos con meta en 30 días.</p>
    <div class="grilla-form"><div class="ancho"><label>Correo</label><input name="correo" type="email" required value="${esc(aj.correo_alertas || '')}"></div>
      <div class="ancho"><label>Avisarme cuando una categoría llegue al</label><div class="pp-umbs" id="pa-umbs"></div>
        <div class="per-eti-nueva"><input id="pa-nuevo-u" type="number" min="1" max="300" placeholder="Otro %, p. ej. 20"><button type="button" class="btn sec mini" id="pa-agregar-u"><span class="mas">+</span> Agregar</button></div></div>
      <div><label class="lv-check"><input type="checkbox" name="on" ${aj.alertas !== false ? 'checked' : ''}> Alertas activas</label></div></div>
    <div class="aviso" id="pa-av"></div>
    <div class="pie-modal"><button type="button" class="btn sec" id="pa-prueba" style="margin-right:auto">Enviar prueba</button><button type="button" class="btn sec" id="pa-c">Cerrar</button><button class="btn">Guardar</button></div></form>`;
  document.body.appendChild(f0);
  const f = $('#pa', f0), av = t => { $('#pa-av', f0).textContent = t; };
  let umbs = new Set((aj.umbrales?.length ? aj.umbrales : [80, 100]).map(Number));
  const pintarU = () => { const l = [...new Set([20, 50, 80, 100, ...umbs])].sort((x, y) => x - y);
    $('#pa-umbs', f0).innerHTML = l.map(u => `<button type="button" class="per-eti-t${umbs.has(u) ? ' on' : ''}" data-u="${u}">${u} %</button>`).join('');
    f0.querySelectorAll('[data-u]').forEach(b => b.onclick = () => { const u = Number(b.dataset.u); umbs.has(u) ? umbs.delete(u) : umbs.add(u); pintarU(); }); };
  pintarU();
  $('#pa-agregar-u', f0).onclick = () => { const v = Math.round(Number($('#pa-nuevo-u', f0).value)); if (v > 0 && v <= 300) { umbs.add(v); $('#pa-nuevo-u', f0).value = ''; pintarU(); } };
  const guardar = () => D.perGuardarAjustes({ ...(aj.dueno ? { dueno: aj.dueno } : {}), correo_alertas: f.correo.value.trim(), umbrales: [...umbs].sort((x, y) => x - y), alertas: f.on.checked });
  $('#pa-c', f0).onclick = () => f0.remove();
  f.onsubmit = async ev => { ev.preventDefault(); if (!umbs.size) { av('Elige al menos un porcentaje.'); return; } try { await guardar(); f0.remove(); recargar?.(); } catch (err) { av(err.message); } };
  $('#pa-prueba', f0).onclick = async ev => { const b = ev.target; b.disabled = true; av('Enviando…');
    try { await guardar(); await D.perProbarAlertas(); av(`Listo: revisa ${f.correo.value.trim()}.`); } catch (err) { av('No se pudo enviar: ' + err.message); } b.disabled = false; };
}
