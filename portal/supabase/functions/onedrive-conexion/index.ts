// Conexión del portal con el OneDrive de regenerativo (Microsoft Graph, permisos delegados de apardo@).
// GET  ?code=…&state=…  → regreso de Microsoft: guarda el token y vuelve al portal.
// POST {accion}         → solo administración:
//   'url'      → dirección para autorizar la conexión
//   'estado'   → si está conectado
//   'despegar' → {encargo_id}: crea "REG/26  I  NOMBRE" desde la plantilla; copia Word+PDF de la propuesta a LEGALES/00 PROPUESTA y solo el PDF a DOC _ ENV/AAAA MM DD _ PROPUESTA ECONÓMICA
//   'subir'    → {encargo_id, carpeta, nombre, base64}: guarda un archivo en la carpeta del encargo
//   'propuesta'→ {propuesta_id}: crea la carpeta de la propuesta "SCREG_26xxx_NOMBRE" en ZL_REG_PROPUESTAS
//   'subir_propuesta' → {propuesta_id, nombre, base64}: guarda el Word de la propuesta en su carpeta (y su ruta en la propuesta)
//   'descargar_propuesta' → {propuesta_id}: devuelve el Word de la propuesta en base64
//   'archivos_propuesta' → {propuesta_id}: lista Word/PDF/Excel de la carpeta de la propuesta
//   'archivo_propuesta'  → {propuesta_id, nombre, pdf?}: descarga uno (pdf=true convierte el Word a PDF)
//   'eliminar_propuesta' → {propuesta_id}: borra la propuesta del portal y manda su carpeta de ZL_REG_PROPUESTAS a la papelera de OneDrive
//   'archivos_encargo' → {encargo_id, fuentes}: documentos de las carpetas del módulo (plantilla nueva o nombres viejos)
//   'conteos_encargo'  → {encargo_id, modulos}: cuántos documentos tiene cada módulo
//   'explorar'         → {encargo_id, ruta}: carpetas y archivos de una carpeta del encargo
//   'archivo_encargo'  → {encargo_id, carpeta, ruta, pdf?}: descarga uno
//   'explorar_reg' / 'archivo_reg' → {ruta}: folders de toda la carpeta REG (solo administración)
//   'aviso_respuesta' → {comentario_id}: correo al cliente con la respuesta de regenerativo
//   'gantt_excel'     → {encargo_id, crear?}: (administración y equipo) pasa el cronograma del portal al Excel de PROGRAMACIÓN; crear=true lo crea desde la plantilla
//   'revisar_envios'  → {clave}: (cada hora, pg_cron) correo al cliente con los documentos nuevos de DOC _ ENV
import { createClient } from "npm:@supabase/supabase-js@2";

const TENANT = "d5bde326-cff3-4067-b8ed-8821209cee21";
const CLIENTE = "5fb20396-2b10-470b-b028-86f4b6e9d9ca";
const ALCANCE = "offline_access Files.ReadWrite Mail.Read User.Read";
// Al conectar se pide también Mail.Send (avisos de comentarios de clientes). La renovación usa ALCANCE para no romper OneDrive.
const ALCANCE_CONEXION = ALCANCE + " Mail.Send";
const CORREO_PROYECTOS = "proyectos@regenerativo.co";
const CARPETAS_CLIENTE = ["DOC _ ENV", "DOC _ ENVIADOS"];
const CARPETAS_RECIBIDOS = ["DOC _ REC", "DOC _ RECIBIDOS"];
// Legales que ve el cliente: mismas secciones que el equipo, pero solo los PDF
const LEGALES_CLIENTE: [string, string[]][] = [
  ["Propuesta", ["LEGALES/00 PROPUESTA", "LEGALES/PROP _ ECONOMICAS"]],
  ["Contratos", ["LEGALES/01 CONTRATOS", "LEGALES/OPS CONTRATOS"]],
  ["Adendas", ["LEGALES/02 ADENDAS"]],
  ["Actas de entrega", ["LEGALES/03 ACTAS DE ENTREGA", "LEGALES/04 ACTAS DE ENTREGA"]],
  ["Cuentas de cobro", ["LEGALES/04 CUENTAS DE COBRO", "LEGALES/05 CUENTAS DE COBRO", "LEGALES/CUENTAS DE COBRO"]],
  ["Facturación", ["LEGALES/05 FACTURACION"]],
];
const RAICES_LEGALES = LEGALES_CLIENTE.flatMap(([, c]) => c);
async function legalesCliente(at: string, encargoId: string) {
  const una = async (cands: string[]) => {
    for (const c of cands) {
      const r = await archivosEncargo(at, encargoId, [[c]]);
      if (!r.web) continue;   // esa carpeta no existe: se prueba la siguiente
      return { titulo: c.split("/").pop(), archivos: r.archivos.filter((a: any) => /\.pdf$/i.test(a.nombre) && !/XXXX/.test(a.ruta)).map(({ web: _w, ...a }: any) => a) };
    }
    return null;
  };
  // con el nombre de la carpeta tal cual está en OneDrive, en el orden de LEGALES
  return { secciones: (await Promise.all(LEGALES_CLIENTE.map(([, c]) => una(c)))).filter(Boolean) };
}
const CARPETAS_VISOR: Record<string, string[]> = { presupuesto: ["PRESUPUESTO"], gantt: ["PROGRAMACIÓN", "PROGRAMACION"] };
const PORTAL = "https://regenerativo.co/portal/";
const RAIZ = "REG";
const PROPUESTAS = "REG/REG  I  GESTION INTEGRAL/ZL_REG_PROPUESTAS";
// Plantilla de gestión documental de regenerativo (REG  I  GESTION INTEGRAL/ZL_REG_LIBRERIAS/REG_TEM DOCUMENTAL)
const ESTRUCTURA = [
  "COOR _ ADMIN", "COOR _ ADMIN/00 INFORMES ADMIN", "COOR _ OBRA", "COOR _ OBRA/00 INFORMES OBRA", "COOR _ OBRA/COOR _ PERSONAL",
  "COOR _ TÉCNICA", "COOR _ TÉCNICA/00 INFORMES TÉCNICOS", "COOR _ TÉCNICA/ARQ", "COOR _ TÉCNICA/MEP", "COOR _ TÉCNICA/STR",
  "DOC _ ENV", "DOC _ REC", "IMAGEN _ VISUAL",
  "LEGALES", "LEGALES/00 PROPUESTA", "LEGALES/01 CONTRATOS", "LEGALES/02 ADENDAS",
  "LEGALES/03 ACTAS DE ENTREGA", "LEGALES/04 CUENTAS DE COBRO", "LEGALES/05 FACTURACION",
  "PRESUPUESTO", "PROGRAMACIÓN", "ZL_OBSOLETOS",
];
const CARPETA_PROPUESTA = "LEGALES/00 PROPUESTA";
const PLANTILLA = "REG/REG  I  GESTION INTEGRAL/ZL_REG_LIBRERIAS/REG_TEM DOCUMENTAL";
// Lee la plantilla viva de OneDrive: cualquier carpeta que se agregue allá se crea en los encargos nuevos
async function carpetasPlantilla(at: string, rel = "", out: string[] = []) {
  for (const h of await hijos(at, rel ? `${PLANTILLA}/${rel}` : PLANTILLA)) {
    if (!h.folder) continue;
    const r = rel ? `${rel}/${h.name}` : h.name;
    out.push(r);
    await carpetasPlantilla(at, r, out);
  }
  return out;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (c: unknown, s = 200) => new Response(JSON.stringify(c), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const URL_SB = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(URL_SB, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const REDIRECCION = `${URL_SB}/functions/v1/onedrive-conexion`;
const enc = (p: string) => p.split("/").map(encodeURIComponent).join("/");

async function token(form: Record<string, string>) {
  const r = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENTE, client_secret: Deno.env.get("MS_CLIENT_SECRET") ?? "", scope: ALCANCE, ...form }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error_description || d.error || "Microsoft rechazó la conexión");
  return d;
}

async function accesoGraph() {
  const { data } = await admin.from("integraciones").select("refresh_token").eq("id", "onedrive").maybeSingle();
  if (!data?.refresh_token) throw new Error("OneDrive no está conectado. Conéctalo en Ajustes generales.");
  const t = await token({ grant_type: "refresh_token", refresh_token: data.refresh_token });
  if (t.refresh_token) await admin.from("integraciones").update({ refresh_token: t.refresh_token, actualizado: new Date().toISOString() }).eq("id", "onedrive");
  return t.access_token as string;
}

async function graph(at: string, ruta: string, init: RequestInit = {}) {
  const r = await fetch(`https://graph.microsoft.com/v1.0${ruta}`, { ...init, headers: { Authorization: `Bearer ${at}`, "Content-Type": "application/json", ...(init.headers || {}) } });
  if (r.status === 204) return null;
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(d?.error?.message || `Graph ${r.status}`); (e as any).status = r.status; throw e; }
  return d;
}

