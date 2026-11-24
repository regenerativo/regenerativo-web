// Documentos en Word de regenerativo conectados con el portal (legales y propuestas preliminares).
// Se empiezan en el portal (Word desde la plantilla) y se terminan a mano en el archivo; el PDF se rehace solo.
//   {accion:'plantillas'}                              → plantillas de ZL_REG_LEGALES/REG_TEMPLATES
//   {accion:'crear', encargo_id, tipo, plantilla}      → Word nuevo en la carpeta de LEGALES que toca (contrato, adenda, acta, facturación)
//   {accion:'pdf', encargo_id, ruta} | {propuesta_id, nombre} → PDF de ese Word ahora
//   {accion:'revisar', clave}                          → (cada hora) PDF nuevo de cada Word que cambió en LEGALES y en las propuestas
// El PDF se arma desde una copia temporal del Word con Metronic Pro y Stolzl incrustadas: el Word del equipo no se toca.
import { createClient } from "npm:@supabase/supabase-js@2";
import { unzipSync, zipSync, strFromU8, strToU8 } from "npm:fflate@0.8.2";

const TENANT = "d5bde326-cff3-4067-b8ed-8821209cee21";
const CLIENTE = "5fb20396-2b10-470b-b028-86f4b6e9d9ca";
const PLANTILLAS = "REG/REG  I  GESTION INTEGRAL/ZL_REG_LEGALES/REG_TEMPLATES";
const PROPUESTAS = "REG/REG  I  GESTION INTEGRAL/ZL_REG_PROPUESTAS";
// Carpeta de LEGALES de cada tipo (la primera que exista; si ninguna existe se crea la primera)
const CARPETAS: Record<string, { nombre: string; carpetas: string[] }> = {
  contrato: { nombre: "CONTRATO", carpetas: ["LEGALES/01 CONTRATOS", "LEGALES/OPS CONTRATOS"] },
  adenda: { nombre: "ADENDA", carpetas: ["LEGALES/02 ADENDAS"] },
  acta: { nombre: "ACTA DE ENTREGA", carpetas: ["LEGALES/03 ACTAS DE ENTREGA", "LEGALES/04 ACTAS DE ENTREGA"] },
  facturacion: { nombre: "FACTURA", carpetas: ["LEGALES/05 FACTURACION"] },
};
const CUENTAS = ["LEGALES/04 CUENTAS DE COBRO", "LEGALES/05 CUENTAS DE COBRO", "LEGALES/CUENTAS DE COBRO"];
const URL_SB = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(URL_SB, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (c: unknown, s = 200) => new Response(JSON.stringify(c), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const enc = (p: string) => p.split("/").map(encodeURIComponent).join("/");
const rutaSegura = (r: string) => { if (!r || r.split("/").some((x) => x === ".." || x === "")) throw new Error("Ruta no válida."); return r; };

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
const G = (at: string, ruta: string, init: RequestInit = {}) => fetch(`https://graph.microsoft.com/v1.0${ruta}`, { ...init, headers: { Authorization: `Bearer ${at}`, ...(init.headers || {}) } });
const GJ = async (at: string, ruta: string) => { const r = await G(at, ruta); return r.ok ? await r.json() : null; };
async function subir(at: string, ruta: string, datos: Uint8Array, conflicto = "replace") {
  const r = await G(at, `/me/drive/root:/${enc(ruta)}:/content?@microsoft.graph.conflictBehavior=${conflicto}`, { method: "PUT", headers: { "Content-Type": "application/octet-stream" }, body: datos });
  if (!r.ok) throw new Error(`No se pudo guardar ${ruta.split("/").pop()} en OneDrive.`);
  return await r.json();
}
const hijos = async (at: string, ruta: string) => (await GJ(at, `/me/drive/root:/${enc(ruta)}:/children?$top=200&$select=id,name,file,folder,webUrl,lastModifiedDateTime`))?.value as any[] | undefined;
async function asegurarCarpeta(at: string, ruta: string) {
  if (await GJ(at, `/me/drive/root:/${enc(ruta)}?$select=id`)) return;
  const p = ruta.split("/"); const nombre = p.pop()!; await asegurarCarpeta(at, p.join("/"));
  await G(at, `/me/drive/root:/${enc(p.join("/"))}:/children`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: nombre, folder: {}, "@microsoft.graph.conflictBehavior": "fail" }) });
}

