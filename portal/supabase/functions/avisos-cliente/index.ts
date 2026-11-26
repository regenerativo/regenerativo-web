// Avisos al cliente (solo de lo que él ve en su portal), cada hora con pg_cron (clave 'cron'):
// · documentos de DOC _ ENV y PDF de LEGALES que se ACTUALIZARON (los nuevos de DOC _ ENV los avisa revisar_envios)
// · PDF nuevos de LEGALES
// · archivos nuevos o actualizados en PRESUPUESTO y PROGRAMACIÓN (el cliente los abre desde el icono de carpeta de su portal)
// · cambios del cronograma de obra (Gantt)
// Máximo un correo al día por encargo: lo que cambie después se junta en el correo del día siguiente.
// No avisa nada de carpetas internas (COOR…, carpetas ZL_), ni Word de legales, ni datos del resumen.
import { createClient } from "npm:@supabase/supabase-js@2";

const TENANT = "d5bde326-cff3-4067-b8ed-8821209cee21";
const CLIENTE = "5fb20396-2b10-470b-b028-86f4b6e9d9ca";
const PORTAL = "https://regenerativo.co/portal/";
const CORREO_PROYECTOS = "proyectos@regenerativo.co";   // remitente de todo correo que le llega al cliente
const ENVIADOS = ["DOC _ ENV", "DOC _ ENVIADOS"];
// Legales que ve el cliente en su portal (solo PDF)
const LEGALES = [["LEGALES/00 PROPUESTA", "LEGALES/PROP _ ECONOMICAS"], ["LEGALES/01 CONTRATOS", "LEGALES/OPS CONTRATOS"], ["LEGALES/02 ADENDAS"],
  ["LEGALES/03 ACTAS DE ENTREGA", "LEGALES/04 ACTAS DE ENTREGA"], ["LEGALES/04 CUENTAS DE COBRO", "LEGALES/05 CUENTAS DE COBRO", "LEGALES/CUENTAS DE COBRO"], ["LEGALES/05 FACTURACION"]];
// Carpetas que el cliente abre desde el visor de Presupuesto y Programación (todos los archivos)
const CARPETAS_OBRA = [["PRESUPUESTO"], ["PROGRAMACIÓN", "PROGRAMACION"]];
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
  for (const g of CARPETAS_OBRA) for (const c of g) { const raiz = await hijos(at, `${base}/${c}`); if (!raiz) continue; await andar(c, raiz, 3, false); break; }
  return out.filter((d) => !/XXXX/.test(d.ruta) && !/(^|\/)ZL_/i.test(d.ruta) && !d.nombre.startsWith("~"));
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
const BOTON = (url: string) => `<p style="margin:24px 0"><a href="${url}" style="display:inline-block;background:#1D1D1B;color:#fff;text-decoration:none;border-radius:999px;padding:11px 22px;font-size:14px">Ver en el portal</a></p>`;
const NOTA = `<p style="margin:0;color:#7A7A7A;font-size:12px">Entra en la pestaña Clientes con el nombre del encargo y tu contraseña.</p>`;
const plantilla = (titulo: string, cuerpo: string) => membrete(`${CEJA("Actualización")}<h2 style="margin:0 0 18px;font-weight:400;font-size:22px;line-height:1.3">${esc(titulo)}</h2>${cuerpo}${BOTON(PORTAL)}${NOTA}`);

