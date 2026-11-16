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

async function enviar(asunto: string, html: string) {
  // Un correo por destino: si van juntos, la regla del buzón lo manda solo a la carpeta de facturación
  const at = await tokenCorreo();
  for (const address of DESTINOS) {
    const s = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
      method: "POST", headers: { Authorization: `Bearer ${at}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message: { subject: asunto, body: { contentType: "HTML", content: html },
        toRecipients: [{ emailAddress: { address } }] }, saveToSentItems: address === DESTINOS[0] }),
    });
    if (!s.ok) throw new Error(`Correo ${s.status}: ${(await s.text()).slice(0, 200)}`);
  }
}

// Lunes 8:00 a. m. (comité regenerativo): lo que hay que revisar de finanzas
async function correoComite() {
  const hoy = new Date(Date.now() - 5 * 3600e3);   // hora de Bogotá
  const fechaTxt = hoy.toISOString().slice(0, 10).split("-").reverse().join("/");
  const { data: encs } = await admin.from("encargos").select("id, nombre, estado").order("codigo", { ascending: false });
  const cobrar: { e: any; k: any }[] = [];
  for (const e of encs || []) {
    const { data: c } = await admin.rpc("cuentas_encargo", { p_encargo: e.id });
    const k = c && c[0]; if (k && Number(k.por_cobrar) > 0) cobrar.push({ e, k });
  }
  const totalCobrar = cobrar.reduce((t, x) => t + Number(x.k.por_cobrar), 0);
  const { data: pend } = await admin.from("fin_movimientos").select("tipo, valor").eq("estado", "por_confirmar");
  const hace7 = new Date(Date.now() - 7 * 864e5).toISOString();
  const { data: cambios } = await admin.from("fin_cambios").select("creado, detalle, encargo:encargos(nombre)").gte("creado", hace7).order("creado");
  // Posibles repetidos: mismo tipo y valor, con un día o menos de diferencia, en los últimos 60 días
  const desde = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
  const { data: movs } = await admin.from("fin_movimientos").select("id, fecha, tipo, valor, descripcion").eq("estado", "confirmado").gte("fecha", desde).order("fecha");
  const dup: string[] = [];
  (movs || []).forEach((a, i) => (movs || []).slice(i + 1).forEach((b2) => {
    if (a.tipo === b2.tipo && Number(a.valor) === Number(b2.valor) && Math.abs(new Date(a.fecha).getTime() - new Date(b2.fecha).getTime()) <= 864e5)
      dup.push(`${esc(a.descripcion || "")} y ${esc(b2.descripcion || "")} · ${cop(Number(a.valor))} · ${a.fecha.split("-").reverse().join("/")}`);
  }));
  const sec = (t: string, cuerpo: string) => `<h3 style="font-weight:400;font-size:17px;margin:22px 0 8px">${t}</h3>${cuerpo}`;
  const fila = (a: string, v: string) => `<tr><td style="padding:5px 18px 5px 0;border-bottom:1px dotted #CFCFCF">${a}</td><td style="padding:5px 0;text-align:right;border-bottom:1px dotted #CFCFCF">${v}</td></tr>`;
  const html = `<div style="font-family:Arial,sans-serif;color:#1E221D;max-width:620px">
    <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#6B6B6B;margin:0 0 6px">Comité regenerativo · ${fechaTxt}</p>
    <h2 style="font-weight:400;margin:0 0 4px">Revisión de finanzas de la semana</h2>
    <p style="color:#6B6B6B;margin:0;font-size:14px">Por cobrar en total: <b style="color:#1E221D">${cop(totalCobrar)}</b> · Por confirmar: <b style="color:#1E221D">${(pend || []).length}</b></p>
    ${sec("1. Por cobrar", cobrar.length ? `<table style="font-size:14px;border-collapse:collapse;width:100%">${cobrar.map((x) => fila(`<a href="${PORTAL}#/${slug(x.e.nombre)}/finanzas" style="color:#1E221D;text-decoration:none">${esc(x.e.nombre)}</a>`, cop(Number(x.k.por_cobrar)))).join("")}</table>` : `<p style="font-size:14px">Nada por cobrar.</p>`)}
    ${sec("2. Por confirmar", (pend || []).length ? `<p style="font-size:14px">${(pend || []).length} movimiento${(pend || []).length === 1 ? "" : "s"} esperan tipo, categoría y proyecto. <a href="${PORTAL}#/finanzas" style="color:#00758F;text-decoration:none">Abrir Finanzas</a></p>` : `<p style="font-size:14px">Todo confirmado.</p>`)}
    ${sec("3. Cambios de la semana", (cambios || []).length ? `<ul style="font-size:14px;margin:0 0 0 18px;padding:0">${(cambios || []).map((c: any) => `<li style="margin:0 0 4px"><b>${esc((c.encargo?.nombre || "").replace(/^\s*\d{2}\s+I\s+/, ""))}</b> · ${esc(c.detalle)}</li>`).join("")}</ul>` : `<p style="font-size:14px">Sin cambios en los números de los proyectos.</p>`)}
    ${sec("4. Posibles repetidos", dup.length ? `<ul style="font-size:14px;margin:0 0 0 18px;padding:0">${dup.map((d) => `<li style="margin:0 0 4px">${d}</li>`).join("")}</ul><p style="font-size:12px;color:#6B6B6B">Si alguno es repetido, descártalo en Finanzas.</p>` : `<p style="font-size:14px">No se ven movimientos repetidos.</p>`)}
    <p style="font-size:12px;color:#6B6B6B;border-top:1px dotted #CFCFCF;padding-top:12px;margin-top:22px">Aviso automático del portal de regenerativo para el comité de los lunes.</p></div>`;
  try { await enviar(`Comité regenerativo · finanzas ${fechaTxt}`, html); }
  catch (e) { return json({ error: (e as Error).message }, 500); }
  return json({ ok: true, comite: true, porCobrar: totalCobrar, porConfirmar: (pend || []).length, cambios: (cambios || []).length, repetidos: dup.length });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);
  let b: any = {}; try { b = await req.json(); } catch (_) { /* vacío */ }
  const { data: cl } = await admin.from("integraciones").select("refresh_token").eq("id", "cron").maybeSingle();
  if (!cl?.refresh_token || b.clave !== cl.refresh_token) return json({ error: "Sin acceso." }, 403);

  if (b.accion === "comite") return await correoComite();

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

  try { await enviar(asunto, html); } catch (e) { return json({ error: (e as Error).message }, 500); }   // queda pendiente y se reintenta en la próxima vuelta

  await admin.from("fin_cambios").update({ enviado: true }).in("id", pend.map((x) => x.id));
  return json({ ok: true, enviados: pend.length, proyectos: n });
});