// ---------------- Fuentes de regenerativo en el PDF ----------------
// Microsoft no acepta Metronic Pro incrustada con su nombre original: en la copia temporal va como «MetronicREG» (misma letra).
const FUENTES_URL = "https://regenerativo.co/portal/assets/docfonts";
const FUENTES_DOC: [string, Record<string, string>][] = [
  ["MetronicREG", { Regular: "rg-r", Bold: "rg-bb", Italic: "rg-ii" }],
  ["MetronicREG SemiBold", { Regular: "rg-sb" }], ["MetronicREG Bold", { Regular: "rg-b" }], ["MetronicREG Italic", { Regular: "rg-i" }],
  ["MetronicREG Light", { Regular: "rg-l" }], ["MetronicREG Light Italic", { Regular: "rg-li" }],
  ["Stolzl Medium", { Regular: "st-m" }], ["Stolzl Light", { Regular: "st-l" }], ["Stolzl Book", { Regular: "st-b" }],
];
const LLAVES: Record<string, string> = { "rg-r": "{996EE876-59BB-475E-8893-E1A14C2BA38D}", "rg-bb": "{E27761BC-CFA2-4638-82A1-735E3BA18C59}", "rg-ii": "{2E8C5BF7-133E-4719-BA25-76DD52366BD6}",
  "rg-b": "{1688DD98-DF92-43A1-A1EF-04930ECF249E}", "rg-i": "{E8973237-A4CB-4900-9B6D-D452F799EA47}", "rg-sb": "{FD859686-2B77-4D9F-B69F-2121387CFF30}",
  "rg-l": "{C859EB41-0AB7-4714-8375-86C96EC8B605}", "rg-li": "{2131C083-B51E-4498-8BD1-930424682B51}",
  "st-m": "{EDCC2940-515B-579A-8722-FC430542FE11}", "st-l": "{6FD71215-F7DA-52FA-9492-3F4ED3D458A3}", "st-b": "{BF43B586-7C5D-5FEE-ADC1-B9250A255B91}" };
const NOMBRE_MP = (n: string) => { const x = n.toUpperCase().replace(/[^A-Z]/g, "");
  return x.includes("SEMIBOLD") ? "MetronicREG SemiBold" : x.includes("LIGHTITALIC") ? "MetronicREG Light Italic" : x.includes("LIGHT") ? "MetronicREG Light"
    : x.includes("BOLD") ? "MetronicREG Bold" : x.includes("ITALIC") ? "MetronicREG Italic" : "MetronicREG"; };