async function asegurarCarpeta(at: string, ruta: string) {
  const partes = ruta.split("/"); const nombre = partes.pop()!; const padre = partes.join("/");
  try { return await graph(at, `/me/drive/root:/${enc(ruta)}`); } catch (_) { /* no existe */ }
  const destino = padre ? `/me/drive/root:/${enc(padre)}:/children` : `/me/drive/root/children`;
  return await graph(at, destino, { method: "POST", body: JSON.stringify({ name: nombre, folder: {}, "@microsoft.graph.conflictBehavior": "fail" }) });
}

async function despegar(at: string, encargoId: string) {
  const { data: e } = await admin.from("encargos").select("id,codigo,nombre").eq("id", encargoId).single();
  if (!e) throw new Error("Encargo no encontrado");
  const base = `${RAIZ}/${e.nombre.toUpperCase()}`;
  await asegurarCarpeta(at, base);
  let estructura = ESTRUCTURA;
  try { const p = await carpetasPlantilla(at); if (p.length) estructura = p; } catch (_) { /* si no se lee la plantilla, se usa la lista fija */ }
  for (const sub of estructura) await asegurarCarpeta(at, `${base}/${sub}`);
  await admin.from("encargos").update({ onedrive_carpeta: base }).eq("id", e.id);
  // La propuesta aprobada se COPIA (el original queda en ZL_REG_PROPUESTAS):
  // LEGALES/00 PROPUESTA → Word y PDF sueltos · DOC _ ENV/AAAA MM DD _ PROPUESTA ECONÓMICA → solo el PDF
  const legales: string[] = []; let enviados: any = null;
  try {
    const ap = await propuestaAprobada(at, e.id);
    const dl = await asegurarCarpeta(at, `${base}/${CARPETA_PROPUESTA}`);
    if (ap.word) legales.push(await copiarItem(at, ap.word, dl.id));
    if (ap.pdf) legales.push(await copiarItem(at, ap.pdf, dl.id));
    else if (ap.word) { const n = await pdfDesdeWord(at, ap.word, dl.id); if (n) legales.push(n); }
    enviados = await propuestaEnviados(at, e.id, ap);
  } catch (_) { /* no detiene el despegue */ }
  return { carpeta: base, legales, enviados };
}

// Word y PDF de la propuesta aprobada (carpeta de la propuesta en ZL_REG_PROPUESTAS o donde indique archivo_ruta)
async function propuestaAprobada(at: string, encargoId: string) {
  const { data: e } = await admin.from("encargos").select("codigo").eq("id", encargoId).single();
  const { data: p } = await admin.from("propuestas").select("fecha_envio,archivo_ruta").eq("encargo_id", encargoId).maybeSingle();
  const archivos: any[] = [];
  const leer = async (ruta: string) => {
    for (const h of await hijos(at, ruta)) {
      if (h.file) archivos.push(h);
      else if (h.folder) for (const x of await hijos(at, `${ruta}/${h.name}`)) if (x.file) archivos.push(x);
    }
  };
  if (p?.archivo_ruta) { try { await leer(p.archivo_ruta.split("/").slice(0, -1).join("/")); } catch (_) { /* ruta vieja */ } }
  if (!archivos.length && e?.codigo) {
    for (const h of await hijos(at, PROPUESTAS)) {
      if (!h.name.toUpperCase().startsWith(e.codigo.toUpperCase())) continue;
      if (h.file) archivos.push(h); else await leer(`${PROPUESTAS}/${h.name}`);
    }
  }
  const rec = (l: any[]) => l.sort((a, b) => (b.lastModifiedDateTime || "").localeCompare(a.lastModifiedDateTime || ""))[0];
  const mejor = (l: any[]) => rec(l.filter((x) => /SCREG_|PROPUESTA/i.test(x.name))) || rec(l);
  return {
    fecha: p?.fecha_envio as string | null,
    pdf: mejor(archivos.filter((x) => /\.pdf$/i.test(x.name))),
    word: mejor(archivos.filter((x) => /\.docx?$/i.test(x.name))),
  };
}
async function copiarItem(at: string, item: any, destinoId: string) {
  await graph(at, `/me/drive/items/${item.id}/copy?@microsoft.graph.conflictBehavior=replace`, { method: "POST", body: JSON.stringify({ parentReference: { id: destinoId }, name: item.name }) });
  return item.name as string;
}
async function pdfDesdeWord(at: string, word: any, destinoId: string) {
  const r = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${word.id}/content?format=pdf`, { headers: { Authorization: `Bearer ${at}` } });
  if (!r.ok) return null;
  const nombre = word.name.replace(/\.docx?$/i, ".pdf");
  const u = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${destinoId}:/${encodeURIComponent(nombre)}:/content?@microsoft.graph.conflictBehavior=replace`, {
    method: "PUT", headers: { Authorization: `Bearer ${at}`, "Content-Type": "application/pdf" }, body: await r.arrayBuffer(),
  });
  return u.ok ? nombre : null;
}
// DOC _ ENV/"AAAA MM DD _ PROPUESTA ECONÓMICA" (fecha de envío de la propuesta) con solo el PDF aprobado
async function propuestaEnviados(at: string, encargoId: string, ap?: Awaited<ReturnType<typeof propuestaAprobada>>) {
  ap = ap || await propuestaAprobada(at, encargoId);
  const base = await baseEncargo(encargoId);
  const fecha = String(ap.fecha || new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })).slice(0, 10).replaceAll("-", " ");
  const env = (await primeraCarpeta(at, base, CARPETAS_CLIENTE)) || "DOC _ ENV";
  await asegurarCarpeta(at, `${base}/${env}`);
  const nombre = `${fecha} _ PROPUESTA ECONÓMICA`;
  const destino = await asegurarCarpeta(at, `${base}/${env}/${nombre}`);
  const archivo = ap.pdf ? await copiarItem(at, ap.pdf, destino.id) : ap.word ? await pdfDesdeWord(at, ap.word, destino.id) : null;
  return { carpeta: `${env}/${nombre}`, archivo };
}

