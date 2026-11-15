// Lectura de la exportación CSV de MONAI → movimientos de regenerativo (misma regla siempre, para que reimportar no duplique)
const CAT = { Income: 'Ingresos', 'Payroll Expenses': 'Nómina y honorarios', Tools: 'Herramientas', Transport: 'Transporte', Debts: 'Deudas', Viaticos: 'Viáticos' };
const TAG = { reg_income: 'Honorarios', reg_resources: 'Recursos', reg_tools: 'Herramientas', reg_suscriptions: 'Suscripciones', reg_transport: 'Transporte',
  debt_bank: 'Banco', debt_credit: 'Crédito', reg_food_others: 'Alimentación y otros', reg_saves: 'Ahorros', reg_others: 'Otros' };
const SUBS = { 'Ingresos': ['Honorarios', 'Otros ingresos'], 'Nómina y honorarios': ['Recursos'], 'Transporte': ['Transporte'], 'Viáticos': ['Alimentación y otros', 'Ahorros'],
  'Herramientas': ['Herramientas', 'Suscripciones', 'Otros'], 'Deudas': ['Banco', 'Impuestos', 'Crédito'] };

function csv(texto) {
  const filas = []; let f = [], c = '', q = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (q) { if (ch === '"') { if (texto[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { f.push(c); c = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && texto[i + 1] === '\n') i++; f.push(c); filas.push(f); f = []; c = ''; }
    else c += ch;
  }
  if (c || f.length) { f.push(c); filas.push(f); }
  return filas.filter(r => r.some(x => x.trim()));
}

// Fecha local de Bogotá (UTC−5, sin horario de verano)
const fechaBogota = iso => new Date(new Date(iso).getTime() - 5 * 3600e3).toISOString().slice(0, 10);

export function leerMonai(texto) {
  const [cab, ...filas] = csv(texto.replace(/^﻿/, ''));
  const k = n => cab.indexOf(n);
  if (k('id') < 0 || k('amount') < 0 || k('category') < 0) throw new Error('El archivo no parece una exportación de MONAI (faltan columnas id, amount o category).');
  const desconocidas = new Set();
  const movs = filas.map(r => {
    const g = n => (r[k(n)] ?? '').trim();
    const cat = CAT[g('category')];
    if (!cat) { desconocidas.add(g('category')); return null; }
    const cop = g('original_currency') === 'COP' && g('original_amount');
    const valor = Math.round(Math.abs(Number(cop ? g('original_amount') : g('amount'))));
    const descripcion = g('purpose');
    const tags = g('tags').split(';').map(t => TAG[t.trim()]).filter(Boolean);
    let sub = tags.find(t => SUBS[cat].includes(t)) || null;
    if (cat === 'Ingresos' && (/otro/i.test(descripcion) || /^ingreso$/i.test(descripcion))) sub = 'Otros ingresos';
    if (!sub) sub = cat === 'Deudas' && /dian|impuesto/i.test(descripcion) ? 'Impuestos' : SUBS[cat][0];
    return { ref: 'monai:' + g('id'), fecha: fechaBogota(g('date')), valor, descripcion, tipo: cat === 'Ingresos' ? 'ingreso' : 'gasto', cat, sub };
  }).filter(Boolean);
  return { movs, desconocidas: [...desconocidas] };
}
