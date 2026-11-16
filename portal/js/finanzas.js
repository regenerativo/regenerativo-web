// Finanzas de regenerativo: ingresos, gastos y presupuesto de la empresa. Solo perfil de facturación.
import * as D from './datos.js?v=117';
import { cop, fecha, iso } from './formato.js?v=117';
import { btnIco, ico } from './iconos.js?v=117';
import { leerMonai } from './monai.js?v=117';

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
  marketing: '<path d="M4 10v4h3l6 4V6L7 10z"/><path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11"/>',
  oficina: '<path d="M5 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16M16 9h2a2 2 0 0 1 2 2v10M3 21h18M9 7h3M9 11h3M9 15h3"/>',
  legal: '<path d="M12 4v16M7 20h10M5 8h14M5 8l-2.5 6a3 3 0 0 0 5 0zM19 8l-2.5 6a3 3 0 0 0 5 0z"/>',
  materiales: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
  formacion: '<path d="M3 9l9-4.5L21 9l-9 4.5z"/><path d="M7 11v4.5c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5V11M21 9v5"/>',
};
const claveCat = n => { n = (n || '').toLowerCase();
  if (/marketing|publicidad|pauta|redes/.test(n)) return 'marketing';
  if (/oficina|arriendo|servicios p/.test(n)) return 'oficina';
  if (/contab|legal|tr[áa]mite|notar/.test(n)) return 'legal';
  if (/material|muestra|maqueta/.test(n)) return 'materiales';
  if (/formaci|capacita|curso/.test(n)) return 'formacion';
  return /honorario/.test(n) && !/n[óo]mina/.test(n) ? 'honorario' : /otro.*ingreso|otros/.test(n) ? 'otros' : /ingreso/.test(n) ? 'ingreso' : /n[óo]mina|recurso|salari/.test(n) ? 'nomina'
    : /herramienta/.test(n) ? 'herramienta' : /transporte/.test(n) ? 'transporte' : /vi[áa]tico|aliment/.test(n) ? 'viatico' : /deuda|banco|impuesto|cr[ée]dito/.test(n) ? 'deuda' : /suscrip/.test(n) ? 'suscripcion' : 'base'; };
// Una sola regla para el valor y el saldo de un encargo (Inicio, Finanzas, el encargo y el cliente usan esta misma):
// valor = valor base escrito en el portal (o honorarios de la propuesta) + adendas aprobadas + adicionales a mano
// recibido = ingresos confirmados del encargo · por cobrar = valor − recibido
// «Dar por saldado» es una marca a mano: deja el por cobrar en 0 pero NO es dinero recibido y se muestra distinto
export function cuentasEncargo(e, { props = [], docs = [], adics = [], movs = [] }) {
  const aprob = d => ['aprobado', 'firmado'].includes(d.estado);
  const suma = t => movs.filter(x => x.encargo_id === e.id && x.tipo === t && (x.estado || 'confirmado') === 'confirmado').reduce((a, x) => a + Number(x.valor), 0);
  const hon = e.valor_base != null ? Number(e.valor_base) : Number(props.find(p => p.encargo_id === e.id)?.honorarios) || Number(docs.filter(d => d.encargo_id === e.id && d.tipo === 'propuesta' && aprob(d)).at(-1)?.contenido?.honorarios) || 0;
  const adic = docs.filter(d => d.encargo_id === e.id && d.tipo === 'adenda' && aprob(d)).reduce((s, d) => s + (Number(d.contenido?.valor) || 0), 0)
    + adics.filter(a => a.encargo_id === e.id).reduce((s, a) => s + (Number(a.valor) || 0), 0);
  const esperado = Math.round(hon + adic), recibido = Math.round(suma('ingreso')), gastos = Math.round(suma('gasto'));
  const pagado = esperado > 0 && recibido >= esperado;
  const saldado = !pagado && !!e.pagado_total;
  return { esperado, adic, recibido, gastos, pagado, saldado, porCobrar: pagado || saldado ? 0 : Math.max(0, esperado - recibido) };
}
export const icoCat = n => `<svg class="ico-cat ic-${claveCat(n)}" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICAT[claveCat(n)]}</svg>`;