async function carpetaPropuesta(at: string, propuestaId: string) {
  const { data: p } = await admin.from("propuestas").select("codigo,nombre,archivo_ruta").eq("id", propuestaId).single();
  if (!p) throw new Error("Propuesta no encontrada");
  const ruta = `${PROPUESTAS}/${p.codigo.toUpperCase()}_${p.nombre.toUpperCase()}`;
  await asegurarCarpeta(at, ruta);
  // Propuesta nueva sin Word: se crea su Word desde la plantilla SCREG_2XXXX_PROPUESTA.docx
  if (!p.archivo_ruta) {
    const t = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${enc(`${PROPUESTAS}/SCREG_2XXXX_PROPUESTA.docx`)}:/content`, { headers: { Authorization: `Bearer ${at}` } });
    if (t.ok) {
      const nombre = `${p.codigo.toUpperCase()}_${p.nombre.toUpperCase()}.docx`;
      const r = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${enc(`${ruta}/${nombre}`)}:/content?@microsoft.graph.conflictBehavior=fail`, {
        method: "PUT", headers: { Authorization: `Bearer ${at}`, "Content-Type": "application/octet-stream" }, body: await t.arrayBuffer(),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok || r.status === 409) {   // 409: ya había un Word con ese nombre; se enlaza sin pisarlo
        await admin.from("propuestas").update({ archivo_ruta: `${ruta}/${nombre}`, archivo_web: d.webUrl, archivo_nombre: nombre }).eq("id", propuestaId);
        return { carpeta: ruta, ruta: `${ruta}/${nombre}`, word: true };
      }
    }
  }
  return { carpeta: ruta };
}

// Carpeta donde está el Word de la propuesta (o la carpeta por código si aún no tiene)
async function carpetaDocs(at: string, propuestaId: string) {
  const { data: p } = await admin.from("propuestas").select("archivo_ruta").eq("id", propuestaId).single();
  if (p?.archivo_ruta) return p.archivo_ruta.split("/").slice(0, -1).join("/");
  return (await carpetaPropuesta(at, propuestaId)).carpeta;
}

async function subirPropuesta(at: string, propuestaId: string, nombre: string, base64: string) {
  const carpeta = await carpetaDocs(at, propuestaId);
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const r = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${enc(`${carpeta}/${nombre}`)}:/content`, {
    method: "PUT", headers: { Authorization: `Bearer ${at}`, "Content-Type": "application/octet-stream" }, body: bytes,
  });
  const d = await r.json(); if (!r.ok) throw new Error(d?.error?.message || "No se pudo subir");
  await admin.from("propuestas").update({ archivo_ruta: `${carpeta}/${nombre}`, archivo_web: d.webUrl, archivo_nombre: nombre }).eq("id", propuestaId);
  return { ruta: `${carpeta}/${nombre}`, web: d.webUrl };
}

const b64 = (buf: ArrayBuffer) => { const b = new Uint8Array(buf); let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };

async function descargarPropuesta(at: string, propuestaId: string) {
  const { data: p } = await admin.from("propuestas").select("archivo_ruta").eq("id", propuestaId).single();
  if (!p?.archivo_ruta) throw new Error("Esta propuesta no tiene documento cargado.");
  const r = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${enc(p.archivo_ruta)}:/content`, { headers: { Authorization: `Bearer ${at}` } });
  if (!r.ok) throw new Error("No se pudo descargar el documento de OneDrive.");
  return { base64: b64(await r.arrayBuffer()), nombre: p.archivo_ruta.split("/").pop() };
}

// Documentos de la carpeta de la propuesta (Word, PDF, Excel)
async function archivosPropuesta(at: string, propuestaId: string) {
  const carpeta = await carpetaDocs(at, propuestaId);
  const d = await graph(at, `/me/drive/root:/${enc(carpeta)}:/children?$top=200&$select=name,file,webUrl,size,lastModifiedDateTime`);
  const archivos = (d?.value || []).filter((x: any) => x.file && /\.(docx?|pdf|xlsx?)$/i.test(x.name))
    .map((x: any) => ({ nombre: x.name, web: x.webUrl, tamano: x.size, fecha: x.lastModifiedDateTime }));
  return { carpeta, archivos };
}

