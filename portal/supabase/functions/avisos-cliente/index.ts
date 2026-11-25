// Avisos al cliente (solo de lo que él ve en su portal), cada hora con pg_cron (clave 'cron'):
// · documentos de DOC _ ENV y PDF de LEGALES que se ACTUALIZARON (los nuevos de DOC _ ENV los avisa revisar_envios)
// · PDF nuevos de LEGALES
// · cambios del cronograma de obra (Gantt), máximo un aviso al día
// No avisa nada de carpetas internas (PRESUPUESTO, COOR…), ni Word de legales, ni datos del resumen.
import { createClient } from "npm:@supabase/supabase-js@2";

const TENANT = "d5bde326-cff3-4067-b8ed-8821209cee21";
const CLIENTE = "5fb20396-2b10-470b-b028-86f4b6e9d9ca";
const PORTAL = "https://regenerativo.co/portal/";
const CORREO_PROYECTOS = "proyectos@regenerativo.co";   // copia de todo correo que le llega al cliente
const ENVIADOS = ["DOC _ ENV", "DOC _ ENVIADOS"];
// Legales que ve el cliente en su portal (solo PDF)
const LEGALES = [["LEGALES/00 PROPUESTA", "LEGALES/PROP _ ECONOMICAS"], ["LEGALES/01 CONTRATOS", "LEGALES/OPS CONTRATOS"], ["LEGALES/02 ADENDAS"],
  ["LEGALES/03 ACTAS DE ENTREGA", "LEGALES/04 ACTAS DE ENTREGA"], ["LEGALES/04 CUENTAS DE COBRO", "LEGALES/05 CUENTAS DE COBRO", "LEGALES/CUENTAS DE COBRO"], ["LEGALES/05 FACTURACION"]];
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const json = (c: unknown, s = 200) => new Response(JSON.stringify(c), { status: s, headers: { "Content-Type": "application/json" } });
const esc = (s: string) => String(s ?? "").replace(/[&<>"]/g, (x) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" } as any)[x]);
const enc = (p: string) => p.split("/").map(encodeURIComponent).join("/");

