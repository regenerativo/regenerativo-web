// Cada hora (pg_cron, clave 'cron'): lo que se cambie a mano en el Excel del cronograma (carpeta PROGRAMACIÓN)
// vuelve al portal: fechas del encargo, actividades (nombre, responsable, peso, fechas, avance) y responsables.
// Solo se lee un Excel que cambió desde la última revisión. No se borran actividades del portal.
import { createClient } from "npm:@supabase/supabase-js@2";

const TENANT = "d5bde326-cff3-4067-b8ed-8821209cee21";
const CLIENTE = "5fb20396-2b10-470b-b028-86f4b6e9d9ca";
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const json = (c: unknown, s = 200) => new Response(JSON.stringify(c), { status: s, headers: { "Content-Type": "application/json" } });
const enc = (p: string) => p.split("/").map(encodeURIComponent).join("/");
const CARPETAS = ["PROGRAMACIÓN", "PROGRAMACION"];
const DIAS: Record<string, string> = { "lunes a viernes": "lv", "lunes a sábado": "ls", "lunes a sabado": "ls", "todos los días": "todos", "todos los dias": "todos" };

async function acceso() {
  const { data } = await admin.from("integraciones").select("refresh_token").eq("id", "onedrive").maybeSingle();
  if (!data?.refresh_token) throw new Error("OneDrive no está conectado.");
  const r = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENTE, client_secret: Deno.env.get("MS_CLIENT_SECRET") ?? "", scope: "offline_access Files.ReadWrite User.Read", grant_type: "refresh_token", refresh_token: data.refresh_token }),
  });
  const t = await r.json(); if (!r.ok) throw new Error(t.error_description || "Microsoft rechazó la conexión.");
  if (t.refresh_token) await admin.from("integraciones").update({ refresh_token: t.refresh_token, actualizado: new Date().toISOString() }).eq("id", "onedrive");
  return t.access_token as string;
}
const G = async (at: string, ruta: string) => { const r = await fetch(`https://graph.microsoft.com/v1.0${ruta}`, { headers: { Authorization: `Bearer ${at}` } }); return r.ok ? await r.json() : null; };

// Fecha de Excel (número de serie o texto) → AAAA-MM-DD
function fecha(v: unknown): string | null {
  if (v === "" || v == null) return null;
  if (typeof v === "number" && v > 20000) return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 864e5).toISOString().slice(0, 10);
  const s = String(v).trim(); let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/); if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}
const num = (v: unknown) => { if (v === "" || v == null) return null; const n = typeof v === "number" ? v : Number(String(v).replace(/%$/, "").replace(",", ".")); return Number.isFinite(n) ? (/%$/.test(String(v)) ? n / 100 : n) : null; };
const txt = (v: unknown) => String(v ?? "").trim();

