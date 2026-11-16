// Calendario de Outlook de apardo@regenerativo.co desde el portal (permiso Calendars.ReadWrite de la conexión de Microsoft).
// Solo se usa con la clave interna (integraciones 'cron'). Crea eventos con repetición y recordatorio, que el conector de Claude no permite.
import { createClient } from "npm:@supabase/supabase-js@2";

const TENANT = "d5bde326-cff3-4067-b8ed-8821209cee21";
const CLIENTE = "5fb20396-2b10-470b-b028-86f4b6e9d9ca";
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const json = (c: unknown, s = 200) => new Response(JSON.stringify(c), { status: s, headers: { "Content-Type": "application/json" } });

async function tokenCalendario() {
  const { data: ig } = await admin.from("integraciones").select("refresh_token").eq("id", "onedrive").maybeSingle();
  if (!ig?.refresh_token) throw new Error("Microsoft no está conectado.");
  const r = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENTE, client_secret: Deno.env.get("MS_CLIENT_SECRET") ?? "", scope: "offline_access Calendars.ReadWrite", grant_type: "refresh_token", refresh_token: ig.refresh_token }),
  });
  const t = await r.json(); if (!r.ok) throw new Error(t.error_description || "Sin permiso de calendario.");
  return t.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);
  let b: any = {}; try { b = await req.json(); } catch (_) { /* vacío */ }
  const { data: cl } = await admin.from("integraciones").select("refresh_token").eq("id", "cron").maybeSingle();
  if (!cl?.refresh_token || b.clave !== cl.refresh_token) return json({ error: "Sin acceso." }, 403);
  try {
    const at = await tokenCalendario();
    const g = async (ruta: string, init: RequestInit = {}) => {
      const r = await fetch(`https://graph.microsoft.com/v1.0${ruta}`, { ...init, headers: { Authorization: `Bearer ${at}`, "Content-Type": "application/json", Prefer: 'outlook.timezone="SA Pacific Standard Time"', ...(init.headers || {}) } });
      if (r.status === 204) return null;
      const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d?.error?.message || `Graph ${r.status}`); return d;
    };
    if (b.accion === "crear") return json(await g("/me/events", { method: "POST", body: JSON.stringify(b.evento) }));
    if (b.accion === "buscar") return json(await g(`/me/events?$select=id,subject,start,end,recurrence,reminderMinutesBeforeStart&$filter=${encodeURIComponent(`startswith(subject,'${String(b.texto || "").replace(/'/g, "''")}')`)}&$top=20`));
    if (b.accion === "borrar") { await g(`/me/events/${encodeURIComponent(b.id)}`, { method: "DELETE" }); return json({ ok: true }); }
    return json({ error: "Acción desconocida." }, 400);
  } catch (e) { return json({ error: (e as Error).message }, 500); }
});
