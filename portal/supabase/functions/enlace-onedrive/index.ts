// Enlace "cualquiera con el enlace" de un documento o carpeta de OneDrive, para abrirlo desde el portal sin iniciar sesión en Microsoft.
// POST {url} (webUrl de OneDrive) → {url} del enlace compartido (edición). Solo administración.
// POST {encargo_id, modulo:'presupuesto'|'gantt'} → enlace de solo lectura a la carpeta PRESUPUESTO o PROGRAMACIÓN del encargo,
//   para el icono de carpeta del visor (cualquier persona invitada al encargo, clientes incluidos).
// POST {accion:'listar', encargo_id, modulo} → archivos de PRESUPUESTO o PROGRAMACIÓN por subcarpeta (sin carpetas ZL_), para Documentos del cliente.
// POST {accion:'archivo', encargo_id, ruta} → enlace de descarga directa de un archivo de esas carpetas.
import { createClient } from "npm:@supabase/supabase-js@2";

const TENANT = "d5bde326-cff3-4067-b8ed-8821209cee21";
const CLIENTE = "5fb20396-2b10-470b-b028-86f4b6e9d9ca";
const ALCANCE = "offline_access Files.ReadWrite Mail.Read User.Read";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (c: unknown, s = 200) => new Response(JSON.stringify(c), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const URL_SB = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(URL_SB, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

async function acceso() {
  const { data } = await admin.from("integraciones").select("refresh_token").eq("id", "onedrive").maybeSingle();
  if (!data?.refresh_token) throw new Error("OneDrive no está conectado.");
  const r = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENTE, client_secret: Deno.env.get("MS_CLIENT_SECRET") ?? "", scope: ALCANCE, grant_type: "refresh_token", refresh_token: data.refresh_token }),
  });
  const t = await r.json(); if (!r.ok) throw new Error(t.error_description || "Microsoft rechazó la conexión.");
  if (t.refresh_token) await admin.from("integraciones").update({ refresh_token: t.refresh_token, actualizado: new Date().toISOString() }).eq("id", "onedrive");
  return t.access_token as string;
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
const escH = (s: string) => (s || "").replace(/[&<>]/g, (x) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" } as any)[x]);
// Aviso a proyectos@ cuando el cliente descarga un archivo de Presupuesto o Programación, con el enlace al archivo en OneDrive
async function avisoDescarga(encargoId: string, archivo: string, carpeta: string, web: string) {
  try {
    const { data: ig } = await admin.from("integraciones").select("refresh_token").eq("id", "onedrive").maybeSingle();
    const { data: e } = await admin.from("encargos").select("nombre").eq("id", encargoId).maybeSingle();
    const r = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: CLIENTE, client_secret: Deno.env.get("MS_CLIENT_SECRET") ?? "", scope: "offline_access Mail.Send", grant_type: "refresh_token", refresh_token: ig?.refresh_token || "" }) });
    const tk = await r.json(); if (!r.ok) return;
    const html = membrete(`${CEJA("El cliente descargó un documento")}
      <h2 style="margin:0 0 6px;font-weight:400;font-size:22px;line-height:1.3">${escH(e?.nombre || "")}</h2>
      <p style="color:#7A7A7A;margin:0 0 18px">${new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" })} · ${escH(carpeta)}</p>
      <p style="font-size:16px;line-height:1.5;border-top:1px dotted #CFCFCF;border-bottom:1px dotted #CFCFCF;padding:12px 0">${escH(archivo)}</p>
      ${web ? `<p style="margin:22px 0 0"><a href="${escH(web)}" style="display:inline-block;background:#1D1D1B;color:#fff;text-decoration:none;border-radius:999px;padding:11px 22px;font-size:14px">Abrir en OneDrive</a></p>` : ""}`);
    await fetch("https://graph.microsoft.com/v1.0/me/sendMail", { method: "POST", headers: { Authorization: `Bearer ${tk.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message: { subject: `El cliente descargó un documento · ${e?.nombre || ""}`, body: { contentType: "HTML", content: html }, toRecipients: [{ emailAddress: { address: "proyectos@regenerativo.co" } }] }, saveToSentItems: false }) });
  } catch (_) { /* el aviso no detiene la descarga */ }
}
const codificar = (u: string) => "u!" + btoa(unescape(encodeURIComponent(u))).replace(/=+$/, "").replace(/\//g, "_").replace(/\+/g, "-");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const usuario = createClient(URL_SB, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: esAdmin } = await usuario.rpc("es_admin");
    const b = await req.json().catch(() => ({}));
    if (b.encargo_id && (b.accion === "listar" || b.accion === "archivo")) {
      const { data: rol } = await usuario.rpc("rol_en_encargo", { p_encargo: b.encargo_id });
      const { data: k } = b.clave ? await admin.from("integraciones").select("refresh_token").eq("id", "cron").maybeSingle() : { data: null };
      if (!rol && !esAdmin && !(k?.refresh_token && b.clave === k.refresh_token)) return json({ error: "Sin acceso." }, 403);
      const { data: e } = await admin.from("encargos").select("onedrive_carpeta").eq("id", b.encargo_id).single();
      if (!e?.onedrive_carpeta) return json({ secciones: [] });
      const at = await acceso();
      const enc = (p: string) => p.split("/").map(encodeURIComponent).join("/");
      const G = async (ruta: string, q = "") => { const r = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${enc(`${e.onedrive_carpeta}/${ruta}`)}${q}`, { headers: { Authorization: `Bearer ${at}` } }); return r.ok ? await r.json() : null; };
      const oculto = (n: string) => /^ZL_/i.test(n) || n.startsWith("~") || n.startsWith(".");
      if (b.accion === "archivo") {
        const ruta = String(b.ruta || "");
        const partes = ruta.split("/");
        if (!/^(PRESUPUESTO|PROGRAMACI[OÓ]N)\//.test(ruta) || partes.some((x) => !x || x === ".." || oculto(x))) return json({ error: "Sin acceso." }, 403);
        const it = await G(ruta);
        if (!it?.file || !it["@microsoft.graph.downloadUrl"]) return json({ error: "No se encontró el archivo." }, 404);
        if (!esAdmin && !(k?.refresh_token && b.clave === k.refresh_token)) await avisoDescarga(b.encargo_id, it.name, partes.slice(0, -1).join(" / "), it.webUrl || "");
        return json({ url: it["@microsoft.graph.downloadUrl"], nombre: it.name });
      }
      const raices = b.modulo === "presupuesto" ? ["PRESUPUESTO"] : ["PROGRAMACIÓN", "PROGRAMACION"];
      for (const raiz of raices) {
        const l = await G(raiz, ":/children?$top=200&$select=name,file,folder,lastModifiedDateTime");
        if (!l) continue;
        const sueltos: any[] = [], secciones: any[] = [];
        const andar = async (rel: string, prof: number, out: any[]) => {
          const h = await G(`${raiz}/${rel}`, ":/children?$top=200&$select=name,file,folder,lastModifiedDateTime");
          for (const x of h?.value || []) { if (oculto(x.name)) continue; const r = `${rel}/${x.name}`;
            if (x.file) out.push({ nombre: x.name, ruta: `${raiz}/${r}`, fecha: x.lastModifiedDateTime, sub: rel.split("/").slice(1).join(" / ") });
            else if (x.folder && prof > 0) await andar(r, prof - 1, out); }
        };
        for (const x of l.value || []) {
          if (oculto(x.name)) continue;
          if (x.file) sueltos.push({ nombre: x.name, ruta: `${raiz}/${x.name}`, fecha: x.lastModifiedDateTime });
          else if (x.folder) { const out: any[] = []; await andar(x.name, 2, out); secciones.push({ titulo: x.name, archivos: out }); }
        }
        if (sueltos.length) secciones.unshift({ titulo: raiz, archivos: sueltos });
        return json({ secciones });
      }
      return json({ secciones: [] });
    }
    if (b.encargo_id && ["presupuesto", "gantt"].includes(b.modulo)) {
      const { data: rol } = await usuario.rpc("rol_en_encargo", { p_encargo: b.encargo_id });
      const { data: k } = b.clave ? await admin.from("integraciones").select("refresh_token").eq("id", "cron").maybeSingle() : { data: null };
      if (!rol && !esAdmin && !(k?.refresh_token && b.clave === k.refresh_token)) return json({ error: "Sin acceso." }, 403);
      const { data: e } = await admin.from("encargos").select("onedrive_carpeta").eq("id", b.encargo_id).single();
      if (!e?.onedrive_carpeta) return json({ error: "El encargo no tiene carpeta en OneDrive." }, 404);
      const at = await acceso();
      const enc = (p: string) => p.split("/").map(encodeURIComponent).join("/");
      for (const c of b.modulo === "presupuesto" ? ["PRESUPUESTO"] : ["PROGRAMACIÓN", "PROGRAMACION"]) {
        const r = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${enc(`${e.onedrive_carpeta}/${c}`)}:/createLink`, { method: "POST", headers: { Authorization: `Bearer ${at}`, "Content-Type": "application/json" }, body: JSON.stringify({ type: "view", scope: "anonymous" }) });
        if (r.status === 404) continue;
        const d = await r.json().catch(() => ({}));
        if (r.ok && d?.link?.webUrl) return json({ url: d.link.webUrl });
        return json({ error: d?.error?.message || "No se pudo abrir la carpeta." }, 500);
      }
      return json({ error: "Todavía no hay carpeta para este módulo." }, 404);
    }
    if (!esAdmin) return json({ error: "Solo administración." }, 403);
    const url = String(b.url || "");
    if (!/^https:\/\/[a-z0-9-]+(-my)?\.sharepoint\.com\//i.test(url)) return json({ error: "Enlace no válido." }, 400);
    const at = await acceso();
    const g = async (ruta: string, init: RequestInit = {}) => { const r = await fetch(`https://graph.microsoft.com/v1.0${ruta}`, { ...init, headers: { Authorization: `Bearer ${at}`, "Content-Type": "application/json" } }); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d?.error?.message || `Graph ${r.status}`); return d; };
    const it = await g(`/shares/${codificar(url)}/driveItem?$select=id,parentReference,webUrl`);
    const drive = it.parentReference?.driveId;
    // Primero "cualquiera con el enlace"; si la cuenta no lo permite, enlace de la organización; si no, el original
    for (const scope of ["anonymous", "organization"]) {
      try {
        const l = await g(`/drives/${drive}/items/${it.id}/createLink`, { method: "POST", body: JSON.stringify({ type: "edit", scope }) });
        if (l?.link?.webUrl) return json({ url: l.link.webUrl, alcance: scope });
      } catch (_) { /* siguiente */ }
    }
    return json({ url: it.webUrl || url, alcance: "original" });
  } catch (err) { return json({ error: (err as Error).message }, 500); }
});