async function leerGantt(at: string, e: any, item: any, seco = false) {
  const hoja = (dir: string) => G(at, `/me/drive/items/${item.id}/workbook/worksheets('GANTT')/range(address='${dir}')?$select=values`).then((x) => x?.values as unknown[][] | undefined);
  const [cab, act, resp] = await Promise.all([hoja("J5:J7"), hoja("C13:M27"), hoja("C35:D44")]);
  if (!act) return { encargo: e.nombre, error: "El Excel no tiene la hoja GANTT." };
  const cambios: string[] = [];
  // Fechas y días de trabajo del encargo
  if (cab) {
    const ini = fecha(cab[0]?.[0]), fin = fecha(cab[1]?.[0]), dias = DIAS[txt(cab[2]?.[0]).toLowerCase()];
    const up: Record<string, unknown> = {};
    if (ini && ini !== e.inicio) up.inicio = ini; if (fin && fin !== e.fin) up.fin = fin; if (dias && dias !== e.dias_trabajo) up.dias_trabajo = dias;
    if (Object.keys(up).length) { if (!seco) await admin.from("encargos").update(up).eq("id", e.id); cambios.push("fechas del encargo " + JSON.stringify(up)); }
  }
  // Responsables (número = fila)
  const { data: rs } = await admin.from("encargo_responsables").select("id,numero,nombre,cargo").eq("encargo_id", e.id);
  const porNum = new Map((rs || []).map((r: any) => [r.numero, r]));
  for (let i = 0; i < (resp || []).length; i++) {
    const nombre = txt(resp![i][0]), cargo = txt(resp![i][1]); if (!nombre) continue;
    const r: any = porNum.get(i + 1);
    if (!r) { if (seco) { cambios.push(`responsable nuevo ${nombre}`); continue; } const { data } = await admin.from("encargo_responsables").insert({ encargo_id: e.id, numero: i + 1, nombre, cargo }).select("id,numero,nombre,cargo").single(); if (data) porNum.set(i + 1, data); cambios.push(`responsable ${nombre}`); }
    else if (r.nombre !== nombre || (r.cargo || "") !== cargo) { if (!seco) await admin.from("encargo_responsables").update({ nombre, cargo }).eq("id", r.id); cambios.push(`responsable ${nombre}`); }
  }
  // Actividades (fila i = actividad i del portal, en orden)
  const { data: ts } = await admin.from("gantt_tareas").select("*").eq("encargo_id", e.id).order("orden");
  const filas = act.map((f) => ({ nombre: txt(f[0]), resp: num(f[1]), peso: num(f[3]), ini: fecha(f[4]), dias: num(f[5]), iniR: fecha(f[7]), finR: fecha(f[8]), avance: num(f[10]) }));
  const llenas = filas.filter((f) => f.nombre).length;
  for (let i = 0; i < filas.length; i++) {
    const f = filas[i]; if (!f.nombre) continue;
    const t: any = (ts || [])[i];
    const respId = f.resp ? (porNum.get(Math.round(f.resp)) as any)?.id ?? null : null;
    const pesoAuto = llenas ? 1 / llenas : 0;
    const d: Record<string, unknown> = { nombre: f.nombre, responsable_id: respId, inicio_esperado: f.ini, dias_esperados: f.dias != null ? Math.round(f.dias) : null,
      inicio_real: f.iniR, fin_real: f.finR, avance: f.avance != null ? Math.max(0, Math.min(1, f.avance > 1 ? f.avance / 100 : f.avance)) : 0 };
    // El peso que el portal pone por defecto (1/n) no se guarda como peso manual
    if (f.peso != null && (t?.peso_manual != null || Math.abs(f.peso - pesoAuto) > 0.001)) d.peso_manual = f.peso;
    if (!t) { if (!seco) await admin.from("gantt_tareas").insert({ encargo_id: e.id, orden: i, ...d }); cambios.push(`actividad nueva: ${f.nombre}`); continue; }
    const distinto = Object.entries(d).some(([k, v]) => k === "avance" || k === "peso_manual" ? Math.abs(Number(t[k] ?? 0) - Number(v ?? 0)) > 0.0005 : String(t[k] ?? "").slice(0, 10) !== String(v ?? "").slice(0, 10));
    if (distinto) { if (!seco) await admin.from("gantt_tareas").update(d).eq("id", t.id); cambios.push(seco ? `${f.nombre} ${JSON.stringify(Object.fromEntries(Object.entries(d).filter(([k, v]) => String(t[k] ?? "") !== String(v ?? ""))))} antes ${JSON.stringify(Object.fromEntries(Object.keys(d).map((k) => [k, t[k]])))}` : f.nombre); }
  }
  return { encargo: e.nombre, archivo: item.name, cambios };
}

async function revisar(todo = false, seco = false) {
  const at = await acceso();
  const { data: est } = await admin.from("integraciones").select("refresh_token").eq("id", "excel_cronograma").maybeSingle();
  let vistos: Record<string, string> = {}; try { vistos = JSON.parse(est?.refresh_token || "{}"); } catch (_) { /* vacío */ }
  const { data: encs } = await admin.from("encargos").select("id,nombre,onedrive_carpeta,inicio,fin,dias_trabajo").not("onedrive_carpeta", "is", null);
  const res: any[] = [];
  for (const e of encs || []) {
    let l: any[] | null = null;
    for (const c of CARPETAS) { const x = await G(at, `/me/drive/root:/${enc(`${e.onedrive_carpeta}/${c}`)}:/children?$top=200&$select=id,name,file,lastModifiedDateTime`); if (x) { l = x.value || []; break; } }
    const item = (l || []).filter((x: any) => x.file && /\.xlsx$/i.test(x.name) && !x.name.startsWith("~"))
      .sort((a: any, b: any) => (b.lastModifiedDateTime > a.lastModifiedDateTime ? 1 : -1))[0];
    if (!item) continue;
    if (!todo && vistos[e.id] === item.lastModifiedDateTime) continue;   // sin cambios desde la última revisión
    if (!todo && Date.now() - new Date(item.lastModifiedDateTime).getTime() < 5 * 60e3) continue;   // todavía lo están editando
    try { const r = await leerGantt(at, e, item, seco); res.push(r); if (!r.error && !seco) vistos[e.id] = item.lastModifiedDateTime; }
    catch (err) { res.push({ encargo: e.nombre, error: (err as Error).message }); }
  }
  if (!seco) await admin.from("integraciones").upsert({ id: "excel_cronograma", refresh_token: JSON.stringify(vistos), actualizado: new Date().toISOString() });
  return { revisados: res };
}

Deno.serve(async (req) => {
  try {
    const b = await req.json().catch(() => ({}));
    const { data: k } = await admin.from("integraciones").select("refresh_token").eq("id", "cron").maybeSingle();
    if (!k?.refresh_token || b.clave !== k.refresh_token) return json({ error: "Sin acceso." }, 403);
    return json(await revisar(!!b.todo, !!b.seco));
  } catch (err) { return json({ error: (err as Error).message }, 500); }
});