// Descarga un documento de la carpeta de la propuesta; pdf=true convierte el Word a PDF
async function archivoPropuesta(at: string, propuestaId: string, nombre: string, pdf = false) {
  if (!nombre || nombre.includes("/")) throw new Error("Archivo no válido.");
  const carpeta = await carpetaDocs(at, propuestaId);
  const r = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${enc(`${carpeta}/${nombre}`)}:/content${pdf ? "?format=pdf" : ""}`, { headers: { Authorization: `Bearer ${at}` } });
  if (!r.ok) throw new Error(pdf ? "No se pudo convertir el Word a PDF." : "No se pudo descargar el archivo.");
  return { base64: b64(await r.arrayBuffer()), nombre: pdf ? nombre.replace(/\.docx?$/i, ".pdf") : nombre };
}

// Elimina una propuesta que no ha despegado: su carpeta en ZL_REG_PROPUESTAS va a la papelera de OneDrive (recuperable) y se borra del portal
async function eliminarPropuesta(at: string, propuestaId: string) {
  const { data: p } = await admin.from("propuestas").select("id,codigo,nombre,encargo_id,archivo_ruta").eq("id", propuestaId).single();
  if (!p) throw new Error("Propuesta no encontrada");
  if (p.encargo_id) throw new Error("Esta propuesta ya despegó y tiene un encargo: no se puede eliminar desde aquí.");
  const carpeta = p.archivo_ruta ? p.archivo_ruta.split("/").slice(0, -1).join("/") : `${PROPUESTAS}/${p.codigo.toUpperCase()}_${p.nombre.toUpperCase()}`;
  const nombre = carpeta.split("/").pop() || "";
  let borrada: string | null = null;
  // Solo se borra una carpeta propia de la propuesta: dentro de ZL_REG_PROPUESTAS y con nombre que empieza por su código
  if (carpeta.startsWith(PROPUESTAS + "/") && carpeta.split("/").length === PROPUESTAS.split("/").length + 1 && nombre.toUpperCase().startsWith(p.codigo.toUpperCase())) {
    try {
      const it = await graph(at, `/me/drive/root:/${enc(carpeta)}?$select=id`);
      await graph(at, `/me/drive/items/${it.id}`, { method: "DELETE" });
      borrada = carpeta;
    } catch (e) { if ((e as any).status !== 404) throw e; }
  }
  const { error } = await admin.from("propuestas").delete().eq("id", p.id);
  if (error) throw new Error(error.message);
  return { carpeta: borrada };
}

// Documentos de una carpeta del encargo (incluye un nivel de subcarpetas), para verlos desde el portal
async function baseEncargo(encargoId: string) {
  const { data: e } = await admin.from("encargos").select("nombre,onedrive_carpeta").eq("id", encargoId).single();
  if (!e) throw new Error("Encargo no encontrado");
  return e.onedrive_carpeta || `${RAIZ}/${e.nombre.toUpperCase()}`;
}
const rutaSegura = (r: string) => { if (!r || r.split("/").some((x) => x === ".." || x === "")) throw new Error("Ruta no válida."); return r; };

// Fuentes de un módulo: lista de grupos; de cada grupo se usa la primera carpeta que exista (plantilla nueva o nombres viejos).
// "RUTA#0" = solo los archivos sueltos de esa carpeta (sin subcarpetas).
type Fuente = string[];
async function hijos(at: string, ruta: string) {
  const sel = "$top=200&$select=id,name,file,folder,webUrl,size,lastModifiedDateTime";
  return (await graph(at, `/me/drive/root:/${enc(ruta)}:/children?${sel}`))?.value || [];
}
async function recorrer(at: string, base: string, rel: string, prof: number, out: any[]) {
  for (const h of await hijos(at, `${base}/${rel}`)) {
    const r = `${rel}/${h.name}`;
    if (h.file) out.push({ nombre: h.name, carpeta: rel, ruta: r, web: h.webUrl, fecha: h.lastModifiedDateTime });
    else if (h.folder && prof > 0) await recorrer(at, base, r, prof - 1, out);
  }
}
async function archivosEncargo(at: string, encargoId: string, fuentes: Fuente[] | string) {
  const base = await baseEncargo(encargoId);
  const grupos: Fuente[] = typeof fuentes === "string" ? [[fuentes]] : fuentes;
  const archivos: any[] = []; let web: string | null = null;
  for (const g of grupos) {
    for (const cand of g) {
      const [ruta, p] = cand.split("#"); rutaSegura(ruta);
      let it; try { it = await graph(at, `/me/drive/root:/${enc(`${base}/${ruta}`)}?$select=webUrl,folder`); } catch (_) { continue; }
      web = web || it.webUrl;
      await recorrer(at, base, ruta, p === "0" ? 0 : 3, archivos);
      break;
    }
  }
  archivos.sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  return { web, archivos };
}

// Cuántos archivos tiene cada módulo (para mostrar solo los módulos con datos)
async function conteosEncargo(at: string, encargoId: string, modulos: Record<string, Fuente[]>) {
  const base = await baseEncargo(encargoId);
  const contarGrupo = async (g: Fuente) => {
    for (const cand of g) {
      const [ruta, p] = cand.split("#");
      let it; try { it = await graph(at, `/me/drive/root:/${enc(`${base}/${ruta}`)}?$select=folder`); } catch (_) { continue; }
      return p === "0" ? (await hijos(at, `${base}/${ruta}`)).filter((x: any) => x.file).length : (it.folder?.childCount || 0);
    }
    return 0;
  };
  const pares = await Promise.all(Object.entries(modulos).map(async ([m, grupos]) => [m, (await Promise.all(grupos.map(contarGrupo))).reduce((a, b) => a + b, 0)] as const));
  return Object.fromEntries(pares);
}

// Explorador de carpetas (del encargo o de toda la carpeta REG)
async function explorarEn(at: string, base: string, ruta = "") {
  if (ruta) rutaSegura(ruta);
  const raiz = await graph(at, `/me/drive/root:/${enc(ruta ? `${base}/${ruta}` : base)}?$select=webUrl`);
  const sel = "$top=200&$select=name,file,folder,webUrl,size,lastModifiedDateTime";
  const l = (await graph(at, `/me/drive/root:/${enc(ruta ? `${base}/${ruta}` : base)}:/children?${sel}`))?.value || [];
  const items = l.map((x: any) => ({ nombre: x.name, carpeta: !!x.folder, n: x.folder?.childCount ?? null, web: x.webUrl, fecha: x.lastModifiedDateTime, tamano: x.size }))
    .sort((a: any, b: any) => (Number(b.carpeta) - Number(a.carpeta)) || a.nombre.localeCompare(b.nombre));
  return { web: raiz.webUrl, base, items };
}
const explorar = async (at: string, encargoId: string, ruta = "") => explorarEn(at, await baseEncargo(encargoId), ruta);
async function descargarEn(at: string, ruta: string, pdf = false) {
  const r = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${enc(ruta)}:/content${pdf ? "?format=pdf" : ""}`, { headers: { Authorization: `Bearer ${at}` } });
  if (!r.ok) throw new Error(pdf ? "No se pudo convertir a PDF." : "No se pudo descargar el archivo.");
  const nombre = ruta.split("/").pop()!;
  return { base64: b64(await r.arrayBuffer()), nombre: pdf ? nombre.replace(/\.[^.]+$/, ".pdf") : nombre };
}

async function archivoEncargo(at: string, encargoId: string, carpeta: string, ruta: string, pdf = false) {
  const base = `${await baseEncargo(encargoId)}/${carpeta ? rutaSegura(carpeta) + "/" : ""}${rutaSegura(ruta)}`;
  const r = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${enc(base)}:/content${pdf ? "?format=pdf" : ""}`, { headers: { Authorization: `Bearer ${at}` } });
  if (!r.ok) throw new Error(pdf ? "No se pudo convertir a PDF." : "No se pudo descargar el archivo.");
  const nombre = ruta.split("/").pop()!;
  return { base64: b64(await r.arrayBuffer()), nombre: pdf ? nombre.replace(/\.[^.]+$/, ".pdf") : nombre };
}

async function subir(at: string, encargoId: string, carpeta: string, nombre: string, base64: string) {
  const { data: e } = await admin.from("encargos").select("nombre,onedrive_carpeta").eq("id", encargoId).single();
  const base = e?.onedrive_carpeta || `${RAIZ}/${e?.nombre.toUpperCase()}`;
  await asegurarCarpeta(at, base);
  await asegurarCarpeta(at, `${base}/${carpeta}`);
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const r = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${enc(`${base}/${carpeta}/${nombre}`)}:/content`, {
    method: "PUT", headers: { Authorization: `Bearer ${at}`, "Content-Type": "application/octet-stream" }, body: bytes,
  });
  const d = await r.json(); if (!r.ok) throw new Error(d?.error?.message || "No se pudo subir");
  return { ruta: `${base}/${carpeta}/${nombre}`, web: d.webUrl };
}

