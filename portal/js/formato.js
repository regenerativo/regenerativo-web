// Formatos de regenerativo y calendario de días de trabajo.

/** 8200000 -> "8.200.000 COP" (punto de miles, sin símbolo de peso, sin decimales). */
export function cop(valor) {
  if (valor === null || valor === undefined || valor === '' || isNaN(valor)) return '—';
  const n = Math.round(Number(valor));
  const s = Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (n < 0 ? '-' : '') + s + ' COP';
}

/** Date | "aaaa-mm-dd" -> "dd/mm/aaaa" */
export function fecha(f) {
  const d = aFecha(f);
  if (!d) return '—';
  return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Fecha para códigos de documento: "aaaa mm dd" */
export function fechaCodigo(f) {
  const d = aFecha(f);
  if (!d) return 'XXXX XX XX';
  return `${d.getFullYear()} ${dos(d.getMonth() + 1)} ${dos(d.getDate())}`;
}

export function pct(x) {
  if (x === null || x === undefined || isNaN(x)) return '—';
  return Math.round(x * 100) + '%';
}

export function aFecha(f) {
  if (!f) return null;
  if (f instanceof Date) return new Date(f.getFullYear(), f.getMonth(), f.getDate());
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(f);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}

export function iso(d) {
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

function dos(n) { return String(n).padStart(2, '0'); }

/** Días de trabajo: 'lv' lunes a viernes, 'ls' lunes a sábado, 'todos'. */
export function esDiaDeTrabajo(d, modo, festivos) {
  const w = d.getDay(); // 0 domingo
  if (modo === 'lv' && (w === 0 || w === 6)) return false;
  if (modo === 'ls' && w === 0) return false;
  return !festivos.has(iso(d));
}

/** Días de trabajo entre dos fechas, ambas incluidas. */
export function diasDeTrabajo(desde, hasta, modo = 'lv', festivos = new Set()) {
  let a = aFecha(desde), b = aFecha(hasta);
  if (!a || !b || b < a) return 0;
  let n = 0;
  for (let d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) {
    if (esDiaDeTrabajo(d, modo, festivos)) n++;
  }
  return n;
}

/** Fecha de corte: la escrita o, si está vacía, hoy. */
export function fechaCorte(corte) {
  return aFecha(corte) || aFecha(new Date());
}

export const DIAS_TRABAJO = { lv: 'Lunes a viernes', ls: 'Lunes a sábado', todos: 'Todos los días' };
export const TIPOS = { diseno: 'Solo diseño', obra: 'Obra', ambos: 'Diseño y obra' };
export const ESTADOS_ENCARGO = { activo: 'Activo', pausado: 'Pausado', cerrado: 'Cerrado' };

/** Fecha en que termina una actividad que arranca en `inicio` y dura `n` días de trabajo. */
export function finDeTrabajo(inicio, n, modo = 'lv', festivos = new Set()) {
  let d = aFecha(inicio); if (!d || !n) return d;
  let c = 0;
  for (let i = 0; i < 1000; i++) {
    if (esDiaDeTrabajo(d, modo, festivos)) { c++; if (c >= n) return d; }
    d = new Date(d); d.setDate(d.getDate() + 1);
  }
  return d;
}

export const ESTADOS_TAREA = {
  sin_iniciar: 'Sin iniciar', retrasada: 'Retrasada', en_curso: 'En curso', en_curso_retraso: 'En curso con retraso',
  fin_antes: 'Finalizada antes', fin_tiempo: 'Finalizada a tiempo', fin_retraso: 'Finalizada con retraso',
};