// Sale como proyectos@regenerativo.co con copia a apardo@. Si Microsoft no deja "Enviar como" proyectos@, sale de apardo@ con copia a proyectos@.
const CORREO_APARDO = "apardo@regenerativo.co";
let comoProyectos: boolean | null = null;
async function enviarCliente(at: string, para: string[], asunto: string, html: string) {
  const dir = (l: string[]) => l.map((a) => ({ emailAddress: { address: a } }));
  const intento = (desde: boolean) => fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST", headers: { Authorization: `Bearer ${at}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { subject: asunto, body: { contentType: "HTML", content: html }, toRecipients: dir(para),
      ...(desde ? { from: { emailAddress: { address: CORREO_PROYECTOS, name: "Proyectos · regenerativo" } }, ccRecipients: dir(para.includes(CORREO_APARDO) ? [] : [CORREO_APARDO]) }
        : { ccRecipients: dir(para.includes(CORREO_PROYECTOS) ? [] : [CORREO_PROYECTOS]) }) }, saveToSentItems: true }),
  });
  if (comoProyectos !== false) {
    const r = await intento(true);
    if (r.ok) { comoProyectos = true; return true; }
    if (r.status !== 403 && r.status !== 400) return false;
    comoProyectos = false;
  }
  return (await intento(false)).ok;
}

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
    // Archivos nuevos en PRESUPUESTO / PROGRAMACIÓN. La primera vez se toma como base.
    const esObra = (r: string) => /^(PRESUPUESTO|PROGRAMACI[OÓ]N)\//.test(r);
    const nuevosObra = primera || !est.obra_base ? [] : docs.filter((d) => esObra(d.ruta) && !docsAntes[d.ruta]);
    const docsAhora = Object.fromEntries(docs.map((d) => [d.ruta, d.fecha]));
    // 2. Cronograma de obra (lo que el cliente ve): nombre, fechas, avance
    const { data: t } = await admin.from("gantt_tareas").select("nombre,inicio_esperado,dias_esperados,inicio_real,fin_real,avance").eq("encargo_id", e.id).order("orden");
    const firma = (t || []).map((x: any) => [x.nombre, x.inicio_esperado, x.dias_esperados, x.inicio_real || "", x.fin_real || "", Math.round(Number(x.avance || 0) * 100)].join("|")).join("¦");
    const ultimoG = est.gantt_aviso ? new Date(est.gantt_aviso).getTime() : 0;
    const cambioG = !primera && est.gantt !== undefined && est.gantt !== firma && (t || []).length > 0;
    const avisarG = cambioG && Date.now() - ultimoG > 20 * 3600e3;   // máximo un aviso del cronograma al día
    const nuevo: any = { legales_base: true, obra_base: true, docs: docsAhora, gantt: cambioG && !avisarG ? est.gantt : firma, gantt_aviso: avisarG ? new Date().toISOString() : (est.gantt_aviso || null) };
    let enviado = false;
    // Máximo un correo de actualización al día por encargo: si ya salió uno en las últimas 20 h, lo nuevo espera
    // (no se guarda el estado, así la próxima revisión lo vuelve a encontrar y lo manda junto)
    const hay = actualizados.length || nuevosAll.length || nuevosObra.length || avisarG;
    if (hay && para.length && est.ultimo_aviso && Date.now() - new Date(est.ultimo_aviso).getTime() < 20 * 3600e3) {
      res.push({ encargo: e.nombre, en_espera: true, siguiente: new Date(new Date(est.ultimo_aviso).getTime() + 20 * 3600e3).toISOString() });
      continue;
    }
    if (hay && para.length) {
      atCorreo = atCorreo || await token("offline_access Mail.Send");
      const partes: string[] = [];
      // Por cada carpeta del portal (Presupuesto, Legales…) arriba su nombre y abajo las subcarpetas con algo nuevo o actualizado
      const RAIZ: Record<string, string> = { LEGALES: "Legales", PRESUPUESTO: "Presupuesto", "PROGRAMACIÓN": "Programación", PROGRAMACION: "Programación", "DOC _ ENV": "Documentos", "DOC _ ENVIADOS": "Documentos" };
      const grupos = new Map<string, Set<string>>();
      for (const d of [...nuevosAll, ...nuevosObra, ...actualizados]) {
        const s = d.ruta.split("/"); const r = RAIZ[s[0]] || s[0];
        if (!grupos.has(r)) grupos.set(r, new Set());
        grupos.get(r)!.add(s.length > 2 ? s.slice(1, -1).join(" / ") : d.nombre);
      }
      if (grupos.size) partes.push(`<p style="font-size:15px;line-height:1.5;margin:0 0 14px">Revisa los archivos nuevos en:</p>`);
      for (const [r, l] of grupos) partes.push(`<p style="font-size:15px;line-height:1.5;margin:0 0 8px;font-weight:700;letter-spacing:.04em">${esc(r.toUpperCase())}</p>
        <ul style="list-style:none;margin:0 0 22px;padding:0;font-size:15px;line-height:1.5;max-width:520px;border-top:1px dotted #CFCFCF">${[...l].map((c) => `<li style="padding:9px 0;border-bottom:1px dotted #CFCFCF">${esc(c)}</li>`).join("")}</ul>`);
      if (avisarG) { const av = (t || []).length ? Math.round((t || []).reduce((s: number, x: any) => s + Number(x.avance || 0), 0) / (t || []).length * 100) : 0;
        partes.push(`<p style="font-size:15px;line-height:1.5">Se actualizó el <b>cronograma de obra</b> (${(t || []).length} actividades · avance promedio ${av} %).</p>`); }
      enviado = await enviarCliente(atCorreo, para, `Actualización · ${e.nombre}`, plantilla(e.nombre, partes.join("")));
      if (!enviado) continue;   // se reintenta en la próxima revisión (no se guarda el estado)
      nuevo.ultimo_aviso = new Date().toISOString();
    } else if (est.ultimo_aviso) nuevo.ultimo_aviso = est.ultimo_aviso;
    // Sin correo del cliente: se toma lo actual como base, para no avisar cosas viejas cuando se agregue el correo
    await admin.from("encargos").update({ avisos_cliente: nuevo }).eq("id", e.id);
    res.push({ encargo: e.nombre, base: primera, actualizados: actualizados.length, nuevos_legales: nuevosAll.length, nuevos_obra: nuevosObra.length, cronograma: avisarG, enviado, sin_correo: !para.length });
  }
  return { revisados: res.length, desde: comoProyectos === false ? CORREO_APARDO : comoProyectos ? CORREO_PROYECTOS : null, detalle: res };
}

Deno.serve(async (req) => {
  try {
    const b = await req.json().catch(() => ({}));
    const { data: k } = await admin.from("integraciones").select("refresh_token").eq("id", "cron").maybeSingle();
    if (!k?.refresh_token || b.clave !== k.refresh_token) return json({ error: "Sin acceso." }, 403);
    return json(await revisar());
  } catch (err) { return json({ error: (err as Error).message }, 500); }
});
