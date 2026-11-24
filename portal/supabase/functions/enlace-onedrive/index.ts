// Enlace "cualquiera con el enlace" de un documento o carpeta de OneDrive, para abrirlo desde el portal sin iniciar sesión en Microsoft.
// POST {url} (webUrl de OneDrive) → {url} del enlace compartido (edición). Solo administración.
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
const codificar = (u: string) => "u!" + btoa(unescape(encodeURIComponent(u))).replace(/=+$/, "").replace(/\//g, "_").replace(/\+/g, "-");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const usuario = createClient(URL_SB, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: esAdmin } = await usuario.rpc("es_admin");
    if (!esAdmin) return json({ error: "Solo administración." }, 403);
    const b = await req.json().catch(() => ({}));
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
