// Finanzas de regenerativo: ingresos, gastos y presupuesto de la empresa. Solo perfil de facturación.
import * as D from './datos.js?v=58';
import { cop, fecha, iso } from './formato.js?v=58';
import { btnIco } from './iconos.js?v=58';

const $ = (s, r = document) => r.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const C_ING = '#00A3CB', C_GAS = '#800000';   // azul y rojo vino regenerativo   // par validado (CVD y contraste)
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const mesDe = f => f.slice(0, 7);
const compacto = n => n >= 1e6 ? (n / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 1 }) + ' M' : n >= 1e3 ? Math.round(n / 1e3) + ' mil' : String(Math.round(n));

// Íconos de línea por categoría (estilo The Noun Project), en vez de emojis
const ICAT = {
  ingreso: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  honorario: '<circle cx="12" cy="12" r="8.5"/><path d="M14.5 9.2c-.5-.8-1.4-1.2-2.5-1.2-1.5 0-2.6.8-2.6 2s1.1 1.6 2.6 2 2.6.8 2.6 2-1.1 2-2.6 2c-1.1 0-2.1-.5-2.6-1.3M12 6.5V8M12 16v1.5"/>',
  otros: '<path d="M12 4v16M4 12h16"/><circle cx="12" cy="12" r="8.5"/>',
  nomina: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/>',
  herramienta: '<path d="M14.5 5.5a4 4 0 0 0-5 5L4 16v4h4l5.5-5.5a4 4 0 0 0 5-5L16 12l-4-4z"/>',
  transporte: '<path d="M4 14l2-5.2A2 2 0 0 1 7.9 7.5h8.2a2 2 0 0 1 1.9 1.3L20 14v3.5H4z"/><path d="M6.5 17.5V19M17.5 17.5V19M4 14h16"/><circle cx="8" cy="15.8" r=".6"/><circle cx="16" cy="15.8" r=".6"/>',
  viatico: '<path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5c0 1.5 1 1.5 1 3M11.5 3.5c0 1.5 1 1.5 1 3"/>',
  deuda: '<rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M3 10h18M7 14.5h4"/>',
  suscripcion: '<path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3"/><path d="M18 3v4h-4M6 21v-4h4"/>',
  base: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="1.5"/>',
};
const claveCat = n => { n = (n || '').toLowerCase();
  return /honorario/.test(n) && !/n[óo]mina/.test(n) ? 'honorario' : /otro.*ingreso|otros/.test(n) ? 'otros' : /ingreso/.test(n) ? 'ingreso' : /n[óo]mina|recurso|salari/.test(n) ? 'nomina'
    : /herramienta/.test(n) ? 'herramienta' : /transporte/.test(n) ? 'transporte' : /vi[áa]tico|aliment/.test(n) ? 'viatico' : /deuda|banco|impuesto|cr[ée]dito/.test(n) ? 'deuda' : /suscrip/.test(n) ? 'suscripcion' : 'base'; };
export const icoCat = n => `<svg class="ico-cat ic-${claveCat(n)}" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICAT[claveCat(n)]}</svg>`;