// Por confirmar: «ver todos» y el filtro de origen se mantienen al confirmar (la lista no se vuelve a cerrar)
const PEND = { todos: false, origen: '' };
const GRAF = { vista: 'anio' };   // gráfica de Finanzas: 'anio' (12 meses del año) o 'seis' (últimos 6 meses)
// De dónde viene cada movimiento: correo (lectura automática), MONAI (importación) o escrito a mano en el portal
const ORIGENES = { correo: 'Correo', monai: 'MONAI', portal: 'Portal' };
const origenDe = x => x.origen === 'correo' || x.origen === 'monai' ? x.origen : 'portal';
const chipOrigen = x => `<span class="origen o-${origenDe(x)}" title="${origenDe(x) === 'portal' ? 'Escrito a mano en el portal' : origenDe(x) === 'monai' ? 'Importado de MONAI' : 'Leído del correo'}">${ORIGENES[origenDe(x)]}</span>`;
const opsCat = (cats, tipo, sel) => tipo === 'socio' ? '<option value="">—</option>' : cats.filter(c => c.tipo === tipo).map(c => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('');

export async function vistaFinanzas(mesSel, listaSel) {
  const [cats, todos, encargos, docs, props, adicsMan] = await Promise.all([D.finCategorias(), D.finMovimientos(), D.encargos(), D.finDocumentosCobro(), D.finPropuestasEncargos().catch(() => []), D.adicionalesTodos().catch(() => [])]);
  const movs = todos.filter(x => (x.estado || 'confirmado') === 'confirmado');
  const pend = todos.filter(x => x.estado === 'por_confirmar').sort((a, b) => a.fecha < b.fecha ? 1 : -1);
  const hoy = new Date();
  // Periodo: un mes («2026-11») o el año completo («2026», al tocar el año junto al mes)
  const modoAnio = /^\d{4}$/.test(mesSel || '');
  const mes = modoAnio ? (iso(hoy).slice(0, 4) === mesSel ? iso(hoy).slice(0, 7) : `${mesSel}-12`) : mesSel && /^\d{4}-\d{2}$/.test(mesSel) ? mesSel : iso(hoy).slice(0, 7);
  const [a, m] = mes.split('-').map(Number);
  const mesTxt = modoAnio ? `Año ${a}` : `${MESES[m - 1]} ${a}`;
  const eyebrow = modoAnio ? `Todo el año ${a}` : `${MESES[m - 1]} de ${a}`;
  const anioHoy = hoy.getFullYear();
  const anioMin = Math.min(anioHoy, ...todos.map(x => Number((x.fecha || '').slice(0, 4))).filter(Boolean));
  const aniosDisp = Array.from({ length: anioHoy - anioMin + 1 }, (_, i) => anioHoy - i);
  const enPeriodo = x => modoAnio ? (x.fecha || '').slice(0, 4) === String(a) : mesDe(x.fecha) === mes;
  const lista = listaSel || 'todo';   // 'todo' | 'general' | id de encargo
  const enLista = x => lista === 'todo' || (lista === 'general' ? !x.encargo_id : x.encargo_id === lista);
  const delMes = movs.filter(x => enPeriodo(x) && enLista(x));
  const suma = (l, t) => l.filter(x => x.tipo === t).reduce((s, x) => s + Number(x.valor), 0);
  const SALARIO = cats.find(c => c.nombre === 'Nómina y honorarios')?.id;
  const esSal = x => x.categoria_id === SALARIO;
  const ing = suma(delMes, 'ingreso'), gas = suma(delMes.filter(x => !esSal(x)), 'gasto'), sal = suma(delMes.filter(esSal), 'gasto');

  // Valor de cada encargo: honorarios de la propuesta (o del documento web) + adendas aprobadas; menos lo recibido
  const porEnc = encargos.map(e => ({ e, ...cuentasEncargo(e, { props, docs, adics: adicsMan, movs }) }));
  const porCobrar = porEnc.reduce((s, r) => s + r.porCobrar, 0);

  // Últimos 6 meses
  const meses = Array.from({ length: 6 }, (_, i) => { const d = new Date(a, m - 1 - (5 - i), 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });
  const serie = meses.map(k => ({ k, ing: suma(movs.filter(x => mesDe(x.fecha) === k && enLista(x)), 'ingreso'), gas: suma(movs.filter(x => mesDe(x.fecha) === k && !esSal(x) && enLista(x)), 'gasto') }));

  // Todo el año del mes elegido: ingresos y egresos (gastos + salario) de cada mes
  const mesesAnio = Array.from({ length: 12 }, (_, i) => `${a}-${String(i + 1).padStart(2, '0')}`);
  const serieAnio = mesesAnio.map(k => { const l = movs.filter(x => mesDe(x.fecha) === k && enLista(x)); return { k, ing: suma(l, 'ingreso'), gas: suma(l, 'gasto') }; });
  const totAnio = serieAnio.reduce((t, x) => ({ ing: t.ing + x.ing, gas: t.gas + x.gas }), { ing: 0, gas: 0 });
  const nc = v => cop(v).replace(' COP', '');   // en la tabla del año el COP va en el encabezado
  const tablaAnio = `<div class="tabla-cont"><table class="t-compacta t-anio"><thead><tr><th>Mes</th><th class="num">Ingresos</th><th class="num">Egresos</th><th class="num">Balance <span class="sub">COP</span></th></tr></thead><tbody>
    ${serieAnio.map(x => { const [, mm] = x.k.split('-').map(Number); const b = x.ing - x.gas; const vacio = !x.ing && !x.gas;
      return `<tr class="clic${x.k === mes && !modoAnio ? ' mes-actual' : ''}${vacio ? ' mes-vacio' : ''}" data-ir-mes="${x.k}"><td><span class="m-largo">${MESES[mm - 1]}</span><span class="m-corto">${MESES[mm - 1].slice(0, 3)}</span></td><td class="num ingreso">${x.ing ? nc(x.ing) : '—'}</td><td class="num gasto">${x.gas ? nc(x.gas) : '—'}</td><td class="num ${b < 0 ? 'xxx' : ''}">${vacio ? '—' : (b < 0 ? '−' : '') + nc(Math.abs(b))}</td></tr>`; }).join('')}
    <tr class="total"><td>Total ${a}</td><td class="num">${nc(totAnio.ing)}</td><td class="num">${nc(totAnio.gas)}</td><td class="num ${totAnio.ing - totAnio.gas < 0 ? 'xxx' : ''}">${totAnio.ing - totAnio.gas < 0 ? '−' : ''}${nc(Math.abs(totAnio.ing - totAnio.gas))}</td></tr></tbody></table></div>`;

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
  const listas = [['todo', 'General'], ['general', 'Gastos generales (sin proyecto)'], ...encargos.map(e => [e.id, e.nombre])];
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
            <label class="per-sel"><span>Año</span><select id="sel-anio" aria-label="Año">${aniosDisp.map(y => `<option value="${y}" ${y === a ? 'selected' : ''}>${y}</option>`).join('')}</select></label>
            <label class="per-sel"><span>Mes</span><select id="sel-mes" aria-label="Mes"><option value="" ${modoAnio ? 'selected' : ''}>Todo el año</option>${MESES.map((n, i) => `<option value="${String(i + 1).padStart(2, '0')}" ${!modoAnio && i + 1 === m ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
            <label class="per-sel per-proy"><span>Proyecto</span>            <select id="lista">${listas.map(([v, n]) => `<option value="${v}" ${v === lista ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
          </div>
        </div>
        <div class="mon-cols">${colsIng.map(c => {
          const hI = Math.max(c.recibido ? 8 : 0, c.recibido / maxCat * H);
          return `<button class="mon-col ing" data-cat="${c.id}" data-sub="${esc(c.sub)}" data-tipo="ingreso" title="Ver ingresos de ${esc(c.nombre)}">
            <div class="mon-barra" style="height:${H}px"><div class="mon-gasto mon-ingreso" style="height:${hI}px"></div></div>
            <div class="mon-ico">${icoCat(c.nombre)}</div>
            <div class="mon-val">${compacto(c.recibido)}</div>
            <div class="mon-pct">ingreso</div>
            <div class="mon-nom">${esc(c.nombre)}</div></button>`;
        }).join('')}${colsIng.length ? '<span class="mon-sep" aria-hidden="true"></span>' : ''}${catsGasto.map(c => {
          const p = Number(c.presupuesto_mensual || 0), exc = p && c.gastado > p;
          const hP = p / maxCat * H, hG = Math.max(c.gastado ? 8 : 0, c.gastado / maxCat * H);
          return `<button class="mon-col" data-cat="${c.id}" title="Ver gastos de ${esc(c.nombre)}">
            <div class="mon-barra" style="height:${H}px">${p ? `<div class="mon-pres" style="height:${hP}px"></div>` : ''}<div class="mon-gasto ${exc ? 'exc' : ''}" style="height:${hG}px"></div></div>
            <div class="mon-ico">${icoCat(c.nombre)}</div>
            <div class="mon-val">${compacto(c.gastado)}</div>
            <div class="mon-pct ${exc ? 'xxx' : ''}">${p ? Math.round(c.gastado / p * 100) + ' %' : '—'}</div>
            <div class="mon-nom">${esc(c.nombre)}</div></button>`;
        }).join('')}</div>
        ${desglose.length ? `<div class="mon-sub">${desglose.map(d => `<div class="ms-fila"><span class="ms-cat">${icoCat(d.nombre)} ${esc(d.nombre)}</span><span class="ms-chips">${d.subs.map(([n, v]) => `<span class="ms-chip">${esc(n)} <b>${compacto(v)}</b></span>`).join('')}</span></div>`).join('')}</div>` : ''}
        <p class="sub mon-ley">Ingresos &nbsp; <span class="ley-pres"></span>Presupuesto del mes &nbsp; <span class="ley-gas"></span>Gastado${presTotal ? ` &nbsp;·&nbsp; ${Math.round(gas / presTotal * 100)} % del presupuesto` : ''}</p>
        <div class="mon-mas">${pend.length ? `<a class="pend-aviso" href="#por-confirmar">${pend.length} por confirmar</a>` : ''}<button class="btn sec mini" id="importar-monai" hidden style="display:none">Importar MONAI</button><button class="btn sec mini btn-ing" data-nuevo="ingreso">+ Ingreso</button><button class="btn mini btn-gas" data-nuevo="gasto">+ Gasto</button></div>
      </section>
      <section class="panel fin-lado">
        <div class="od-cab"><h3>Movimientos del ${modoAnio ? 'año' : 'mes'}</h3><span class="sub">${delMes.length}</span></div>
        ${delMes.length > 3 ? '<input type="search" id="buscar-mov" class="buscar-mov" placeholder="Buscar: concepto, categoría, encargo, valor…">' : ''}
        ${delMes.length ? `<div class="lista-filas">${delMes.map(x => `<button class="mov-fila" data-editar="${x.id}" data-buscar="${esc([x.descripcion, x.categoria?.nombre, x.subcategoria, x.encargo?.nombre, x.medio, x.valor].join(' ').toLowerCase())}">
          <span class="mov-ico ${x.tipo}">${icoCat(x.tipo === 'socio' ? 'nómina' : x.tipo === 'ingreso' ? (x.subcategoria || x.categoria?.nombre || 'ingreso') : x.categoria?.nombre)}</span>
          <span class="mov-txt"><b>${esc(x.descripcion || '')}</b><span class="sub">${chipOrigen(x)} ${fecha(x.fecha)} · ${esc(x.categoria?.nombre || (x.tipo === 'socio' ? 'Personal / socio' : ''))}${subDe(x) ? ' › ' + esc(subDe(x)) : ''}</span></span>
          <span class="mov-der"><span class="mov-val ${x.tipo}">${signo(x)} ${cop(x.valor)}</span><span class="mov-proy${x.encargo_id ? '' : ' general'}" title="${esc(x.encargo?.nombre || 'Regenerativo (general)')}">${x.encargo_id ? esc((x.encargo?.nombre || '').replace(/^\s*\d{2}\s+I\s+/, '')) : 'General'}</span></span></button>`).join('')}</div>`
        : `<p class="sub">No hay movimientos ${modoAnio ? 'este año' : 'este mes'} en esta lista.</p>`}
      </section>
    </div>
    <div class="fin-grid">
      <section class="panel panel-anio"><div class="od-cab"><h3>Ingresos y egresos</h3><span class="graf-vistas" role="group" aria-label="Periodo"><button type="button" class="chip-f${GRAF.vista === 'anio' ? ' on' : ''}" data-graf="anio">Año ${a}</button><button type="button" class="chip-f${GRAF.vista === 'seis' ? ' on' : ''}" data-graf="seis">6 meses</button></span></div>
        ${GRAF.vista === 'anio' ? barras(serieAnio, 'Egresos') + tablaAnio : barras(serie)}</section>
      <section class="panel"><h3>Por cobrar</h3><div class="cifra-grande">${cop(porCobrar)}</div><p class="sub">${porEnc.filter(r => r.porCobrar > 0).length} encargos con saldo · valor de propuestas y adicionales menos lo recibido</p>
        <div class="lista-filas">${porEnc.filter(r => r.esperado && !r.pagado && !r.saldado).map(r => `<button class="mov-fila" data-lista="${r.e.id}"><span class="mov-txt"><b>${esc(r.e.nombre)}</b><span class="barra"><i style="width:${Math.min(100, r.recibido / r.esperado * 100)}%"></i></span></span><span class="mov-val">${cop(r.porCobrar)}</span></button>`).join('')}</div>
      </section>
    </div>
    <section class="panel"><h3>Encargos</h3>
      ${porEnc.length ? `<div class="tabla-cont"><table class="t-compacta"><thead><tr><th>Encargo</th><th class="num">Valor</th><th class="num">Recibido</th><th class="num">Por cobrar</th><th class="num col-opc">Gastos</th><th class="col-opc">Pago</th></tr></thead><tbody>
      ${porEnc.map(r => `<tr class="clic" data-ir-enc="${D.slugEncargo(r.e)}" title="Abrir las finanzas de ${esc(r.e.nombre)}"><td><b>${esc(r.e.nombre)}</b>${r.adic ? `<div class="sub">Incluye ${cop(r.adic)} en adicionales</div>` : ''}${r.pagado || !r.esperado ? '' : `<div class="solo-movil"><button type="button" class="btn mini pago-tog${r.saldado ? ' on' : ''}" data-pagado="${r.e.id}">${r.saldado ? '✓ Saldado' : 'Dar por saldado'}</button></div>`}</td><td class="num"><button type="button" class="valor-ed" data-valor="${r.e.id}" title="Editar valor, adicionales e ingresos">${r.esperado || (r.e.valor_base != null && Number(r.e.valor_base) === 0) ? cop(r.esperado) : 'Escribir valor'}<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/></svg></button></td><td class="num">${cop(r.recibido)}</td><td class="num">${r.pagado ? '<span class="etiqueta despego">Pagado</span>' : r.saldado ? `<span class="etiqueta saldado" title="Se dio por saldado a mano: faltan ${cop(r.esperado - r.recibido)} por registrar como ingreso">Saldado sin abono registrado</span>` : cop(r.porCobrar)}</td><td class="num col-opc">${cop(r.gastos)}</td><td class="col-opc">${!r.esperado ? '<span class="sub">Sin costo</span>' : r.pagado ? '<span class="sub">Cobrado completo</span>' : `<button type="button" class="btn mini pago-tog${r.saldado ? ' on' : ''}" data-pagado="${r.e.id}" title="${r.saldado ? 'Quitar la marca: vuelve a contar lo que falta por cobrar' : 'Dar por saldado sin registrar ingreso (por ejemplo, un pago que no pasó por las cuentas). No crea un ingreso.'}">${r.saldado ? '✓ Saldado' : 'Dar por saldado'}</button>`}</td></tr>`).join('')}
      <tr class="total"><td>Total</td><td class="num">${cop(porEnc.reduce((a, r) => a + r.esperado, 0))}</td><td class="num">${cop(porEnc.reduce((a, r) => a + r.recibido, 0))}</td><td class="num">${cop(porCobrar)}</td><td class="num col-opc">${cop(porEnc.reduce((a, r) => a + r.gastos, 0))}</td><td class="col-opc"></td></tr>
      </tbody></table></div>` : '<p class="sub">Sin encargos.</p>'}
    </section>
    ${!pend.length ? `<section class="pend" id="por-confirmar"><div class="pend-cab"><h3>Por confirmar${D.SIN_CORREO ? '' : ' <span class="pend-n">0</span>'}</h3><span class="sub">Lo que llega por correo queda aquí hasta que lo apruebes con ✓; mientras tanto no cuenta en los totales. ${D.SIN_CORREO ? 'Esta vista previa no puede leer los pendientes del correo: en el portal real aparecen todos aquí.' : 'No hay movimientos pendientes.'}</span></div></section>` : ''}
    ${pend.length ? `<section class="pend" id="por-confirmar">
      <div class="pend-cab"><h3>Por confirmar <span class="pend-n">${pend.length}</span></h3><span class="sub">Elige tipo, categoría y a qué pertenece. No cuentan en los totales hasta que les des ✓.</span></div>
      <div class="pend-filtro" role="group" aria-label="Filtrar por origen"><button type="button" class="chip-f${PEND.origen ? '' : ' on'}" data-origen="">Todos <b>${pend.length}</b></button>${Object.entries(ORIGENES).map(([k, t]) => { const n = pend.filter(x => origenDe(x) === k).length; return n ? `<button type="button" class="chip-f${PEND.origen === k ? ' on' : ''}" data-origen="${k}"><span class="origen o-${k}">${t}</span> <b>${n}</b></button>` : ''; }).join('')}</div>
      ${pend.map((x, i) => `<div class="pend-fila ${i >= 6 && !PEND.todos && !PEND.origen ? 'pend-oculta' : ''}" data-pend="${x.id}" data-org="${origenDe(x)}" ${PEND.origen && origenDe(x) !== PEND.origen ? 'hidden' : ''}>
        <div class="pend-txt"><span class="sub">${chipOrigen(x)} ${fecha(x.fecha)}${x.medio ? ' · ' + esc(x.medio) : ''}${x.subcategoria ? ' · ' + esc(x.subcategoria) : ''}</span><b>${esc(x.descripcion || '')}</b>${x.nota_correo ? `<span class="pend-nota">${esc(x.nota_correo)}</span>` : ''}</div>
        <div class="pend-val ${x.tipo}">${signo(x)} ${cop(x.valor)}</div>
        <div class="pend-sel">
          <select data-f="tipo"><option value="gasto" ${x.tipo === 'gasto' ? 'selected' : ''}>Gasto de la empresa</option><option value="ingreso" ${x.tipo === 'ingreso' ? 'selected' : ''}>Ingreso</option><option value="socio" ${x.tipo === 'socio' ? 'selected' : ''}>Personal / socio (no cuenta)</option></select>
          <select data-f="categoria_id">${opsCat(cats, x.tipo, x.categoria_id)}</select>
          <select data-f="encargo_id"><option value="">Regenerativo (general)</option>${encargos.map(e => `<option value="${e.id}" ${e.id === x.encargo_id ? 'selected' : ''}>${esc(e.nombre)}</option>`).join('')}</select>
        </div>
        <div class="pend-acc">${btnIco('check', 'Confirmar', 'data-ok', '')}${btnIco('x', 'Descartar (no es un movimiento real)', 'data-no')}</div>
      </div>`).join('')}
      ${pend.length > 6 && !PEND.todos && !PEND.origen ? `<button class="btn sec mini pend-mas" id="pend-mas">Ver los ${pend.length - 6} restantes</button>` : ''}
    </section>` : ''}`;

  // Lo que se está viendo, para la esquina superior derecha: General o el proyecto elegido
  const encSel = encargos.find(e => e.id === lista);
  const vista = encSel ? { txt: encSel.nombre.replace(/^\s*\d{2}\s+I\s+/, ''), cls: 'proy', titulo: encSel.nombre } : lista === 'general' ? { txt: 'Gastos generales', cls: 'general', titulo: 'Solo lo que no pertenece a ningún proyecto' } : { txt: 'General', cls: 'general', titulo: 'Todo regenerativo' };
  return { html, mes, mesTxt, eyebrow, vista, montar: recargar => {
    document.querySelectorAll('[data-nuevo]').forEach(b => b.onclick = () => modalMov({ tipo: b.dataset.nuevo, fecha: iso(new Date()), encargo_id: ['todo', 'general'].includes(lista) ? null : lista }, cats, encargos, recargar));
    document.querySelectorAll('[data-editar]').forEach(b => b.onclick = () => modalMov(movs.find(x => x.id === b.dataset.editar), cats, encargos, recargar));
    document.querySelectorAll('[data-origen]').forEach(b => b.onclick = () => {
      document.querySelectorAll('[data-origen]').forEach(x => x.classList.toggle('on', x === b));
      const o = b.dataset.origen, pmx = $('#pend-mas'); if (pmx) pmx.remove(); PEND.origen = o; PEND.todos = true;
      document.querySelectorAll('.pend-fila').forEach(f => { f.classList.remove('pend-oculta'); f.hidden = !!o && f.dataset.org !== o; });
    });
    const pm = $('#pend-mas'); if (pm) pm.onclick = () => { PEND.todos = true; document.querySelectorAll('.pend-oculta').forEach(f => f.classList.remove('pend-oculta')); pm.remove(); };
    const pa = $('.pend-aviso'); if (pa) pa.onclick = ev => { ev.preventDefault(); $('#por-confirmar').scrollIntoView({ behavior: 'smooth' }); };
    let tPend = null;
    const salir = fila => {
      fila.remove();
      const n = document.querySelectorAll('.pend-fila').length, cn = $('.pend-n'); if (cn) cn.textContent = n;
      const sig = document.querySelector('.pend-fila.pend-oculta'); if (sig && document.querySelectorAll('.pend-fila:not(.pend-oculta)').length < 6) sig.classList.remove('pend-oculta');
      // los totales y gráficas se recalculan cuando dejas de confirmar un momento, sin mover la página
      clearTimeout(tPend); tPend = setTimeout(async () => { if (document.querySelector('.modal-fondo') || document.activeElement?.closest?.('.pend-fila')) return; const y = scrollY; await recargar(); scrollTo(0, y); }, 2500);
    };
    document.querySelectorAll('[data-pend]').forEach(fila => {
      const sel = n => fila.querySelector(`[data-f="${n}"]`);
      sel('tipo').onchange = () => { sel('categoria_id').innerHTML = opsCat(cats, sel('tipo').value); sel('categoria_id').disabled = sel('tipo').value === 'socio'; };
      sel('categoria_id').disabled = sel('tipo').value === 'socio';
      fila.querySelector('[data-ok]').onclick = async () => {
        fila.querySelectorAll('button').forEach(b => b.disabled = true);
        const t = sel('tipo').value;
        await D.finGuardarMovimiento({ id: fila.dataset.pend, estado: 'confirmado', tipo: t, categoria_id: t === 'socio' ? null : sel('categoria_id').value || null, encargo_id: sel('encargo_id').value || null,
          ...((sel('categoria_id').value || null) !== (pend.find(x => x.id === fila.dataset.pend)?.categoria_id || null) ? { subcategoria: null } : {}) });   // si cambió la categoría, la subcategoría vieja ya no aplica
        salir(fila);
      };
      fila.querySelector('[data-no]').onclick = async () => { await D.finGuardarMovimiento({ id: fila.dataset.pend, estado: 'descartado' }); salir(fila); };
    });
    const be = $('#borrar-ej'); if (be) be.onclick = async () => { if (confirm('¿Borrar todos los movimientos de ejemplo?')) { await D.finBorrarEjemplos(); recargar(); } };
    // Engranaje de la cabecera: presupuesto del mes, categorías e importación de MONAI
    const bg = $('#fin-ajustes'); if (bg) bg.onclick = () => {
      const f = document.createElement('div'); f.className = 'modal-fondo';
      f.innerHTML = `<div class="modal modal-opciones" role="dialog" aria-label="Ajustes de finanzas"><div class="aj-cab"><div><h2>Ajustes de finanzas</h2><p class="sub">${esc(mesTxt)}</p></div>${btnIco('x', 'Cerrar', 'data-cerrar')}</div>
        <div class="aj-rapidos">
          <button type="button" class="aj-rap" data-op="pres"><span>${ico('excel')}</span><b>Presupuesto del mes</b><small>Cuánto se planea gastar en cada categoría</small></button>
          <button type="button" class="aj-rap" data-op="cats"><span>${ico('editar')}</span><b>Categorías</b><small>Nombres y subcategorías de ingresos y gastos</small></button>
          <button type="button" class="aj-rap" data-op="monai"><span>${ico('subir')}</span><b>Importar MONAI</b><small>Subir la exportación CSV de MONAI</small></button>
        </div></div>`;
      const cerrar = () => { f.remove(); removeEventListener('hashchange', cerrar); };
      addEventListener('hashchange', cerrar);
      f.onclick = ev => { if (ev.target === f || ev.target.closest('[data-cerrar]')) return cerrar();
        const op = ev.target.closest('[data-op]')?.dataset.op; if (!op) return; cerrar();
        if (op === 'pres') modalPresupuesto(cats.filter(c => c.tipo === 'gasto'), recargar);
        if (op === 'cats') modalCategorias(recargar);
        if (op === 'monai') $('#importar-monai')?.click(); };
      document.body.appendChild(f);
    };
    $('#importar-monai').onclick = () => modalMonai(recargar);
    const bm = $('#buscar-mov'); if (bm) bm.oninput = () => { const t = bm.value.toLowerCase().trim(); document.querySelectorAll('.mov-fila[data-buscar]').forEach(f => { f.hidden = !!t && !f.dataset.buscar.includes(t); }); };
    document.querySelectorAll('[data-cat]').forEach(x => x.onclick = () => {
      const tipo = x.dataset.tipo || 'gasto', sub = x.dataset.sub || '', cat = cats.find(c => c.id === x.dataset.cat);
      const nuevo = { tipo, fecha: iso(new Date()), categoria_id: x.dataset.cat, ...(sub ? { subcategoria: sub } : {}), encargo_id: ['todo', 'general'].includes(lista) ? null : lista };
      const subs = (cat?.subcategorias || []);
      const lst = delMes.filter(m => m.tipo === tipo && m.categoria_id === x.dataset.cat && (tipo !== 'ingreso' || !subs.length || (sub ? m.subcategoria === sub : !subs.slice(1).includes(m.subcategoria))))
        .sort((a, b) => a.fecha < b.fecha ? 1 : -1);
      const tot = lst.reduce((t, m) => t + Number(m.valor), 0);
      const fondo = document.createElement('div'); fondo.className = 'modal-fondo';
      fondo.innerHTML = `<div class="modal modal-cat"><div class="mc-cab"><span class="mc-ico ${tipo}">${icoCat(sub || cat?.nombre)}</span><div><span class="lv-ceja">${tipo === 'ingreso' ? 'Ingresos' : 'Gastos'} · ${mesTxt}</span><h2>${esc(sub || cat?.nombre || '')}</h2></div><b class="mc-tot ${tipo}">${tipo === 'ingreso' ? '+' : '−'} ${cop(tot)}</b></div>
        ${lst.length ? `<div class="tabla-cont"><table class="t-compacta"><thead><tr><th>Fecha</th><th>Concepto</th><th class="col-opc">Encargo</th><th class="col-opc">Medio</th><th class="num">Valor</th></tr></thead><tbody>
          ${lst.map(m => `<tr class="clic" data-ed="${m.id}"><td>${esc(m.fecha.split('-').reverse().join('/'))}</td><td>${esc(m.descripcion || subDe(m) || '—')}</td><td class="col-opc">${esc(encargos.find(e => e.id === m.encargo_id)?.nombre || 'General')}</td><td class="col-opc">${esc(m.medio || '—')}</td><td class="num">${cop(m.valor)}</td></tr>`).join('')}
          </tbody></table></div>` : `<p class="sub">No hay ${tipo === 'ingreso' ? 'ingresos' : 'gastos'} en ${esc(sub || cat?.nombre || '')} este mes.</p>`}
        <div class="pie-modal"><button type="button" class="btn sec" data-cerrar>Cerrar</button><button type="button" class="btn" data-agregar><span class="mas">+</span> ${tipo === 'ingreso' ? 'Ingreso' : 'Gasto'}</button></div></div>`;
      document.body.appendChild(fondo);
      fondo.onclick = ev => { if (ev.target === fondo || ev.target.closest('[data-cerrar]')) fondo.remove(); };
      fondo.querySelector('[data-agregar]').onclick = () => { fondo.remove(); modalMov(nuevo, cats, encargos, recargar); };
      fondo.querySelectorAll('[data-ed]').forEach(r => r.onclick = () => { fondo.remove(); modalMov(movs.find(m => m.id === r.dataset.ed), cats, encargos, recargar); });
    });
    document.querySelectorAll('[data-pagado]').forEach(b => b.onclick = async ev => { ev.stopPropagation(); const e = encargos.find(x => x.id === b.dataset.pagado); b.disabled = true; await D.actualizarEncargo(e.id, { pagado_total: !e.pagado_total }); recargar(); });
    document.querySelectorAll('[data-valor]').forEach(b => b.onclick = ev => { ev.stopPropagation(); const e = encargos.find(x => x.id === b.dataset.valor);
      window.regModalValores?.(e, props.find(p => p.encargo_id === e.id) || null, recargar); });
    // Tabla de encargos: cada fila lleva a las finanzas de ese encargo (los botones de valor y saldado siguen funcionando en el sitio)
    document.querySelectorAll('[data-ir-enc]').forEach(f => f.onclick = ev => { if (ev.target.closest('button, a, input, select')) return; location.hash = `#/${f.dataset.irEnc}/finanzas`; scrollTo(0, 0); });
    document.querySelectorAll('[data-lista]').forEach(f => f.onclick = () => { location.hash = `#/finanzas/${modoAnio ? a : mes}/${f.dataset.lista}`; scrollTo(0, 0); });
    const irPeriodo = () => { const y = $('#sel-anio').value, mm = $('#sel-mes').value; location.hash = `#/finanzas/${mm ? `${y}-${mm}` : y}/${$('#lista').value}`; };
    $('#sel-anio').onchange = irPeriodo; $('#sel-mes').onchange = irPeriodo; $('#lista').onchange = irPeriodo;
    document.querySelectorAll('[data-graf]').forEach(b => b.onclick = () => { GRAF.vista = b.dataset.graf; const y = scrollY; recargar(); requestAnimationFrame(() => scrollTo(0, y)); });
    document.querySelectorAll('[data-ir-mes]').forEach(tr => tr.onclick = () => { location.hash = `#/finanzas/${tr.dataset.irMes}/${lista}`; scrollTo(0, 0); });
    document.querySelectorAll('.g-col').forEach(col => {
      col.onmouseenter = () => { const t = $('#tip-fin'); t.innerHTML = col.dataset.tip; t.style.display = 'block'; };
      col.onmousemove = ev => { const t = $('#tip-fin'), r = col.closest('.graf').getBoundingClientRect(); t.style.left = (ev.clientX - r.left + 12) + 'px'; t.style.top = (ev.clientY - r.top - 10) + 'px'; };
      col.onmouseleave = () => { $('#tip-fin').style.display = 'none'; };
    });
  } };
}

function barras(serie, nomGas = 'Gastos') {
  const max = Math.max(1, ...serie.flatMap(s => [s.ing, s.gas]));
  const H = 220;
  return `<div class="graf">
    <div class="leyenda-fin"><span><i style="background:${C_ING}"></i>Ingresos</span><span><i style="background:${C_GAS}"></i>${nomGas}</span></div>
    <div class="graf-area" style="height:${H + 26}px">
      ${[0.5, 1].map(f => `<div class="graf-guia" style="bottom:${26 + H * f}px"><span>${compacto(max * f)}</span></div>`).join('')}
      <div class="graf-cols">${serie.map(s => {
        const [y, mm] = s.k.split('-').map(Number);
        return `<div class="g-col" data-tip="<b>${MESES[mm - 1]} ${y}</b><br>Ingresos ${cop(s.ing)}<br>${nomGas} ${cop(s.gas)}<br>Balance ${cop(s.ing - s.gas)}">
          <div class="g-par" style="height:${H}px"><span style="height:${s.ing / max * H}px;background:${C_ING}"></span><span style="height:${s.gas / max * H}px;background:${C_GAS}"></span></div>
          <div class="g-mes"><span class="gm-l">${MESES[mm - 1].slice(0, 3)}</span><span class="gm-c">${MESES[mm - 1][0].toUpperCase()}</span></div></div>`;
      }).join('')}</div>
      <div id="tip-fin" class="tip-fin"></div>
    </div></div>`;
}

export function modalMov(m, cats, encargos, recargar, alCancelar) {
  const fondo = document.createElement('div'); fondo.className = 'modal-fondo';
  const opsCat = t => cats.filter(c => c.tipo === t).map(c => `<option value="${c.id}" ${c.id === m.categoria_id ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('');
  fondo.innerHTML = `<form class="modal" id="fm">
    <h2>${m.id ? 'Editar' : 'Nuevo'} ${m.tipo === 'ingreso' ? 'ingreso' : m.tipo === 'socio' ? 'movimiento personal / socio' : 'gasto'}</h2>
    <div class="grilla-form">
      <div><label>Valor (COP)</label><input name="valor" inputmode="numeric" required value="${m.valor ? Number(m.valor).toLocaleString('es-CO').replace(/,/g, '.') : ''}"></div>
      <div><label>Fecha</label><input name="fecha" type="date" required value="${m.fecha || ''}"></div>
      ${m.tipo === 'socio' ? '' : `<div><label>Categoría</label><select name="categoria_id">${opsCat(m.tipo)}</select></div>
      <div><label>Subcategoría</label><select name="subcategoria"></select></div>`}
      <div class="ancho"><label>Pertenece a</label><select name="encargo_id"><option value="">Regenerativo (general)</option>${[['Encargos vigentes', encargos.filter(e => !['finalizado', 'cerrado'].includes(e.estado))], ['Finalizados y cancelados', encargos.filter(e => ['finalizado', 'cerrado'].includes(e.estado))]].filter(([, l]) => l.length).map(([g, l]) => `<optgroup label="${g}">${l.map(e => `<option value="${e.id}" ${e.id === m.encargo_id ? 'selected' : ''}>${esc(e.nombre)}</option>`).join('')}</optgroup>`).join('')}</select>
        <p class="sub" style="margin:4px 0 0">${m.tipo === 'gasto' ? 'Si el gasto es de un proyecto, elígelo: se descuenta de ese encargo y aparece en su módulo de Finanzas.' : 'Si el ingreso es de un proyecto, elígelo: cuenta como abono de ese encargo.'}</p></div>
      <div class="ancho"><label>Concepto</label><input name="descripcion" value="${esc(m.descripcion || '')}" placeholder="${m.tipo === 'ingreso' ? 'Pago 50% al iniciar' : 'Taxi visita de obra'}"></div>
      <div><label>Medio de pago</label><input name="medio" list="medios" value="${esc(m.medio || '')}" placeholder="Transferencia, efectivo…"><datalist id="medios"><option value="Transferencia"><option value="Efectivo"><option value="Consignación"><option value="Tarjeta"><option value="Nequi"><option value="Daviplata"></datalist></div>
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
  // Subcategorías de la categoría elegida (las mismas de MONAI); se conserva la que ya tenía aunque no esté en la lista
  // Subcategorías de la categoría elegida (las mismas de MONAI). Al cambiar de categoría se reinicia a una válida.
  const subsDe = () => cats.find(x => x.id === f.categoria_id.value)?.subcategorias || [];
  const pintarSubs = (inicial = false) => { const sel = f.subcategoria; if (!sel) return; const l = [...subsDe()];
    const actual = inicial ? (m.subcategoria || '') : '';
    if (inicial && actual && !l.includes(actual)) l.push(actual);   // un movimiento viejo conserva la suya hasta que la cambies
    sel.innerHTML = (l.length ? '' : '<option value="">Sin subcategoría</option>') + l.map(n => `<option value="${esc(n)}" ${n === actual ? 'selected' : ''}>${esc(n)}</option>`).join('');
    if (!actual && l.length) sel.value = l[0]; };
  if (f.categoria_id) { f.categoria_id.onchange = () => pintarSubs(false); pintarSubs(true); }
  f.valor.oninput = () => { const n = f.valor.value.replace(/\D/g, ''); f.valor.value = n ? Number(n).toLocaleString('es-CO').replace(/,/g, '.') : ''; };
  $('#cancelar', fondo).onclick = () => { fondo.remove(); alCancelar?.(); };
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
    if (sub && f.categoria_id && subsDe().length && !subsDe().includes(sub) && sub !== m.subcategoria) { $('#aviso', fondo).textContent = 'Revisa la subcategoría: no pertenece a la categoría elegida.'; return; }
    if (sub || m.subcategoria) reg.subcategoria = sub || null;   // solo si hay subcategoría (columna nueva)
    try { await D.finGuardarMovimiento(reg); fondo.remove(); recargar(); } catch (err) { $('#aviso', fondo).textContent = err.message; }
  };
}

// Importar la exportación CSV de MONAI: primero muestra qué cambia, luego aplica. Reimportar no duplica (cada fila lleva su id de MONAI)
function modalMonai(recargar) {
  const fondo = document.createElement('div'); fondo.className = 'modal-fondo';
  fondo.innerHTML = `<div class="modal ancho modal-monai"><h2>Importar desde MONAI</h2>
    <p class="sub">En MONAI: Ajustes › Exportar › CSV. Sube aquí el archivo: el portal agrega lo nuevo, actualiza lo que cambió y quita lo que borraste en MONAI. El encargo y el medio de pago que pongas en el portal se conservan.</p>
    <label class="monai-arch"><input type="file" accept=".csv,text/csv" id="monai-arch"><span>Elegir archivo CSV</span></label>
    <div id="monai-res"></div><div class="aviso" id="monai-aviso"></div>
    <div class="pie-modal"><button type="button" class="btn sec" id="monai-cerrar">Cerrar</button><button type="button" class="btn" id="monai-aplicar" disabled>Importar</button></div></div>`;
  document.body.appendChild(fondo);
  let filas = null;
  const av = t => { $('#monai-aviso', fondo).textContent = t; };
  const lista = (t, l, f) => l.length ? `<details class="monai-det"><summary>${t} (${l.length})</summary><ul>${l.map(f).join('')}</ul></details>` : '';
  const fila = x => `<li><span>${fecha(x.fecha)}</span><b>${esc(x.descripcion || '')}</b><span class="num">${x.tipo === 'ingreso' ? '+' : '−'} ${cop(x.valor)}</span></li>`;
  const resumen = r => `<ul class="monai-res">
      <li><b>${r.filas}</b>movimientos en el archivo</li><li><b>${r.nuevos}</b>nuevos</li><li><b>${r.cambios}</b>con cambios</li>
      <li><b>${r.eliminados}</b>borrados en MONAI</li><li><b>${r.duplicados_correo}</b>repetidos del correo</li></ul>
    ${r.sin_categoria ? `<p class="aviso">${r.sin_categoria} movimientos no tienen una categoría equivalente en el portal.</p>` : ''}
    ${lista('Nuevos', r.detalle_nuevos || [], fila)}${lista('Se quitan (ya no están en MONAI)', r.detalle_eliminados || [], fila)}
    ${lista('Del correo que ya están en MONAI (se descartan para no contar doble)', r.detalle_duplicados || [], x => fila({ ...x, tipo: 'gasto' }))}`;
  $('#monai-arch', fondo).onchange = async ev => {
    const a = ev.target.files[0]; if (!a) return; av(''); $('#monai-res', fondo).innerHTML = '<p class="sub">Revisando…</p>';
    try {
      const { movs, desconocidas } = leerMonai(await a.text()); filas = movs;
      if (desconocidas.length) av('Categorías de MONAI sin equivalente (se omiten): ' + desconocidas.join(', '));
      const r = await D.finImportarMonai(filas, false);
      $('#monai-res', fondo).innerHTML = resumen(r);
      $('#monai-aplicar', fondo).disabled = !(r.nuevos || r.cambios || r.eliminados || r.duplicados_correo);
      if ($('#monai-aplicar', fondo).disabled) av('Todo está al día: no hay nada que importar.');
    } catch (err) { $('#monai-res', fondo).innerHTML = ''; av(err.message); }
  };
  $('#monai-aplicar', fondo).onclick = async ev => {
    const b = ev.target; b.disabled = true; b.textContent = 'Importando…';
    try { const r = await D.finImportarMonai(filas, true); fondo.remove(); recargar();
      setTimeout(() => alert(`Listo: ${r.nuevos} nuevos, ${r.cambios} actualizados, ${r.eliminados} quitados, ${r.duplicados_correo} repetidos del correo descartados.`), 50); }
    catch (err) { av(err.message); b.disabled = false; b.textContent = 'Importar'; }
  };
  $('#monai-cerrar', fondo).onclick = () => fondo.remove();
}

// Categorías y subcategorías de ingresos y gastos, editables en el portal
async function modalCategorias(recargar) {
  const fondo = document.createElement('div'); fondo.className = 'modal-fondo';
  const pintar = async () => {
    const cats = await D.finTodasCategorias();
    const fila = c => `<form class="cat-fila${c.activa !== false ? '' : ' inactiva'}" data-cat-id="${c.id}">
      <span class="mov-ico ${c.tipo}">${icoCat(c.nombre)}</span>
      <input name="nombre" value="${esc(c.nombre)}" required aria-label="Nombre">
      <input name="subcategorias" value="${esc((c.subcategorias || []).join(', '))}" placeholder="Subcategorías separadas por coma" aria-label="Subcategorías">
      <label class="lv-check"><input type="checkbox" name="activa" ${c.activa !== false ? 'checked' : ''}> Activa</label>
      <button class="btn mini sec">Guardar</button></form>`;
    fondo.innerHTML = `<div class="modal ancho modal-cats"><h2>Categorías</h2>
      <p class="sub">Cambia nombres y subcategorías, o desactiva las que ya no uses (sus movimientos se conservan).</p>
      <h3>Ingresos</h3>${cats.filter(c => c.tipo === 'ingreso').map(fila).join('')}
      <h3>Gastos</h3>${cats.filter(c => c.tipo === 'gasto').map(fila).join('')}
      <h3>Nueva categoría</h3>
      <form class="cat-fila nueva" id="cat-nueva"><select name="tipo"><option value="gasto">Gasto</option><option value="ingreso">Ingreso</option></select>
        <input name="nombre" placeholder="Nombre" required><input name="subcategorias" placeholder="Subcategorías separadas por coma"><span></span><button class="btn mini"><span class="mas">+</span> Agregar</button></form>
      <div class="aviso" id="cat-aviso"></div>
      <div class="pie-modal"><button type="button" class="btn" id="cat-listo">Listo</button></div></div>`;
    const subs = v => v.split(',').map(x => x.trim()).filter(Boolean);
    const av = t => { $('#cat-aviso', fondo).textContent = t; };
    fondo.querySelectorAll('[data-cat-id]').forEach(f => f.onsubmit = async ev => { ev.preventDefault();
      try { await D.finActualizarCategoria(f.dataset.catId, { nombre: f.nombre.value.trim(), subcategorias: subs(f.subcategorias.value), activa: f.activa.checked }); av('Guardado.'); pintar(); } catch (err) { av(err.message); } });
    $('#cat-nueva', fondo).onsubmit = async ev => { ev.preventDefault(); const f = ev.target;
      const orden = Math.max(0, ...cats.filter(c => c.tipo === f.tipo.value).map(c => c.orden || 0)) + 1;
      try { await D.finCrearCategoria({ tipo: f.tipo.value, nombre: f.nombre.value.trim(), subcategorias: subs(f.subcategorias.value), orden, activa: true }); pintar(); } catch (err) { av(err.message); } };
    $('#cat-listo', fondo).onclick = () => { fondo.remove(); recargar(); };
  };
  fondo.onclick = ev => { if (ev.target === fondo) { fondo.remove(); recargar(); } };
  document.body.appendChild(fondo); await pintar();
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