// Aviso por correo de un comentario o duda de cliente a proyectos@regenerativo.co
// Membrete de los correos: encabezado y pie van como imagen (Stolzl se ve igual en cualquier correo); el texto en Metronic Pro con Arial de respaldo.
const MEMB = "https://regenerativo.co/portal/assets/correo";
const membrete = (contenido: string) => `<!doctype html><html><head><meta charset="utf-8"><style>@font-face{font-family:"Metronic Pro";src:url(https://regenerativo.co/portal/assets/fonts/metronic-regular.woff) format("woff")}</style></head>
<body style="margin:0;padding:0;background:#ffffff"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#ffffff;border-collapse:collapse;margin:0">
<tr><td style="padding:32px 32px 0"><img src="${MEMB}/membrete-sup.png" width="440" alt="PORTAL DE ENCARGOS · regenerativo" style="display:block;width:440px;max-width:100%;height:auto;border:0"></td></tr>
<tr><td style="padding:30px 32px 8px;font-family:'Metronic Pro',Arial,sans-serif;color:#1D1D1B;font-size:15px;line-height:1.55">${contenido}</td></tr>
<tr><td style="padding:34px 32px 32px"><img src="${MEMB}/membrete-inf.png" width="440" alt="Área de Proyectos · Por _ regenerativo · www.regenerativo.co · @_regenerativo_ · +57 320 215 0932" style="display:block;width:440px;max-width:100%;height:auto;border:0"></td></tr>
</table></body></html>`;
const CEJA = (t: string) => `<p style="margin:0 0 6px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#7A7A7A">${t}</p>`;
const BOTON = (url: string) => `<p style="margin:24px 0"><a href="${url}" style="display:inline-block;background:#1D1D1B;color:#fff;text-decoration:none;border-radius:999px;padding:11px 22px;font-size:14px">Ver en el portal</a></p>`;
const NOTA = `<p style="margin:0;color:#7A7A7A;font-size:12px">Entra en la pestaña Clientes con el nombre del encargo y tu contraseña.</p>`;
async function avisoComentario(id: string) {
  const { data: c } = await admin.from("comentarios").select("id,texto,tipo,autor_nombre,avisado,creado,encargo:encargos(nombre,codigo)").eq("id", id).single();
  if (!c) throw new Error("Comentario no encontrado.");
  if (c.avisado) return { enviado: true, ya: true };
  const { data: ig } = await admin.from("integraciones").select("refresh_token").eq("id", "onedrive").maybeSingle();
  if (!ig?.refresh_token) return { enviado: false, motivo: "OneDrive no está conectado." };
  let at: string;
  try {
    const t = await token({ grant_type: "refresh_token", refresh_token: ig.refresh_token, scope: "offline_access Mail.Send" });
    at = t.access_token;
  } catch (_) { return { enviado: false, motivo: "Falta el permiso para enviar correos: reconecta OneDrive en Ajustes." }; }
  const e: any = c.encargo || {};
  const esc = (s: string) => (s || "").replace(/[&<>]/g, (x) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" } as any)[x]);
  const html = membrete(`${CEJA(`${c.tipo === "duda" ? "Duda" : "Comentario"} de cliente`)}
    <h2 style="margin:0 0 6px;font-weight:400;font-size:22px;line-height:1.3">${esc(e.nombre)}</h2>
    <p style="color:#7A7A7A;margin:0 0 18px">${esc(c.autor_nombre || "Cliente")} · ${new Date(c.creado).toLocaleString("es-CO", { timeZone: "America/Bogota" })}</p>
    <p style="font-size:16px;line-height:1.5;border-top:1px dotted #CFCFCF;border-bottom:1px dotted #CFCFCF;padding:12px 0">${esc(c.texto).replace(/\n/g, "<br>")}</p>
    <p style="margin:24px 0"><a href="${PORTAL}#/encargos" style="display:inline-block;background:#1D1D1B;color:#fff;text-decoration:none;border-radius:999px;padding:11px 22px;font-size:14px">Responder en el portal</a></p>`);
  const r = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST", headers: { Authorization: `Bearer ${at}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { subject: `${c.tipo === "duda" ? "Duda" : "Comentario"} de cliente · ${e.nombre}`, body: { contentType: "HTML", content: html }, toRecipients: [{ emailAddress: { address: CORREO_PROYECTOS } }] }, saveToSentItems: false }),
  });
  if (!r.ok) return { enviado: false, motivo: "No se pudo enviar el correo." };
  await admin.from("comentarios").update({ avisado: new Date().toISOString() }).eq("id", id);
  return { enviado: true };
}