const opsCat = (cats, tipo, sel) => tipo === 'socio' ? '<option value="">—</option>' : cats.filter(c => c.tipo === tipo).map(c => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('');

export async function vistaFinanzas(mesSel, listaSel) {
  const [cats, todos, encargos, docs, props] = await Promise.all([D.finCategorias(), D.finMovimientos(), D.encargos(), D.finDocumentosCobro(), D.finPropuestasEncargos().catch(() => [])]);
  const movs = todos.filter(x => (x.estado || 'confirmado') === 'confirmado');
  const pend = todos.filter(x => x.estado === 'por_confirmar').sort((a, b) => a.fecha < b.fecha ? 1 : -1);
  const hoy = new Date();
  const mes = mesSel && /^\d{4}-\d{2}$/.test(mesSel) ? mesSel : iso(hoy).slice(0, 7);
  const [a, m] = mes.split('-').map(Number);
  const mesTxt = `${MESES[m - 1]} ${a}`;
  const lista = listaSel || 'todo';   // 'todo' | 'general' | id de encargo
  const enLista = x => lista === 'todo' || (lista === 'general' ? !x.encargo_id : x.encargo_id === lista);
  const delMes = movs.filter(x => mesDe(x.fecha) === mes && enLista(x));
  const suma = (l, t) => l.filter(x => x.tipo === t).reduce((s, x) => s + Number(x.valor), 0);
  const SALARIO = cats.find(c => c.nombre === 'Nómina y honorarios')?.id;
  const esSal = x => x.categoria_id === SALARIO;
  const ing = suma(delMes, 'ingreso'), gas = suma(delMes.filter(x => !esSal(x)), 'gasto'), sal = suma(delMes.filter(esSal), 'gasto');

  // Valor de cada encargo: honorarios de la propuesta (o del documento web) + adendas aprobadas; menos lo recibido
  const aprob = d => ['aprobado', 'firmado'].includes(d.estado);
  const porEnc = encargos.map(e => {
    const hon = Number(props.find(p => p.encargo_id === e.id)?.honorarios) || Number(docs.filter(d => d.encargo_id === e.id && d.tipo === 'propuesta' && aprob(d)).at(-1)?.contenido?.honorarios) || 0;
    const adic = docs.filter(d => d.encargo_id === e.id && d.tipo === 'adenda' && aprob(d)).reduce((s, d) => s + (Number(d.contenido.valor) || 0), 0);
    const esperado = hon + adic;
    const recibido = suma(movs.filter(x => x.encargo_id === e.id), 'ingreso');
    const gastos = suma(movs.filter(x => x.encargo_id === e.id), 'gasto');
    return { e, esperado, adic, recibido, gastos, porCobrar: Math.max(0, esperado - recibido) };
  });
  const porCobrar = porEnc.reduce((s, r) => s + r.porCobrar, 0);

  // Últimos 6 meses
  const meses = Array.from({ length: 6 }, (_, i) => { const d = new Date(a, m - 1 - (5 - i), 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });
  const serie = meses.map(k => ({ k, ing: suma(movs.filter(x => mesDe(x.fecha) === k && enLista(x)), 'ingreso'), gas: suma(movs.filter(x => mesDe(x.fecha) === k && !esSal(x) && enLista(x)), 'gasto') }));

  const catsGasto = cats.filter(c => c.tipo === 'gasto' && c.id !== SALARIO).map(c => ({ ...c, gastado: delMes.filter(x => x.categoria_id === c.id).reduce((s, x) => s + Number(x.valor), 0) }))
    .sort((x, y) => y.gastado - x.gastado);
  // Columnas de ingresos: una por subcategoría de cada categoría de ingreso (Honorarios, Otros ingresos…)
  const delIng = delMes.filter(x => x.tipo === 'ingreso');
  const colsIng = cats.filter(c => c.tipo === 'ingreso').flatMap(c => {
    const subs = (c.subcategorias || []).length ? c.subcategorias : [c.nombre];
    const sinSub = delIng.filter(x => x.categoria_id === c.id && !subs.includes(x.subcategoria)).reduce((s, x) => s + Number(x.valor), 0);
    return subs.map((sb, i) => ({ id: c.id, sub: sb === c.nombre ? '' : sb, nombre: sb, recibido: delIng.filter(x => x.categoria_id === c.id && x.subcategoria === sb).reduce((s, x) => s + Number(x.valor), 0) + (i === 0 ? sinSub : 0) }));
  });
  const presTotal = catsGasto.reduce((s, c) => s + Number(c.presupuesto_mensual || 0), 0);
  const ejemplos = movs.some(x => x.ejemplo);
  const prev = new Date(a, m - 2, 1), next = new Date(a, m, 1);
  const k = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const balance = ing - gas;
  const listas = [['todo', 'Todo regenerativo'], ['general', 'Gastos generales'], ...encargos.map(e => [e.id, e.nombre])];
  const maxCat = Math.max(1, ...catsGasto.map(c => Math.max(c.gastado, Number(c.presupuesto_mensual || 0))), ...colsIng.map(c => c.recibido));
  const signo = x => x.tipo === 'ingreso' ? '+' : x.tipo === 'gasto' ? '−' : '';
  const H = 190;
  const subDe = x => x.subcategoria && x.subcategoria !== x.categoria?.nombre ? x.subcategoria : '';
  const desglose = catsGasto.filter(c => c.gastado).map(c => {
    const m = {}; delMes.filter(x => x.categoria_id === c.id).forEach(x => { const k = x.subcategoria || 'Sin subcategoría'; m[k] = (m[k] || 0) + Number(x.valor); });
    return { ...c, subs: Object.entries(m).sort((a, b) => b[1] - a[1]) };
  }).filter(d => d.subs.length > 1 || d.subs[0][0] !== d.nombre);
  const html = `
    ${ejemplos ? `<div class="aviso-ej">Hay movimientos de ejemplo. <button class="btn sec mini" id="borrar-ej">Borrar ejemplos</button></div>` : ''}
    <div class="fin-mon">
      <section class="mon">
        <div class="mon-total">
          <div class="mon-et">Balance de la operación</div>
          <div class="mon-cifra">${balance < 0 ? '−' : '+'}${cop(Math.abs(balance)).replace(' COP', '')}<span>COP</span></div>
          <div class="mon-pills"><span class="pill-gas">− ${cop(gas)}</span><span class="pill-ing">+ ${cop(ing)}</span></div>
          <div class="mon-sal"><span>Tu salario <b>${cop(sal)}</b></span><span>Queda en regenerativo <b class="${balance - sal < 0 ? 'xxx' : ''}">${balance - sal < 0 ? '−' : ''}${cop(Math.abs(balance - sal))}</b></span></div>
          <div class="mon-filtros">
            <a href="#/finanzas/${k(prev)}/${lista}" class="mon-flecha" aria-label="Mes anterior">‹</a><b>${mesTxt}</b><a href="#/finanzas/${k(next)}/${lista}" class="mon-flecha" aria-label="Mes siguiente">›</a>
            <select id="lista">${listas.map(([v, n]) => `<option value="${v}" ${v === lista ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
          </div>
        </div>
        <div class="mon-cols">${colsIng.map(c => {
          const hI = Math.max(c.recibido ? 8 : 0, c.recibido / maxCat * H);
          return `<button class="mon-col ing" data-cat="${c.id}" data-sub="${esc(c.sub)}" data-tipo="ingreso" title="Agregar ingreso en ${esc(c.nombre)}">
            <div class="mon-barra" style="height:${H}px"><div class="mon-gasto mon-ingreso" style="height:${hI}px"></div></div>
            <div class="mon-ico">${icoCat(c.nombre)}</div>
            <div class="mon-val">${compacto(c.recibido)}</div>
            <div class="mon-pct">ingreso</div>
            <div class="mon-nom">${esc(c.nombre)}</div></button>`;
        }).join('')}${colsIng.length ? '<span class="mon-sep" aria-hidden="true"></span>' : ''}${catsGasto.map(c => {
          const p = Number(c.presupuesto_mensual || 0), exc = p && c.gastado > p;
          const hP = p / maxCat * H, hG = Math.max(c.gastado ? 8 : 0, c.gastado / maxCat * H);
          return `<button class="mon-col" data-cat="${c.id}" title="Agregar gasto en ${esc(c.nombre)}">
            <div class="mon-barra" style="height:${H}px">${p ? `<div class="mon-pres" style="height:${hP}px"></div>` : ''}<div class="mon-gasto ${exc ? 'exc' : ''}" style="height:${hG}px"></div></div>
            <div class="mon-ico">${icoCat(c.nombre)}</div>
            <div class="mon-val">${compacto(c.gastado)}</div>
            <div class="mon-pct ${exc ? 'xxx' : ''}">${p ? Math.round(c.gastado / p * 100) + ' %' : '—'}</div>
            <div class="mon-nom">${esc(c.nombre)}</div></button>`;
        }).join('')}</div>
        ${desglose.length ? `<div class="mon-sub">${desglose.map(d => `<div class="ms-fila"><span class="ms-cat">${icoCat(d.nombre)} ${esc(d.nombre)}</span><span class="ms-chips">${d.subs.map(([n, v]) => `<span class="ms-chip">${esc(n)} <b>${compacto(v)}</b></span>`).join('')}</span></div>`).join('')}</div>` : ''}
        <p class="sub mon-ley">Ingresos &nbsp; <span class="ley-pres"></span>Presupuesto del mes &nbsp; <span class="ley-gas"></span>Gastado &nbsp; <a href="#" id="editar-pres">Editar presupuesto</a>${presTotal ? ` &nbsp;·&nbsp; ${Math.round(gas / presTotal * 100)} % del presupuesto` : ''}</p>
        <div class="mon-mas">${pend.length ? `<a class="pend-aviso" href="#por-confirmar">${pend.length} por confirmar</a>` : ''}<button class="btn sec mini btn-ing" data-nuevo="ingreso">+ Ingreso</button><button class="btn mini btn-gas" data-nuevo="gasto">+ Gasto</button></div>
      </section>
      <section class="panel fin-lado">
        <div class="od-cab"><h3>Movimientos del mes</h3><span class="sub">${delMes.length}</span></div>
        ${delMes.length ? `<div class="lista-filas">${delMes.map(x => `<button class="mov-fila" data-editar="${x.id}">
          <span class="mov-ico ${x.tipo}">${icoCat(x.tipo === 'socio' ? 'nómina' : x.tipo === 'ingreso' ? (x.subcategoria || x.categoria?.nombre || 'ingreso') : x.categoria?.nombre)}</span>
          <span class="mov-txt"><b>${esc(x.descripcion || '')}</b><span class="sub">${fecha(x.fecha)} · ${esc(x.categoria?.nombre || (x.tipo === 'socio' ? 'Personal / socio' : ''))}${subDe(x) ? ' › ' + esc(subDe(x)) : ''} · ${esc(x.encargo?.nombre || 'General')}</span></span>
          <span class="mov-val ${x.tipo}">${signo(x)} ${cop(x.valor)}</span></button>`).join('')}</div>`
        : '<p class="sub">No hay movimientos este mes en esta lista.</p>'}
      </section>
    </div>
    <div class="fin-grid">
      <section class="panel"><h3>Ingresos y gastos · 6 meses</h3>${barras(serie)}</section>
      <section class="panel"><h3>Por cobrar</h3><div class="cifra-grande">${cop(porCobrar)}</div><p class="sub">${porEnc.filter(r => r.porCobrar > 0).length} encargos con saldo · valor de propuestas y adicionales menos lo recibido</p>
        <div class="lista-filas">${porEnc.filter(r => r.esperado).map(r => `<button class="mov-fila" data-lista="${r.e.id}"><span class="mov-txt"><b>${esc(r.e.nombre)}</b><span class="barra"><i style="width:${Math.min(100, r.recibido / r.esperado * 100)}%"></i></span></span><span class="mov-val">${cop(r.porCobrar)}</span></button>`).join('')}</div>
      </section>
    </div>
    <section class="panel"><h3>Encargos</h3>
      ${porEnc.length ? `<div class="tabla-cont"><table class="t-compacta"><thead><tr><th>Encargo</th><th class="num">Valor</th><th class="num">Recibido</th><th class="num">Por cobrar</th><th class="num col-opc">Gastos</th></tr></thead><tbody>
      ${porEnc.map(r => `<tr class="clic" data-lista="${r.e.id}"><td><b>${esc(r.e.nombre)}</b>${r.adic ? `<div class="sub">Incluye ${cop(r.adic)} en adicionales</div>` : ''}</td><td class="num">${r.esperado ? cop(r.esperado) : '—'}</td><td class="num">${cop(r.recibido)}</td><td class="num">${cop(r.porCobrar)}</td><td class="num col-opc">${cop(r.gastos)}</td></tr>`).join('')}
      <tr class="total"><td>Total</td><td class="num">${cop(porEnc.reduce((a, r) => a + r.esperado, 0))}</td><td class="num">${cop(porEnc.reduce((a, r) => a + r.recibido, 0))}</td><td class="num">${cop(porCobrar)}</td><td class="num col-opc">${cop(porEnc.reduce((a, r) => a + r.gastos, 0))}</td></tr>
      </tbody></table></div>` : '<p class="sub">Sin encargos.</p>'}
    </section>
    ${!pend.length ? `<section class="pend" id="por-confirmar"><div class="pend-cab"><h3>Por confirmar${D.SIN_CORREO ? '' : ' <span class="pend-n">0</span>'}</h3><span class="sub">Lo que llega por correo queda aquí hasta que lo apruebes con ✓; mientras tanto no cuenta en los totales. ${D.SIN_CORREO ? 'Esta vista previa no puede leer los pendientes del correo: en el portal real aparecen todos aquí.' : 'No hay movimientos pendientes.'}</span></div></section>` : ''}
    ${pend.length ? `<section class="pend" id="por-confirmar">
      <div class="pend-cab"><h3>Por confirmar <span class="pend-n">${pend.length}</span></h3><span class="sub">Llegaron por correo y están sujetos a tu aprobación: no cuentan en los totales hasta que les des ✓.</span></div>
      ${pend.map((x, i) => `<div class="pend-fila ${i >= 6 ? 'pend-oculta' : ''}" data-pend="${x.id}">
        <div class="pend-txt"><span class="sub">${fecha(x.fecha)}${x.medio ? ' · ' + esc(x.medio) : ''}</span><b>${esc(x.descripcion || '')}</b>${x.nota_correo ? `<span class="pend-nota">${esc(x.nota_correo)}</span>` : ''}</div>
        <div class="pend-val ${x.tipo}">${signo(x)} ${cop(x.valor)}</div>
        <div class="pend-sel">
          <select data-f="tipo"><option value="gasto" ${x.tipo === 'gasto' ? 'selected' : ''}>Gasto de la empresa</option><option value="ingreso" ${x.tipo === 'ingreso' ? 'selected' : ''}>Ingreso</option><option value="socio" ${x.tipo === 'socio' ? 'selected' : ''}>Personal / socio (no cuenta)</option></select>
          <select data-f="categoria_id">${opsCat(cats, x.tipo, x.categoria_id)}</select>
          <select data-f="encargo_id"><option value="">Regenerativo (general)</option>${encargos.map(e => `<option value="${e.id}" ${e.id === x.encargo_id ? 'selected' : ''}>${esc(e.nombre)}</option>`).join('')}</select>
        </div>
        <div class="pend-acc">${btnIco('check', 'Confirmar', 'data-ok', '')}${btnIco('x', 'Descartar (no es un movimiento real)', 'data-no')}</div>
      </div>`).join('')}
      ${pend.length > 6 ? `<button class="btn sec mini pend-mas" id="pend-mas">Ver los ${pend.length - 6} restantes</button>` : ''}
    </section>` : ''}`;

  return { html, montar: recargar => {
    document.querySelectorAll('[data-nuevo]').forEach(b => b.onclick = () => modalMov({ tipo: b.dataset.nuevo, fecha: iso(new Date()), encargo_id: ['todo', 'general'].includes(lista) ? null : lista }, cats, encargos, recargar));
    document.querySelectorAll('[data-editar]').forEach(b => b.onclick = () => modalMov(movs.find(x => x.id === b.dataset.editar), cats, encargos, recargar));
    const pm = $('#pend-mas'); if (pm) pm.onclick = () => { document.querySelectorAll('.pend-oculta').forEach(f => f.classList.remove('pend-oculta')); pm.remove(); };
    const pa = $('.pend-aviso'); if (pa) pa.onclick = ev => { ev.preventDefault(); $('#por-confirmar').scrollIntoView({ behavior: 'smooth' }); };
    document.querySelectorAll('[data-pend]').forEach(fila => {
      const sel = n => fila.querySelector(`[data-f="${n}"]`);
      sel('tipo').onchange = () => { sel('categoria_id').innerHTML = opsCat(cats, sel('tipo').value); sel('categoria_id').disabled = sel('tipo').value === 'socio'; };
      sel('categoria_id').disabled = sel('tipo').value === 'socio';
      fila.querySelector('[data-ok]').onclick = async () => {
        const t = sel('tipo').value;
        await D.finGuardarMovimiento({ id: fila.dataset.pend, estado: 'confirmado', tipo: t, categoria_id: t === 'socio' ? null : sel('categoria_id').value || null, encargo_id: sel('encargo_id').value || null });
        recargar();
      };
      fila.querySelector('[data-no]').onclick = async () => { await D.finGuardarMovimiento({ id: fila.dataset.pend, estado: 'descartado' }); recargar(); };
    });
    const be = $('#borrar-ej'); if (be) be.onclick = async () => { if (confirm('¿Borrar todos los movimientos de ejemplo?')) { await D.finBorrarEjemplos(); recargar(); } };
    $('#editar-pres').onclick = ev => { ev.preventDefault(); modalPresupuesto(cats.filter(c => c.tipo === 'gasto'), recargar); };
    document.querySelectorAll('[data-cat]').forEach(x => x.onclick = () => modalMov({ tipo: x.dataset.tipo || 'gasto', fecha: iso(new Date()), categoria_id: x.dataset.cat, ...(x.dataset.sub ? { subcategoria: x.dataset.sub } : {}), encargo_id: ['todo', 'general'].includes(lista) ? null : lista }, cats, encargos, recargar));
    document.querySelectorAll('[data-lista]').forEach(f => f.onclick = () => { location.hash = `#/finanzas/${mes}/${f.dataset.lista}`; scrollTo(0, 0); });
    $('#lista').onchange = ev => { location.hash = `#/finanzas/${mes}/${ev.target.value}`; };
    document.querySelectorAll('.g-col').forEach(col => {
      col.onmouseenter = () => { const t = $('#tip-fin'); t.innerHTML = col.dataset.tip; t.style.display = 'block'; };
      col.onmousemove = ev => { const t = $('#tip-fin'), r = col.closest('.graf').getBoundingClientRect(); t.style.left = (ev.clientX - r.left + 12) + 'px'; t.style.top = (ev.clientY - r.top - 10) + 'px'; };
      col.onmouseleave = () => { $('#tip-fin').style.display = 'none'; };
    });
  } };
}

function barras(serie) {
  const max = Math.max(1, ...serie.flatMap(s => [s.ing, s.gas]));
  const H = 220;
  return `<div class="graf">
    <div class="leyenda-fin"><span><i style="background:${C_ING}"></i>Ingresos</span><span><i style="background:${C_GAS}"></i>Gastos</span></div>
    <div class="graf-area" style="height:${H + 26}px">
      ${[0.5, 1].map(f => `<div class="graf-guia" style="bottom:${26 + H * f}px"><span>${compacto(max * f)}</span></div>`).join('')}
      <div class="graf-cols">${serie.map(s => {
        const [y, mm] = s.k.split('-').map(Number);
        return `<div class="g-col" data-tip="<b>${MESES[mm - 1]} ${y}</b><br>Ingresos ${cop(s.ing)}<br>Gastos ${cop(s.gas)}<br>Balance ${cop(s.ing - s.gas)}">
          <div class="g-par" style="height:${H}px"><span style="height:${s.ing / max * H}px;background:${C_ING}"></span><span style="height:${s.gas / max * H}px;background:${C_GAS}"></span></div>
          <div class="g-mes">${MESES[mm - 1].slice(0, 3)}</div></div>`;
      }).join('')}</div>
      <div id="tip-fin" class="tip-fin"></div>
    </div></div>`;
}

export function modalMov(m, cats, encargos, recargar) {
  const fondo = document.createElement('div'); fondo.className = 'modal-fondo';
  const opsCat = t => cats.filter(c => c.tipo === t).map(c => `<option value="${c.id}" ${c.id === m.categoria_id ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('');
  fondo.innerHTML = `<form class="modal" id="fm">
    <h2>${m.id ? 'Editar' : 'Nuevo'} ${m.tipo === 'ingreso' ? 'ingreso' : m.tipo === 'socio' ? 'movimiento personal / socio' : 'gasto'}</h2>
    <div class="grilla-form">
      <div><label>Valor (COP)</label><input name="valor" inputmode="numeric" required value="${m.valor ? Number(m.valor).toLocaleString('es-CO').replace(/,/g, '.') : ''}"></div>
      <div><label>Fecha</label><input name="fecha" type="date" required value="${m.fecha || ''}"></div>
      ${m.tipo === 'socio' ? '' : `<div><label>Categoría</label><select name="categoria_id">${opsCat(m.tipo)}</select></div>
      <div><label>Subcategoría</label><input name="subcategoria" list="subcats" value="${esc(m.subcategoria || '')}" placeholder="Suscripciones, Banco, Transporte…"><datalist id="subcats"></datalist></div>`}
      <div><label>Encargo</label><select name="encargo_id"><option value="">Regenerativo (general)</option>${encargos.map(e => `<option value="${e.id}" ${e.id === m.encargo_id ? 'selected' : ''}>${esc(e.nombre)}</option>`).join('')}</select></div>
      <div class="ancho"><label>Concepto</label><input name="descripcion" value="${esc(m.descripcion || '')}" placeholder="${m.tipo === 'ingreso' ? 'Pago 50% al iniciar' : 'Taxi visita de obra'}"></div>
      <div><label>Medio</label><input name="medio" value="${esc(m.medio || '')}" placeholder="Transferencia, efectivo, tarjeta…"></div>
    </div>
    ${m.id ? `<div class="soportes"><h3>Soportes</h3>
      ${m.correo_texto || m.nota_correo || m.ref_correo ? `<div class="sop-correo"><span class="sub">Llegó por correo${m.medio ? ' · ' + esc(m.medio) : ''}</span>${esc(m.correo_texto || m.descripcion || '')}</div>` : ''}
      <div id="sop-lista" class="sub">Cargando…</div>
      <label class="btn sec mini sop-subir">+ Subir soporte (PDF, XML o foto)<input type="file" id="sop-arch" multiple accept=".pdf,.xml,.zip,image/*" hidden></label></div>` : '<p class="sub">Guarda el movimiento para poder adjuntarle soportes.</p>'}
    <div class="aviso" id="aviso"></div>
    <div class="pie-modal">${m.id ? '<button type="button" class="btn sec" id="borrar" style="margin-right:auto">Borrar</button>' : ''}<button type="button" class="btn sec" id="cancelar">Cancelar</button><button class="btn" type="submit">Guardar</button></div>
  </form>`;
  document.body.appendChild(fondo);
  const f = $('#fm', fondo);
  const pintarSubs = () => { const dl = $('#subcats', fondo); if (!dl) return; const c = cats.find(x => x.id === f.categoria_id.value); dl.innerHTML = (c?.subcategorias || []).map(n => `<option value="${esc(n)}">`).join(''); };
  if (f.categoria_id) { f.categoria_id.onchange = pintarSubs; pintarSubs(); }
  f.valor.oninput = () => { const n = f.valor.value.replace(/\D/g, ''); f.valor.value = n ? Number(n).toLocaleString('es-CO').replace(/,/g, '.') : ''; };
  $('#cancelar', fondo).onclick = () => fondo.remove();
  if (m.id) {
    const pintar = async () => {
      const l = await D.finSoportes(m.id);
      $('#sop-lista', fondo).innerHTML = l.length ? l.map(x => `<div class="sop-item"><a href="#" data-ver="${x.id}">${esc(x.nombre)}</a>${btnIco('borrar', 'Quitar soporte', `data-quitar="${x.id}"`, 'sec peligro')}</div>`).join('') : 'Sin soportes todavía.';
      fondo.querySelectorAll('[data-ver]').forEach(a => a.onclick = async ev => { ev.preventDefault(); window.open(await D.finUrlSoporte(l.find(x => x.id === a.dataset.ver).ruta), '_blank'); });
      fondo.querySelectorAll('[data-quitar]').forEach(b2 => b2.onclick = async () => { await D.finBorrarSoporte(l.find(x => x.id === b2.dataset.quitar)); pintar(); });
    };
    pintar();
    $('#sop-arch', fondo).onchange = async ev => {
      try { for (const a of ev.target.files) await D.finSubirSoporte(m.id, a); pintar(); }
      catch (err) { $('#aviso', fondo).textContent = 'No se pudo subir: ' + err.message; }
    };
  }
  const b = $('#borrar', fondo); if (b) b.onclick = async () => { if (confirm('¿Borrar este movimiento?')) { await D.finBorrarMovimiento(m.id); fondo.remove(); recargar(); } };
  f.onsubmit = async ev => {
    ev.preventDefault();
    const v = Object.fromEntries(new FormData(f));
    const reg = { tipo: m.tipo, valor: Number(v.valor.replace(/\D/g, '')), fecha: v.fecha, categoria_id: m.tipo === 'socio' ? null : v.categoria_id || null, encargo_id: v.encargo_id || null, descripcion: v.descripcion, medio: v.medio };
    if (m.id) reg.id = m.id;
    const sub = m.tipo === 'socio' ? '' : (v.subcategoria || '').trim();
    if (sub || m.subcategoria) reg.subcategoria = sub || null;   // solo si hay subcategoría (columna nueva)
    try { await D.finGuardarMovimiento(reg); fondo.remove(); recargar(); } catch (err) { $('#aviso', fondo).textContent = err.message; }
  };
}

function modalPresupuesto(cats, recargar) {
  const fondo = document.createElement('div'); fondo.className = 'modal-fondo';
  fondo.innerHTML = `<form class="modal" id="fp"><h2>Presupuesto mensual de gastos</h2><p class="sub">Déjalo vacío si una categoría no tiene tope.</p>
    <div class="tabla-cont"><table><thead><tr><th>Categoría</th><th class="num">Tope mensual (COP)</th></tr></thead><tbody>
    ${cats.map(c => `<tr><td>${esc(c.nombre)}</td><td class="num"><input class="cant ancho-p" name="${c.id}" inputmode="numeric" value="${c.presupuesto_mensual ? Number(c.presupuesto_mensual).toLocaleString('es-CO').replace(/,/g, '.') : ''}"></td></tr>`).join('')}
    </tbody></table></div>
    <div class="pie-modal"><button type="button" class="btn sec" id="cancelar">Cancelar</button><button class="btn" type="submit">Guardar</button></div></form>`;
  document.body.appendChild(fondo);
  $('#cancelar', fondo).onclick = () => fondo.remove();
  $('#fp', fondo).onsubmit = async ev => {
    ev.preventDefault();
    for (const c of cats) {
      const raw = fondo.querySelector(`[name="${c.id}"]`).value.replace(/\D/g, '');
      const val = raw ? Number(raw) : null;
      if (val !== (c.presupuesto_mensual ? Number(c.presupuesto_mensual) : null)) await D.finActualizarCategoria(c.id, { presupuesto_mensual: val });
    }
    fondo.remove(); recargar();
  };
}
