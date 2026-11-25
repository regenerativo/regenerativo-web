// Correos al cliente que antes salían de onedrive-conexion, ahora con copia a proyectos@regenerativo.co:
//   {accion:'revisar_envios', clave}  → (cada hora, pg_cron) documentos nuevos de DOC _ ENV de cada encargo
//   {accion:'aviso_respuesta', comentario_id} → (administración) respuesta de regenerativo a una duda o comentario
// Salen desde la cuenta conectada a OneDrive (apardo@regenerativo.co).
import { createClient } from "npm:@supabase/supabase-js@2";

const TENANT = "d5bde326-cff3-4067-b8ed-8821209cee21";
const CLIENTE = "5fb20396-2b10-470b-b028-86f4b6e9d9ca";
const CORREO_PROYECTOS = "proyectos@regenerativo.co";
const PORTAL = "https://regenerativo.co/portal/";
const CARPETAS_CLIENTE = ["DOC _ ENV", "DOC _ ENVIADOS"];
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
async function hijos(at: string, ruta: string) {
  const r = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${enc(ruta)}:/children?$top=200&$select=name,file,folder,lastModifiedDateTime`, { headers: { Authorization: `Bearer ${at}` } });
  return r.ok ? ((await r.json()).value || []) : null;
}
async function correosCliente(encargoId: string): Promise<string[]> {
  const { data: e } = await admin.from("encargos").select("cliente:clientes(email)").eq("id", encargoId).maybeSingle();
  return String((e as any)?.cliente?.email || "").split(/[,;\s]+/).map((x) => x.trim().toLowerCase()).filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
}
function plantilla(ceja: string, titulo: string, cuerpo: string) {
  return `<div style="font-family:Arial,sans-serif;color:#1E221D;max-width:560px">
    <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#999">${escH(ceja)}</p>
    <h2 style="font-weight:400;margin:0 0 18px">${escH(titulo)}</h2>
    ${cuerpo}
    <p style="margin:22px 0"><a href="${PORTAL}" style="display:inline-block;background:#1E221D;color:#fff;text-decoration:none;border-radius:999px;padding:10px 20px">Ver en el portal</a></p>
    <p style="color:#999;font-size:12px">Entra en la pestaña Clientes con el nombre del encargo y tu contraseña.<br>Por — regenerativo</p></div>`;
}
// Todo correo al cliente lleva copia a proyectos@
async function enviar(at: string, para: string[], asunto: string, html: string) {
  const r = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST", headers: { Authorization: `Bearer ${at}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { subject: asunto, body: { contentType: "HTML", content: html }, toRecipients: para.map((a) => ({ emailAddress: { address: a } })),
      ccRecipients: para.includes(CORREO_PROYECTOS) ? [] : [{ emailAddress: { address: CORREO_PROYECTOS } }] }, saveToSentItems: true }),
  });
  return r.ok;
}

// Cada hora: documentos nuevos en DOC _ ENV → correo al cliente. La primera vez solo se toma la línea base.
async function revisarEnvios() {
  const at = await token("offline_access Files.ReadWrite User.Read");
  let atCorreo: string | null = null;
  const { data: encs } = await admin.from("encargos").select("id,nombre,docs_avisados,onedrive_carpeta").not("onedrive_carpeta", "is", null);
  const res: any[] = [];
  for (const e of encs || []) {
    const lista: { nombre: string; ruta: string }[] = [];
    const andar = async (rel: string, prof: number) => {
      const l = await hijos(at, `${e.onedrive_carpeta}/${rel}`); if (!l) return false;
      for (const h of l) { const r = `${rel}/${h.name}`; if (h.file) lista.push({ nombre: h.name, ruta: r }); else if (h.folder && prof > 0) await andar(r, prof - 1); }
      return true;
    };
    let hay = false; for (const c of CARPETAS_CLIENTE) if (await andar(c, 3)) { hay = true; break; }
    if (!hay) continue;
    const docs = lista.filter((a) => !/XXXX/.test(a.ruta));
    const rutas = docs.map((a) => a.ruta);
    const antes: string[] | null = Array.isArray(e.docs_avisados) ? e.docs_avisados : null;
    const nuevos = antes ? docs.filter((a) => !antes.includes(a.ruta)) : [];
    let enviado = false;
    if (nuevos.length) {
      const para = await correosCliente(e.id);
      if (para.length) {
        atCorreo = atCorreo || await token("offline_access Mail.Send");
        const items = nuevos.map((a) => `<li style="margin:4px 0">${escH(a.nombre)}</li>`).join("");
        const html = plantilla("Portal de encargos · nuevos documentos", e.nombre,
          `<p style="font-size:15px;line-height:1.5">Hola, te compartimos ${nuevos.length === 1 ? "un documento nuevo" : nuevos.length + " documentos nuevos"} del proyecto:</p>
           <ul style="font-size:15px;line-height:1.5;background:#F3EFE6;border-radius:14px;padding:14px 14px 14px 34px">${items}</ul>`);
        enviado = await enviar(atCorreo, para, `${nuevos.length === 1 ? "Nuevo documento" : "Nuevos documentos"} · ${e.nombre}`, html);
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
  const at = await token("offline_access Mail.Send");
  const nombre = (c as any).encargo?.nombre || "";
  const html = plantilla("Portal de encargos · respuesta de regenerativo", nombre,
    `<p style="color:#999;margin:0 0 6px">Tu mensaje</p><p style="font-size:15px;line-height:1.5;margin:0 0 16px">${escH(c.texto).replace(/\n/g, "<br>")}</p>
     <p style="color:#999;margin:0 0 6px">Respuesta</p><p style="font-size:16px;line-height:1.5;background:#F3EFE6;border-radius:14px;padding:16px;margin:0">${escH(c.respuesta).replace(/\n/g, "<br>")}</p>`);
  const ok = await enviar(at, para, `regenerativo respondió · ${nombre}`, html);
  if (ok) await admin.from("comentarios").update({ respuesta_avisada: new Date().toISOString() }).eq("id", id);
  return { enviado: ok };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const b = await req.json().catch(() => ({}));
    if (b.accion === "revisar_envios") {
      const { data: k } = await admin.from("integraciones").select("refresh_token").eq("id", "cron").maybeSingle();
      if (!k?.refresh_token || b.clave !== k.refresh_token) return json({ error: "Sin acceso." }, 403);
      return json(await revisarEnvios());
    }
    if (b.accion === "aviso_respuesta") {
      const usuario = createClient(URL_SB, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
      const { data: esAdmin } = await usuario.rpc("es_admin");
      if (!esAdmin) return json({ error: "Solo administración." }, 403);
      return json(await avisoRespuesta(String(b.comentario_id || "")));
    }
    return json({ error: "Acción no válida." }, 400);
  } catch (err) { return json({ error: (err as Error).message }, 500); }
});
