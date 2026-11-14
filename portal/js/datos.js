// Capa de datos: Supabase cuando está configurado; si no, modo demostración (localStorage).
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js?v=60';

// Demostración: sin base de datos, o abriendo regenerativo.co/portal/?demo (datos ficticios guardados solo en el navegador)
export const MODO_DEMO = !SUPABASE_URL || !SUPABASE_ANON_KEY || new URLSearchParams(location.search).has('demo');
let sb = null;

async function cliente() {
  if (!sb) {
    let mod;
    try { mod = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'); }
    catch (e) {
      try { mod = await import('https://esm.sh/@supabase/supabase-js@2'); }
      catch (e2) { throw new Error('No se pudo conectar con el servidor. Revisa tu conexión a internet y recarga la página.'); }
    }
    const { createClient } = mod;
    sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return sb;
}

// ---------------- Datos de ejemplo ----------------
const FESTIVOS_CO = [
  ['2026-01-01','Año Nuevo'],['2026-01-12','Reyes Magos'],['2026-03-23','San José'],['2026-04-02','Jueves Santo'],
  ['2026-04-03','Viernes Santo'],['2026-05-01','Día del Trabajo'],['2026-05-18','Ascensión del Señor'],['2026-06-08','Corpus Christi'],
  ['2026-06-15','Sagrado Corazón'],['2026-06-29','San Pedro y San Pablo'],['2026-07-20','Independencia'],['2026-08-07','Batalla de Boyacá'],
  ['2026-08-17','Asunción de la Virgen'],['2026-10-12','Día de la Raza'],['2026-11-02','Todos los Santos'],['2026-11-16','Independencia de Cartagena'],
  ['2026-12-08','Inmaculada Concepción'],['2026-12-25','Navidad'],
  ['2027-01-01','Año Nuevo'],['2027-01-11','Reyes Magos'],['2027-03-22','San José'],['2027-03-25','Jueves Santo'],
  ['2027-03-26','Viernes Santo'],['2027-05-01','Día del Trabajo'],['2027-05-10','Ascensión del Señor'],['2027-05-31','Corpus Christi'],
  ['2027-06-07','Sagrado Corazón'],['2027-07-05','San Pedro y San Pablo'],['2027-07-20','Independencia'],['2027-08-07','Batalla de Boyacá'],
  ['2027-08-16','Asunción de la Virgen'],['2027-10-18','Día de la Raza'],['2027-11-01','Todos los Santos'],['2027-11-15','Independencia de Cartagena'],
  ['2027-12-08','Inmaculada Concepción'],['2027-12-25','Navidad'],
].map(([fecha, nombre]) => ({ fecha, nombre }));

const SEMILLA = {
  servicios: [
    { id: 's1', nombre: 'Arquitectura', orden: 1 },
    { id: 's2', nombre: 'Diseño de Espacios', orden: 2 },
    { id: 's3', nombre: 'Muebles y Objetos', orden: 3 },
    { id: 's4', nombre: 'Conceptualización de Proyectos', orden: 4 },
    { id: 's5', nombre: 'Otro', orden: 5 },
  ],
  clientes: [
    { id: 'c1', tipo: 'empresa', nombre: 'CLIENTE EMPRESA SAS', documento: 'NIT XXX', representante: '' },
    { id: 'c2', tipo: 'persona', nombre: 'XXX', documento: '', representante: '' },
  ],
  encargos: [
    { id: 'e1', codigo: 'SCREG_20001', nombre: '20  I  PROYECTO', cliente_id: 'c2', servicio_id: 's2', tipo: 'obra',
      direccion: 'XXX', ciudad: 'Bogotá', area_m2: null, inicio: '2026-11-10', fin: '2026-12-10',
      dias_trabajo: 'lv', fecha_corte: null, estado: 'activo' },
    { id: 'e2', codigo: 'SCREG_20002', nombre: '20  I  PROYECTO DOS', cliente_id: 'c1', servicio_id: 's2', tipo: 'diseno',
      direccion: 'XXX', ciudad: 'Bogotá', area_m2: null, inicio: '2026-07-30', fin: '2026-12-18',
      dias_trabajo: 'lv', fecha_corte: null, estado: 'activo' },
  ],
  responsables: [],
  festivos: FESTIVOS_CO,
};

const CLAVE = 'reg-portal-demo-v2';
function leer() {
  try { const d = JSON.parse(localStorage.getItem(CLAVE)); if (d && d.encargos) return d; } catch (e) {}
  return structuredClone(SEMILLA);
}
function guardar(d) { try { localStorage.setItem(CLAVE, JSON.stringify(d)); } catch (e) {} }
const nuevoId = () => Math.random().toString(36).slice(2, 10);

// ---------------- Sesión ----------------
export async function sesion() {
  if (MODO_DEMO) {
    try { return JSON.parse(sessionStorage.getItem('reg-demo-sesion')); } catch (e) { return null; }
  }
  const { data } = await (await cliente()).auth.getSession();
  return data.session ? { email: data.session.user.email, id: data.session.user.id } : null;
}

export async function ingresar(email, clave) {
  if (MODO_DEMO) {
    const s = { email, id: 'demo', admin: true };
    try { sessionStorage.setItem('reg-demo-sesion', JSON.stringify(s)); } catch (e) {}
    return s;
  }
  const { data, error } = await (await cliente()).auth.signInWithPassword({ email, password: clave });
  if (error) throw new Error('Correo o contraseña incorrectos.');
  _admin = null;
  return { email: data.user.email, id: data.user.id };
}

/** Clientes: nombre (o código) del encargo + contraseña asignada por regenerativo. */
export async function ingresarCliente(encargo, clave) {
  if (MODO_DEMO) return ingresar('cliente@demo', clave);
  const c = await cliente();
  const { data: email } = await c.rpc('usuario_cliente', { p_encargo: encargo });
  if (!email) throw new Error('Encargo o contraseña incorrectos.');
  const { data, error } = await c.auth.signInWithPassword({ email, password: clave });
  if (error) throw new Error('Encargo o contraseña incorrectos.');
  _admin = null;
  return { email: data.user.email, id: data.user.id };
}

export async function asignarAccesoCliente(encargoId, clave, quitar = false) {
  if (MODO_DEMO) throw new Error('Disponible cuando el portal esté conectado a la base de datos.');
  const { data, error } = await (await cliente()).functions.invoke('acceso-cliente', { body: { encargo_id: encargoId, clave, quitar } });
  if (error) {
    let msg = 'No se pudo guardar el acceso.';
    try { msg = (await error.context.json()).error || msg; } catch (e) {}
    throw new Error(msg);
  }
  return data;
}

export async function salir() {
  if (MODO_DEMO) { try { sessionStorage.removeItem('reg-demo-sesion'); } catch (e) {} return; }
  _admin = null; _festivos = null;
  await (await cliente()).auth.signOut();
}

export async function recuperarClave(email) {
  if (MODO_DEMO) return;
  const { error } = await (await cliente()).auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
  if (error) throw error;
}

/** Enlaces de invitación o recuperación: Supabase vuelve con #access_token=…&type=invite|recovery */
export async function procesarEnlace() {
  // Enlaces de invitación y recuperación: los tokens llegan en el hash (#access_token=…) o como ?code= (PKCE).
  // Se leen a mano para que funcione aunque el hash venga mezclado (p. ej. "#/nueva-clave#access_token=…").
  const h = location.hash, code = new URLSearchParams(location.search).get('code');
  if (MODO_DEMO || (!/access_token=|error_description=/.test(h) && !code)) return null;
  const c = await cliente();
  if (code) {
    const { error } = await c.auth.exchangeCodeForSession(code);
    history.replaceState(null, '', location.pathname + '#/nueva-clave');
    if (error) return { error: 'El enlace ya no es válido. Pide uno nuevo.' };
    return { tipo: 'recovery' };
  }
  const q = new URLSearchParams(h.slice(h.lastIndexOf('#') + 1).replace(/^\/?/, ''));
  if (q.get('error_description')) return { error: q.get('error_description') };
  let { data } = await c.auth.getSession();
  if (!data?.session && q.get('access_token') && q.get('refresh_token')) {
    const r = await c.auth.setSession({ access_token: q.get('access_token'), refresh_token: q.get('refresh_token') });
    if (r.error) return { error: 'El enlace ya no es válido. Pide uno nuevo.' };
  }
  history.replaceState(null, '', location.pathname + '#/nueva-clave');
  return { tipo: q.get('type') || 'recovery' };
}

export async function cambiarClave(clave) {
  const { error } = await (await cliente()).auth.updateUser({ password: clave });
  if (error) throw new Error(error.message.includes('least') ? 'La contraseña debe tener al menos 8 caracteres.' : error.message);
}

let _admin = null, _festivos = null;
export async function esAdmin() {
  if (MODO_DEMO) { try { return (JSON.parse(sessionStorage.getItem('reg-demo-sesion')) || {}).email !== 'cliente@demo'; } catch (e) { return true; } }
  if (_admin === null) { const { data } = await (await cliente()).rpc('es_admin'); _admin = !!data; }
  return _admin;
}

// ---------------- Catálogos ----------------
export async function servicios() {
  if (MODO_DEMO) return leer().servicios;
  const { data, error } = await (await cliente()).from('servicios').select('*').eq('activo', true).order('orden');
  if (error) throw error; return data;
}
export async function clientes() {
  if (MODO_DEMO) return leer().clientes;
  const { data, error } = await (await cliente()).from('clientes').select('*').order('nombre');
  if (error) throw error; return data;
}
export async function festivos() {
  if (MODO_DEMO) return leer().festivos;
  if (_festivos) return _festivos;
  const { data, error } = await (await cliente()).from('festivos').select('fecha,nombre').order('fecha');
  if (error) throw error; _festivos = data; return data;
}
export async function crearCliente(c) {
  if (MODO_DEMO) { const d = leer(); const n = { ...c, id: nuevoId() }; d.clientes.push(n); guardar(d); return n; }
  const { data, error } = await (await cliente()).from('clientes').insert(c).select().single();
  if (error) throw error; return data;
}

export async function actualizarCliente(id, cambios) {
  if (MODO_DEMO) { const d = leer(); const c = d.clientes.find(x => x.id === id); Object.assign(c, cambios); guardar(d); return c; }
  const { data, error } = await (await cliente()).from('clientes').update(cambios).eq('id', id).select().single();
  if (error) throw error; return data;
}
/** Usuarios del portal: perfil, rol general y encargos donde participa (solo administración). */
export async function usuarios() {
  if (MODO_DEMO) return [{ id: 'u1', nombre: 'Administración', email: 'apardo@regenerativo.co', telefono: '', roles: ['admin'], encargos: [] }];
  const c = await cliente();
  const [p, r, m] = await Promise.all([
    c.from('perfiles').select('*').order('email'), c.from('roles_usuario').select('*'),
    c.from('miembros_encargo').select('usuario_id, rol, encargo:encargos(nombre)')]);
  for (const x of [p, r, m]) if (x.error) throw x.error;
  return p.data.map(u => ({ ...u, roles: r.data.filter(x => x.usuario_id === u.id).map(x => x.rol),
    encargos: m.data.filter(x => x.usuario_id === u.id).map(x => ({ nombre: x.encargo?.nombre || '', rol: x.rol })) }));
}
export async function actualizarPerfil(id, cambios) {
  const { data, error } = await (await cliente()).from('perfiles').update(cambios).eq('id', id).select().single();
  if (error) throw error; return data;
}

// ---------------- Encargos ----------------
export async function encargos() {
  if (MODO_DEMO) {
    const d = leer();
    return d.encargos.map(e => ({ ...e,
      cliente: d.clientes.find(c => c.id === e.cliente_id) || null,
      servicio: d.servicios.find(s => s.id === e.servicio_id) || null }));
  }
  const { data, error } = await (await cliente()).from('encargos')
    .select('*, cliente:clientes(*), servicio:servicios(*)').order('codigo', { ascending: false });
  if (error) throw error; return data;
}

/** Dirección limpia del encargo: "26  I  PRUEBA ENCARGO DEMO" → "prueba-encargo-demo" */
export const slugEncargo = e => (e.nombre || e.codigo).replace(/^\s*\d{2}\s+I\s+/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export async function encargo(codigo) {
  const lista = await encargos();
  const e = lista.find(x => x.codigo === codigo || slugEncargo(x) === codigo);
  if (!e) return null;
  if (MODO_DEMO) { e.responsables = leer().responsables.filter(r => r.encargo_id === e.id).sort((a, b) => a.numero - b.numero); return e; }
  const { data } = await (await cliente()).from('encargo_responsables').select('*').eq('encargo_id', e.id).order('numero');
  e.responsables = data || [];
  return e;
}

/** Siguiente código SCREG_aaNNN según los existentes del año. */
export async function siguienteCodigo(anio = new Date().getFullYear()) {
  const aa = String(anio).slice(2);
  const usados = [...(await encargos()), ...(await propuestas().catch(() => []))];
  const nums = usados.map(e => (new RegExp(`^SCREG_${aa}(\\d{3})$`).exec(e.codigo) || [])[1]).filter(Boolean).map(Number);
  const n = (nums.length ? Math.max(...nums) : 0) + 1;
  return `SCREG_${aa}${String(n).padStart(3, '0')}`;
}

export async function crearEncargo(e) {
  if (MODO_DEMO) {
    const d = leer();
    if (d.encargos.some(x => x.codigo === e.codigo)) throw new Error('Ya existe un encargo con ese código.');
    const n = { ...e, id: nuevoId() }; d.encargos.push(n); guardar(d); return n;
  }
  const { data, error } = await (await cliente()).from('encargos').insert(e).select().single();
  if (error) throw new Error(error.message.includes('duplicate') ? 'Ya existe un encargo con ese código.' : error.message);
  return data;
}

export async function actualizarEncargo(id, cambios) {
  if (MODO_DEMO) { const d = leer(); const e = d.encargos.find(x => x.id === id); Object.assign(e, cambios); guardar(d); return e; }
  const { data, error } = await (await cliente()).from('encargos').update(cambios).eq('id', id).select().single();
  if (error) throw error; return data;
}

export async function guardarResponsables(encargoId, lista) {
  if (MODO_DEMO) {
    const d = leer();
    d.responsables = d.responsables.filter(r => r.encargo_id !== encargoId)
      .concat(lista.map((r, i) => ({ ...r, id: r.id || nuevoId(), encargo_id: encargoId, numero: i + 1 })));
    guardar(d); return;
  }
  const c = await cliente();
  const { error } = await c.rpc('guardar_responsables', { p_encargo: encargoId, p_lista: lista.map((r, i) => ({ ...r, numero: i + 1 })) });
  if (error) throw error;
}

export async function invitar(email, encargoId, rol) {
  if (MODO_DEMO) throw new Error('Las invitaciones se activan cuando el portal esté conectado a la base de datos.');
  const { data, error } = await (await cliente()).functions.invoke('invitar',
    { body: { email, encargo_id: encargoId, rol, redirect: location.origin + location.pathname } });
  if (error) {
    let msg = 'No se pudo enviar la invitación.';
    try { msg = (await error.context.json()).error || msg; } catch (e) {}
    throw new Error(msg);
  }
  return data;
}

export function reiniciarDemo() { try { localStorage.removeItem(CLAVE); } catch (e) {} }

// ---------------- Propuestas preliminares ----------------
export const ESTADOS_PROPUESTA = { borrador: 'Borrador', en_espera: 'En espera', despego: 'Despegó', no_despego: 'No despegó' };

export async function propuestas() {
  if (MODO_DEMO) {
    const d = leer(); d.propuestas = d.propuestas || [];
    const hoy = new Date().toISOString().slice(0, 10);
    d.propuestas.forEach(p => { if (p.estado === 'en_espera' && p.fecha_envio && diasEntre(p.fecha_envio, hoy) >= 30) { p.estado = 'no_despego'; p.motivo = p.motivo || 'Sin respuesta en 30 días'; } });
    guardar(d);
    return d.propuestas.map(p => ({ ...p, cliente: d.clientes.find(c => c.id === p.cliente_id) || null, servicio: d.servicios.find(x => x.id === p.servicio_id) || null }));
  }
  const c = await cliente();
  await c.rpc('vencer_propuestas');
  const { data, error } = await c.from('propuestas').select('*, cliente:clientes(*), servicio:servicios(*)').order('codigo', { ascending: false });
  if (error) throw error; return data;
}

export async function crearPropuesta(p) {
  if (MODO_DEMO) { const d = leer(); d.propuestas = d.propuestas || []; const n = { ...p, id: nuevoId(), estado: 'borrador', fecha: new Date().toISOString().slice(0, 10) }; d.propuestas.push(n); guardar(d); return n; }
  const { data, error } = await (await cliente()).from('propuestas').insert(p).select().single();
  if (error) throw new Error(error.message.includes('duplicate') ? 'Ya existe una propuesta con ese código.' : error.message);
  return data;
}

export async function actualizarPropuesta(id, cambios) {
  if (MODO_DEMO) { const d = leer(); const p = d.propuestas.find(x => x.id === id); Object.assign(p, cambios); guardar(d); return p; }
  const { data, error } = await (await cliente()).from('propuestas').update(cambios).eq('id', id).select().single();
  if (error) throw error; return data;
}

/** Propuesta (cotización) de la que nació el encargo: ahí vive la información del proyecto. */
export async function propuestaDeEncargo(encargoId) {
  if (MODO_DEMO) { const d = leer(); return (d.propuestas || []).find(p => p.encargo_id === encargoId) || null; }
  try { const { data } = await (await cliente()).from('propuestas').select('*').eq('encargo_id', encargoId).maybeSingle(); return data || null; }
  catch (e) { return null; }
}

/** "Despegó": crea el encargo "26  I  NOMBRE" con el mismo código. Devuelve el código. */
export async function despegarPropuesta(id) {
  if (MODO_DEMO) {
    const d = leer(); const p = d.propuestas.find(x => x.id === id);
    const e = { id: nuevoId(), codigo: p.codigo, nombre: `${p.codigo.slice(6, 8)}  I  ${p.nombre.toUpperCase()}`, cliente_id: p.cliente_id, servicio_id: p.servicio_id,
      tipo: p.tipo, inicio: new Date().toISOString().slice(0, 10), fin: null, dias_trabajo: 'lv', estado: 'activo' };
    d.encargos.push(e); Object.assign(p, { estado: 'despego', encargo_id: e.id, fecha_decision: e.inicio }); guardar(d); return p.codigo;
  }
  const { data, error } = await (await cliente()).rpc('despegar_propuesta', { p_id: id });
  if (error) throw new Error(error.message.includes('duplicate') ? 'Ya existe un encargo con ese código.' : error.message);
  return data;
}

function diasEntre(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }

// ================= Módulos del encargo =================
async function q(fn) { if (MODO_DEMO) throw new Error('Este módulo funciona con la base de datos conectada.'); return fn(await cliente()); }
const ok = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

export const documentos = (encargoId, tipo) => q(c => c.from('documentos').select('*').eq('encargo_id', encargoId).eq('tipo', tipo).order('numero').order('version')).then(ok);
export const hayPresupuesto = encargoId => q(c => c.from('presupuestos').select('id', { count: 'exact', head: true }).eq('encargo_id', encargoId)).then(r => { if (r.error) throw r.error; return r.count || 0; });
export const docsEncargo = encargoId => q(c => c.from('documentos').select('id, tipo, estado, numero, version, contenido').eq('encargo_id', encargoId)).then(ok);
export const actualizarDocumento = (id, cambios) => q(c => c.from('documentos').update(cambios).eq('id', id).select().single()).then(ok);
export const crearDocumento = doc => q(c => c.from('documentos').insert(doc).select().single()).then(ok);
export const aprobarDocumento = (id, nombre, cedula) => q(c => c.rpc('aprobar_documento', { p_doc: id, p_nombre: nombre, p_cedula: cedula })).then(ok);

export async function presupuestoCompleto(encargoId) {
  const lista = await q(c => c.from('presupuestos').select('*, capitulos:presupuesto_capitulos(*, actividades:presupuesto_actividades(*, items:presupuesto_items(*, apu:apus(codigo))))').eq('encargo_id', encargoId).order('version', { ascending: false })).then(ok);
  const p = lista[0]; if (!p) return null;
  p.capitulos.sort((a, b) => a.orden - b.orden).forEach(c => { c.actividades.sort((a, b) => a.orden - b.orden).forEach(a => a.items.sort((x, y) => x.orden - y.orden)); });
  return p;
}
export async function presupuestoResumen(encargoId) {
  const lista = await q(c => c.from('presupuestos').select('*').eq('encargo_id', encargoId).order('version', { ascending: false })).then(ok);
  const p = lista[0]; if (!p) return null;
  p.resumen = await q(c => c.rpc('presupuesto_resumen', { p_presupuesto: p.id })).then(ok);
  p.totalesActividad = await q(c => c.rpc('presupuesto_totales_actividad', { p_presupuesto: p.id })).then(ok);
  return p;
}
export const actualizarItem = (id, cambios) => q(c => c.from('presupuesto_items').update(cambios).eq('id', id)).then(ok);
export const eliminarItem = id => q(c => c.from('presupuesto_items').delete().eq('id', id)).then(ok);
export const agregarItem = item => q(c => c.from('presupuesto_items').insert(item)).then(ok);
export const actualizarPresupuesto = (id, cambios) => q(c => c.from('presupuestos').update(cambios).eq('id', id)).then(ok);

export const apus = () => q(c => c.from('v_apus').select('*').order('codigo')).then(ok).then(l => l.sort((a, b) => ordenCodigo(a.codigo, b.codigo)));
export const apuDetalle = id => q(c => c.from('apu_insumos').select('coeficiente, orden, insumo:insumos(*)').eq('apu_id', id).order('orden')).then(ok);
export const insumos = () => q(c => c.from('insumos').select('*').order('nombre')).then(ok);
export const actualizarInsumo = (id, cambios) => q(c => c.from('insumos').update(cambios).eq('id', id)).then(ok);

export const ganttTareas = encargoId => q(c => c.from('gantt_tareas').select('*').eq('encargo_id', encargoId).order('orden')).then(ok);
export const actualizarTarea = (id, cambios) => q(c => c.from('gantt_tareas').update(cambios).eq('id', id)).then(ok);

export function ordenCodigo(a, b) {
  const n = s => s.split(/[.\-]/).map(Number);
  const x = n(a), y = n(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; }
  return 0;
}

const demoCliente = () => { try { return (JSON.parse(sessionStorage.getItem('reg-demo-sesion')) || {}).email === 'cliente@demo'; } catch (e) { return false; } };
export const miRol = encargoId => MODO_DEMO ? Promise.resolve(demoCliente() ? 'cliente' : 'admin') : q(c => c.rpc('rol_en_encargo', { p_encargo: encargoId })).then(ok);

// ================= Finanzas (solo perfil de facturación) =================
export const esFacturacion = () => MODO_DEMO ? Promise.resolve(false) : q(c => c.rpc('es_facturacion')).then(ok);
export const finCategorias = () => q(c => c.from('fin_categorias').select('*').eq('activa', true).order('tipo').order('orden')).then(ok);
export const finMovimientos = () => q(c => c.from('fin_movimientos').select('*, categoria:fin_categorias(nombre,icono), encargo:encargos(codigo,nombre)').order('fecha', { ascending: false })).then(ok);
export const finGuardarMovimiento = m => q(c => m.id ? c.from('fin_movimientos').update(m).eq('id', m.id) : c.from('fin_movimientos').insert(m)).then(ok);
export const finBorrarMovimiento = id => q(c => c.from('fin_movimientos').delete().eq('id', id)).then(ok);
export const finBorrarEjemplos = () => q(c => c.from('fin_movimientos').delete().eq('ejemplo', true)).then(ok);
export const finActualizarCategoria = (id, cambios) => q(c => c.from('fin_categorias').update(cambios).eq('id', id)).then(ok);
export const finMovimientosEncargo = encargoId => q(c => c.from('fin_movimientos').select('*, categoria:fin_categorias(nombre,icono)').eq('encargo_id', encargoId).order('fecha', { ascending: false })).then(ok);
export const finPropuestasEncargos = () => q(c => c.from('propuestas').select('encargo_id, honorarios').not('encargo_id', 'is', null)).then(ok);
export const finDocumentosCobro = () => q(c => c.from('documentos').select('encargo_id, tipo, estado, contenido').in('tipo', ['propuesta', 'adenda'])).then(ok);

// Soportes contables (PDF, XML, fotos) por movimiento — bucket privado "soportes"
export const finSoportes = movId => q(c => c.from('fin_soportes').select('*').eq('movimiento_id', movId).order('creado')).then(ok);
export async function finSubirSoporte(movId, archivo) {
  const limpio = archivo.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.\- ]/g, '_');
  const ruta = `${movId}/${Date.now()}_${limpio}`;
  const c = await cliente();
  const { error } = await c.storage.from('soportes').upload(ruta, archivo, { contentType: archivo.type || 'application/octet-stream' });
  if (error) throw error;
  return q(c2 => c2.from('fin_soportes').insert({ movimiento_id: movId, nombre: archivo.name, ruta })).then(ok);
}
export async function finUrlSoporte(ruta) {
  const { data, error } = await (await cliente()).storage.from('soportes').createSignedUrl(ruta, 300);
  if (error) throw error; return data.signedUrl;
}
export async function finBorrarSoporte(s) {
  await (await cliente()).storage.from('soportes').remove([s.ruta]);
  return q(c => c.from('fin_soportes').delete().eq('id', s.id)).then(ok);
}

// OneDrive (función onedrive-conexion): url | estado | despegar | subir
export async function onedrive(accion, extra = {}) {
  const { data, error } = await (await cliente()).functions.invoke('onedrive-conexion', { body: { accion, ...extra } });
  if (error) { let m = error.message; try { m = (await error.context.json()).error || m; } catch (_) {} throw new Error(m); }
  if (data?.error) throw new Error(data.error);
  return data;
}

// ---------------- Comentarios y dudas del cliente ----------------
export async function comentarios(encargoId) {
  if (MODO_DEMO) return [];
  const { data, error } = await (await cliente()).from('comentarios').select('*').eq('encargo_id', encargoId).order('creado', { ascending: false });
  if (error) throw error; return data || [];
}
export async function comentariosAbiertos() {
  if (MODO_DEMO) return [];
  const { data, error } = await (await cliente()).from('comentarios').select('id,texto,tipo,creado,autor_nombre,encargo:encargos(id,codigo,nombre)').eq('estado', 'abierto').order('creado', { ascending: false });
  if (error) return []; return data || [];
}
/** Guarda el comentario y avisa por correo a proyectos@regenerativo.co (si el correo falla, el comentario igual queda guardado). */
export async function comentar(encargoId, texto, tipo = 'comentario', autorNombre = '', avisar = true) {
  const c = await cliente();
  const { data: u } = await c.auth.getUser();
  const { data, error } = await c.from('comentarios').insert({ encargo_id: encargoId, texto, tipo, autor: u.user.id, autor_nombre: autorNombre || u.user.email, estado: avisar ? 'abierto' : 'resuelto' }).select().single();
  if (error) throw error;
  const aviso = avisar ? await onedrive('aviso_comentario', { comentario_id: data.id }).catch(e => ({ enviado: false, motivo: e.message })) : null;
  return { comentario: data, aviso };
}
export async function responderComentario(id, cambios) {
  const c = await cliente();
  const { data: u } = await c.auth.getUser();
  const extra = cambios.respuesta ? { respondido_por: u.user.id, respondido: new Date().toISOString() } : {};
  const { error } = await c.from('comentarios').update({ ...cambios, ...extra }).eq('id', id);
  if (error) throw error;
}
