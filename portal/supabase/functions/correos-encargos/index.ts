// Trazabilidad de correos por encargo (cada hora, pg_cron, clave interna 'cron').
// Busca en el buzón de regenerativo los correos con cada cliente (enviados y recibidos) y los deja en correos_encargo.
// A qué encargo va: si el asunto o el texto nombra el encargo (nombre o código), a ese; si el cliente tiene un solo
// encargo, a ese; si tiene varios y no se sabe, a sus encargos activos.
import { createClient } from "npm:@supabase/supabase-js@2";

const TENANT = "d5bde326-cff3-4067-b8ed-8821209cee21";
const CLIENTE = "5fb20396-2b10-470b-b028-86f4b6e9d9ca";
const DESDE = "2026-01-01T00:00:00Z";
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const json = (c: unknown, s = 200) => new Response(JSON.stringify(c), { status: s, headers: { "Content-Type": "application/json" } });
// Avisos automáticos del portal (gestión documental): no son correos del proyecto, no se guardan en Correos
const esAviso = (s: string) => /^(Prueba · )?(Nuevo documento|Nuevos documentos|Actualización|regenerativo respondió|El cliente compartió un documento|El cliente descargó un documento) · /i.test((s || "").trim());
const norm = (s: string) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();

async function token() {
  const { data: ig } = await admin.from("integraciones").select("refresh_token").eq("id", "onedrive").maybeSingle();
  if (!ig?.refresh_token) throw new Error("Microsoft no está conectado.");
  const r = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENTE, client_secret: Deno.env.get("MS_CLIENT_SECRET") ?? "", scope: "offline_access Mail.Read", grant_type: "refresh_token", refresh_token: ig.refresh_token }),
  });
  const t = await r.json(); if (!r.ok) throw new Error(t.error_description || "Sin permiso de correo.");
  return t.access_token as string;
}
async function g(at: string, url: string) {
  const r = await fetch(url.startsWith("http") ? url : `https://graph.microsoft.com/v1.0${url}`, { headers: { Authorization: `Bearer ${at}` } });
  const d = await r.json(); if (!r.ok) throw new Error(d?.error?.message || `Graph ${r.status}`);
  return d;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);
  const b = await req.json().catch(() => ({}));
  const { data: k } = await admin.from("integraciones").select("refresh_token").eq("id", "cron").maybeSingle();
  if (!k?.refresh_token || b.clave !== k.refresh_token) return json({ error: "Sin acceso." }, 403);
  try {
    const at = await token();
    const fuera = new Set<string>();
    for (const f of ["deleteditems", "junkemail"]) { try { fuera.add((await g(at, `/me/mailFolders/${f}?$select=id`)).id); } catch (_) { /* sin carpeta */ } }
    const { data: encs } = await admin.from("encargos").select("id,codigo,nombre,estado,cliente_id,cliente:clientes(email)");
    const porCliente = new Map<string, any[]>();
    for (const e of encs || []) { if (!e.cliente_id || !e.cliente?.email) continue; (porCliente.get(e.cliente_id) || porCliente.set(e.cliente_id, []).get(e.cliente_id)!).push(e); }
    let nuevos = 0, revisados = 0;
    for (const lista of porCliente.values()) {
      const correos = String(lista[0].cliente.email).split(/[,;\s]+/).map(x => x.trim().toLowerCase()).filter(x => /@/.test(x));
      const vistos = new Map<string, any>();
      for (const c of correos) {
        let url = `/me/messages?$search=${encodeURIComponent(`"participants:${c}"`)}&$select=id,internetMessageId,subject,bodyPreview,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,webLink,hasAttachments,parentFolderId,isDraft&$top=50`;
        let paginas = 0;
        while (url && paginas++ < 6) {
          const d = await g(at, url);
          for (const m of d.value || []) if (!m.isDraft && !fuera.has(m.parentFolderId)) vistos.set(m.internetMessageId || m.id, m);
          url = d["@odata.nextLink"] || "";
        }
      }
      const filas: any[] = [];
      for (const [ref, m] of vistos) {
        const fecha = m.sentDateTime || m.receivedDateTime; if (!fecha || fecha < DESDE) continue;
        if (esAviso(m.subject)) continue;
        revisados++;
        const de = (m.from?.emailAddress?.address || "").toLowerCase();
        const para = [...(m.toRecipients || []), ...(m.ccRecipients || [])].map((x: any) => x.emailAddress?.address).filter(Boolean).join(", ");
        const texto = norm(`${m.subject} ${m.bodyPreview}`);
        const nombrados = lista.filter(e => texto.includes(norm(e.nombre).replace(/^\d{2} I /, "")) || texto.includes(norm(e.codigo || "-")));
        const activos = lista.filter(e => e.estado !== "finalizado");
        const destino = nombrados.length ? nombrados : lista.length === 1 ? lista : (activos.length ? activos : lista);
        for (const e of destino) filas.push({
          encargo_id: e.id, ref: String(ref).slice(0, 300), fecha, direccion: /@regenerativo\.co$/i.test(de) ? "enviado" : "recibido",
          de: m.from?.emailAddress?.name ? `${m.from.emailAddress.name} <${de}>` : de, para, asunto: m.subject || "(sin asunto)",
          resumen: (m.bodyPreview || "").slice(0, 280), web: m.webLink, adjuntos: !!m.hasAttachments,
        });
      }
      if (filas.length) {
        const { data, error } = await admin.from("correos_encargo").upsert(filas, { onConflict: "encargo_id,ref", ignoreDuplicates: true }).select("id");
        if (error) throw error; nuevos += data?.length || 0;
      }
    }
    // 2) Todo el buzón (apardo@ y sus alias: info@, proyectos@, facturacion@, arquitectura@…, que llegan al mismo buzón):
    //    correos que nombran el encargo en el asunto (nombre o código), aunque vengan de alguien que no está en la ficha.
    const interno = (a: string) => !a || /@regenerativo\.co$/i.test(a);
    for (const e of encs || []) {
      const corto = norm(e.nombre).replace(/^\d{2} I /, "");
      const claves = [corto, norm(e.codigo || "")].filter(x => x.length >= 6);
      const re = new RegExp(claves.map(x => "(^|[^A-Z0-9])" + x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "(?:[\\s_-]+I)?[\\s_-]*") + "($|[^A-Z0-9])").join("|"));
      if (!claves.length) continue;
      const vistos = new Map<string, any>();
      for (const c of claves) {
        let url = `/me/messages?$search=${encodeURIComponent(`"${c}"`)}&$select=id,internetMessageId,subject,bodyPreview,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,webLink,hasAttachments,parentFolderId,isDraft&$top=50`;
        let paginas = 0;
        while (url && paginas++ < 4) {
          const d = await g(at, url);
          for (const m of d.value || []) if (!m.isDraft && !fuera.has(m.parentFolderId) && re.test(norm(m.subject || ""))) vistos.set(m.internetMessageId || m.id, m);
          url = d["@odata.nextLink"] || "";
        }
      }
      const filas: any[] = [];
      for (const [ref, m] of vistos) {
        const fecha = m.sentDateTime || m.receivedDateTime; if (!fecha || fecha < DESDE) continue;
        if (esAviso(m.subject)) continue;
        const de = (m.from?.emailAddress?.address || "").toLowerCase();
        const dest = [...(m.toRecipients || []), ...(m.ccRecipients || [])].map((x: any) => (x.emailAddress?.address || "").toLowerCase()).filter(Boolean);
        if (interno(de) && dest.every(interno)) continue;   // solo correos con alguien de afuera
        if (/no-?reply|notificacion|mailer-daemon/i.test(de)) continue;
        revisados++;
        filas.push({
          encargo_id: e.id, ref: String(ref).slice(0, 300), fecha, direccion: interno(de) ? "enviado" : "recibido",
          de: m.from?.emailAddress?.name ? `${m.from.emailAddress.name} <${de}>` : de, para: dest.join(", "), asunto: m.subject || "(sin asunto)",
          resumen: (m.bodyPreview || "").slice(0, 280), web: m.webLink, adjuntos: !!m.hasAttachments,
        });
      }
      if (filas.length) {
        const { data, error } = await admin.from("correos_encargo").upsert(filas, { onConflict: "encargo_id,ref", ignoreDuplicates: true }).select("id");
        if (error) throw error; nuevos += data?.length || 0;
      }
    }
    return json({ ok: true, clientes: porCliente.size, revisados, nuevos });
  } catch (e) { return json({ error: (e as Error).message }, 500); }
});
