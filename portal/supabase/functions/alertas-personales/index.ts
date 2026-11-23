// Alertas de las finanzas personales de Andrés a su correo personal (per_ajustes.correo_alertas).
// La llama pg_cron cada día a las 7:00 a. m. de Bogotá (clave 'cron'). También se puede pedir desde el portal
// (con la sesión del dueño) para una prueba: {prueba: true}.
// Avisa una sola vez por cosa (per_alertas_enviadas): categoría al cruzar los % de aviso que él elige (per_ajustes.umbrales), pagos fijos que
// vencen en 3 días o ya vencieron sin pagar, resumen del mes anterior el día 1 y proyectos con meta en 30 días.
import { createClient } from "npm:@supabase/supabase-js@2";

const TENANT = "d5bde326-cff3-4067-b8ed-8821209cee21";
const CLIENTE = "5fb20396-2b10-470b-b028-86f4b6e9d9ca";
const PORTAL = "https://regenerativo.co/portal/#/personal";
const URL_SB = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(URL_SB, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (c: unknown, s = 200) => new Response(JSON.stringify(c), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const esc = (s: string) => String(s ?? "").replace(/[&<>"]/g, (x) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" } as any)[x]);
const cop = (v: number) => (v < 0 ? "−" : "") + Math.round(Math.abs(Number(v) || 0)).toLocaleString("es-CO").replace(/,/g, ".") + " COP";
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

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
async function enviar(para: string, asunto: string, html: string) {
  const at = await tokenCorreo();
  const s = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST", headers: { Authorization: `Bearer ${at}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { subject: asunto, body: { contentType: "HTML", content: html }, toRecipients: [{ emailAddress: { address: para } }] }, saveToSentItems: false }),
  });
  if (!s.ok) throw new Error(`Correo ${s.status}: ${(await s.text()).slice(0, 200)}`);
}
const plantilla = (titulo: string, items: string) => `<div style="font-family:Arial,sans-serif;color:#1E221D;max-width:560px">
  <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#999">Finanzas personales</p>
  <h2 style="font-weight:400;margin:0 0 16px">${esc(titulo)}</h2>${items}
  <p style="margin:22px 0"><a href="${PORTAL}" style="display:inline-block;background:#1E221D;color:#fff;text-decoration:none;border-radius:999px;padding:10px 20px">Abrir mis finanzas</a></p></div>`;
const bloque = (t: string, l: string[]) => l.length ? `<p style="margin:16px 0 6px;color:#999;font-size:13px">${esc(t)}</p><ul style="margin:0;padding:12px 12px 12px 30px;background:#F3EFE6;border-radius:14px;font-size:15px;line-height:1.55">${l.map((x) => `<li>${x}</li>`).join("")}</ul>` : "";