async function correoProyectos(asunto: string, html: string) {
  const { data: ig } = await admin.from("integraciones").select("refresh_token").eq("id", "onedrive").maybeSingle();
  if (!ig?.refresh_token) return false;
  try {
    const t = await token({ grant_type: "refresh_token", refresh_token: ig.refresh_token, scope: "offline_access Mail.Send" });
    const r = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
      method: "POST", headers: { Authorization: `Bearer ${t.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message: { subject: asunto, body: { contentType: "HTML", content: html }, toRecipients: [{ emailAddress: { address: CORREO_PROYECTOS } }] }, saveToSentItems: false }),
    });
    return r.ok;
  } catch (_) { return false; }
}
const escH = (s: string) => (s || "").replace(/[&<>]/g, (x) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" } as any)[x]);
async function avisoCliente(encargoId: string, accion: string, archivo: string) {
  const { data: e } = await admin.from("encargos").select("nombre").eq("id", encargoId).maybeSingle();
  const cuando = new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" });
  const html = membrete(`${CEJA(escH(accion))}
    <h2 style="margin:0 0 6px;font-weight:400;font-size:22px;line-height:1.3">${escH(e?.nombre || "")}</h2>
    <p style="color:#7A7A7A;margin:0 0 18px">${cuando}</p>
    <p style="font-size:16px;line-height:1.5;border-top:1px dotted #CFCFCF;border-bottom:1px dotted #CFCFCF;padding:12px 0">${escH(archivo)}</p>`);
  return correoProyectos(`${accion} · ${e?.nombre || ""}`, html);
}
// ---- Avisos al cliente por correo (desde la cuenta de regenerativo) ----
async function tokenCorreo() {
  const { data: ig } = await admin.from("integraciones").select("refresh_token").eq("id", "onedrive").maybeSingle();
  if (!ig?.refresh_token) throw new Error("OneDrive no está conectado.");
  const t = await token({ grant_type: "refresh_token", refresh_token: ig.refresh_token, scope: "offline_access Mail.Send" });
  return t.access_token as string;
}
async function correosCliente(encargoId: string): Promise<string[]> {
  const { data: e } = await admin.from("encargos").select("cliente:clientes(email)").eq("id", encargoId).maybeSingle();
  const raw = String((e as any)?.cliente?.email || "");
  return raw.split(/[,;\s]+/).map((x) => x.trim().toLowerCase()).filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
}
function plantillaCliente(ceja: string, titulo: string, cuerpo: string) {
  return membrete(`${CEJA(escH(ceja))}<h2 style="margin:0 0 18px;font-weight:400;font-size:22px;line-height:1.3">${escH(titulo)}</h2>${cuerpo}${BOTON(PORTAL)}${NOTA}`);
}
async function enviarCorreo(at: string, para: string[], asunto: string, html: string) {
  const r = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST", headers: { Authorization: `Bearer ${at}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { subject: asunto, body: { contentType: "HTML", content: html }, toRecipients: para.map((a) => ({ emailAddress: { address: a } })) }, saveToSentItems: true }),
  });
  return r.ok;
}
// Cada hora: documentos nuevos en DOC _ ENV de cada encargo → correo al cliente. La primera vez solo toma la línea base.
async function revisarEnvios() {
  const at = await accesoGraph();
  let atCorreo: string | null = null;
  const { data: encs } = await admin.from("encargos").select("id,nombre,docs_avisados,onedrive_carpeta").not("onedrive_carpeta", "is", null);
  const res: any[] = [];
  for (const e of encs || []) {
    let lista: any[];
    try { lista = (await archivosEncargo(at, e.id, [CARPETAS_CLIENTE])).archivos.filter((a: any) => !/XXXX/.test(a.ruta)); } catch (_) { continue; }
    const rutas = lista.map((a: any) => a.ruta);
    const antes: string[] | null = Array.isArray(e.docs_avisados) ? e.docs_avisados : null;
    const nuevos = antes ? lista.filter((a: any) => !antes.includes(a.ruta)) : [];
    let enviado = false;
    if (nuevos.length) {
      const para = await correosCliente(e.id);
      if (para.length) {
        atCorreo = atCorreo || await tokenCorreo();
        const items = nuevos.map((a: any) => `<li style="padding:9px 0;border-bottom:1px dotted #CFCFCF">${escH(a.nombre)}</li>`).join("");
        const html = plantillaCliente("Nuevos documentos", e.nombre,
          `<p style="font-size:15px;line-height:1.5">Hola, te compartimos ${nuevos.length === 1 ? "un documento nuevo" : nuevos.length + " documentos nuevos"} del proyecto:</p>
           <ul style="list-style:none;margin:0;padding:0;font-size:15px;line-height:1.5;max-width:520px;border-top:1px dotted #CFCFCF">${items}</ul>`);
        enviado = await enviarCorreo(atCorreo, para, `${nuevos.length === 1 ? "Nuevo documento" : "Nuevos documentos"} · ${e.nombre}`, html);
        if (!enviado) continue;   // se reintenta en la próxima revisión
      }
    }
    if (!antes || nuevos.length || rutas.length !== antes.length) await admin.from("encargos").update({ docs_avisados: rutas }).eq("id", e.id);
    res.push({ encargo: e.nombre, base: !antes, nuevos: nuevos.length, enviado });
  }
  return { revisados: res.length, detalle: res };
}
// Cuando regenerativo responde una duda o comentario del cliente
async function avisoRespuesta(id: string) {
  const { data: c } = await admin.from("comentarios").select("id,texto,respuesta,respuesta_avisada,encargo_id,encargo:encargos(nombre)").eq("id", id).single();
  if (!c?.respuesta) return { enviado: false, motivo: "Sin respuesta." };
  if (c.respuesta_avisada) return { enviado: true, ya: true };
  const para = await correosCliente(c.encargo_id);
  if (!para.length) return { enviado: false, motivo: "El cliente no tiene correo para avisos (Ajustes del encargo)." };
  const at = await tokenCorreo();
  const nombre = (c as any).encargo?.nombre || "";
  const html = plantillaCliente("Respuesta de regenerativo", nombre,
    `<p style="color:#7A7A7A;margin:0 0 6px">Tu mensaje</p><p style="font-size:15px;line-height:1.5;margin:0 0 16px">${escH(c.texto).replace(/\n/g, "<br>")}</p>
     <p style="color:#7A7A7A;margin:0 0 6px">Respuesta</p><p style="font-size:16px;line-height:1.5;border-top:1px dotted #CFCFCF;border-bottom:1px dotted #CFCFCF;padding:12px 0;margin:0">${escH(c.respuesta).replace(/\n/g, "<br>")}</p>`);
  const ok = await enviarCorreo(at, para, `regenerativo respondió · ${nombre}`, html);
  if (ok) await admin.from("comentarios").update({ respuesta_avisada: new Date().toISOString() }).eq("id", id);
  return { enviado: ok };
}
async function primeraCarpeta(at: string, base: string, opciones: string[]) {
  for (const c of opciones) {
    try { await graph(at, `/me/drive/root:/${enc(`${base}/${c}`)}?$select=id`); return c; } catch (_) { /* siguiente */ }
  }
  return null;
}
async function visorCarpeta(at: string, encargoId: string, modulo: string) {
  const base = await baseEncargo(encargoId);
  const carpeta = await primeraCarpeta(at, base, CARPETAS_VISOR[modulo] || []);
  if (!carpeta) return { archivo: null };
  const sel = "$top=200&$select=id,name,file,webUrl,size,lastModifiedDateTime";
  const l = ((await graph(at, `/me/drive/root:/${enc(`${base}/${carpeta}`)}:/children?${sel}`))?.value || []).filter((x: any) => x.file);
  const peso = (n: string) => modulo === "gantt" ? (/\.xlsx$/i.test(n) ? 0 : /\.pdf$/i.test(n) ? 1 : 2) : (/\.pdf$/i.test(n) ? 0 : /\.xlsx?$/i.test(n) ? 1 : 2);
  l.sort((a: any, b: any) => (peso(a.name) - peso(b.name)) || (b.lastModifiedDateTime > a.lastModifiedDateTime ? 1 : -1));
  const f = l.find((x: any) => peso(x.name) < 2) || l[0];
  if (!f) return { archivo: null, carpeta };
  let vista = "";
  try { vista = (await graph(at, `/me/drive/items/${f.id}/preview`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }))?.getUrl || ""; } catch (_) { /* sin vista previa */ }
  return { carpeta, archivo: { nombre: f.name, fecha: f.lastModifiedDateTime, web: f.webUrl, vista, ruta: f.name } };
}