const cache: Record<string, Uint8Array> = {};
// La Metronic ya trae su cursiva y su negrita: si el Word además marca cursiva o negrita, Microsoft la inclina o engruesa de nuevo
const sinSintetico = (t: string) => t.replace(/<w:rPr>([\s\S]*?)<\/w:rPr>/g, (m: string, d: string) => {
  const f = (d.match(/w:ascii="([^"]*)"/) || [])[1] || "";
  if (!/^MetronicREG /.test(f)) return m;
  let x = d;
  if (/Italic/.test(f)) x = x.replace(/<w:i(Cs)?(\s+w:val="(1|true|on)")?\s*\/>/g, "");
  if (/Bold/.test(f)) x = x.replace(/<w:b(Cs)?(\s+w:val="(1|true|on)")?\s*\/>/g, "");
  return `<w:rPr>${x}</w:rPr>`;
});
async function incrustarFuentes(z: Record<string, Uint8Array>) {
  for (const k of Object.keys(z)) if (/^word\/(document|header\d*|footer\d*|styles|numbering|fontTable|footnotes|endnotes)\.xml$/.test(k)) {
    let t = strFromU8(z[k]); const t0 = t;
    t = sinSintetico(t.replace(/"(Metronic ?Pro[^"]*|METRONICPRO[^"]*)"/g, (_m, n) => `"${NOMBRE_MP(n)}"`));
    if (k === "word/fontTable.xml") { const vistos = new Set<string>(); t = t.replace(/<w:font w:name="([^"]*)">[\s\S]*?<\/w:font>/g, (m: string, n: string) => vistos.has(n) ? "" : (vistos.add(n), m)); }
    if (t !== t0) z[k] = strToU8(t);
  }
  if (!z["word/fontTable.xml"]) return z;
  let ft = strFromU8(z["word/fontTable.xml"]);
  if (!/xmlns:r=/.test(ft)) ft = ft.replace("<w:fonts ", '<w:fonts xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ');
  const usadas = new Set<string>(), rels: string[] = [];
  for (const [nombre, tipos] of FUENTES_DOC) {
    const emb = Object.entries(tipos).map(([t, k]) => { usadas.add(k); return `<w:embed${t} r:id="rIdF${k.replace("-", "")}" w:fontKey="${LLAVES[k]}"/>`; }).join("");
    const re = new RegExp(`<w:font w:name="${nombre}">([\\s\\S]*?)</w:font>`);
    if (re.test(ft)) ft = ft.replace(re, (_m: string, d: string) => `<w:font w:name="${nombre}">${d.replace(/<w:embed(Regular|Bold|Italic|BoldItalic) [^>]*\/>/g, "")}${emb}</w:font>`);
    else ft = ft.replace("</w:fonts>", `<w:font w:name="${nombre}"><w:charset w:val="00"/><w:family w:val="auto"/><w:pitch w:val="variable"/>${emb}</w:font></w:fonts>`);
  }
  for (const k of Object.keys(z)) if (/^word\/fonts\/.+\.odttf$/.test(k)) delete z[k];
  for (const k of usadas) {
    if (!cache[k]) { const r = await fetch(`${FUENTES_URL}/${k}.odttf?v=3`); if (!r.ok) throw new Error("No se pudieron cargar las fuentes de regenerativo."); cache[k] = new Uint8Array(await r.arrayBuffer()); }
    z[`word/fonts/${k}.odttf`] = cache[k];
    rels.push(`<Relationship Id="rIdF${k.replace("-", "")}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/${k}.odttf"/>`);
  }
  z["word/fontTable.xml"] = strToU8(ft);
  z["word/_rels/fontTable.xml.rels"] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join("")}</Relationships>`);
  let ct = strFromU8(z["[Content_Types].xml"]);
  if (!/Extension="odttf"/.test(ct)) ct = ct.replace("<Default ", '<Default Extension="odttf" ContentType="application/vnd.openxmlformats-officedocument.obfuscatedFont"/><Default ');
  z["[Content_Types].xml"] = strToU8(ct);
  if (z["word/settings.xml"]) { let st = strFromU8(z["word/settings.xml"]);
    if (!/<w:embedTrueTypeFonts/.test(st)) st = /<w:zoom [^>]*\/>/.test(st) ? st.replace(/(<w:zoom [^>]*\/>)/, "$1<w:embedTrueTypeFonts/>") : st.replace(/(<w:settings [^>]*>)/, "$1<w:embedTrueTypeFonts/>");
    z["word/settings.xml"] = strToU8(st.replace(/<w:saveSubsetFonts\/>/, "")); }
  return z;
}

// Texto de los párrafos (para leer valor y concepto de una cuenta de cobro hecha a mano)
const desXml = (t: string) => t.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const parrafos = (xml: string) => (xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || [])
  .map((p) => desXml((p.match(/<w:t(?:\s[^>]*)?>[^<]*<\/w:t>/g) || []).map((t) => t.replace(/<[^>]+>/g, "")).join("")).trim()).filter(Boolean);
function leerCuenta(xml: string) {
  const ps = parrafos(xml);
  const tras = (et: string) => { const i = ps.findIndex((p) => p.toLowerCase().startsWith(et)); return i >= 0 ? ps[i + 1] || "" : ""; };
  const valor = Number(((tras("la suma de").match(/\d[\d.]*/) || [""])[0]).replace(/\./g, "")) || null;
  const concepto = tras("por concepto de");
  return { valor, concepto: concepto && !/^X+$/.test(concepto) ? concepto : null };
}

// PDF de un Word (mismo nombre, misma carpeta) armado desde una copia temporal con las fuentes incrustadas
async function pdfDeWord(at: string, ruta: string) {
  const r = await G(at, `/me/drive/root:/${enc(ruta)}:/content`); if (!r.ok) throw new Error("No encontré el Word.");
  const z = unzipSync(new Uint8Array(await r.arrayBuffer()));
  const xml = z["word/document.xml"] ? strFromU8(z["word/document.xml"]) : "";
  await incrustarFuentes(z);
  const tmp = await G(at, `/me/drive/special/approot:/PDF_${crypto.randomUUID()}.docx:/content`, { method: "PUT", headers: { "Content-Type": "application/octet-stream" }, body: zipSync(z) });
  if (!tmp.ok) throw new Error("No se pudo preparar el PDF.");
  const t = await tmp.json();
  try {
    const p = await G(at, `/me/drive/items/${t.id}/content?format=pdf`); if (!p.ok) throw new Error("Microsoft no pudo convertir el Word a PDF.");
    const bytes = new Uint8Array(await p.arrayBuffer());
    const pdf = await subir(at, ruta.replace(/\.docx$/i, ".pdf"), bytes);
    const word = await GJ(at, `/me/drive/root:/${enc(ruta)}?$select=webUrl`);
    // Fuentes que quedaron en el PDF (para comprobar que no salió con Calibri)
    let txt = ""; for (let i = 0; i < bytes.length; i += 0x8000) txt += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const fuentes = [...new Set([...txt.matchAll(/\/FontName\/(?:[A-Z]{6}\+)?([^/\s]+)\/Flags \d+[\s\S]{0,160}?\/FontWeight (\d+)/g)].map((m) => `${m[1]}:${m[2]}`))];
    return { pdf, word, xml, fuentes };
  } finally { await G(at, `/me/drive/items/${t.id}`, { method: "DELETE" }).catch(() => {}); }
}
async function despuesDelPdf(encargoId: string | null, ruta: string, x: { pdf: any; word: any; xml: string }) {
  if (!encargoId || !CUENTAS.some((c) => ruta.includes(`/${c}/`))) return null;
  const nombre = ruta.split("/").pop()!.replace(/\.docx$/i, "");
  if (!/^(CCREG_|CUENTA DE COBRO)/i.test(nombre)) return null;
  const d = leerCuenta(x.xml);
  const numero = (nombre.match(/_ (\d{1,3})$/) || [])[1] || null;
  await admin.from("cuentas_cobro").upsert({ encargo_id: encargoId, nombre, numero, valor: d.valor, ...(d.concepto ? { concepto: d.concepto } : {}),
    word_web: x.word?.webUrl, pdf_web: x.pdf.webUrl, actualizado: new Date().toISOString() }, { onConflict: "encargo_id,nombre" });
  return d;
}

// Cada Word que cambió (2 min más nuevo que su PDF) y lleva 10 minutos sin tocarse
async function recorrer(at: string, ruta: string, prof: number, out: { ruta: string; mod: number; pdf: number }[]) {
  const l = await hijos(at, ruta); if (!l) return;
  for (const w of l.filter((x) => x.file && /\.docx$/i.test(x.name) && !x.name.startsWith("~$") && !/XXXX/.test(x.name))) {
    const pdf = l.find((x) => x.file && x.name.toLowerCase() === w.name.replace(/\.docx$/i, ".pdf").toLowerCase());
    out.push({ ruta: `${ruta}/${w.name}`, mod: new Date(w.lastModifiedDateTime).getTime(), pdf: pdf ? new Date(pdf.lastModifiedDateTime).getTime() : 0 });
  }
  if (prof > 0) for (const c of l.filter((x) => x.folder && !/^ZL_|OBSOLETO/i.test(x.name))) await recorrer(at, `${ruta}/${c.name}`, prof - 1, out);
}
async function revisar() {
  const at = await acceso();
  const res: any[] = [];
  const procesar = async (encargoId: string | null, quien: string, base: string, prof: number) => {
    const ws: { ruta: string; mod: number; pdf: number }[] = []; await recorrer(at, base, prof, ws);
    for (const w of ws) {
      if (w.mod - w.pdf < 120e3 || Date.now() - w.mod < 10 * 60e3) continue;
      try { const x = await pdfDeWord(at, w.ruta); const c = await despuesDelPdf(encargoId, w.ruta, x); res.push({ de: quien, word: w.ruta.split("/").pop(), ...(c ? { valor: c.valor } : {}) }); }
      catch (err) { res.push({ de: quien, word: w.ruta.split("/").pop(), error: (err as Error).message }); }
    }
  };
  const { data: encs } = await admin.from("encargos").select("id,nombre,onedrive_carpeta").not("onedrive_carpeta", "is", null);
  for (const e of encs || []) await procesar(e.id, e.nombre, `${e.onedrive_carpeta}/LEGALES`, 2);
  // Propuestas preliminares que todavía no despegan (su carpeta en ZL_REG_PROPUESTAS)
  const { data: props } = await admin.from("propuestas").select("codigo,nombre,archivo_ruta,encargo_id").not("archivo_ruta", "is", null);
  for (const p of props || []) { const c = String(p.archivo_ruta).split("/").slice(0, -1).join("/"); if (c.startsWith(PROPUESTAS + "/")) await procesar(p.encargo_id, p.codigo, c, 1); }
  return { actualizados: res };
}

async function baseEncargo(encargoId: string) {
  const { data: e } = await admin.from("encargos").select("id,codigo,nombre,onedrive_carpeta").eq("id", encargoId).single();
  if (!e) throw new Error("Encargo no encontrado.");
  return { e, base: e.onedrive_carpeta || `REG/${String(e.nombre).toUpperCase()}` };
}
const corto = (n: string) => String(n || "").replace(/^\s*\d{2}\s+I\s+/, "").trim().toUpperCase();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const b = await req.json().catch(() => ({}));
    const { data: k } = await admin.from("integraciones").select("refresh_token").eq("id", "cron").maybeSingle();
    const conClave = !!k?.refresh_token && b.clave === k.refresh_token;
    if (b.accion === "revisar") { if (!conClave) return json({ error: "Sin acceso." }, 403); return json(await revisar()); }
    const usuario = createClient(URL_SB, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: esAdmin } = await usuario.rpc("es_admin");
    if (!esAdmin && !conClave) return json({ error: "Solo administración." }, 403);
    const at = await acceso();
    if (b.accion === "plantillas") {
      const l = (await hijos(at, PLANTILLAS)) || [];
      return json({ plantillas: l.filter((x) => x.file && /\.docx$/i.test(x.name) && !x.name.startsWith("~$")).map((x) => x.name).sort((a, c) => a.localeCompare(c, "es")) });
    }
    if (b.accion === "crear") {
      const t = CARPETAS[b.tipo]; if (!t) return json({ error: "Tipo de documento no válido." }, 400);
      const plantilla = String(b.plantilla || ""); if (!plantilla || plantilla.includes("/")) return json({ error: "Elige una plantilla." }, 400);
      const { e, base } = await baseEncargo(b.encargo_id);
      let carpeta = t.carpetas[0];
      for (const c of t.carpetas) if (await GJ(at, `/me/drive/root:/${enc(`${base}/${c}`)}?$select=id`)) { carpeta = c; break; }
      await asegurarCarpeta(at, `${base}/${carpeta}`);
      const ya = ((await hijos(at, `${base}/${carpeta}`)) || []).map((x) => x.name.toUpperCase());
      const re = new RegExp(`_ ${t.nombre} (\\d{1,3}) _`);
      const numero = String(Math.max(0, ...ya.map((n) => Number((n.match(re) || [])[1] || 0))) + 1).padStart(2, "0");
      const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" }).replaceAll("-", " ");
      const nombre = `${hoy} _ ${t.nombre} ${numero} _ ${corto(e.nombre)}.docx`.replace(/[\\/:*?"<>|]/g, " ");
      const r = await G(at, `/me/drive/root:/${enc(`${PLANTILLAS}/${plantilla}`)}:/content`); if (!r.ok) throw new Error("No encontré la plantilla en OneDrive.");
      const z = unzipSync(new Uint8Array(await r.arrayBuffer()));
      // Código del documento en el encabezado de la plantilla (si lo tiene)
      const cod = `SCREG_${String(e.codigo || "2XXXX").replace(/^SCREG_/i, "")}_${corto(e.nombre)} _ ${hoy}`;
      for (const kk of Object.keys(z)) if (/^word\/(header\d*|footer\d*|document)\.xml$/.test(kk)) {
        const x = strFromU8(z[kk]); const y = x.replace(/SCREG_2XXXX_XXX _ XXXX XX XX/g, cod); if (y !== x) z[kk] = strToU8(y); }
      const w = await subir(at, `${base}/${carpeta}/${nombre}`, zipSync(z), "fail");
      return json({ ok: true, nombre, carpeta, web: w.webUrl });
    }
    if (b.accion === "pdf") {
      let ruta: string, encargoId: string | null = null;
      if (b.propuesta_id) {
        const { data: p } = await admin.from("propuestas").select("archivo_ruta,encargo_id").eq("id", b.propuesta_id).single();
        if (!p?.archivo_ruta) return json({ error: "La propuesta no tiene Word." }, 400);
        const nombre = String(b.nombre || p.archivo_ruta.split("/").pop()); if (nombre.includes("/")) return json({ error: "Archivo no válido." }, 400);
        ruta = `${p.archivo_ruta.split("/").slice(0, -1).join("/")}/${nombre}`; encargoId = p.encargo_id;
      } else {
        const { base } = await baseEncargo(b.encargo_id); const rel = rutaSegura(String(b.ruta || ""));
        if (!rel.startsWith("LEGALES/")) return json({ error: "Solo documentos de LEGALES." }, 400);
        ruta = `${base}/${rel}`; encargoId = b.encargo_id;
      }
      if (!/\.docx$/i.test(ruta)) return json({ error: "Solo documentos Word (.docx)." }, 400);
      const x = await pdfDeWord(at, ruta); await despuesDelPdf(encargoId, ruta, x);
      return json({ ok: true, pdf: x.pdf.webUrl, nombre: x.pdf.name, fuentes: x.fuentes });
    }
    return json({ error: "Acción no válida." }, 400);
  } catch (err) { return json({ error: (err as Error).message }, 500); }
});
