// Finanzas de regenerativo: ingresos, gastos y presupuesto de la empresa. Solo perfil de facturación.
import * as D from './datos.js?v=28';
import { cop, fecha, iso } from './formato.js?v=28';

const $ = (s, r = document) => r.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const C_ING = '#0090B0', C_GAS = '#C0603A';   // par validado (CVD y contraste)
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const mesDe = f => f.slice(0, 7);
const compacto = n => n >= 1e6 ? (n / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 1 }) + ' M' : n >= 1e3 ? Math.round(n / 1e3) + ' mil' : String(Math.round(n));

const opsCat = (cats, tipo, sel) => tipo === 'socio' ? '<option value="">—</option>' : cats.filter(c => c.tipo === tipo).map(c => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.icono || '')} ${esc(c.nombre)}</option>`).join('');

export async function vistaFinanzas(mesSel, listaSel) {
  const [cats, todos, encargos, docs] = await Promise.all([D.finCategorias(), D.finMovimientos(), D.encargos(), D.finDocumentosCobro()]);
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

  // Por cobrar: plan de pagos de la propuesta + adendas aprobadas, menos ingresos registrados por encargo
  const porEnc = encargos.map(e => {
    const prop = docs.filter(d => d.encargo_id === e.id && d.tipo === 'propuesta' && ['aprobado', 'firmado'].includes(d.estado)).at(-1);
    const adds = docs.filter(d => d.encargo_id === e.id && d.tipo === 'adenda' && ['aprobado', 'firmado'].includes(d.estado));
    const esperado = (prop?.contenido?.honorarios || 0) + adds.reduce((s, d) => s + (d.contenido.valor || 0), 0);
    const recibido = suma(movs.filter(x => x.encargo_id === e.id), 'ingreso');
    const gastos = suma(movs.filter(x => x.encargo_id === e.id), 'gasto');
    return { e, esperado, recibido, gastos, porCobrar: Math.max(0, esperado - recibido), neto: recibido - gastos };
  });   // todos los encargos, aunque aún no tengan movimientos
  const porCobrar = porEnc.reduce((s, r) => s + r.porCobrar, 0);

  // Últimos 6 meses
  const meses = Array.from({ length: 6 }, (_, i) => { const d = new Date(a, m - 1 - (5 - i), 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });
  const serie = meses.map(k => ({ k, ing: suma(movs.filter(x => mesDe(x.fecha) === k), 'ingreso'), gas: suma(movs.filter(x => mesDe(x.fecha) === k && !esSal(x)), 'gasto') }));

  // Presupuesto por categoría (gastos del mes)
  const catsGasto = cats.filter(c => c.tipo === 'gasto' && c.id !== SALARIO).map(c => ({ ...c, gastado: delMes.filter(x => x.categoria_id === c.id).reduce((s, x) => s + Number(x.valor), 0) }));
  const presTotal = catsGasto.reduce((s, c) => s + Number(c.presupuesto_mensual || 0), 0);
  const ejemplos = movs.some(x => x.ejemplo);
  const prev = new Date(a, m - 2, 1), next = new Date(a, m, 1);
  const k = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  const balance = ing - gas;   // operación: sin tu salario
  const queda = balance - sal;
  const listas = [['todo', 'Todo regenerativo'], ['general', 'Gastos generales'], ...encargos.map(e => [e.id, e.nombre])];
  const maxCol = Math.max(1, ...catsGasto.map(c => Math.max(c.gastado, Number(c.presupuesto_mensual || 0))));
  const H = 190;
  const porDia = [...new Set(delMes.map(x => x.fecha))];
  const html = `
    ${ejemplos ? `<div class="aviso-ej">Hay movimientos de ejemplo para que veas cómo funciona. <button class="btn sec mini" id="borrar-ej">Borrar ejemplos</button></div>` : ''}
    ${pend.length ? `<section class="pend">
      <div class="pend-cab"><h3>Por confirmar <span class="pend-n">${pend.length}</span></h3><span class="sub">Llegaron al correo. No cuentan en los totales hasta que les des ✓.</span></div>
      ${pend.map((x, i) => `<div class="pend-fila ${i >= 4 ? 'pend-oculta' : ''}" data-pend="${x.id}">
        <div class="pend-txt"><span class="sub">${fecha(x.fecha)}${x.medio ? ' · ' + esc(x.medio) : ''}</span><b>${esc(x.descripcion || '')}</b>${x.nota_correo ? `<span class="pend-nota">${esc(x.nota_correo)}</span>` : ''}</div>
        <div class="pend-val ${x.tipo}">${x.tipo === 'ingreso' ? '+' : x.tipo === 'gasto' ? '−' : ''} ${cop(x.valor)}</div>
        <div class="pend-sel">
          <select data-f="tipo"><option value="gasto" ${x.tipo === 'gasto' ? 'selected' : ''}>Gasto de la empresa</option><option value="ingreso" ${x.tipo === 'ingreso' ? 'selected' : ''}>Ingreso</option><option value="socio" ${x.tipo === 'socio' ? 'selected' : ''}>Personal / socio (no cuenta)</option></select>
          <select data-f="categoria_id">${opsCat(cats, x.tipo, x.categoria_id)}</select>
          <select data-f="encargo_id"><option value="">Regenerativo (general)</option>${encargos.map(e => `<option value="${e.id}" ${e.id === x.encargo_id ? 'selected' : ''}>${esc(e.nombre)}</option>`).join('')}</select>
        </div>
        <div class="pend-acc"><button class="btn mini" data-ok>✓</button><button class="btn sec mini" data-no title="Descartar (no es un movimiento real)">✕</button></div>
      </div>`).join('')}
      ${pend.length > 4 ? `<button class="btn sec mini pend-mas" id="pend-mas">Ver los ${pend.length - 4} restantes</button>` : ''}
    </section>` : ''}
    <section class="mon">
      <div class="mon-total">
        <div class="mon-et">Balance de la operación</div>
        <div class="mon-cifra">${balance < 0 ? '−' : '+'}${cop(Math.abs(balance)).replace(' COP', '')}<span>COP</span></div>
        <div class="mon-pills"><span class="pill-gas">− ${cop(gas)}</span><span class="pill-ing">+ ${cop(ing)}</span></div>
        <div class="mon-sal"><span>Tu salario <b>${cop(sal)}</b></span><span>Queda en regenerativo <b class="${queda < 0 ? 'xxx' : ''}">${queda < 0 ? '−' : ''}${cop(Math.abs(queda))}</b></span></div>
        <div class="mon-filtros">
          <a href="#/finanzas/${k(prev)}/${lista}" class="mon-flecha">‹</a><b>${mesTxt}</b><a href="#/finanzas/${k(next)}/${lista}" class="mon-flecha">›</a>
          <span class="sub">en</span>
          <select id="lista">${listas.map(([v, n]) => `<option value="${v}" ${v === lista ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
        </div>
      </div>
      <div class="mon-cols">${catsGasto.map(c => {
        const p = Number(c.presupuesto_mensual || 0), exc = p && c.gastado > p;
        const hP = p / maxCol * H, hG = Math.max(c.gastado ? 6 : 0, c.gastado / maxCol * H);
        return `<button class="mon-col" data-cat="${c.id}" title="${esc(c.nombre)}">
          <div class="mon-barra" style="height:${H}px">
            ${p ? `<div class="mon-pres" style="height:${hP}px"></div>` : ''}
            <div class="mon-gasto ${exc ? 'exc' : ''}" style="height:${hG}px"></div>
          </div>
          <div class="mon-ico">${esc(c.icono || '•')}</div>
          <div class="mon-val">${compacto(c.gastado)}</div>
          <div class="mon-pct ${exc ? 'xxx' : ''}">${p ? Math.round(c.gastado / p * 100) + '%' : '—'}</div>
          <div class="mon-nom">${esc(c.nombre)}</div></button>`;
      }).join('')}</div>
      <p class="sub mon-ley"><span class="ley-pres"></span>Presupuesto del mes &nbsp; <span class="ley-gas"></span>Gastado &nbsp; <a href="#" id="editar-pres">Editar presupuesto</a></p>
      <div class="mon-lista">
        ${porDia.length ? porDia.map(d => `<div class="mon-dia">${fecha(d)}</div>` + delMes.filter(x => x.fecha === d).map(x => `
          <button class="mon-mov" data-editar="${x.id}">
            <span class="mon-mico">${esc(x.tipo === 'socio' ? '👤' : x.categoria?.icono || '•')}</span>
            <span class="mon-mtxt"><span class="sub">${esc(x.tipo === 'socio' ? 'Personal / socio' : x.categoria?.nombre || '')}${x.encargo ? ' · ' + esc(x.encargo.nombre) : ''}</span>${esc(x.descripcion || '')}</span>
            <span class="mon-mval ${x.tipo}">${x.tipo === 'ingreso' ? '+' : x.tipo === 'gasto' ? '−' : ''} ${cop(x.valor)}${x.tipo === 'socio' ? '<small>no cuenta</small>' : ''}</span>
          </button>`).join('')).join('') : '<div class="vacio">No hay movimientos este mes en esta lista.</div>'}
      </div>
      <div class="mon-mas"><button class="btn mini" data-nuevo="ingreso">+ Ingreso</button><button class="mon-fab" data-nuevo="gasto" title="Agregar gasto">+</button></div>
    </section>
    <div class="kpis kpis-3" style="margin-top:24px">
      <div class="kpi"><div class="et">Gastos vs. presupuesto</div><div class="va">${presTotal ? Math.round(gas / presTotal * 100) + '%' : '—'}</div><div class="su">${cop(gas)} de ${cop(presTotal)}</div></div>
      <div class="kpi"><div class="et">Por cobrar</div><div class="va">${cop(porCobrar)}</div><div class="su">Propuestas y adendas aprobadas, menos lo recibido</div></div>
      <div class="kpi"><div class="et">Encargos con saldo</div><div class="va">${porEnc.filter(r => r.porCobrar > 0).length}</div><div class="su">de ${porEnc.length} con movimientos</div></div>
    </div>
    <div class="dos">
      <section class="panel"><h3>Ingresos y gastos de la operación · últimos 6 meses</h3>${barras(serie)}</section>
      <section class="panel"><h3>Encargos</h3><p class="sub">Toca un encargo para ver solo sus movimientos.</p>
      ${porEnc.length ? `<div class="tabla-cont"><table><thead><tr><th>Encargo</th><th class="num">Acordado</th><th class="num">Recibido</th><th class="num">Por cobrar</th><th class="num col-opc">Gastos</th><th class="num col-opc">Neto</th></tr></thead><tbody>
      ${porEnc.map(r => `<tr class="fila-enc" data-lista="${r.e.id}"><td><b>${esc(r.e.nombre)}</b></td><td class="num">${cop(r.esperado)}</td><td class="num">${cop(r.recibido)}</td><td class="num">${cop(r.porCobrar)}</td><td class="num col-opc">${cop(r.gastos)}</td><td class="num col-opc">${cop(r.neto)}</td></tr>`).join('')}
      <tr class="total"><td>Total</td><td class="num">${cop(porEnc.reduce((a, r) => a + r.esperado, 0))}</td><td class="num">${cop(porEnc.reduce((a, r) => a + r.recibido, 0))}</td><td class="num">${cop(porCobrar)}</td><td class="num col-opc">${cop(porEnc.reduce((a, r) => a + r.gastos, 0))}</td><td class="num col-opc">${cop(porEnc.reduce((a, r) => a + r.neto, 0))}</td></tr>
      </tbody></table></div>` : '<div class="vacio">Sin movimientos por encargo.</div>'}</section>
    </div>`;

  return { html, montar: recargar => {
    document.querySelectorAll('[data-nuevo]').forEach(b => b.onclick = () => modalMov({ tipo: b.dataset.nuevo, fecha: iso(new Date()) }, cats, encargos, recargar));
    document.querySelectorAll('[data-editar]').forEach(b => b.onclick = () => modalMov(movs.find(x => x.id === b.dataset.editar), cats, encargos, recargar));
    const pm = $('#pend-mas'); if (pm) pm.onclick = () => { document.querySelectorAll('.pend-oculta').forEach(f => f.classList.remove('pend-oculta')); pm.remove(); };
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
    const ep = () => modalPresupuesto(cats.filter(c => c.tipo === 'gasto'), recargar);
    $('#editar-pres').onclick = ev => { ev.preventDefault(); ep(); };
    document.querySelectorAll('[data-cat]').forEach(x => x.onclick = () => modalMov({ tipo: 'gasto', fecha: iso(new Date()), categoria_id: x.dataset.cat, encargo_id: ['todo', 'general'].includes(lista) ? null : lista }, cats, encargos, recargar));
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
  const H = 180;
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

function modalMov(m, cats, encargos, recargar) {
  const fondo = document.createElement('div'); fondo.className = 'modal-fondo';
  const opsCat = t => cats.filter(c => c.tipo === t).map(c => `<option value="${c.id}" ${c.id === m.categoria_id ? 'selected' : ''}>${esc(c.icono || '')} ${esc(c.nombre)}</option>`).join('');
  fondo.innerHTML = `<form class="modal" id="fm">
    <h2>${m.id ? 'Editar' : 'Nuevo'} ${m.tipo === 'ingreso' ? 'ingreso' : m.tipo === 'socio' ? 'movimiento personal / socio' : 'gasto'}</h2>
    <div class="grilla-form">
      <div><label>Valor (COP)</label><input name="valor" inputmode="numeric" required value="${m.valor ? Number(m.valor).toLocaleString('es-CO').replace(/,/g, '.') : ''}"></div>
      <div><label>Fecha</label><input name="fecha" type="date" required value="${m.fecha || ''}"></div>
      ${m.tipo === 'socio' ? '' : `<div><label>Categoría</label><select name="categoria_id">${opsCat(m.tipo)}</select></div>`}
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
  f.valor.oninput = () => { const n = f.valor.value.replace(/\D/g, ''); f.valor.value = n ? Number(n).toLocaleString('es-CO').replace(/,/g, '.') : ''; };
  $('#cancelar', fondo).onclick = () => fondo.remove();
  if (m.id) {
    const pintar = async () => {
      const l = await D.finSoportes(m.id);
      $('#sop-lista', fondo).innerHTML = l.length ? l.map(x => `<div class="sop-item"><a href="#" data-ver="${x.id}">${esc(x.nombre)}</a><button type="button" class="btn sec mini" data-quitar="${x.id}">Quitar</button></div>`).join('') : 'Sin soportes todavía.';
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
    try { await D.finGuardarMovimiento(reg); fondo.remove(); recargar(); } catch (err) { $('#aviso', fondo).textContent = err.message; }
  };
}

function modalPresupuesto(cats, recargar) {
  const fondo = document.createElement('div'); fondo.className = 'modal-fondo';
  fondo.innerHTML = `<form class="modal" id="fp"><h2>Presupuesto mensual de gastos</h2><p class="sub">Déjalo vacío si una categoría no tiene tope.</p>
    <div class="tabla-cont"><table><thead><tr><th>Categoría</th><th class="num">Tope mensual (COP)</th></tr></thead><tbody>
    ${cats.map(c => `<tr><td>${esc(c.icono || '')} ${esc(c.nombre)}</td><td class="num"><input class="cant ancho-p" name="${c.id}" inputmode="numeric" value="${c.presupuesto_mensual ? Number(c.presupuesto_mensual).toLocaleString('es-CO').replace(/,/g, '.') : ''}"></td></tr>`).join('')}
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