// ---------------- Cronograma (Gantt) ⇄ Excel de la carpeta PROGRAMACIÓN ----------------
// Escribe en el Excel del encargo (plantilla REG_TEM DOCUMENTAL/PROGRAMACIÓN) lo que hay en el portal:
// datos generales, actividades (máx. 15) y responsables. Solo celdas de entrada: las fórmulas y la gráfica del Excel se recalculan solas.
const DIAS_TXT: Record<string, string> = { lv: "Lunes a viernes", ls: "Lunes a sábado", todos: "Todos los días" };
const serial = (f: string | null) => { if (!f) return ""; const [y, m, d] = f.slice(0, 10).split("-").map(Number); return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 864e5; };
async function excelCronograma(at: string, encargoId: string, crear: boolean) {
  const base = await baseEncargo(encargoId);
  let carpeta = await primeraCarpeta(at, base, CARPETAS_VISOR.gantt);
  if (!carpeta) { if (!crear) return null; await asegurarCarpeta(at, base); carpeta = "PROGRAMACIÓN"; await asegurarCarpeta(at, `${base}/${carpeta}`); }
  const l = ((await graph(at, `/me/drive/root:/${enc(`${base}/${carpeta}`)}:/children?$top=200&$select=id,name,file,webUrl,lastModifiedDateTime`))?.value || [])
    .filter((x: any) => x.file && /\.xlsx$/i.test(x.name)).sort((a: any, b: any) => (b.lastModifiedDateTime > a.lastModifiedDateTime ? 1 : -1));
  if (l[0]) return { item: l[0], carpeta };
  if (!crear) return null;
  const pl = ((await graph(at, `/me/drive/root:/${enc(`${PLANTILLA}/PROGRAMACIÓN`)}:/children?$select=id,name,file`))?.value || []).find((x: any) => x.file && /\.xlsx$/i.test(x.name));
  if (!pl) throw new Error("No encontré la plantilla del cronograma en REG_TEM DOCUMENTAL/PROGRAMACIÓN.");
  const bin = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${pl.id}/content`, { headers: { Authorization: `Bearer ${at}` } });
  if (!bin.ok) throw new Error("No se pudo leer la plantilla del cronograma.");
  const { data: e } = await admin.from("encargos").select("codigo,nombre").eq("id", encargoId).single();
  const nombre = `SCREG_${e?.codigo || "2XXXX"}_${String(e?.nombre || "").replace(/^\d{2}\s+I\s+/i, "").toUpperCase()}_CRONOGRAMA.xlsx`.replace(/[\\/:*?"<>|]/g, " ");
  const r = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${enc(`${base}/${carpeta}/${nombre}`)}:/content`, {
    method: "PUT", headers: { Authorization: `Bearer ${at}`, "Content-Type": "application/octet-stream" }, body: await bin.arrayBuffer(),
  });
  const d = await r.json(); if (!r.ok) throw new Error(d?.error?.message || "No se pudo crear el Excel del cronograma.");
  return { item: d, carpeta };
}
async function ganttExcel(at: string, encargoId: string, crear = false) {
  const x = await excelCronograma(at, encargoId, crear);
  if (!x) return { archivo: null };
  const [{ data: e }, { data: resp }, { data: tareas }] = await Promise.all([
    admin.from("encargos").select("codigo,nombre,direccion,ciudad,inicio,fin,dias_trabajo,cliente:clientes(nombre)").eq("id", encargoId).single(),
    admin.from("encargo_responsables").select("id,numero,nombre,cargo").eq("encargo_id", encargoId).order("numero"),
    admin.from("gantt_tareas").select("*").eq("encargo_id", encargoId).order("orden"),
  ]);
  if ((tareas || []).length > 15) throw new Error("El Excel del cronograma tiene 15 filas de actividades; el encargo tiene " + tareas!.length + ".");
  if ((resp || []).length > 10) throw new Error("El Excel del cronograma tiene 10 filas de responsables.");
  const num = new Map((resp || []).map((r: any) => [r.id, r.numero]));
  const n = (tareas || []).length;
  const fila = (i: number) => (tareas || [])[i];
  const col = (f: (t: any) => unknown, ancho = 1) => Array.from({ length: 15 }, (_, i) => { const t = fila(i); return t ? ([] as unknown[]).concat(f(t)) : Array(ancho).fill(""); });
  const ses = await graph(at, `/me/drive/items/${x.item.id}/workbook/createSession`, { method: "POST", body: JSON.stringify({ persistChanges: true }) });
  const h = { "workbook-session-id": ses.id };
  const poner = (dir: string, values: unknown[][]) => graph(at, `/me/drive/items/${x.item.id}/workbook/worksheets('GANTT')/range(address='${dir}')`, { method: "PATCH", headers: h, body: JSON.stringify({ values }) });
  try {
    const ubic = [e?.direccion, e?.ciudad].filter(Boolean).join(", ");
    await poner("D4:D7", [[e?.nombre || "XXX"], [e?.codigo ? `SCREG_${e.codigo}` : "SCREG_2XXXX"], [(e as any)?.cliente?.nombre || "XXX"], [ubic || "XXX"]]);
    await poner("J5:J7", [[serial(e?.inicio)], [serial(e?.fin)], [DIAS_TXT[e?.dias_trabajo || "ls"] || "Lunes a sábado"]]);
    await poner("C13:D27", col((t) => [t.nombre, num.get(t.responsable_id) ?? ""], 2));
    await poner("F13:H27", col((t) => [t.peso_manual != null ? Number(t.peso_manual) : (n ? 1 / n : ""), serial(t.inicio_esperado), t.dias_esperados ?? ""], 3));
    await poner("J13:K27", col((t) => [serial(t.inicio_real), serial(t.fin_real)], 2));
    await poner("M13:M27", col((t) => [Number(t.avance) || 0]));
    await poner("C35:D44", Array.from({ length: 10 }, (_, i) => { const r = (resp || [])[i]; return r ? [r.nombre, r.cargo || ""] : ["", ""]; }));
  } finally {
    await graph(at, `/me/drive/items/${x.item.id}/workbook/closeSession`, { method: "POST", headers: h, body: "{}" }).catch(() => {});
  }
  return { archivo: { nombre: x.item.name, web: x.item.webUrl, carpeta: x.carpeta } };
}
async function subirRecibido(at: string, encargoId: string, nombre: string, base64: string) {
  const base = await baseEncargo(encargoId);
  const carpeta = (await primeraCarpeta(at, base, CARPETAS_RECIBIDOS)) || "DOC _ REC";
  const limpio = nombre.replace(/[\\/:*?"<>|#%]/g, " ").trim().slice(0, 180) || "archivo";
  const bin = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  if (bin.length > 60e6) throw new Error("El archivo supera 60 MB.");
  const r = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${enc(`${base}/${carpeta}/${limpio}`)}:/content?@microsoft.graph.conflictBehavior=rename`, {
    method: "PUT", headers: { Authorization: `Bearer ${at}`, "Content-Type": "application/octet-stream" }, body: bin,
  });
  if (!r.ok) throw new Error("No se pudo subir el archivo.");
  return { ok: true, nombre: (await r.json()).name };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const u = new URL(req.url);

  // Regreso de Microsoft
  if (req.method === "GET") {
    const code = u.searchParams.get("code"), estado = u.searchParams.get("state");
    const volver = (r: string) => Response.redirect(`${PORTAL}#/ajustes?onedrive=${r}`, 302);
    if (!code || !estado) return volver("error");
    const { data: st } = await admin.from("oauth_estados").delete().eq("estado", estado).select().maybeSingle();
    if (!st || Date.now() - new Date(st.creado).getTime() > 15 * 60 * 1000) return volver("expirado");
    try {
      const t = await token({ grant_type: "authorization_code", code, redirect_uri: REDIRECCION });
      const yo = await graph(t.access_token, "/me?$select=userPrincipalName");
      await admin.from("integraciones").upsert({ id: "onedrive", refresh_token: t.refresh_token, cuenta: yo.userPrincipalName, actualizado: new Date().toISOString() });
      return volver("ok");
    } catch (_) { return volver("error"); }
  }

  // Acciones del portal (solo administración)
  try {
    const usuario = createClient(URL_SB, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: esAdmin } = await usuario.rpc("es_admin");
    const b = await req.json();
    if (b.accion === "revisar_envios") {
      const { data: k } = await admin.from("integraciones").select("refresh_token").eq("id", "cron").maybeSingle();
      if (!k?.refresh_token || b.clave !== k.refresh_token) return json({ error: "Sin acceso." }, 403);
      // Propuestas sin Word (creadas por fuera del formulario): carpeta y Word desde la plantilla
      const { data: sin } = await admin.from("propuestas").select("id").is("archivo_ruta", null).gte("creado", "2026-11-01");
      if (sin?.length) { const at0 = await accesoGraph(); for (const p of sin) { try { await carpetaPropuesta(at0, p.id); } catch (_) { /* siguiente */ } } }
      return json(await revisarEnvios());
    }
    // Mantenimiento (clave del cron): sube a la librería de plantillas un archivo publicado en el repositorio de regenerativo
    if (b.accion === "plantilla_desde_repo") {
      const { data: k } = await admin.from("integraciones").select("refresh_token").eq("id", "cron").maybeSingle();
      if (!k?.refresh_token || b.clave !== k.refresh_token) return json({ error: "Sin acceso." }, 403);
      const url = String(b.url || ""), ruta = rutaSegura(String(b.ruta || ""));
      if (!url.startsWith("https://raw.githubusercontent.com/regenerativo/regenerativo-web/") || !ruta.startsWith(PLANTILLA + "/")) return json({ error: "No permitido." }, 400);
      const f = await fetch(url); if (!f.ok) return json({ error: "No se pudo leer " + url }, 400);
      const at0 = await accesoGraph();
      const r = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${enc(ruta)}:/content`, { method: "PUT", headers: { Authorization: `Bearer ${at0}`, "Content-Type": "application/octet-stream" }, body: await f.arrayBuffer() });
      const d = await r.json(); if (!r.ok) return json({ error: d?.error?.message || "No se pudo subir" }, 500);
      return json({ ok: true, web: d.webUrl, tamano: d.size });
    }
    // Acciones que puede usar cualquier persona invitada al encargo (clientes incluidos)
    if (["aviso_comentario", "cli_enviados", "cli_archivo", "cli_recibidos", "cli_subir", "cli_legales", "visor"].includes(b.accion)) {
      const { data: yo } = await usuario.auth.getUser();
      if (!yo?.user) return json({ error: "Sesión no válida." }, 401);
      if (b.accion === "aviso_comentario") {
        const { data: c } = await usuario.from("comentarios").select("id,autor").eq("id", b.comentario_id).maybeSingle();
        if (!c || (c.autor !== yo.user.id && !esAdmin)) return json({ error: "Sin acceso." }, 403);
        return json(await avisoComentario(c.id));
      }
      const { data: rol } = await usuario.rpc("rol_en_encargo", { p_encargo: b.encargo_id });
      if (!rol && !esAdmin) return json({ error: "Sin acceso." }, 403);
      const at = await accesoGraph();
      if (b.accion === "cli_enviados") return json(await archivosEncargo(at, b.encargo_id, [CARPETAS_CLIENTE]));
      if (b.accion === "cli_recibidos") return json(await archivosEncargo(at, b.encargo_id, [CARPETAS_RECIBIDOS]));
      if (b.accion === "cli_legales") return json(await legalesCliente(at, b.encargo_id));
      if (b.accion === "visor") return json(await visorCarpeta(at, b.encargo_id, b.modulo));
      if (b.accion === "cli_subir") {
        const r = await subirRecibido(at, b.encargo_id, String(b.nombre || ""), String(b.base64 || ""));
        if (!esAdmin) await avisoCliente(b.encargo_id, "El cliente compartió un documento", r.nombre);
        return json(r);
      }
      const ruta = rutaSegura(b.ruta || "");
      const esLegal = RAICES_LEGALES.some((c) => ruta.startsWith(c + "/"));
      if (esLegal && !/\.pdf$/i.test(ruta)) return json({ error: "Sin acceso." }, 403);   // de legales, el cliente solo baja PDF
      if (!esLegal && ![...CARPETAS_CLIENTE, ...CARPETAS_RECIBIDOS].some((c) => ruta.startsWith(c + "/"))) return json({ error: "Sin acceso." }, 403);
      const archivo = await archivoEncargo(at, b.encargo_id, "", ruta, !esLegal && !!b.pdf);
      if (!esAdmin) await avisoCliente(b.encargo_id, "El cliente descargó un documento", ruta.split("/").pop() || ruta);
      return json(archivo);
    }
    if (b.accion === "gantt_excel") {
      const { data: rol } = await usuario.rpc("rol_en_encargo", { p_encargo: b.encargo_id });
      if (!esAdmin && rol !== "equipo") return json({ error: "Sin acceso." }, 403);
      return json(await ganttExcel(await accesoGraph(), b.encargo_id, !!b.crear && !!esAdmin));
    }
    if (!esAdmin) return json({ error: "Solo administración." }, 403);
    if (b.accion === "url") {
      const estado = crypto.randomUUID();
      await admin.from("oauth_estados").insert({ estado });
      const q = new URLSearchParams({ client_id: CLIENTE, response_type: "code", redirect_uri: REDIRECCION, response_mode: "query", scope: ALCANCE_CONEXION, state: estado, prompt: "select_account" });
      return json({ url: `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/authorize?${q}` });
    }
    if (b.accion === "estado") {
      const { data } = await admin.from("integraciones").select("cuenta,actualizado,refresh_token").eq("id", "onedrive").maybeSingle();
      return json({ conectado: !!data?.refresh_token, cuenta: data?.cuenta, secreto: !!Deno.env.get("MS_CLIENT_SECRET") });
    }
    const at = await accesoGraph();
    if (b.accion === "aviso_respuesta") return json(await avisoRespuesta(b.comentario_id));
    if (b.accion === "revisar_envios_ya") return json(await revisarEnvios());
    if (b.accion === "despegar") return json(await despegar(at, b.encargo_id));
    if (b.accion === "propuesta_enviados") return json(await propuestaEnviados(at, b.encargo_id));
    if (b.accion === "subir_propuesta") return json(await subirPropuesta(at, b.propuesta_id, b.nombre, b.base64));
    if (b.accion === "descargar_propuesta") return json(await descargarPropuesta(at, b.propuesta_id));
    if (b.accion === "archivos_propuesta") return json(await archivosPropuesta(at, b.propuesta_id));
    if (b.accion === "archivo_propuesta") return json(await archivoPropuesta(at, b.propuesta_id, b.nombre, !!b.pdf));
    if (b.accion === "eliminar_propuesta") return json(await eliminarPropuesta(at, b.propuesta_id));
    if (b.accion === "archivos_encargo") return json(await archivosEncargo(at, b.encargo_id, b.fuentes || b.carpeta));
    if (b.accion === "conteos_encargo") return json(await conteosEncargo(at, b.encargo_id, b.modulos || {}));
    if (b.accion === "explorar") return json(await explorar(at, b.encargo_id, b.ruta || ""));
    if (b.accion === "explorar_reg") return json(await explorarEn(at, RAIZ, b.ruta || ""));
    if (b.accion === "archivo_reg") return json(await descargarEn(at, `${RAIZ}/${rutaSegura(b.ruta)}`, !!b.pdf));
    if (b.accion === "archivo_encargo") return json(await archivoEncargo(at, b.encargo_id, b.carpeta, b.ruta, !!b.pdf));
    if (b.accion === "propuesta") return json(await carpetaPropuesta(at, b.propuesta_id));
    if (b.accion === "subir") return json(await subir(at, b.encargo_id, b.carpeta, b.nombre, b.base64));
    return json({ error: "Acción desconocida" }, 400);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
