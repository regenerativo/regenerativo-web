// Conexión del portal con el OneDrive de regenerativo (Microsoft Graph, permisos delegados de apardo@).
// GET  ?code=…&state=…  → regreso de Microsoft: guarda el token y vuelve al portal.
// POST {accion}         → solo administración:
//   'url'      → dirección para autorizar la conexión
//   'estado'   → si está conectado
//   'despegar' → {encargo_id}: crea "REG/26  I  NOMBRE" con la estructura de carpetas y mueve la propuesta a LEGALES/PROP _ ECONOMICAS
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
import { createClient } from "npm:@supabase/supabase-js@2";

const TENANT = "d5bde326-cff3-4067-b8ed-8821209cee21";
const CLIENTE = "5fb20396-2b10-470b-b028-86f4b6e9d9ca";
const ALCANCE = "offline_access Files.ReadWrite Mail.Read User.Read";
const PORTAL = "https://regenerativo.co/portal/";
const RAIZ = "REG";
const PROPUESTAS = "REG/REG  I  GESTION INTEGRAL/ZL_REG_PROPUESTAS";
// Plantilla de gestión documental de regenerativo (REG  I  GESTION INTEGRAL/ZL_REG_LIBRERIAS/REG_TEM DOCUMENTAL)
const ESTRUCTURA = [
  "COOR _ ADMIN", "COOR _ OBRA", "COOR _ OBRA/COOR _ PERSONAL", "COOR _ TÉCNICA", "DOC _ ENV", "DOC _ REC", "IMAGEN _ VISUAL",
  "LEGALES", "LEGALES/00 PROPUESTA", "LEGALES/01 CONTRATOS", "LEGALES/02 ADENDAS", "LEGALES/03 OTRO SI",
  "LEGALES/04 ACTAS DE ENTREGA", "LEGALES/05 CUENTAS DE COBRO", "PRESUPUESTO", "PROGRAMACIÓN", "ZL_OBSOLETOS",
];
const CARPETA_PROPUESTA = "LEGALES/00 PROPUESTA";

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
  for (const sub of ESTRUCTURA) await asegurarCarpeta(at, `${base}/${sub}`);
  // Mover la carpeta (o archivo) de la propuesta cuyo nombre empieza por el código del encargo
  let movidos: string[] = [];
  try {
    const hijos = await graph(at, `/me/drive/root:/${enc(PROPUESTAS)}:/children?$top=200&$select=id,name`);
    const destino = await graph(at, `/me/drive/root:/${enc(base + "/" + CARPETA_PROPUESTA)}`);
    for (const h of hijos.value.filter((x: any) => x.name.toUpperCase().startsWith(e.codigo.toUpperCase()))) {
      await graph(at, `/me/drive/items/${h.id}`, { method: "PATCH", body: JSON.stringify({ parentReference: { id: destino.id } }) });
      movidos.push(h.name);
    }
  } catch (_) { /* si no hay propuesta en ZL, no es error */ }
  // La ruta del Word de la propuesta cambia: queda dentro de LEGALES/00 PROPUESTA del encargo
  const { data: p } = await admin.from("propuestas").select("id,archivo_ruta").eq("encargo_id", e.id).maybeSingle();
  if (p?.archivo_ruta?.startsWith(PROPUESTAS + "/")) {
    await admin.from("propuestas").update({ archivo_ruta: `${base}/${CARPETA_PROPUESTA}/${p.archivo_ruta.slice(PROPUESTAS.length + 1)}`, archivo_web: null }).eq("id", p.id);
  }
  await admin.from("encargos").update({ onedrive_carpeta: base }).eq("id", e.id);
  return { carpeta: base, movidos };
}

async function carpetaPropuesta(at: string, propuestaId: string) {
  const { data: p } = await admin.from("propuestas").select("codigo,nombre").eq("id", propuestaId).single();
  if (!p) throw new Error("Propuesta no encontrada");
  const ruta = `${PROPUESTAS}/${p.codigo.toUpperCase()}_${p.nombre.toUpperCase()}`;
  await asegurarCarpeta(at, ruta);
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
  const sel = "$top=200&$select=name,file,folder,webUrl,size,lastModifiedDateTime";
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
    if (!esAdmin) return json({ error: "Solo administración." }, 403);
    const b = await req.json();
    if (b.accion === "url") {
      const estado = crypto.randomUUID();
      await admin.from("oauth_estados").insert({ estado });
      const q = new URLSearchParams({ client_id: CLIENTE, response_type: "code", redirect_uri: REDIRECCION, response_mode: "query", scope: ALCANCE, state: estado, prompt: "select_account" });
      return json({ url: `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/authorize?${q}` });
    }
    if (b.accion === "estado") {
      const { data } = await admin.from("integraciones").select("cuenta,actualizado,refresh_token").eq("id", "onedrive").maybeSingle();
      return json({ conectado: !!data?.refresh_token, cuenta: data?.cuenta, secreto: !!Deno.env.get("MS_CLIENT_SECRET") });
    }
    const at = await accesoGraph();
    if (b.accion === "despegar") return json(await despegar(at, b.encargo_id));
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
