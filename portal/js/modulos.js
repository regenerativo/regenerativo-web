// Módulos del expediente: Brief, Propuesta, Contrato, Adendas, Presupuesto, Gantt, Informes y Base de precios.
import * as D from './datos.js?v=73';
import { descargarPDF } from './pdf.js?v=73';
import { btnIco } from './iconos.js?v=73';
import { cop, fecha, fechaCodigo, pct, aFecha, iso, diasDeTrabajo, finDeTrabajo, fechaCorte, ESTADOS_TAREA, DIAS_TRABAJO, TIPOS } from './formato.js?v=73';

const $ = (s, r = document) => r.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const xxx = v => (v === null || v === undefined || v === '' || v === 'XXX') ? '<span class="xxx">XXX</span>' : esc(v);
const ESTADOS_DOC = { borrador: 'Borrador', enviado: 'Enviado', aprobado: 'Aprobado', firmado: 'Firmado' };
const NOMBRE_DOC = { brief: 'BRIEF', propuesta: 'PROPUESTA', contrato: 'CONTRATO', adenda: 'ADENDA', informe: 'INFORME DE AVANCE' };
const nombreSinAnio = e => e.nombre.replace(/^\s*\d{2}\s+I\s+/, '');

// ---------------- Nombres de archivo (regla de regenerativo) ----------------
export function nombreArchivo(e, tipo, doc, ext) {
  const f = fechaCodigo(doc?.fecha || new Date());
  if (tipo === 'propuesta') return `${f} _ ${e.codigo}_${e.nombre}.${ext}`;
  if (tipo === 'contrato') return `${f} _ ${doc?.contenido?.numero || 'REGOPS'} _ ${e.nombre}.${ext}`;
  const n = doc?.numero ? ' ' + String(doc.numero).padStart(2, '0') : '';
  const t = tipo === 'presupuesto' ? `PRESUPUESTO v${String(doc?.version || 1).padStart(2, '0')}` : tipo === 'gantt' ? 'CRONOGRAMA' : NOMBRE_DOC[tipo] + (tipo === 'brief' ? '' : n);
  return `${f} _ REG_${e.nombre} _ ${t}.${ext}`;
}

// ---------------- Impresión con membrete (papel legal) ----------------
const DESCRIPTOR = { brief: 'BRIEF', propuesta: 'PROPUESTA', contrato: 'CONTRATO', adenda: 'ADENDA', informe: 'INFORME', cuenta: 'CUENTA DE COBRO' };
// Membrete único: izquierda servicio + "Servicios" (gris); derecha tipo de documento + fecha (gris)
function membrete(e, tipo, d) {
  const n = d?.numero && ['adenda', 'informe', 'cuenta'].includes(tipo) ? ' ' + String(d.numero).padStart(2, '0') : '';
  const ref = tipo === 'contrato' && d?.contenido?.numero ? d.contenido.numero : tipo === 'propuesta' ? e.codigo : e.nombre;
  return { documento: `${DESCRIPTOR[tipo] || 'DOCUMENTO'}${n} _ ${ref}`, codigo: fechaCodigo(d?.fecha || new Date()) };
}
export async function imprimir(e, codigoFecha, cuerpo, nombre, documento) {
  try {
    document.body.classList.add('generando');
    await descargarPDF({ servicio: e.servicio?.nombre, documento, codigo: codigoFecha, nombre: nombre || `${codigoFecha} _ ${e.nombre}.pdf`, cuerpoHTML: cuerpo });
    return;
  } catch (err) { console.warn('PDF directo no disponible, uso impresión del navegador', err); }
  finally { document.body.classList.remove('generando'); }
  imprimirNavegador(e, codigoFecha, cuerpo, documento);
}
function imprimirNavegador(e, codigoFecha, cuerpo, documento) {
  let cont = $('#impresion');
  if (!cont) { cont = document.createElement('div'); cont.id = 'impresion'; document.body.appendChild(cont); }
  cont.innerHTML = `
    <div class="imp-cabeza"><div><div class="imp-servicio">${esc(((e.servicios?.length ? e.servicios.join(' · ') : e.servicio?.nombre) || 'XXX').toUpperCase())}</div><div class="imp-servicios">Servicios</div></div>
      <div style="text-align:right"><div class="imp-servicio">${esc(documento || '')}</div><div class="imp-servicios">${esc(codigoFecha)}</div></div></div>
    <div class="imp-banda"></div>
    <div class="imp-cuerpo">${cuerpo}</div>
    <div class="imp-pie"><div class="firma"><span class="por">Por</span><span class="linea"></span><span class="reg">regenerativo</span></div>
      <div class="imp-contacto">info@regenerativo.co &nbsp; @_regenerativo_ &nbsp; +57 320 215 0932</div></div>`;
  document.body.classList.add('imprimiendo');
  setTimeout(() => { window.print(); setTimeout(() => document.body.classList.remove('imprimiendo'), 300); }, 120);
}

