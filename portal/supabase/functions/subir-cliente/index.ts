// Documento que comparte el cliente desde su portal: queda en DOC _ REC dentro de una carpeta con la fecha del día
// ("AAAA MM DD _ DOCUMENTOS DEL CLIENTE", como se organiza DOC _ ENV) y llega aviso a proyectos@regenerativo.co.
//   {encargo_id, nombre, base64} → cualquier persona invitada al encargo (clientes incluidos)
import { createClient } from "npm:@supabase/supabase-js@2";

const TENANT = "d5bde326-cff3-4067-b8ed-8821209cee21";
const CLIENTE = "5fb20396-2b10-470b-b028-86f4b6e9d9ca";
const CORREO_PROYECTOS = "proyectos@regenerativo.co";
const URL_SB = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(URL_SB, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (c: unknown, s = 200) => new Response(JSON.stringify(c), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const enc = (p: string) => p.split("/").map(encodeURIComponent).join("/");
const escH = (s: string) => (s || "").replace(/[&<>]/g, (x) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" } as any)[x]);

async function token(scope: string) {
  const { data } = await admin.from("integraciones").select("refresh_token").eq("id", "onedrive").maybeSingle();
  if (!data?.refresh_token) throw new Error("OneDrive no está conectado.");
  const r = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENTE, client_secret: Deno.env.get("MS_CLIENT_SECRET") ?? "", scope, grant_type: "refresh_token", refresh_token: data.refresh_token }),
  });
  const t = await r.json(); if (!r.ok) throw new Error(t.error_description || "Microsoft rechazó la conexión.");
  return t.access_token as string;
}
const G = (at: string, ruta: string, init: RequestInit = {}) => fetch(`https://graph.microsoft.com/v1.0${ruta}`, { ...init, headers: { Authorization: `Bearer ${at}`, ...(init.headers || {}) } });
const existe = async (at: string, ruta: string) => (await G(at, `/me/drive/root:/${enc(ruta)}?$select=id`)).ok;
async function asegurarCarpeta(at: string, ruta: string) {
  if (await existe(at, ruta)) return;
  const p = ruta.split("/"); const nombre = p.pop()!;
  await G(at, `/me/drive/root:/${enc(p.join("/"))}:/children`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: nombre, folder: {}, "@microsoft.graph.conflictBehavior": "fail" }) });
}

// Membrete de los correos: encabezado y pie van como imagen (Stolzl se ve igual en cualquier correo); el texto en Metronic Pro con Arial de respaldo.
const MEMB = "https://regenerativo.co/portal/assets/correo";
const membrete = (contenido: string) => `<!doctype html><html><head><meta charset="utf-8"><style>@font-face{font-family:"Metronic Pro";src:url(https://regenerativo.co/portal/assets/fonts/metronic-regular.woff) format("woff")}</style></head>
<body style="margin:0;padding:0;background:#ffffff"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#ffffff;border-collapse:collapse;margin:0">
<tr><td style="padding:32px 32px 0"><img src="${MEMB}/membrete-sup.png" width="440" alt="PORTAL DE ENCARGOS · regenerativo" style="display:block;width:440px;max-width:100%;height:auto;border:0"></td></tr>
<tr><td style="padding:30px 32px 8px;font-family:'Metronic Pro',Arial,sans-serif;color:#1D1D1B;font-size:15px;line-height:1.55">${contenido}</td></tr>
<tr><td style="padding:34px 32px 32px"><img src="${MEMB}/membrete-inf.png" width="440" alt="Área de Proyectos · Por _ regenerativo · www.regenerativo.co · @_regenerativo_ · +57 320 215 0932" style="display:block;width:440px;max-width:100%;height:auto;border:0"></td></tr>
</table></body></html>`;
const CEJA = (t: string) => `<p style="margin:0 0 6px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#7A7A7A">${t}</p>`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const b = await req.json();
    const usuario = createClient(URL_SB, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: yo } = await usuario.auth.getUser();
    if (!yo?.user) return json({ error: "Sesión no válida." }, 401);
    const [{ data: rol }, { data: esAdmin }] = await Promise.all([usuario.rpc("rol_en_encargo", { p_encargo: b.encargo_id }), usuario.rpc("es_admin")]);
    if (!rol && !esAdmin) return json({ error: "Sin acceso." }, 403);
    const { data: e } = await admin.from("encargos").select("nombre,onedrive_carpeta").eq("id", b.encargo_id).single();
    if (!e) return json({ error: "Encargo no encontrado." }, 404);
    const base = e.onedrive_carpeta || `REG/${String(e.nombre).toUpperCase()}`;
    const limpio = String(b.nombre || "").replace(/[\\/:*?"<>|#%]/g, " ").trim().slice(0, 180) || "archivo";
    const bin = Uint8Array.from(atob(String(b.base64 || "")), (c) => c.charCodeAt(0));
    if (bin.length > 60e6) return json({ error: "El archivo supera 60 MB." }, 400);
    const at = await token("offline_access Files.ReadWrite User.Read");
    const rec = (await existe(at, `${base}/DOC _ REC`)) ? "DOC _ REC" : (await existe(at, `${base}/DOC _ RECIBIDOS`)) ? "DOC _ RECIBIDOS" : "DOC _ REC";
    const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" }).replaceAll("-", " ");
    const carpeta = `${rec}/${hoy} _ DOCUMENTOS DEL CLIENTE`;
    await asegurarCarpeta(at, base); await asegurarCarpeta(at, `${base}/${rec}`); await asegurarCarpeta(at, `${base}/${carpeta}`);
    const r = await G(at, `/me/drive/root:/${enc(`${base}/${carpeta}/${limpio}`)}:/content?@microsoft.graph.conflictBehavior=rename`, { method: "PUT", headers: { "Content-Type": "application/octet-stream" }, body: bin });
    if (!r.ok) return json({ error: "No se pudo subir el archivo." }, 500);
    const d = await r.json();
    // Aviso a proyectos@ (solo si lo subió el cliente)
    if (!esAdmin) {
      try {
        const am = await token("offline_access Mail.Send");
        const html = membrete(`${CEJA("El cliente compartió un documento")}
          <h2 style="margin:0 0 6px;font-weight:400;font-size:22px;line-height:1.3">${escH(e.nombre)}</h2>
          <p style="color:#7A7A7A;margin:0 0 18px">${new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" })} · ${escH(carpeta)}</p>
          <p style="font-size:16px;line-height:1.5;border-top:1px dotted #CFCFCF;border-bottom:1px dotted #CFCFCF;padding:12px 0">${escH(d.name)}</p>`);
        await G(am, "/me/sendMail", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: { subject: `El cliente compartió un documento · ${e.nombre}`, body: { contentType: "HTML", content: html }, toRecipients: [{ emailAddress: { address: CORREO_PROYECTOS } }] }, saveToSentItems: false }) });
      } catch (_) { /* el archivo ya quedó guardado */ }
    }
    return json({ ok: true, nombre: d.name, carpeta });
  } catch (err) { return json({ error: (err as Error).message }, 500); }
});
