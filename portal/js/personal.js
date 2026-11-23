// Finanzas personales de Andrés: lo mismo que tenía en MONAI (categorías y etiquetas en inglés, como él las escribe),
// con Movimientos y Rendimiento como las finanzas de regenerativo. Tres tipos: ingreso, gasto y ahorro (el ahorro no cuenta como gasto).
import * as D from './datos.js?v=159';
import { cop, fecha, iso } from './formato.js?v=159';
import { btnIco, ico } from './iconos.js?v=159';
import { barras } from './finanzas.js?v=159';

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
const ESTADO = { rend: false, graf: 'anio', eti: '' };
const emoji = c => `<span class="per-emo" style="--c:${esc(c?.color || '#BFBFBF')}">${esc(c?.emoji || '·')}</span>`;
const DIEZMO = ['ministerio_diezmo', 'savings_diezmo'];

export async function vistaPersonal(mesSel) {
  const [cats, etis, movs] = await Promise.all([D.perCategorias(), D.perEtiquetas(), D.perMovimientos()]);
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
  const colDe = c => ({ ...c, pres: c.presupuesto_mensual == null ? 0 : Number(c.presupuesto_mensual) * (modoAnio ? 12 : 1), v: delPer.filter(x => x.categoria_id === c.id).reduce((s, x) => s + Number(x.valor), 0) });
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

  const selector = `<div class="rend-sel" role="group" aria-label="Vista de finanzas personales"><button type="button" class="chip-f${ESTADO.rend ? '' : ' on'}" data-rend="0">Movimientos</button><button type="button" class="chip-f${ESTADO.rend ? ' on' : ''}" data-rend="1">Rendimiento</button></div>`;
  const filtros = `<div class="mon-filtros">
      <label class="per-sel"><span>Año</span><select id="sel-anio" aria-label="Año">${anios.map(y => `<option value="${y}" ${y === a ? 'selected' : ''}>${y}</option>`).join('')}</select></label>
      <label class="per-sel"><span>Mes</span><select id="sel-mes" aria-label="Mes"><option value="" ${modoAnio ? 'selected' : ''}>Todo el año</option>${MESES.map((n, i) => `<option value="${String(i + 1).padStart(2, '0')}" ${!modoAnio && i + 1 === m ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="per-sel per-proy"><span>Etiqueta</span><select id="sel-eti"><option value="">Todas</option>${etis.map(t => `<option value="${esc(t.nombre)}" ${t.nombre === ESTADO.eti ? 'selected' : ''}>#${esc(t.nombre)}</option>`).join('')}</select></label></div>`;

  const htmlMov = `
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
        <p class="sub mon-ley">Ingresos &nbsp; <span class="ley-pres"></span>Presupuesto &nbsp; <span class="ley-gas"></span>Gastado &nbsp; <span class="ley-aho"></span>Ahorro${presTot ? ` &nbsp;·&nbsp; ${Math.round(gas / presTot * 100)} % del presupuesto` : ''}</p>
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

  const html = selector + (ESTADO.rend ? rendimiento({ movs, cats, a, m, mes, suma, catDe }) : htmlMov);
  return { html, eyebrow, mesTxt, rend: ESTADO.rend, montar: recargar => {
    const ir = (y, mm) => { location.hash = `#/personal/${mm ? `${y}-${mm}` : y}`; };
    document.querySelectorAll('[data-rend]').forEach(b => b.onclick = () => { ESTADO.rend = b.dataset.rend === '1'; recargar(); });
    const bg = $('#per-ajustes'); if (bg) bg.onclick = () => ajustes(cats, etis, movs, mesTxt, recargar);
    if (ESTADO.rend) return;
    $('#sel-anio').onchange = () => ir($('#sel-anio').value, $('#sel-mes').value);
    $('#sel-mes').onchange = () => ir($('#sel-anio').value, $('#sel-mes').value);
    $('#sel-eti').onchange = () => { ESTADO.eti = $('#sel-eti').value; recargar(); };
    document.querySelectorAll('[data-eti]').forEach(b => b.onclick = () => { ESTADO.eti = ESTADO.eti === b.dataset.eti ? '' : b.dataset.eti; recargar(); });
    document.querySelectorAll('[data-nuevo]').forEach(b => b.onclick = () => modalMov({ tipo: b.dataset.nuevo, fecha: iso(new Date()), etiquetas: [] }, cats, etis, recargar));
    document.querySelectorAll('[data-editar]').forEach(b => b.onclick = () => modalMov(movs.find(x => x.id === b.dataset.editar), cats, etis, recargar));
    document.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => {
      const t = b.dataset.tipo, id = b.dataset.cat, c = catDe(id);
      const l = delPer.filter(x => x.tipo === t && (id ? x.categoria_id === id : !ids.has(x.categoria_id)));
      const f = document.createElement('div'); f.className = 'modal-fondo';
      f.innerHTML = `<div class="modal modal-cat"><div class="mc-cab"><span class="mc-ico">${emoji(c)}</span><div><span class="lv-ceja">${TIPOS[t]} · ${esc(mesTxt)}</span><h2>${esc(c?.nombre || 'Sin categoría')}</h2></div><b class="mc-tot ${t}">${SIGNO[t]} ${cop(l.reduce((s, x) => s + Number(x.valor), 0))}</b></div>
        ${l.length ? `<div class="lista-filas">${l.map(fila).join('')}</div>` : '<p class="sub">Sin movimientos en este periodo.</p>'}
        <div class="pie-modal"><button type="button" class="btn sec" data-cerrar>Cerrar</button><button type="button" class="btn" data-agregar><span class="mas">+</span> ${TIPOS[t]}</button></div></div>`;
      document.body.appendChild(f);
      f.onclick = ev => { if (ev.target === f || ev.target.closest('[data-cerrar]')) f.remove(); };
      f.querySelector('[data-agregar]').onclick = () => { f.remove(); modalMov({ tipo: t, fecha: iso(new Date()), categoria_id: id || null, etiquetas: [] }, cats, etis, recargar); };
      f.querySelectorAll('[data-editar]').forEach(r => r.onclick = () => { f.remove(); modalMov(movs.find(x => x.id === r.dataset.editar), cats, etis, recargar); });
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
function rendimiento({ movs, cats, a, m, mes, suma, catDe }) {
  const mk = (y, mm) => `${y}-${String(mm).padStart(2, '0')}`;
  const ant = m === 1 ? mk(a - 1, 12) : mk(a, m - 1);
  const delM = k => movs.filter(x => mesDe(x.fecha) === k);
  const anio = movs.filter(x => (x.fecha || '').startsWith(String(a)));
  const ing = suma(delM(mes), 'ingreso'), gas = suma(delM(mes), 'gasto'), aho = suma(delM(mes), 'ahorro');
  const yIng = suma(anio, 'ingreso'), yGas = suma(anio, 'gasto'), yAho = suma(anio, 'ahorro');
  const pct = (n, d) => d ? Math.round(n / d * 100) : 0;
  // Diezmo: 10 % de lo que entra; lo dado = movimientos con #ministerio_diezmo o #savings_diezmo
  const diez = l => l.filter(x => (x.etiquetas || []).some(t => DIEZMO.includes(t))).reduce((s, x) => s + Number(x.valor), 0);
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
  cats.filter(c => c.tipo === 'gasto' && c.presupuesto_mensual && (cA[c.nombre] || 0) > Number(c.presupuesto_mensual)).forEach(c => obs.push(['alto', `${c.nombre} pasó su presupuesto: ${cop(cA[c.nombre])} de ${cop(c.presupuesto_mensual)}.`]));
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
  <section class="panel per-diezmo"><h3>Diezmo</h3><p class="sub">10 % de los ingresos. Cuenta lo marcado con #ministerio_diezmo o #savings_diezmo.</p>
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
function modalMov(m, cats, etis, recargar) {
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
    const reg = { tipo: v.tipo, valor: n, fecha: v.fecha, hora: v.hora || null, categoria_id: v.categoria_id || null, descripcion: v.descripcion.trim() || null, medio: v.medio.trim() || null, etiquetas: [...sel] };
    if (m.id) reg.id = m.id;
    try { await D.perGuardar(reg); f0.remove(); recargar(); } catch (err) { $('#pm-aviso', f0).textContent = err.message; }
  };
}

// ── Engranaje: presupuesto, categorías, etiquetas e importación de MONAI ──
function ajustes(cats, etis, movs, mesTxt, recargar) {
  const f = document.createElement('div'); f.className = 'modal-fondo';
  f.innerHTML = `<div class="modal modal-opciones" role="dialog" aria-label="Ajustes de finanzas personales"><div class="aj-cab"><div><h2>Ajustes</h2><p class="sub">${esc(mesTxt)}</p></div>${btnIco('x', 'Cerrar', 'data-cerrar')}</div>
    <div class="aj-rapidos">
      <button type="button" class="aj-rap" data-op="pres"><span>${ico('excel')}</span><b>Presupuesto del mes</b><small>Tope de gasto por categoría</small></button>
      <button type="button" class="aj-rap" data-op="cats"><span>${ico('editar')}</span><b>Categorías</b><small>Nombre, tipo y emoji</small></button>
      <button type="button" class="aj-rap" data-op="etis"><span>${ico('editar')}</span><b>Etiquetas</b><small>Crear o quitar etiquetas</small></button>
    </div></div>`;
  const cerrar = () => { f.remove(); removeEventListener('hashchange', cerrar); };
  addEventListener('hashchange', cerrar);
  f.onclick = ev => { if (ev.target === f || ev.target.closest('[data-cerrar]')) return cerrar();
    const op = ev.target.closest('[data-op]')?.dataset.op; if (!op) return; cerrar();
    if (op === 'pres') modalPresupuesto(cats.filter(c => c.tipo === 'gasto' && c.activa !== false), recargar);
    if (op === 'cats') modalCategorias(recargar);
    if (op === 'etis') modalEtiquetas(movs, recargar);
  };
  document.body.appendChild(f);
}
function modalPresupuesto(cats, recargar) {
  const f = document.createElement('div'); f.className = 'modal-fondo';
  f.innerHTML = `<form class="modal" id="pp"><h2>Presupuesto mensual</h2><p class="sub">Tope de gasto por categoría. Déjalo vacío si no tiene tope.</p>
    <div class="tabla-cont"><table><thead><tr><th>Categoría</th><th class="num">Tope mensual (COP)</th></tr></thead><tbody>
    ${cats.map(c => `<tr><td>${emoji(c)} ${esc(c.nombre)}</td><td class="num"><input class="cant ancho-p" name="${c.id}" inputmode="numeric" value="${c.presupuesto_mensual ? Number(c.presupuesto_mensual).toLocaleString('es-CO').replace(/,/g, '.') : ''}"></td></tr>`).join('')}
    </tbody></table></div><div class="pie-modal"><button type="button" class="btn sec" id="pp-c">Cancelar</button><button class="btn">Guardar</button></div></form>`;
  document.body.appendChild(f);
  $('#pp-c', f).onclick = () => f.remove();
  $('#pp', f).onsubmit = async ev => { ev.preventDefault();
    for (const c of cats) { const raw = f.querySelector(`[name="${c.id}"]`).value.replace(/\D/g, ''); const v = raw ? Number(raw) : null;
      if (v !== (c.presupuesto_mensual ? Number(c.presupuesto_mensual) : null)) await D.perActualizarCategoria(c.id, { presupuesto_mensual: v }); }
    f.remove(); recargar(); };
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

// ── Importar la exportación CSV de MONAI (columnas date, purpose, amount, category, tags, id…) ──
function csv(txt) {
  const filas = []; let f = [], c = '', q = false;
  for (let i = 0; i < txt.length; i++) { const ch = txt[i];
    if (q) { if (ch === '"') { if (txt[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { f.push(c); c = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && txt[i + 1] === '\n') i++; f.push(c); filas.push(f); f = []; c = ''; } else c += ch; }
  if (c || f.length) { f.push(c); filas.push(f); }
  const cab = (filas.shift() || []).map(x => x.replace(/^﻿/, '').trim());
  return filas.filter(r => r.length > 1).map(r => Object.fromEntries(cab.map((k, i) => [k, r[i] ?? ''])));
}
export function leerMonaiPersonal(txt, cats) {
  const filas = csv(txt);
  if (!filas.length || !('amount' in filas[0]) || !('category' in filas[0])) throw new Error('Este archivo no parece una exportación de MONAI (faltan las columnas amount y category).');
  return filas.map(r => {
    // MONAI exporta en UTC; se pasa a la hora de Bogotá (UTC−5)
    const d = new Date(new Date(r.date).getTime() - 5 * 3600e3), f = d.toISOString();
    const c = cats.find(k => k.nombre.toLowerCase() === String(r.category).trim().toLowerCase());
    const monto = Number(r.amount) || 0;
    const tipo = c ? c.tipo : monto > 0 ? 'ingreso' : 'gasto';
    return { ref: 'monai:' + r.id, origen: 'monai', fecha: f.slice(0, 10), hora: f.slice(11, 19), tipo, categoria_id: c?.id || null,
      valor: Math.round(tipo === 'ingreso' ? monto : -monto), descripcion: String(r.purpose || '').trim() || null,
      etiquetas: String(r.tags || '').split(/[;,]/).map(t => t.trim().replace(/^#/, '')).filter(Boolean), _cat: r.category };
  });
}
function modalMonai(cats, etis, movs, recargar) {
  const f = document.createElement('div'); f.className = 'modal-fondo';
  f.innerHTML = `<div class="modal ancho modal-monai"><h2>Importar desde MONAI</h2>
    <p class="sub">En MONAI: Ajustes › Exportar › CSV. El portal agrega lo nuevo, actualiza lo que cambió y quita lo que borraste en MONAI. Volver a importar no duplica.</p>
    <label class="monai-arch"><input type="file" accept=".csv,text/csv" id="pmo-arch"><span>Elegir archivo CSV</span></label>
    <div id="pmo-res"></div><div class="aviso" id="pmo-av"></div>
    <div class="pie-modal"><button type="button" class="btn sec" id="pmo-c">Cerrar</button><button type="button" class="btn" id="pmo-ok" disabled>Importar</button></div></div>`;
  document.body.appendChild(f);
  let plan = null, etiNuevas = [];
  const av = t => { $('#pmo-av', f).textContent = t; };
  const igual = (x, y) => x.fecha === y.fecha && String(x.hora || '').slice(0, 8) === String(y.hora || '').slice(0, 8) && Number(x.valor) === Number(y.valor) && x.tipo === y.tipo
    && (x.categoria_id || null) === (y.categoria_id || null) && (x.descripcion || null) === (y.descripcion || null) && JSON.stringify(x.etiquetas || []) === JSON.stringify(y.etiquetas || []);
  $('#pmo-arch', f).onchange = async ev => {
    const a = ev.target.files[0]; if (!a) return; av('');
    try {
      const filas = leerMonaiPersonal(await a.text(), cats);
      const porRef = new Map(movs.filter(x => x.ref).map(x => [x.ref, x]));
      const refs = new Set(filas.map(x => x.ref));
      const min = filas.reduce((s, x) => x.fecha < s ? x.fecha : s, '9999');
      const limpio = ({ _cat, ...x }) => x;
      const nuevos = filas.filter(x => !porRef.has(x.ref)).map(limpio);
      const cambios = filas.filter(x => porRef.has(x.ref) && !igual(x, porRef.get(x.ref))).map(x => ({ id: porRef.get(x.ref).id, ...limpio(x), medio: porRef.get(x.ref).medio }));
      const quitar = movs.filter(x => x.origen === 'monai' && x.fecha >= min && !refs.has(x.ref)).map(x => x.id);
      const sinCat = [...new Set(filas.filter(x => !x.categoria_id).map(x => x._cat))];
      const conocidas = new Set(etis.map(t => t.nombre));
      etiNuevas = [...new Set(filas.flatMap(x => x.etiquetas))].filter(t => !conocidas.has(t));
      plan = { nuevos, cambios, quitar };
      const tipo = t => filas.filter(x => x.tipo === t).length;
      $('#pmo-res', f).innerHTML = `<ul class="monai-res"><li><b>${filas.length}</b>movimientos en el archivo</li><li><b>${nuevos.length}</b>nuevos</li><li><b>${cambios.length}</b>con cambios</li><li><b>${quitar.length}</b>borrados en MONAI</li></ul>
        <p class="sub">${tipo('ingreso')} ingresos · ${tipo('gasto')} gastos · ${tipo('ahorro')} ahorros · del ${fecha(min)} al ${fecha(filas.reduce((s, x) => x.fecha > s ? x.fecha : s, ''))}</p>
        ${sinCat.length ? `<p class="aviso">Categorías sin equivalente (quedan sin categoría): ${sinCat.map(esc).join(', ')}</p>` : ''}
        ${etiNuevas.length ? `<p class="sub">Etiquetas nuevas que se crean: ${etiNuevas.map(t => '#' + esc(t)).join(' ')}</p>` : ''}`;
      $('#pmo-ok', f).disabled = !(nuevos.length || cambios.length || quitar.length);
      if ($('#pmo-ok', f).disabled) av('Todo está al día: no hay nada que importar.');
    } catch (err) { $('#pmo-res', f).innerHTML = ''; av(err.message); }
  };
  $('#pmo-ok', f).onclick = async ev => {
    const b = ev.target; b.disabled = true; b.textContent = 'Importando…';
    try {
      for (const t of etiNuevas) await D.perCrearEtiqueta(t).catch(() => {});
      await D.perImportar(plan); f.remove(); recargar();
      setTimeout(() => alert(`Listo: ${plan.nuevos.length} nuevos, ${plan.cambios.length} actualizados, ${plan.quitar.length} quitados.`), 50);
    } catch (err) { av(err.message); b.disabled = false; b.textContent = 'Importar'; }
  };
  $('#pmo-c', f).onclick = () => f.remove();
}
