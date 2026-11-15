// Formulario de contacto de regenerativo.co.
// Valida los datos, guarda la solicitud (contactos_web) y la envía por correo a info@regenerativo.co
// desde la cuenta de regenerativo (Microsoft 365), con el correo del visitante como dirección de respuesta.
// Solo responde «recibido» cuando la solicitud quedó guardada.
import { createClient } from "npm:@supabase/supabase-js@2";

const TENANT = "d5bde326-cff3-4067-b8ed-8821209cee21";
const CLIENTE = "5fb20396-2b10-470b-b028-86f4b6e9d9ca";
const DESTINO = "info@regenerativo.co";
const ORIGENES = ["https://regenerativo.co", "https://www.regenerativo.co", "http://localhost:8765"];
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const cors = (o: string | null) => ({
  "Access-Control-Allow-Origin": o && ORIGENES.includes(o) ? o : ORIGENES[0],
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});
const esc = (s: string) => (s || "").replace(/[&<>"]/g, (x) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" } as any)[x]);
const limpio = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);
const CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

function validar(b: any) {
  const d = {
    nombre: limpio(b.nombre, 120), correo: limpio(b.correo, 160).toLowerCase(), ciudad: limpio(b.ciudad, 120),
    telefono: limpio(b.telefono, 40), servicios: limpio(b.servicios, 200), modalidad: limpio(b.modalidad, 40), mensaje: limpio(b.mensaje, 5000),
  };
  const errores: Record<string, string> = {};
  if (d.nombre.length < 2) errores.nombre = "Escribe tu nombre.";
  if (!CORREO.test(d.correo)) errores.correo = "Escribe un correo válido, por ejemplo nombre@dominio.com.";
  if (d.ciudad.length < 2) errores.ciudad = "Escribe tu ciudad y país.";
  if (!d.servicios) errores.servicios = "Elige al menos una opción.";
  if (!d.modalidad) errores.modalidad = "Elige una modalidad.";
  if (d.mensaje.length < 10) errores.mensaje = "Cuéntanos un poco más (al menos 10 caracteres).";
  return { d, errores };
}

async function enviar(d: Record<string, string>) {
  const { data: ig } = await admin.from("integraciones").select("refresh_token").eq("id", "onedrive").maybeSingle();
  if (!ig?.refresh_token) throw new Error("Sin conexión con el correo de regenerativo.");
  const r = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENTE, client_secret: Deno.env.get("MS_CLIENT_SECRET") ?? "", scope: "offline_access Mail.Send", grant_type: "refresh_token", refresh_token: ig.refresh_token }),
  });
  const t = await r.json(); if (!r.ok) throw new Error(t.error_description || "No se pudo autorizar el correo.");
  const fila = (k: string, v: string) => v ? `<tr><td style="padding:6px 16px 6px 0;color:#6B6B6B;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:6px 0">${esc(v)}</td></tr>` : "";
  const html = `<div style="font-family:Arial,sans-serif;color:#1E221D;max-width:600px">
    <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#6B6B6B">Nuevo proyecto · formulario de regenerativo.co</p>
    <h2 style="font-weight:400;margin:0 0 16px">${esc(d.nombre)}</h2>
    <table style="font-size:15px;border-collapse:collapse">${fila("Correo", d.correo)}${fila("Ciudad - País", d.ciudad)}${fila("Teléfono", d.telefono)}${fila("Qué necesita", d.servicios)}${fila("Modalidad", d.modalidad)}</table>
    <p style="font-size:16px;line-height:1.55;background:#F3EFE6;border-radius:14px;padding:16px;margin-top:16px">${esc(d.mensaje).replace(/\n/g, "<br>")}</p>
    <p style="color:#6B6B6B;font-size:12px">Responde este correo para escribirle directamente a ${esc(d.nombre)}.</p></div>`;
  const s = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST", headers: { Authorization: `Bearer ${t.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { subject: `Nuevo proyecto · ${d.nombre}`, body: { contentType: "HTML", content: html },
      toRecipients: [{ emailAddress: { address: DESTINO } }], replyTo: [{ emailAddress: { address: d.correo, name: d.nombre } }] }, saveToSentItems: true }),
  });
  if (!s.ok) throw new Error(`Correo ${s.status}`);
}

Deno.serve(async (req) => {
  const o = req.headers.get("Origin");
  const json = (c: unknown, st = 200) => new Response(JSON.stringify(c), { status: st, headers: { ...cors(o), "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(o) });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);
  let b: any; try { b = await req.json(); } catch (_) { return json({ error: "Solicitud no válida." }, 400); }
  // Trampa para robots: un campo oculto que una persona no llena
  if (limpio(b.web, 200)) return json({ ok: true });
  const { d, errores } = validar(b);
  if (Object.keys(errores).length) return json({ error: "Revisa los campos marcados.", errores }, 422);
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  // Máximo 5 solicitudes por hora desde la misma conexión
  if (ip) {
    const { count } = await admin.from("contactos_web").select("id", { count: "exact", head: true }).eq("ip", ip).gte("creado", new Date(Date.now() - 3600e3).toISOString());
    if ((count || 0) >= 5) return json({ error: "Recibimos varios mensajes seguidos desde tu conexión. Intenta de nuevo en un rato o escríbenos a info@regenerativo.co." }, 429);
  }
  const { data: g, error } = await admin.from("contactos_web").insert({ ...d, ip }).select("id").single();
  if (error) return json({ error: "No pudimos recibir tu mensaje. Intenta de nuevo o escríbenos a info@regenerativo.co." }, 500);
  try { await enviar(d); await admin.from("contactos_web").update({ enviado: true }).eq("id", g.id); }
  catch (e) { await admin.from("contactos_web").update({ error: (e as Error).message }).eq("id", g.id); }   // quedó guardada: no se pierde
  return json({ ok: true });
});