/** Descarga Word (.doc) o Excel (.xls) a partir de HTML: Word y Excel lo abren y se guarda como .docx/.xlsx. */
export function descargar(nombre, html, tipo) {
  const estilos = `<style>body{font-family:'Metronic Pro',Arial;font-size:11pt;color:#1E221D}h1,h2,h3{font-family:'Stolzl',Arial;font-weight:400}
    table{border-collapse:collapse;width:100%}th{background:#D9D9D9;text-align:left;padding:4pt;font-size:9pt}td{padding:4pt;border-top:1px dotted #999;font-size:10pt}.num{text-align:right}.xxx{color:#800000}</style>`;
  const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8">${estilos}</head><body>${html}</body></html>`;
  const blob = new Blob(['﻿' + doc], { type: tipo === 'xls' ? 'application/vnd.ms-excel' : 'application/msword' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ---------------- Barra común de documentos ----------------
function barraDoc(ctx, d, tipo) {
  const b = [];
  if (ctx.admin && d.estado === 'borrador') b.push(btnIco('enviar', 'Marcar enviado', 'data-doc="enviar"'));
  if (ctx.admin && tipo === 'contrato' && d.estado !== 'firmado') b.push(btnIco('firmar', 'Marcar firmado', 'data-doc="firmar"'));
  if (d.estado === 'enviado' && ctx.admin && tipo !== 'informe') b.push(btnIco('check', 'Aprobar', 'data-doc="aprobar"', 'ok'));
  if (!(ctx.esCliente && ['presupuesto', 'gantt'].includes(tipo))) b.push(`<button class="btn-envio" data-doc="pdf">Descargar PDF <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none"><path d="M9.5 5.5l6 6.5-6 6.5"></path></svg></button>`);
  if (!ctx.esCliente) b.push(`<button class="btn-envio" data-doc="word">Descargar Word <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none"><path d="M9.5 5.5l6 6.5-6 6.5"></path></svg></button>`);
  return `<div class="barra-doc">
    <div><span class="etiqueta ${d.estado}">${ESTADOS_DOC[d.estado]}</span>
      <span class="sub"> &nbsp;${esc(d.titulo || '')} · versión ${d.version} · ${fecha(d.fecha)}</span>
      ${d.aprobado_por ? `<div class="sub">Aprobado por ${esc(d.aprobado_por)} · ${esc(d.aprobado_doc)} · registrado el ${fecha(d.aprobado_en?.slice(0, 10))}</div>` : ''}</div>
    <div class="barra-acc">${b.join('')}</div></div>`;
}

function montarBarra(ctx, d, tipo, cuerpoImpresion) {
  document.querySelectorAll(`[data-doc]`).forEach(btn => btn.onclick = async () => {
    const acc = btn.dataset.doc;
    try {
      if (acc === 'enviar') { await D.actualizarDocumento(d.id, { estado: 'enviado' }); return ctx.recargar(); }
      if (acc === 'firmar') { await D.actualizarDocumento(d.id, { estado: 'firmado' }); return ctx.recargar(); }
      if (acc === 'aprobar') {
        const nombre = prompt('¿Quién aprobó por parte del cliente? (nombre completo)'); if (!nombre) return;
        const cedula = prompt('¿Cómo lo aprobó? (p. ej. correo del 10/11, firma, reunión)'); if (!cedula) return;
        await D.aprobarDocumento(d.id, nombre, cedula); return ctx.recargar();
      }
      const cuerpo = cuerpoImpresion();
      const m = membrete(ctx.e, tipo, d);
      if (acc === 'pdf') imprimir(ctx.e, m.codigo, cuerpo, nombreArchivo(ctx.e, tipo, d, 'pdf'), m.documento);
      if (acc === 'word') descargar(nombreArchivo(ctx.e, tipo, d, 'doc'), cuerpo, 'doc');
    } catch (err) { alert(err.message); }
  });
}

const vacioDoc = (ctx, tipo) => `<div class="vacio">${ctx.esCliente ? 'Todavía no hay documentos enviados en este módulo.' : `No hay ${tipo} en este encargo todavía.`}</div>`;


// Vista del cliente para documentos legales: solo tarjeta de descarga (PDF), sin texto en pantalla
const NOMBRE_TARJETA = { propuesta: 'la propuesta económica', contrato: 'el contrato', adenda: 'la adenda' };
function tarjetaDescarga(ctx, d, tipo, i) {
  const titulo = tipo === 'adenda' ? `Adenda ${String(d.numero).padStart(2, '0')}` : tipo === 'contrato' ? 'Contrato' : 'Propuesta económica';
  return `<div class="tarjeta-doc">
    <div class="td-txt"><b>${titulo}</b><span>A continuación encuentras el documento de ${NOMBRE_TARJETA[tipo]}.</span>
      <span class="sub">Versión ${d.version} · ${fecha(d.fecha)}${d.estado === 'aprobado' || d.estado === 'firmado' ? ' · ' + ESTADOS_DOC[d.estado] : ''}</span></div>
    <button class="btn-envio" data-dl="${i}">Descargar PDF <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none"><path d="M9.5 5.5l6 6.5-6 6.5"></path></svg></button></div>`;
}
function vistaClienteDocs(ctx, items) {
  return {
    html: items.map((x, i) => tarjetaDescarga(ctx, x.d, x.tipo, i)).join(''),
    montar: () => document.querySelectorAll('[data-dl]').forEach(b => b.onclick = () => {
      const x = items[Number(b.dataset.dl)];
      const m = membrete(ctx.e, x.tipo, x.d);
      imprimir(ctx.e, m.codigo, x.cuerpo(), nombreArchivo(ctx.e, x.tipo, x.d, 'pdf'), m.documento);
    }),
  };
}

// ---------------- Brief ----------------
async function brief(ctx) {
  const d = (await D.documentos(ctx.e.id, 'brief')).at(-1);
  if (!d) return { html: vacioDoc(ctx, 'brief') };
  const c = d.contenido;
  const cuerpo = () => `
    <h1 class="doc-titulo">Brief del encargo</h1><p class="doc-sub">${esc(ctx.e.nombre)}</p>
    <h3>Necesidades</h3><p>${esc(c.necesidades)}</p>
    <h3>Usuarios</h3><p>${esc(c.usuarios)}</p>
    <h3>Espacios</h3>
    <table><thead><tr><th>Espacio</th><th>Área</th><th>Requerimientos</th></tr></thead>
    <tbody>${(c.espacios || []).map(x => `<tr><td>${esc(x.nombre)}</td><td>${esc(x.area)}</td><td>${esc(x.requerimientos)}</td></tr>`).join('')}</tbody></table>
    <h3>Referentes</h3><ul>${(c.referentes || []).map(r => `<li>${esc(r)}</li>`).join('')}</ul>
    <h3>Presupuesto objetivo y tiempos</h3><p>${cop(c.presupuesto_objetivo)} · fecha deseada ${fecha(c.fecha_deseada)}</p>
    ${c.notas ? `<h3>Notas</h3><p>${esc(c.notas)}</p>` : ''}`;
  return { html: barraDoc(ctx, d, 'brief') + `<article class="hoja">${cuerpo()}</article>`, montar: () => montarBarra(ctx, d, 'brief', cuerpo) };
}

// ---------------- Propuesta ----------------
async function propuesta(ctx) {
  const d = (await D.documentos(ctx.e.id, 'propuesta')).at(-1);
  if (!d) return { html: vacioDoc(ctx, 'propuesta') };
  const c = d.contenido;
  const cuerpo = () => `
    <h1 class="doc-titulo">Propuesta económica</h1><p class="doc-sub">${esc(ctx.e.codigo)} · ${esc(ctx.e.nombre)} · ${xxx(ctx.e.cliente?.nombre)}</p>
    <p>${esc(c.introduccion)}</p>
    <h3>Alcance por etapas</h3>
    <table><thead><tr><th style="width:40px">Etapa</th><th>Nombre</th><th>Duración</th><th>Entregables</th></tr></thead>
    <tbody>${(c.etapas || []).map(x => `<tr><td>${esc(x.letra)}</td><td>${esc(x.nombre)}</td><td>${esc(x.duracion)}</td><td>${(x.entregables || []).map(esc).join('<br>')}</td></tr>`).join('')}</tbody></table>
    <h3>Honorarios</h3><p class="cifra">${cop(c.honorarios)}</p>
    <h3>Plan de pagos</h3>
    <table><thead><tr><th>%</th><th>Momento</th><th class="num">Valor</th></tr></thead>
    <tbody>${(c.pagos || []).map(x => `<tr><td>${pct(x.pct)}</td><td>${esc(x.momento)}</td><td class="num">${cop(x.pct * c.honorarios)}</td></tr>`).join('')}</tbody></table>
    <h3>Condiciones</h3>${(c.condiciones || []).map(x => `<p><b>${esc(x.titulo)}.</b> ${esc(x.texto)}</p>`).join('')}
    <p class="sub">Vigencia de la propuesta: ${esc(c.vigencia_dias)} días calendario.</p>
    <div class="cierre">Cordialmente,<br><br>Área de Proyectos<br><b>REGENERATIVO</b></div>`;
  if (ctx.esCliente) return vistaClienteDocs(ctx, [{ d, tipo: 'propuesta', cuerpo }]);
  return { html: barraDoc(ctx, d, 'propuesta') + `<article class="hoja">${cuerpo()}</article>`, montar: () => montarBarra(ctx, d, 'propuesta', cuerpo) };
}

// ---------------- Contrato ----------------
function variables(texto, ctx, prop) {
  const v = {
    'encargo.nombre': ctx.e.nombre, 'encargo.codigo': ctx.e.nombre, 'propuesta.codigo': ctx.e.codigo, 'encargo.direccion': ctx.e.direccion,
    'encargo.inicio': ctx.e.inicio ? fecha(ctx.e.inicio) : '', 'encargo.fin': ctx.e.fin ? fecha(ctx.e.fin) : '',
    'cliente.nombre': ctx.e.cliente?.nombre, 'propuesta.honorarios': prop?.contenido?.honorarios ? cop(prop.contenido.honorarios) : '',
  };
  return esc(texto).replace(/\{\{([\w.]+)\}\}/g, (_, k) => v[k] ? `<span class="var">${esc(v[k])}</span>` : '<span class="xxx">XXX</span>');
}
const romano = n => ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX'][n - 1] || n;

async function contrato(ctx) {
  const [docs, props, adendas] = await Promise.all([D.documentos(ctx.e.id, 'contrato'), D.documentos(ctx.e.id, 'propuesta'), D.documentos(ctx.e.id, 'adenda')]);
  const d = docs.at(-1); if (!d) return { html: vacioDoc(ctx, 'contrato') };
  const prop = props.at(-1), c = d.contenido;
  const inicial = prop?.contenido?.honorarios || 0;
  const sumaAdendas = adendas.filter(a => ['aprobado', 'firmado'].includes(a.estado)).reduce((s, a) => s + (a.contenido.valor || 0), 0);
  const cuerpo = () => `
    <h1 class="doc-titulo">Contrato de prestación de servicios</h1>
    <p class="doc-sub">No. ${esc(c.numero)} ${fechaCodigo(d.fecha)} celebrado entre ${xxx(ctx.e.cliente?.nombre)} y REGENERATIVO</p>
    <p>Entre <b>${xxx(ctx.e.cliente?.nombre)}</b>, identificado con ${xxx(ctx.e.cliente?.documento)}, quien en adelante se denomina EL CONTRATANTE, y <b>Andrés Fernando Correa Pardo</b>, quien actúa bajo la marca REGENERATIVO y en adelante se denomina EL CONTRATISTA, se celebra el presente contrato, previas las siguientes consideraciones:</p>
    <h3>Considerandos</h3><ol>${(c.considerandos || []).map(t => `<li>${variables(t, ctx, prop)}</li>`).join('')}</ol>
    <h3>Cláusulas</h3>
    ${(c.clausulas || []).map((x, i) => `<p><b>CLÁUSULA ${romano(i + 1)}. ${esc(x.titulo.toUpperCase())}.</b> ${variables(x.texto, ctx, prop)}</p>`).join('')}
    <p class="sub">Anexo 1: Propuesta económica ${esc(ctx.e.codigo)}.</p>
    <div class="firmas"><div>EL CONTRATANTE<br><br><br>${xxx(ctx.e.cliente?.representante || ctx.e.cliente?.nombre)}</div><div>EL CONTRATISTA<br><br><br>Andrés Fernando Correa Pardo<br>REGENERATIVO</div></div>`;
  const resumen = `<div class="kpis kpis-3">
    <div class="kpi"><div class="et">Valor inicial</div><div class="va">${cop(inicial)}</div><div class="su">Propuesta aprobada (Anexo 1)</div></div>
    <div class="kpi"><div class="et">Adendas aprobadas</div><div class="va">${cop(sumaAdendas)}</div><div class="su">${adendas.length} adenda(s) en total</div></div>
    <div class="kpi"><div class="et">Valor total del contrato</div><div class="va">${cop(inicial + sumaAdendas)}</div><div class="su">Se calcula solo</div></div></div>`;
  if (ctx.esCliente) return vistaClienteDocs(ctx, [{ d, tipo: 'contrato', cuerpo }, ...adendas.map(a => ({ d: a, tipo: 'adenda', cuerpo: () => cuerpoAdenda(ctx, a) }))]);
  return { html: barraDoc(ctx, d, 'contrato') + resumen + `<article class="hoja">${cuerpo()}</article>`, montar: () => montarBarra(ctx, d, 'contrato', cuerpo) };
}

// ---------------- Adendas ----------------
function cuerpoAdenda(ctx, a) {
  const c = a.contenido;
  return `
    <h1 class="doc-titulo">Adenda ${String(a.numero).padStart(2, '0')}</h1><p class="doc-sub">${esc(ctx.e.nombre)}</p>
    <p><b>Tipo:</b> ${esc(c.tipo)}</p><p>${esc(c.descripcion)}</p>
    <p><b>Valor:</b> ${cop(c.valor)} · <b>Plazo adicional:</b> ${esc(c.plazo_dias)} días</p>
    <table><thead><tr><th>%</th><th>Momento</th><th class="num">Valor</th></tr></thead>
    <tbody>${(c.pagos || []).map(x => `<tr><td>${pct(x.pct)}</td><td>${esc(x.momento)}</td><td class="num">${cop(x.pct * c.valor)}</td></tr>`).join('')}</tbody></table>`;
}
async function adendas(ctx) {
  const lista = await D.documentos(ctx.e.id, 'adenda');
  if (!lista.length) return { html: vacioDoc(ctx, 'adendas') };
  const sel = ctx.sub ? lista.find(a => String(a.numero) === ctx.sub) || lista.at(-1) : lista.at(-1);
  if (ctx.esCliente) return vistaClienteDocs(ctx, lista.map(a => ({ d: a, tipo: 'adenda', cuerpo: () => cuerpoAdenda(ctx, a) })));
  const cuerpo = () => cuerpoAdenda(ctx, sel);
  const tabs = lista.length > 1 ? `<div class="filtros">${lista.map(a => `<a class="btn ${a.id === sel.id ? '' : 'sec'} mini" href="${ctx.base}/adendas/${a.numero}">Adenda ${String(a.numero).padStart(2, '0')}</a>`).join('')}</div>` : '';
  return { html: tabs + barraDoc(ctx, sel, 'adenda') + `<article class="hoja">${cuerpo()}</article>`, montar: () => montarBarra(ctx, sel, 'adenda', cuerpo) };
}

// ---------------- Presupuesto ----------------
function totales(p, filas, area) {
  const directos = filas.filter(f => !f.indirecto).reduce((s, f) => s + Number(f.total), 0);
  const indirectos = filas.filter(f => f.indirecto).reduce((s, f) => s + Number(f.total), 0);
  const base = directos + indirectos;
  const admin = base * p.pct_admin, util = base * p.pct_utilidad, iva = util * p.pct_iva;
  const total = base + admin + util + iva;
  return { directos, indirectos, base, admin, util, iva, total, m2sin: area ? base / area : null, m2con: area ? total / area : null };
}

function cierreHTML(p, t, area) {
  return `<table class="cierre-tabla"><tbody>
    <tr><td>Subtotal costos directos</td><td class="num">${cop(t.directos)}</td></tr>
    <tr><td>Subtotal costos indirectos</td><td class="num">${cop(t.indirectos)}</td></tr>
    <tr><td><b>Total de capítulos</b></td><td class="num"><b>${cop(t.base)}</b></td></tr>
    <tr><td>Administración e imprevistos (${pct(p.pct_admin)})</td><td class="num">${cop(t.admin)}</td></tr>
    <tr><td>Utilidad (${pct(p.pct_utilidad)})</td><td class="num">${cop(t.util)}</td></tr>
    <tr><td>IVA sobre la utilidad (${pct(p.pct_iva)})</td><td class="num">${cop(t.iva)}</td></tr>
    <tr class="total"><td>TOTAL</td><td class="num">${cop(t.total)}</td></tr>
    ${area ? `<tr><td class="sub">Valor m² sin AIU (${area} m²)</td><td class="num sub">${cop(t.m2sin)}</td></tr><tr><td class="sub">Valor m² con AIU</td><td class="num sub">${cop(t.m2con)}</td></tr>` : ''}
  </tbody></table>`;
}

async function presupuesto(ctx) {
  const area = Number(ctx.e.area_m2) || null;
  if (ctx.esCliente) {
    const p = await D.presupuestoResumen(ctx.e.id);
    if (!p) return { html: vacioDoc(ctx, 'presupuesto') };
    const t = totales(p, p.resumen, area);
    const caps = [...new Map(p.resumen.map(r => [r.capitulo_orden, r])).values()];
    const cuerpo = () => `<h1 class="doc-titulo">Presupuesto de obra</h1><p class="doc-sub">${esc(ctx.e.nombre)} · versión ${p.version}</p>
      <table><thead><tr><th style="width:60px">N°</th><th>Tipo de actividad</th><th class="num">Valor</th></tr></thead><tbody>
      ${caps.map(c => `<tr class="fila-cap"><td>${c.capitulo_orden}.</td><td>${esc(c.capitulo)}</td><td class="num">${cop(p.resumen.filter(r => r.capitulo_orden === c.capitulo_orden).reduce((s, r) => s + Number(r.total), 0))}</td></tr>
        ${p.resumen.filter(r => r.capitulo_orden === c.capitulo_orden).map(r => `<tr><td class="sub">${r.capitulo_orden}.${r.actividad_orden}</td><td>${esc(r.actividad)}</td><td class="num">${cop(r.total)}</td></tr>`).join('')}`).join('')}
      </tbody></table>${cierreHTML(p, t, area)}`;
    const d = { ...p, titulo: 'Presupuesto de obra' };
    return { html: barraDoc(ctx, d, 'presupuesto') + kpisPres(t) + `<article class="hoja">${cuerpo()}</article>`, montar: () => montarBarra(ctx, d, 'presupuesto', cuerpo) };
  }
  const p = await D.presupuestoCompleto(ctx.e.id);
  if (!p) return { html: vacioDoc(ctx, 'presupuesto') };
  const filas = p.capitulos.flatMap(c => c.actividades.map(a => ({ indirecto: c.indirecto, total: a.items.reduce((s, i) => s + i.cantidad * i.valor_unitario, 0) })));
  const t = totales(p, filas, area);
  const editable = ctx.admin && p.estado === 'borrador';
  const tabla = (conControles) => `<table class="tabla-pres"><thead><tr><th style="width:70px">Ítem</th><th>Descripción</th><th class="col-opc">APU</th><th>Und</th><th class="num">Cant.</th><th class="num">V. unitario</th><th class="num">Total</th><th class="col-opc">Contratista</th></tr></thead><tbody>
    ${p.capitulos.map(c => {
      const totC = c.actividades.reduce((s, a) => s + a.items.reduce((x, i) => x + i.cantidad * i.valor_unitario, 0), 0);
      return `<tr class="fila-cap"><td>${c.orden}.</td><td colspan="5">${esc(c.nombre.toUpperCase())}${c.indirecto ? ' <span class="sub">(indirectos)</span>' : ''}</td><td class="num">${cop(totC)}</td><td class="col-opc"></td></tr>` +
        c.actividades.map(a => {
          const totA = a.items.reduce((x, i) => x + i.cantidad * i.valor_unitario, 0);
          return `<tr class="fila-act"><td>${c.orden}.${a.orden}</td><td colspan="5">${esc(a.nombre)}</td><td class="num">${cop(totA)}</td><td class="col-opc"></td></tr>` +
            a.items.map(i => `<tr><td class="sub">${c.orden}.${a.orden}-${i.orden}</td><td>${esc(i.descripcion)}</td>
              <td class="col-opc">${i.apu ? `<a href="#" data-apu="${i.apu_id}" class="sub">${esc(i.apu.codigo)}</a>` : '<span class="sub">manual</span>'}</td>
              <td>${esc(i.unidad)}</td>
              <td class="num">${conControles && editable ? `<input class="cant" data-item="${i.id}" value="${i.cantidad}" inputmode="decimal">` : Number(i.cantidad).toLocaleString('es-CO')}</td>
              <td class="num">${cop(i.valor_unitario)}</td><td class="num">${cop(i.cantidad * i.valor_unitario)}</td><td class="col-opc sub">${esc(i.contratista || '')}</td></tr>`).join('');
        }).join('');
    }).join('')}</tbody></table>`;
  const cuerpo = () => `<h1 class="doc-titulo">Presupuesto de obra</h1><p class="doc-sub">${esc(ctx.e.nombre)} · versión ${p.version}</p>${tabla(false)}${cierreHTML(p, t, area)}`;
  const d = { ...p, titulo: 'Presupuesto de obra' };
  const html = barraDoc(ctx, d, 'presupuesto') + `<div class="barra-doc" style="margin-top:-8px"><div class="sub">${editable ? 'Borrador: puedes cambiar cantidades; los totales se recalculan solos.' : `Versión ${ESTADOS_DOC[p.estado].toLowerCase()}: los valores están congelados.`} El cliente solo ve los totales por tipo de actividad.</div>
    <div class="barra-acc">${btnIco('excel', 'Descargar Excel', 'id="xls"')}${ctx.admin && p.estado !== 'borrador' ? btnIco('reabrir', 'Volver a borrador', 'id="reabrir-p"') : ''}</div></div>` +
    kpisPres(t) + `<div class="tabla-cont">${tabla(true)}</div><div class="dos" style="margin-top:20px"><div></div><section class="panel">${cierreHTML(p, t, area)}</section></div>`;
  return { html, montar: () => {
    montarBarra(ctx, d, 'presupuesto', cuerpo);
    $('#xls').onclick = () => descargar(nombreArchivo(ctx.e, 'presupuesto', p, 'xls'), cuerpo(), 'xls');
    const r = $('#reabrir-p'); if (r) r.onclick = async () => { await D.actualizarPresupuesto(p.id, { estado: 'borrador' }); ctx.recargar(); };
    document.querySelectorAll('input.cant').forEach(inp => inp.onchange = async () => {
      const v = Number(inp.value.replace(',', '.')); if (isNaN(v)) return;
      await D.actualizarItem(inp.dataset.item, { cantidad: v }); ctx.recargar();
    });
    document.querySelectorAll('[data-apu]').forEach(a => a.onclick = ev => { ev.preventDefault(); modalApu(a.dataset.apu); });
  } };
}

function kpisPres(t) {
  return `<div class="kpis">
    <div class="kpi"><div class="et">Costos directos</div><div class="va">${cop(t.directos)}</div></div>
    <div class="kpi"><div class="et">Costos indirectos</div><div class="va">${cop(t.indirectos)}</div></div>
    <div class="kpi"><div class="et">AIU + IVA utilidad</div><div class="va">${cop(t.admin + t.util + t.iva)}</div></div>
    <div class="kpi"><div class="et">Total</div><div class="va">${cop(t.total)}</div><div class="su">${t.m2con ? cop(t.m2con) + ' por m²' : ''}</div></div></div>`;
}

export async function modalApu(apuId) {
  const [lista, lineas] = await Promise.all([D.apus(), D.apuDetalle(apuId)]);
  const a = lista.find(x => x.id === apuId);
  const sec = (tipo, nombre) => {
    const l = lineas.filter(x => x.insumo.tipo === tipo);
    const tot = l.reduce((s, x) => s + x.coeficiente * x.insumo.precio, 0);
    return `<h3 style="margin:16px 0 8px">${nombre}</h3><div class="tabla-cont"><table><thead><tr><th>Insumo</th><th>Und</th><th class="num">Coef.</th><th class="num">Precio</th><th class="num">Total</th></tr></thead><tbody>
      ${l.map(x => `<tr><td>${esc(x.insumo.nombre)}${x.insumo.revisar ? ' <span class="xxx" title="' + esc(x.insumo.revisar) + '">●</span>' : ''}</td><td>${esc(x.insumo.unidad)}</td><td class="num">${x.coeficiente}</td><td class="num">${cop(x.insumo.precio)}</td><td class="num">${cop(x.coeficiente * x.insumo.precio)}</td></tr>`).join('') || '<tr><td colspan="5" class="sub">Sin insumos</td></tr>'}
      <tr class="fila-act"><td colspan="4">Costo total ${nombre.toLowerCase()}</td><td class="num">${cop(tot)}</td></tr></tbody></table></div>`;
  };
  const suma = Number(a.materiales) + Number(a.mano_obra);
  const fondo = document.createElement('div'); fondo.className = 'modal-fondo';
  fondo.innerHTML = `<div class="modal ancho">
    <div class="sub">APU ${esc(a.codigo)} · ${esc(a.actividad || '')}</div><h2>${esc(a.descripcion)}</h2>
    <p class="sub">Unidad: ${esc(a.unidad)}</p>
    ${sec('material', 'Materia prima')}${sec('mano_obra', 'Mano de obra')}
    <table class="cierre-tabla" style="margin-top:16px"><tbody>
      <tr><td>Materia prima + mano de obra</td><td class="num">${cop(suma)}</td></tr>
      ${a.valor_manual ? `<tr><td>Valor fijado a mano (no sale de los insumos)</td><td class="num">${cop(a.valor_manual)}</td></tr>` : `<tr><td>Ajuste a la centena</td><td class="num">${cop(a.valor - suma)}</td></tr>`}
      <tr class="total"><td>VALOR UNITARIO</td><td class="num">${cop(a.valor)}</td></tr></tbody></table>
    <div class="pie-modal"><button class="btn" id="cerrar">Cerrar</button></div></div>`;
  document.body.appendChild(fondo);
  $('#cerrar', fondo).onclick = () => fondo.remove();
  fondo.onclick = ev => { if (ev.target === fondo) fondo.remove(); };
}

// ---------------- Gantt ----------------
export async function datosGantt(ctx) {
  const [tareas, p] = await Promise.all([D.ganttTareas(ctx.e.id), ctx.esCliente ? D.presupuestoResumen(ctx.e.id) : D.presupuestoCompleto(ctx.e.id)]);
  const totalesAct = new Map();
  if (p?.capitulos) p.capitulos.forEach(c => c.actividades.forEach(a => totalesAct.set(a.id, a.items.reduce((s, i) => s + i.cantidad * i.valor_unitario, 0))));
  if (p?.totalesActividad) p.totalesActividad.forEach(r => totalesAct.set(r.actividad_id, Number(r.total)));
  const corte = fechaCorte(ctx.e.fecha_corte), modo = ctx.e.dias_trabajo, fest = ctx.fest;
  const sumaVal = tareas.reduce((s, t) => s + (totalesAct.get(t.presupuesto_actividad_id) || 0), 0);
  const filas = tareas.map(t => {
    const finEsp = finDeTrabajo(t.inicio_esperado, t.dias_esperados, modo, fest);
    const ini = aFecha(t.inicio_esperado);
    const hasta = finEsp && corte > finEsp ? finEsp : corte;
    const antes = ini ? new Date(ini.getTime() - 86400000) : null;
    const esperado = t.dias_esperados && ini ? Math.min(1, Math.max(0, (diasDeTrabajo(ini, hasta, modo, fest)) / t.dias_esperados)) : 0;
    let estado;
    const fr = aFecha(t.fin_real), ir = aFecha(t.inicio_real);
    if (fr) estado = fr < finEsp ? 'fin_antes' : (+fr === +finEsp ? 'fin_tiempo' : 'fin_retraso');
    else if (ir) estado = (Number(t.avance) >= esperado - 1e-9 && corte <= finEsp) ? 'en_curso' : 'en_curso_retraso';
    else estado = corte < ini ? 'sin_iniciar' : 'retrasada';
    const valor = totalesAct.get(t.presupuesto_actividad_id) || 0;
    const peso = sumaVal ? valor / sumaVal : (Number(t.peso_manual) || 1 / tareas.length);
    const resp = ctx.e.responsables.find(r => r.id === t.responsable_id);
    return { ...t, finEsp, esperado, estado, peso, resp, antes };
  });
  const esperadoTotal = filas.reduce((s, f) => s + f.peso * f.esperado, 0);
  const realTotal = filas.reduce((s, f) => s + f.peso * Number(f.avance), 0);
  return { filas, corte, esperadoTotal, realTotal };
}

async function gantt(ctx) {
  const g = await datosGantt(ctx);
  if (!g.filas.length) return { html: vacioDoc(ctx, 'cronograma') };
  const { filas, corte } = g;
  const fechas = filas.flatMap(f => [aFecha(f.inicio_esperado), f.finEsp, aFecha(f.inicio_real), aFecha(f.fin_real)]).filter(Boolean);
  const min = new Date(Math.min(...fechas, corte)); min.setDate(min.getDate() - 1);
  const max = new Date(Math.max(...fechas, corte)); max.setDate(max.getDate() + 2);
  const dias = Math.round((max - min) / 86400000) + 1;
  const W = 22, x = d => Math.round((aFecha(d) - min) / 86400000) * W;
  const lineas = Array.from({ length: dias }, (_, i) => { const d = new Date(min); d.setDate(d.getDate() + i); return d; });
  const editable = ctx.admin || ctx.rol === 'equipo';
  const tabla = `<div class="tabla-cont"><table class="tabla-gantt"><thead><tr><th>N°</th><th>Actividad</th><th class="col-opc">Resp.</th><th class="num">Peso</th>
    <th class="col-opc">Inicio esp.</th><th class="num col-opc">Días</th><th class="col-opc">Fin esp.</th><th>Inicio real</th><th>Fin real</th><th class="num">Avance</th><th class="num col-opc">Esperado</th><th>Estado</th></tr></thead><tbody>
    ${filas.map((f, i) => `<tr><td>${i + 1}</td><td>${esc(f.nombre)}</td><td class="col-opc">${f.resp ? `${f.resp.numero}. ${esc(f.resp.nombre)}` : '—'}</td><td class="num">${pct(f.peso)}</td>
      <td class="col-opc">${fecha(f.inicio_esperado)}</td><td class="num col-opc">${f.dias_esperados}</td><td class="col-opc">${fecha(f.finEsp)}</td>
      <td>${editable ? `<input type="date" data-t="${f.id}" data-k="inicio_real" value="${f.inicio_real || ''}">` : fecha(f.inicio_real)}</td>
      <td>${editable ? `<input type="date" data-t="${f.id}" data-k="fin_real" value="${f.fin_real || ''}">` : fecha(f.fin_real)}</td>
      <td class="num">${editable ? `<input class="cant" data-t="${f.id}" data-k="avance" value="${Math.round(f.avance * 100)}" inputmode="numeric">%` : pct(f.avance)}</td>
      <td class="num col-opc">${pct(f.esperado)}</td><td><span class="etiqueta t-${f.estado}">${ESTADOS_TAREA[f.estado]}</span></td></tr>`).join('')}
    </tbody></table></div>`;
  const grafico = `<div class="gantt-cont"><div class="gantt" style="width:${dias * W + 220}px">
    <div class="g-cab" style="margin-left:220px">${lineas.map(d => `<div class="g-dia${d.getDay() === 1 ? ' lunes' : ''}" style="width:${W}px">${d.getDay() === 1 ? `<span>${fecha(d).slice(0, 5)}</span>` : ''}</div>`).join('')}</div>
    <div class="g-cuerpo">
      <div class="g-rejilla" style="left:220px">${lineas.map((d, i) => `<i style="left:${i * W}px" class="${d.getDay() === 0 || d.getDay() === 6 || ctx.fest.has(iso(d)) ? 'libre' : ''}"></i>`).join('')}
        <b class="g-hoy" style="left:${x(corte) + W / 2}px"></b></div>
      ${filas.map((f, i) => {
        const finReal = f.fin_real ? aFecha(f.fin_real) : (f.inicio_real ? corte : null);
        return `<div class="g-fila"><div class="g-nombre">${i + 1}. ${esc(f.nombre)}</div>
          <div class="g-barras" style="left:220px">
            <span class="g-esp" style="left:${x(f.inicio_esperado) + 3}px;width:${x(f.finEsp) - x(f.inicio_esperado) + W - 6}px"></span>
            ${f.inicio_real ? `<span class="g-real t-${f.estado}" style="left:${x(f.inicio_real) + 2}px;width:${Math.max(W - 4, x(finReal) - x(f.inicio_real) + W - 4)}px"></span>` : ''}
          </div></div>`;
      }).join('')}
    </div></div></div>
    <div class="g-leyenda"><span><i class="l-esp"></i>Esperado</span><span><i class="l-real"></i>Real (color según estado)</span><span><i class="l-hoy"></i>Fecha de corte ${fecha(corte)}</span></div>`;
  const kp = `<div class="kpis">
    <div class="kpi"><div class="et">Fecha de corte</div><div class="va">${fecha(corte)}</div><div class="su">${ctx.e.fecha_corte ? 'Fijada en ajustes' : 'Hoy'} · ${DIAS_TRABAJO[ctx.e.dias_trabajo]}</div></div>
    <div class="kpi"><div class="et">Esperado al corte</div><div class="va">${pct(g.esperadoTotal)}</div><div class="barra"><i style="width:${g.esperadoTotal * 100}%;background:var(--esperado)"></i></div></div>
    <div class="kpi"><div class="et">Avance real</div><div class="va">${pct(g.realTotal)}</div><div class="barra"><i style="width:${g.realTotal * 100}%"></i></div></div>
    <div class="kpi"><div class="et">Estado de la obra</div><div class="va" style="font-size:20px">${g.realTotal + 0.005 >= g.esperadoTotal ? 'A tiempo' : 'Con retraso'}</div><div class="su">${pct(g.realTotal - g.esperadoTotal)} frente a lo esperado</div></div></div>`;
  const cuerpoXls = () => `<h1>Cronograma ${esc(ctx.e.nombre)}</h1>${tabla.replace(/<input[^>]*value="([^"]*)"[^>]*>%?/g, '$1')}`;
  return { html: kp + `<div class="barra-doc"><div class="sub">${editable ? 'Escribe aquí las fechas reales y el avance; el estado, el peso y los totales se calculan solos.' : 'Cronograma del encargo.'}</div><div class="barra-acc">${ctx.esCliente ? '' : btnIco('excel', 'Descargar Excel', 'id="xls-g"')}</div></div>` + grafico + tabla,
    montar: () => {
      const b = $('#xls-g'); if (b) b.onclick = () => descargar(nombreArchivo(ctx.e, 'gantt', { fecha: iso(new Date()) }, 'xls'), cuerpoXls(), 'xls');
      document.querySelectorAll('[data-t]').forEach(inp => inp.onchange = async () => {
        let v = inp.value;
        if (inp.dataset.k === 'avance') v = Math.min(1, Math.max(0, Number(v) / 100));
        else v = v || null;
        try { await D.actualizarTarea(inp.dataset.t, { [inp.dataset.k]: v }); ctx.recargar(); } catch (err) { alert(err.message); }
      });
    } };
}

// ---------------- Informes ----------------
async function informes(ctx) {
  const lista = await D.documentos(ctx.e.id, 'informe');
  if (!lista.length) return { html: vacioDoc(ctx, 'informes') };
  const d = lista.at(-1);
  const g = await datosGantt({ ...ctx, e: { ...ctx.e, fecha_corte: d.contenido.corte || ctx.e.fecha_corte } });
  const conteo = k => g.filas.filter(f => f.estado === k).length;
  const resp = ctx.e.responsables.map(r => {
    const t = g.filas.filter(f => f.responsable_id === r.id);
    return { r, n: t.length, peso: t.reduce((s, f) => s + f.peso, 0), avance: t.reduce((s, f) => s + f.peso * f.avance, 0) / (t.reduce((s, f) => s + f.peso, 0) || 1) };
  });
  const cuerpo = () => `
    <h1 class="doc-titulo">Informe de avance de obra ${String(d.numero).padStart(2, '0')}</h1><p class="doc-sub">Corte al ${fecha(g.corte)}</p>
    <h3>Detalles técnicos del encargo</h3>
    <dl class="datos det">
      <dt>Encargo</dt><dd>${esc(ctx.e.nombre)}</dd><dt>Cliente</dt><dd>${xxx(ctx.e.cliente?.nombre)}</dd>
      <dt>Ubicación</dt><dd>${xxx(ctx.e.direccion)}</dd><dt>Inicio · Fin</dt><dd>${fecha(ctx.e.inicio)} · ${fecha(ctx.e.fin)}</dd><dt>Días de trabajo</dt><dd>${DIAS_TRABAJO[ctx.e.dias_trabajo]}</dd></dl>
    <h3>Resumen del avance</h3>
    <table><tbody><tr><td>Esperado al corte</td><td class="num">${pct(g.esperadoTotal)}</td></tr><tr><td>Avance real</td><td class="num">${pct(g.realTotal)}</td></tr>
      <tr><td>Estado de la obra</td><td class="num">${g.realTotal + 0.005 >= g.esperadoTotal ? 'A tiempo' : 'Con retraso'}</td></tr></tbody></table>
    <p class="sub">${conteo('fin_antes') + conteo('fin_tiempo') + conteo('fin_retraso')} finalizadas · ${conteo('en_curso') + conteo('en_curso_retraso')} en curso · ${conteo('sin_iniciar')} sin iniciar · ${conteo('retrasada')} retrasadas</p>
    <h3>Actividades</h3>
    <table><thead><tr><th>N°</th><th>Actividad</th><th class="num">Peso</th><th>Fin esp.</th><th class="num">Avance</th><th>Estado</th></tr></thead><tbody>
    ${g.filas.map((f, i) => `<tr><td>${i + 1}</td><td>${esc(f.nombre)}</td><td class="num">${pct(f.peso)}</td><td>${fecha(f.finEsp)}</td><td class="num">${pct(f.avance)}</td><td>${ESTADOS_TAREA[f.estado]}</td></tr>`).join('')}</tbody></table>
    <h3>Responsables</h3>
    <table><thead><tr><th>N°</th><th>Responsable</th><th class="num">Actividades</th><th class="num">Peso</th><th class="num">Avance</th></tr></thead><tbody>
    ${resp.map(x => `<tr><td>${x.r.numero}</td><td>${esc(x.r.nombre)}</td><td class="num">${x.n}</td><td class="num">${pct(x.peso)}</td><td class="num">${pct(x.avance)}</td></tr>`).join('')}</tbody></table>
    <h3>Observaciones</h3><p>${esc(d.contenido.observaciones || '')}</p>
    <div class="cierre">Cordialmente,<br><br>Área de Proyectos<br><b>REGENERATIVO</b></div>`;
  return { html: barraDoc(ctx, d, 'informe') + `<article class="hoja">${cuerpo()}</article>`, montar: () => montarBarra(ctx, d, 'informe', cuerpo) };
}

export const VISTAS = { brief, propuesta, contrato, adendas, presupuesto, gantt, informes };

// ---------------- Base de precios (portal) ----------------
export async function vistaBase(admin, pestaña = 'apu') {
  if (pestaña === 'insumos') {
    const l = await D.insumos();
    const conflictos = l.filter(i => i.revisar).length;
    return { html: `${tabs('insumos')}<p class="sub">${l.length} insumos únicos. ${conflictos ? `<span class="xxx">${conflictos} venían con precios distintos en el Excel</span>; quedó el más usado. Revísalos.` : ''}</p>
      <div class="filtros"><input id="buscar" placeholder="Buscar insumo"></div>
      <div class="tabla-cont"><table><thead><tr><th>Cód.</th><th>Insumo</th><th>Tipo</th><th>Und</th><th class="num">Precio</th><th class="col-opc">Nota</th></tr></thead><tbody id="filas">
      ${l.map(i => `<tr data-q="${esc((i.nombre).toLowerCase())}"><td class="sub">${i.codigo}</td><td>${esc(i.nombre)}</td><td>${i.tipo === 'material' ? 'Material' : 'Mano de obra'}</td><td>${esc(i.unidad)}</td>
        <td class="num">${admin ? `<input class="cant ancho-p" data-ins="${i.id}" value="${Math.round(i.precio)}" inputmode="numeric">` : cop(i.precio)}</td><td class="col-opc sub ${i.revisar ? 'xxx' : ''}">${esc(i.revisar || '')}</td></tr>`).join('')}</tbody></table></div>`,
      montar: (recargar) => {
        $('#buscar').oninput = ev => document.querySelectorAll('#filas tr').forEach(tr => tr.style.display = tr.dataset.q.includes(ev.target.value.toLowerCase()) ? '' : 'none');
        document.querySelectorAll('[data-ins]').forEach(inp => inp.onchange = async () => { await D.actualizarInsumo(inp.dataset.ins, { precio: Number(inp.value.replace(/\D/g, '')), fecha_precio: iso(new Date()), revisar: null }); recargar(); });
      } };
  }
  const l = await D.apus();
  return { html: `${tabs('apu')}<p class="sub">${l.length} APU. El valor unitario = Σ (coeficiente × precio del insumo), redondeado hacia arriba a la centena. Si cambias el precio de un insumo, todos los APU que lo usan se actualizan.</p>
    <div class="filtros"><input id="buscar" placeholder="Buscar por código o descripción"></div>
    <div class="tabla-cont"><table><thead><tr><th>Código</th><th>Descripción</th><th class="col-opc">Actividad</th><th>Und</th><th class="num">Valor</th></tr></thead><tbody id="filas">
    ${l.map(a => `<tr class="clic" data-apu="${a.id}" data-q="${esc((a.codigo + ' ' + a.descripcion).toLowerCase())}"><td class="sub">${esc(a.codigo)}</td><td>${esc(a.descripcion)}${a.valor_manual ? ' <span class="sub">(valor fijo)</span>' : ''}</td><td class="col-opc sub">${esc(a.actividad || '')}</td><td>${esc(a.unidad)}</td><td class="num">${cop(a.valor)}</td></tr>`).join('')}</tbody></table></div>`,
    montar: () => {
      $('#buscar').oninput = ev => document.querySelectorAll('#filas tr').forEach(tr => tr.style.display = tr.dataset.q.includes(ev.target.value.toLowerCase()) ? '' : 'none');
      document.querySelectorAll('[data-apu]').forEach(tr => tr.onclick = () => modalApu(tr.dataset.apu));
    } };
}
const tabs = act => `<div class="filtros"><a class="btn ${act === 'apu' ? '' : 'sec'} mini" href="#/base-precios">APU</a><a class="btn ${act === 'insumos' ? '' : 'sec'} mini" href="#/base-precios/insumos">Insumos</a></div>`;

// ---------------- Resumen del encargo: avance y valor del contrato ----------------
export async function indicadores(ctx) {
  try {
    const [g, props, adendas] = await Promise.all([datosGantt(ctx), D.documentos(ctx.e.id, 'propuesta'), D.documentos(ctx.e.id, 'adenda')]);
    const inicial = props.at(-1)?.contenido?.honorarios || 0;
    const ad = adendas.filter(a => ['aprobado', 'firmado'].includes(a.estado)).reduce((s, a) => s + (a.contenido.valor || 0), 0);
    return { avance: g.filas.length ? g.realTotal : null, esperado: g.esperadoTotal, contrato: inicial ? inicial + ad : null };
  } catch (e) { return {}; }
}