// Mismos cálculos que el portal: esperado = ajuste del mes o plan base; real = movimientos del mes
async function revisar(dueno: string, prueba: boolean) {
  const { data: aj } = await admin.from("per_ajustes").select("*").eq("dueno", dueno).maybeSingle();
  if (!aj?.correo_alertas || (!aj.alertas && !prueba)) return { enviado: false, motivo: "Alertas apagadas o sin correo." };
  const hoy = new Date(Date.now() - 5 * 3600e3), iso = hoy.toISOString().slice(0, 10), mes = iso.slice(0, 7), dia = hoy.getUTCDate();
  const [y, m] = mes.split("-").map(Number);
  const ant = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  const desde = `${ant}-01`;
  const [{ data: cats }, { data: pres }, { data: movs }, { data: fijos }, { data: proys }, { data: items }, { data: yaEnv }] = await Promise.all([
    admin.from("per_categorias").select("*").eq("dueno", dueno),
    admin.from("per_presupuesto").select("*").eq("dueno", dueno),
    admin.from("per_movimientos").select("fecha,tipo,valor,categoria_id,etiquetas,descripcion,fijo_id,proyecto_id").eq("dueno", dueno).gte("fecha", desde),
    admin.from("per_fijos").select("*").eq("dueno", dueno).eq("activo", true),
    admin.from("per_proyectos").select("*").eq("dueno", dueno).neq("estado", "cerrado"),
    admin.from("per_proyecto_items").select("proyecto_id,valor").eq("dueno", dueno),
    admin.from("per_alertas_enviadas").select("clave").eq("dueno", dueno),
  ]);
  const ya = new Set((yaEnv || []).map((x: any) => x.clave));
  const esperado = (cid: string, k: string) => { const o = (pres || []).find((p: any) => p.categoria_id === cid && p.mes === k); const b = (pres || []).find((p: any) => p.categoria_id === cid && !p.mes); return Number((o ?? b)?.valor || 0); };
  const real = (cid: string, k: string) => (movs || []).filter((x: any) => x.categoria_id === cid && x.fecha.startsWith(k)).reduce((s: number, x: any) => s + Number(x.valor), 0);
  const nuevas: string[] = [];
  const marcar = (k: string) => { if (ya.has(k) && !prueba) return false; nuevas.push(k); return true; };
  // 1. Categorías de gasto cerca o por encima de lo esperado
  const cat: string[] = [];
  for (const c of (cats || []).filter((c: any) => c.tipo === "gasto" && c.activa !== false)) {
    const e = esperado(c.id, mes), r = real(c.id, mes); if (!e) continue;
    const p = Math.round(r / e * 100);
    // Porcentajes de aviso que él eligió en la página: se avisa el más alto que se cruzó y no se había avisado
    const umbrales = ((aj.umbrales && aj.umbrales.length) ? aj.umbrales : [aj.avisar_pct || 80, 100]).map(Number).filter((u: number) => u > 0).sort((a: number, b: number) => a - b);
    const u = umbrales.filter((x: number) => p >= x).pop();
    if (u == null) continue;
    const yaMayor = umbrales.some((x: number) => x >= u && ya.has(`cat:${c.id}:${mes}:${x}`));
    if (yaMayor && !prueba) continue;
    marcar(`cat:${c.id}:${mes}:${u}`);
    cat.push(p >= 100 ? `<b>${esc(c.emoji || "")} ${esc(c.nombre)}</b>: ${cop(r)} de ${cop(e)} (${p} %). Ya pasaste lo esperado por ${cop(r - e)}. Revisa tu presupuesto.`
      : `<b>${esc(c.emoji || "")} ${esc(c.nombre)}</b>: ya vas en el ${p} % (${cop(r)} de ${cop(e)}). Te quedan ${cop(e - r)} este mes. Revisa tu presupuesto.`);
  }
  // 2. Pagos fijos: vencen en 3 días o ya vencieron, sin pago registrado este mes
  const fij: string[] = [];
  const pagado = (f: any) => (movs || []).some((x: any) => x.fecha.startsWith(mes) && (x.fijo_id === f.id || (f.categoria_id && x.categoria_id === f.categoria_id && (!f.etiqueta || (x.etiquetas || []).includes(f.etiqueta)) && String(x.descripcion || "").toLowerCase().includes(String(f.nombre).toLowerCase()))));
  for (const f of fijos || []) {
    if (pagado(f)) continue;
    const faltan = f.dia - dia;
    if (faltan <= 3 && marcar(`fijo:${f.id}:${mes}:${faltan < 0 ? "vencido" : "pronto"}`)) fij.push(`<b>${esc(f.nombre)}</b> · ${cop(f.valor)} · ${faltan < 0 ? `venció el día ${f.dia}` : faltan === 0 ? "vence hoy" : `vence en ${faltan} día${faltan > 1 ? "s" : ""} (día ${f.dia})`}`);
  }
  // 3. Resumen del mes anterior (el día 1 o en una prueba)
  let resumen = "";
  if ((dia === 1 || prueba) && marcar(`resumen:${ant}`)) {
    const suma = (t: string, k: string) => (movs || []).filter((x: any) => x.tipo === t && x.fecha.startsWith(k)).reduce((s: number, x: any) => s + Number(x.valor), 0);
    const espT = (t: string, k: string) => (cats || []).filter((c: any) => c.tipo === t).reduce((s: number, c: any) => s + esperado(c.id, k), 0);
    const ing = suma("ingreso", ant), gas = suma("gasto", ant), aho = suma("ahorro", ant);
    const pasadas = (cats || []).filter((c: any) => c.tipo === "gasto" && esperado(c.id, ant) && real(c.id, ant) > esperado(c.id, ant))
      .map((c: any) => `${esc(c.nombre)}: ${cop(real(c.id, ant))} de ${cop(esperado(c.id, ant))}`);
    resumen = bloque(`Cómo te fue en ${MESES[Number(ant.slice(5)) - 1]}`, [
      `Ingresos ${cop(ing)} · esperado ${cop(espT("ingreso", ant))}`, `Gastos ${cop(gas)} · esperado ${cop(espT("gasto", ant))}`,
      `Ahorro ${cop(aho)} · esperado ${cop(espT("ahorro", ant))}`, `Disponible ${cop(ing - gas - aho)}`,
      ...(pasadas.length ? [`Se pasaron: ${pasadas.join(" · ")}`] : ["Ninguna categoría pasó lo esperado."])]);
  }
  // 4. Proyectos personales con meta en los próximos 30 días y plata pendiente
  const pro: string[] = [];
  for (const p of proys || []) {
    if (!p.fecha_meta) continue;
    const dias = Math.round((new Date(p.fecha_meta).getTime() - new Date(iso).getTime()) / 864e5);
    const total = (items || []).filter((i: any) => i.proyecto_id === p.id).reduce((s: number, i: any) => s + Number(i.valor), 0);
    if (dias < 0 || dias > 30 || !total) continue;
    if (marcar(`proy:${p.id}:${mes}`)) pro.push(`<b>${esc(p.nombre)}</b>: meta en ${dias} días · presupuesto ${cop(total)}`);
  }
  const cuerpo = bloque("Categorías", cat) + bloque("Pagos fijos", fij) + resumen + bloque("Proyecciones", pro);
  if (!cuerpo) {
    if (!prueba) return { enviado: false, motivo: "Nada nuevo que avisar." };
    await enviar(aj.correo_alertas, "Prueba · alertas de mis finanzas", plantilla("Las alertas están activas", "<p style=\"font-size:15px\">Así te llegarán los avisos de tu presupuesto. Hoy no hay nada pendiente.</p>"));
    return { enviado: true, prueba: true };
  }
  await enviar(aj.correo_alertas, prueba ? "Prueba · alertas de mis finanzas" : `Mis finanzas · ${cat.length + fij.length + pro.length + (resumen ? 1 : 0)} aviso${cat.length + fij.length + pro.length + (resumen ? 1 : 0) > 1 ? "s" : ""}`, plantilla(prueba ? "Prueba de alertas" : "Avisos de tu presupuesto", cuerpo));
  if (!prueba && nuevas.length) await admin.from("per_alertas_enviadas").upsert(nuevas.map((clave) => ({ dueno, clave })));
  return { enviado: true, avisos: nuevas.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const b = await req.json().catch(() => ({}));
    if (b.clave) {
      const { data: k } = await admin.from("integraciones").select("refresh_token").eq("id", "cron").maybeSingle();
      if (!k?.refresh_token || b.clave !== k.refresh_token) return json({ error: "Sin acceso." }, 403);
      const { data: ajs } = await admin.from("per_ajustes").select("dueno").eq("alertas", true);
      const res = [];
      for (const a of ajs || []) { try { res.push(await revisar(a.dueno, false)); } catch (e) { res.push({ error: (e as Error).message }); } }
      return json({ revisados: res.length, res });
    }
    // Desde el portal: solo el dueño, para su propia prueba
    const usuario = createClient(URL_SB, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: yo } = await usuario.auth.getUser();
    if (!yo?.user) return json({ error: "Sesión no válida." }, 401);
    return json(await revisar(yo.user.id, true));
  } catch (err) { return json({ error: (err as Error).message }, 500); }
});