async function token(scope: string) {
  const { data: ig } = await admin.from("integraciones").select("refresh_token").eq("id", "onedrive").maybeSingle();
  if (!ig?.refresh_token) throw new Error("OneDrive no está conectado.");
  const r = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENTE, client_secret: Deno.env.get("MS_CLIENT_SECRET") ?? "", scope, grant_type: "refresh_token", refresh_token: ig.refresh_token }),
  });
  const t = await r.json(); if (!r.ok) throw new Error(t.error_description || "Microsoft rechazó la conexión.");
  return t.access_token as string;
}
async function hijos(at: string, ruta: string) {
  const r = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${enc(ruta)}:/children?$top=200&$select=name,file,folder,lastModifiedDateTime`, { headers: { Authorization: `Bearer ${at}` } });
  if (!r.ok) return null;
  return (await r.json()).value || [];
}
async function documentos(at: string, base: string) {
  const out: { ruta: string; nombre: string; fecha: string }[] = [];
  const andar = async (rel: string, l: any[], prof: number, soloPdf: boolean) => {
    for (const h of l) { const r = `${rel}/${h.name}`;
      if (h.file) { if (!soloPdf || /\.pdf$/i.test(h.name)) out.push({ ruta: r, nombre: h.name, fecha: h.lastModifiedDateTime }); }
      else if (h.folder && prof > 0) await andar(r, (await hijos(at, `${base}/${r}`)) || [], prof - 1, soloPdf); }
  };
  for (const c of ENVIADOS) { const raiz = await hijos(at, `${base}/${c}`); if (!raiz) continue; await andar(c, raiz, 3, false); break; }
  for (const g of LEGALES) for (const c of g) { const raiz = await hijos(at, `${base}/${c}`); if (!raiz) continue; await andar(c, raiz, 3, true); break; }
  return out.filter((d) => !/XXXX/.test(d.ruta));
}
const plantilla = (titulo: string, cuerpo: string) => `<div style="font-family:Arial,sans-serif;color:#1E221D;max-width:560px">
  <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#999">Portal de encargos · actualización</p>
  <h2 style="font-weight:400;margin:0 0 18px">${esc(titulo)}</h2>${cuerpo}
  <p style="margin:22px 0"><a href="${PORTAL}" style="display:inline-block;background:#1E221D;color:#fff;text-decoration:none;border-radius:999px;padding:10px 20px">Ver en el portal</a></p>
  <p style="color:#999;font-size:12px">Entra en la pestaña Clientes con el nombre del encargo y tu contraseña.<br>Por — regenerativo</p></div>`;

async function revisar() {
  const at = await token("offline_access Files.ReadWrite User.Read");
  let atCorreo: string | null = null;
  const { data: encs } = await admin.from("encargos").select("id,nombre,onedrive_carpeta,avisos_cliente,cliente:clientes(email)").not("onedrive_carpeta", "is", null);
  const res: any[] = [];
  for (const e of encs || []) {
    const para = String((e as any).cliente?.email || "").split(/[,;\s]+/).map((x) => x.trim().toLowerCase()).filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
    const est = (e.avisos_cliente && typeof e.avisos_cliente === "object") ? e.avisos_cliente : {};
    const primera = !est.docs;
    const docsAntes: Record<string, string> = est.docs || {};
    // 1. Documentos que ve el cliente actualizados (misma ruta, fecha nueva)
    let docs: any[] = [];
    try { docs = await documentos(at, e.onedrive_carpeta); } catch (_) { continue; }
    const actualizados = primera ? [] : docs.filter((d) => docsAntes[d.ruta] && new Date(d.fecha).getTime() - new Date(docsAntes[d.ruta]).getTime() > 60000);
    // PDF nuevos de LEGALES (los nuevos de DOC _ ENV ya los avisa revisar_envios). La primera vez con legales se toma como base.
    const conLegalesAntes = Object.keys(docsAntes).some((r) => r.startsWith("LEGALES/")) || est.legales_base;
    const nuevosLegales = primera || !conLegalesAntes ? [] : docs.filter((d) => d.ruta.startsWith("LEGALES/") && !docsAntes[d.ruta]);
    const enEnv = new Set(docs.filter((d) => !d.ruta.startsWith("LEGALES/")).map((d) => d.nombre.toLowerCase()));
    const nuevosAll = nuevosLegales.filter((d) => !enEnv.has(d.nombre.toLowerCase()));   // si también se envió por DOC _ ENV, ya se avisó
    const docsAhora = Object.fromEntries(docs.map((d) => [d.ruta, d.fecha]));
    // 2. Cronograma de obra (lo que el cliente ve): nombre, fechas, avance
    const { data: t } = await admin.from("gantt_tareas").select("nombre,inicio_esperado,dias_esperados,inicio_real,fin_real,avance").eq("encargo_id", e.id).order("orden");
    const firma = (t || []).map((x: any) => [x.nombre, x.inicio_esperado, x.dias_esperados, x.inicio_real || "", x.fin_real || "", Math.round(Number(x.avance || 0) * 100)].join("|")).join("¦");
    const ultimoG = est.gantt_aviso ? new Date(est.gantt_aviso).getTime() : 0;
    const cambioG = !primera && est.gantt !== undefined && est.gantt !== firma && (t || []).length > 0;
    const avisarG = cambioG && Date.now() - ultimoG > 20 * 3600e3;   // máximo un aviso del cronograma al día
    const nuevo: any = { legales_base: true, docs: docsAhora, gantt: cambioG && !avisarG ? est.gantt : firma, gantt_aviso: avisarG ? new Date().toISOString() : (est.gantt_aviso || null) };
    let enviado = false;
    if ((actualizados.length || nuevosAll.length || avisarG) && para.length) {
      atCorreo = atCorreo || await token("offline_access Mail.Send");
      const partes: string[] = [];
      if (nuevosAll.length) partes.push(`<p style="font-size:15px;line-height:1.5">${nuevosAll.length === 1 ? "Hay un documento nuevo" : `Hay ${nuevosAll.length} documentos nuevos`} en Legales:</p>
        <ul style="font-size:15px;line-height:1.5;background:#F3EFE6;border-radius:14px;padding:14px 14px 14px 34px">${nuevosAll.map((d) => `<li>${esc(d.nombre)}</li>`).join("")}</ul>`);
      if (actualizados.length) partes.push(`<p style="font-size:15px;line-height:1.5">Se ${actualizados.length === 1 ? "actualizó un documento" : `actualizaron ${actualizados.length} documentos`} del proyecto:</p>
        <ul style="font-size:15px;line-height:1.5;background:#F3EFE6;border-radius:14px;padding:14px 14px 14px 34px">${actualizados.map((d) => `<li>${esc(d.nombre)}</li>`).join("")}</ul>`);
      if (avisarG) { const av = (t || []).length ? Math.round((t || []).reduce((s: number, x: any) => s + Number(x.avance || 0), 0) / (t || []).length * 100) : 0;
        partes.push(`<p style="font-size:15px;line-height:1.5">Se actualizó el <b>cronograma de obra</b> (${(t || []).length} actividades · avance promedio ${av} %).</p>`); }
      const r = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
        method: "POST", headers: { Authorization: `Bearer ${atCorreo}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message: { subject: `Actualización · ${e.nombre}`, body: { contentType: "HTML", content: plantilla(e.nombre, partes.join("")) }, toRecipients: para.map((a) => ({ emailAddress: { address: a } })), ccRecipients: para.includes(CORREO_PROYECTOS) ? [] : [{ emailAddress: { address: CORREO_PROYECTOS } }] }, saveToSentItems: true }),
      });
      enviado = r.ok;
      if (!r.ok) continue;   // se reintenta en la próxima revisión (no se guarda el estado)
    }
    // Sin correo del cliente: se toma lo actual como base, para no avisar cosas viejas cuando se agregue el correo
    await admin.from("encargos").update({ avisos_cliente: nuevo }).eq("id", e.id);
    res.push({ encargo: e.nombre, base: primera, actualizados: actualizados.length, nuevos_legales: nuevosAll.length, cronograma: avisarG, enviado, sin_correo: !para.length });
  }
  return { revisados: res.length, detalle: res };
}

Deno.serve(async (req) => {
  try {
    const b = await req.json().catch(() => ({}));
    const { data: k } = await admin.from("integraciones").select("refresh_token").eq("id", "cron").maybeSingle();
    if (!k?.refresh_token || b.clave !== k.refresh_token) return json({ error: "Sin acceso." }, 403);
    return json(await revisar());
  } catch (err) { return json({ error: (err as Error).message }, 500); }
});
