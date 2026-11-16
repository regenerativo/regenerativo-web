// Aviso por correo de cambios en los números de los encargos.
// La llama pg_cron cada 15 minutos (con la clave de integraciones 'cron'). Si hay cambios anotados en fin_cambios
// y llevan al menos 10 minutos quietos (para juntar una tanda de ediciones en un solo correo), envía un resumen
// por proyecto —qué cambió y cómo queda: valor, recibido, por cobrar— a apardo@ y facturacion@regenerativo.co.
import { createClient } from "npm:@supabase/supabase-js@2";

const TENANT = "d5bde326-cff3-4067-b8ed-8821209cee21";
const CLIENTE = "5fb20396-2b10-470b-b028-86f4b6e9d9ca";
const DESTINOS = ["apardo@regenerativo.co", "facturacion@regenerativo.co"];
const PORTAL = "https://regenerativo.co/portal/";
const QUIETO_MS = 10 * 60 * 1000;
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const esc = (s: string) => (s || "").replace(/[&<>"]/g, (x) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" } as any)[x]);
const cop = (v: number) => Math.round(Number(v) || 0).toLocaleString("es-CO").replace(/,/g, ".") + " COP";
const slug = (n: string) => n.replace(/^\s*\d{2}\s+I\s+/, "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const json = (c: unknown, s = 200) => new Response(JSON.stringify(c), { status: s, headers: { "Content-Type": "application/json" } });

async function tokenCorreo() {
  const { data: ig } = await admin.from("integraciones").select("refresh_token").eq("id", "onedrive").maybeSingle();
  if (!ig?.refresh_token) throw new Error("Sin conexión con el correo de regenerativo.");
  const r = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENTE, client_secret: Deno.env.get("MS_CLIENT_SECRET") ?? "", scope: "offline_access Mail.Send", grant_type: "refresh_token", refresh_token: ig.refresh_token }),
  });
  const t = await r.json(); if (!r.ok) throw new Error(t.error_description || "No se pudo autorizar el correo.");
  return t.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);
  let b: any = {}; try { b = await req.json(); } catch (_) { /* vacío */ }
  const { data: cl } = await admin.from("integraciones").select("refresh_token").eq("id", "cron").maybeSingle();
  if (!cl?.refresh_token || b.clave !== cl.refresh_token) return json({ error: "Sin acceso." }, 403);

  const { data: pend } = await admin.from("fin_cambios").select("id, creado, encargo_id, detalle").eq("enviado", false).order("creado");
  if (!pend?.length) return json({ ok: true, cambios: 0 });
  const ultimo = new Date(pend[pend.length - 1].creado).getTime();
  if (!b.ya && Date.now() - ultimo < QUIETO_MS) return json({ ok: true, esperando: pend.length });

  // Agrupar por encargo y calcular cómo queda cada uno (misma regla del portal)
  const ids = [...new Set(pend.map((c) => c.encargo_id))];
  const { data: encs } = await admin.from("encargos").select("id, nombre").in("id", ids);
  const bloques: string[] = [];
  let totalPorCobrar = 0;
  for (const id of ids) {
    const e = encs?.find((x) => x.id === id); if (!e) continue;
    const { data: c } = await admin.rpc("cuentas_encargo", { p_encargo: id });
    const k = (c && c[0]) || { valor: 0, recibido: 0, gastos: 0, por_cobrar: 0, saldado: false };
    totalPorCobrar += Number(k.por_cobrar) || 0;
    const lista = pend.filter((x) => x.encargo_id === id).map((x) => `<li style="margin:0 0 4px">${esc(x.detalle)}</li>`).join("");
    const fila = (t: string, v: string, fuerte = false) => `<tr><td style="padding:4px 18px 4px 0;color:#6B6B6B">${t}</td><td style="padding:4px 0;text-align:right;${fuerte ? "font-weight:600" : ""}">${v}</td></tr>`;
    bloques.push(`<div style="border-top:1px dotted #CFCFCF;padding:16px 0">
      <a href="${PORTAL}#/${slug(e.nombre)}/finanzas" style="color:#1E221D;text-decoration:none;font-size:17px">${esc(e.nombre)}</a>
      <ul style="margin:8px 0 10px 18px;padding:0;font-size:14px;color:#1E221D">${lista}</ul>
      <table style="font-size:14px;border-collapse:collapse">
        ${fila("Valor del encargo", cop(k.valor))}${fila("Recibido", cop(k.recibido))}${fila("Gastos del encargo", cop(k.gastos))}
        ${fila("Por cobrar", k.saldado ? "Saldado a mano" : cop(k.por_cobrar), true)}
      </table></div>`);
  }
  const n = ids.length;
  const html = `<div style="font-family:Arial,sans-serif;color:#1E221D;max-width:620px">
    <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#6B6B6B;margin:0 0 6px">Portal de encargos · finanzas</p>
    <h2 style="font-weight:400;margin:0 0 4px">Se actualizaron ${n === 1 ? "los números de un proyecto" : `los números de ${n} proyectos`}</h2>
    <p style="color:#6B6B6B;margin:0 0 8px;font-size:14px">Así quedan después de los cambios. Por cobrar en estos proyectos: <b style="color:#1E221D">${cop(totalPorCobrar)}</b></p>
    ${bloques.join("")}
    <p style="font-size:12px;color:#6B6B6B;border-top:1px dotted #CFCFCF;padding-top:12px">Aviso automático del portal de regenerativo. Abre cada proyecto para ver el detalle en sus finanzas.</p></div>`;
  const asunto = n === 1 ? `Finanzas · ${encs?.find((x) => x.id === ids[0])?.nombre.replace(/^\s*\d{2}\s+I\s+/, "") || "proyecto"} actualizado` : `Finanzas · ${n} proyectos actualizados`;

  try {
    const at = await tokenCorreo();
    const s = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
      method: "POST", headers: { Authorization: `Bearer ${at}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message: { subject: asunto, body: { contentType: "HTML", content: html },
        toRecipients: DESTINOS.map((address) => ({ emailAddress: { address } })) }, saveToSentItems: true }),
    });
    if (!s.ok) throw new Error(`Correo ${s.status}: ${(await s.text()).slice(0, 200)}`);
  } catch (e) { return json({ error: (e as Error).message }, 500); }   // queda pendiente y se reintenta en la próxima vuelta

  await admin.from("fin_cambios").update({ enviado: true }).in("id", pend.map((x) => x.id));
  return json({ ok: true, enviados: pend.length, proyectos: n });
});
