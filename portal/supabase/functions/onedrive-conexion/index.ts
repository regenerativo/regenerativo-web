// Conexión del portal con el OneDrive de regenerativo (Microsoft Graph, permisos delegados de apardo@).
// GET  ?code=…&state=…  → regreso de Microsoft: guarda el token y vuelve al portal.
// POST {accion}         → solo administración:
//   'url'      → dirección para autorizar la conexión
//   'estado'   → si está conectado
//   'despegar' → {encargo_id}: crea "REG/26  I  NOMBRE" con la estructura de carpetas y mueve la propuesta a LEGALES/PROP _ ECONOMICAS
//   'subir'    → {encargo_id, carpeta, nombre, base64}: guarda un archivo en la carpeta del encargo
import { createClient } from "npm:@supabase/supabase-js@2";

const TENANT = "d5bde326-cff3-4067-b8ed-8821209cee21";
const CLIENTE = "5fb20396-2b10-470b-b028-86f4b6e9d9ca";
const ALCANCE = "offline_access Files.ReadWrite Mail.Read User.Read";
const PORTAL = "https://regenerativo.co/portal/";
const RAIZ = "REG";
const PROPUESTAS = "REG/REG  I  GESTION INTEGRAL/ZL_REG_PROPUESTAS";
const ESTRUCTURA = [
  "COORDINACION _ ADMINISTRATIVA", "COORDINACION _ OBRA", "COORDINACION _ PERSONAL", "COORDINACION _ TECNICA",
  "DOC _ ENVIADOS", "DOC _ RECIBIDOS", "IMAGEN _ VISUAL", "LEGALES", "LEGALES/CUENTAS DE COBRO", "LEGALES/OPS CONTRATOS",
  "LEGALES/PROP _ ECONOMICAS", "PRESUPUESTO", "ZL_OBSOLETOS",
];

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
    const destino = await graph(at, `/me/drive/root:/${enc(base + "/LEGALES/PROP _ ECONOMICAS")}`);
    for (const h of hijos.value.filter((x: any) => x.name.toUpperCase().startsWith(e.codigo.toUpperCase()))) {
      await graph(at, `/me/drive/items/${h.id}`, { method: "PATCH", body: JSON.stringify({ parentReference: { id: destino.id } }) });
      movidos.push(h.name);
    }
  } catch (_) { /* si no hay propuesta en ZL, no es error */ }
  await admin.from("encargos").update({ onedrive_carpeta: base }).eq("id", e.id);
  return { carpeta: base, movidos };
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
    if (b.accion === "subir") return json(await subir(at, b.encargo_id, b.carpeta, b.nombre, b.base64));
    return json({ error: "Acción desconocida" }, 400);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
