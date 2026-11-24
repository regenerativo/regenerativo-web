// Cuenta de cobro de un encargo (solo administración): se arma con el membrete de la propuesta y los datos del encargo,
// se guarda en Word y PDF en LEGALES/04 CUENTAS DE COBRO de la carpeta del encargo en OneDrive.
//   {accion:'datos', encargo_id}   → número siguiente y datos del cliente para el formulario
//   {accion:'crear', encargo_id, fecha, concepto, valor, cliente:{…}, manual?}  → Word (y PDF; manual=true deja solo el Word para terminarlo a mano)
//   {accion:'pdf', encargo_id, nombre}  → vuelve a armar el PDF desde el Word (con las fuentes de regenerativo) y lee el valor
//   {accion:'revisar', clave}           → (cada hora) PDF nuevo de cada cuenta de cobro cuyo Word cambió
// Los Word llevan incrustadas Metronic Pro y Stolzl para que el PDF que arma Microsoft salga con la letra real.
import { createClient } from "npm:@supabase/supabase-js@2";
import { unzipSync, zipSync, strFromU8, strToU8 } from "npm:fflate@0.8.2";

const TENANT = "d5bde326-cff3-4067-b8ed-8821209cee21";
const CLIENTE = "5fb20396-2b10-470b-b028-86f4b6e9d9ca";
const ALCANCE = "offline_access Files.ReadWrite Mail.Read User.Read";
const PLANTILLA = "REG/REG  I  GESTION INTEGRAL/ZL_REG_PROPUESTAS/SCREG_2XXXX_PROPUESTA.docx";
const CARPETA = "LEGALES/04 CUENTAS DE COBRO";
const URL_SB = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(URL_SB, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (c: unknown, s = 200) => new Response(JSON.stringify(c), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const enc = (p: string) => p.split("/").map(encodeURIComponent).join("/");
const cop = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " COP";

async function accesoGraph() {
  const { data } = await admin.from("integraciones").select("refresh_token").eq("id", "onedrive").maybeSingle();
  if (!data?.refresh_token) throw new Error("OneDrive no está conectado.");
  const r = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENTE, client_secret: Deno.env.get("MS_CLIENT_SECRET") ?? "", scope: ALCANCE, grant_type: "refresh_token", refresh_token: data.refresh_token }),
  });
  const t = await r.json(); if (!r.ok) throw new Error(t.error_description || "Microsoft rechazó la conexión");
  if (t.refresh_token) await admin.from("integraciones").update({ refresh_token: t.refresh_token, actualizado: new Date().toISOString() }).eq("id", "onedrive");
  return t.access_token as string;
}
const G = (at: string, ruta: string, init: RequestInit = {}) => fetch(`https://graph.microsoft.com/v1.0${ruta}`, { ...init, headers: { Authorization: `Bearer ${at}`, ...(init.headers || {}) } });
async function subir(at: string, ruta: string, datos: Uint8Array) {
  const r = await G(at, `/me/drive/root:/${enc(ruta)}:/content?@microsoft.graph.conflictBehavior=replace`, { method: "PUT", headers: { "Content-Type": "application/octet-stream" }, body: datos });
  if (!r.ok) throw new Error(`No se pudo guardar ${ruta.split("/").pop()} en OneDrive`);
  return await r.json();
}
async function existentes(at: string, carpeta: string): Promise<string[]> {
  const r = await G(at, `/me/drive/root:/${enc(carpeta)}:/children?$top=200&$select=name`);
  return r.ok ? ((await r.json()).value || []).map((x: any) => x.name as string) : [];
}

// Arma la cuenta de cobro a partir de la plantilla de la propuesta (mismo membrete). Solo texto: sin dependencias.
function armarCuenta(archivos: Record<string, string>, d: any) {
  const E = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const T = (p: string) => (p.match(/<w:t(?:\s[^>]*)?>[^<]*<\/w:t>/g) || []).map((t: string) => t.replace(/<[^>]+>/g, "")).join("");
  const x = archivos["word/document.xml"];
  const ib = x.indexOf("<w:body>") + 8, fb = x.indexOf("</w:body>");
  const head = x.slice(0, ib), body = x.slice(ib, fb);
  const els = body.match(/<w:p[ >][\s\S]*?<\/w:p>|<w:tbl>[\s\S]*?<\/w:tbl>/g) || [];
  const sects = body.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/g) || []; const sect = sects[sects.length - 1] || "";
  const busca = (pref: string) => { const i = els.findIndex((e: string) => T(e).trim().startsWith(pref)); if (i < 0) throw new Error("La plantilla no tiene: " + pref); return i; };
  const uno = (p: string, txt: string) => { let i = 0; return p.replace(/<w:t(\s[^>]*)?>[^<]*<\/w:t>/g, () => i++ ? "<w:t></w:t>" : `<w:t xml:space="preserve">${E(txt)}</w:t>`); };
  const sinNeg = (p: string) => p.replace(/<w:b\/>|<w:bCs\/>/g, "").replace(/METRONICPRO-SEMIBOLD/g, "Metronic Pro");
  const alinear = (p: string, a: string) => { p = p.replace(/<w:ind [^>]*\/>/, ""); const pp = p.split("</w:pPr>")[0]; return /<w:jc /.test(pp) ? p.replace(/<w:jc w:val="[^"]*"\/>/, `<w:jc w:val="${a}"/>`) : p.replace("<w:pPr>", `<w:pPr><w:jc w:val="${a}"/>`); };
  const antes = (p: string, tw: number) => p.replace(/(<w:pPr>(?:<w:pStyle [^>]*\/>)?(?:<w:keepNext\/>)?)/, `$1<w:spacing w:before="${tw}"/>`);
  const linea = (p: string, lab: string, val: string, neg?: any) => {
    const r = (p.match(/<w:r[ >][\s\S]*?<\/w:r>/) || [""])[0]; const rpr = (r.match(/<w:rPr>[\s\S]*?<\/w:rPr>/) || ["<w:rPr></w:rPr>"])[0];
    const rprN = rpr.replace(/(w:ascii|w:hAnsi)="[^"]*"/g, '$1="METRONICPRO-SEMIBOLD"');
    const sinR = p.replace(/<w:r[ >][\s\S]*?<\/w:r>/g, "").replace(/ w14:(paraId|textId)="[^"]*"/g, "");
    const corr = neg ? `<w:r>${rpr}<w:t xml:space="preserve">${E(lab)}: </w:t></w:r><w:r>${rprN}<w:t xml:space="preserve">${E(val)}</w:t></w:r>` : `<w:r>${rpr}<w:t xml:space="preserve">${E(lab)}: ${E(val)}</w:t></w:r>`;
    return sinR.replace(/<\/w:p>$/, corr + "</w:p>");
  };
  const iT = busca("DETALLES TÉCNICOS"), TIT = els[iT], BL = els[iT + 1], LV = els[busca("Nombre del propietario")];
  const iS = busca("Señor"), SR = els[iS], NOM = els[iS + 1], CIU = els[iS + 2];
  const iX = busca("Regenerativo presenta"), TX = els[iX];
  const iC = busca("Cordialmente"), COR = els[iC], F1 = els[iC + 2], F2 = els[iC + 3], GD = els[iC + 4], GD2 = els[iC + 5];
  const c = (p: string, t: string) => alinear(sinNeg(uno(p, t)), "center");
  const out = [uno(TIT, `CUENTA DE COBRO No. ${d.numero}`), BL,
    ...d.datos.map(([l, v, n]: any[]) => linea(LV, l, v, n)), BL, BL,
    c(SR, "Debe a:"), c(NOM, d.debeA), c(CIU, d.debeDatos), BL,
    c(SR, "Por concepto de:"), c(CIU, d.concepto), BL,
    c(SR, "La suma de:"), c(NOM, d.valor), c(CIU, d.letras), BL,
    alinear(uno(TX, d.nota), "center"), alinear(uno(TX, d.anexos), "center"),
    antes(COR, d.espacio || 3600), BL, uno(F1, d.firma), sinNeg(uno(F1, d.mp)), F2, GD, uno(GD2, "Original: LEGALES _ 04 CUENTAS DE COBRO")];
  const res: Record<string, string> = {};
  const gris = (s: string) => s.replace(/<w:color w:val="(7F7F7F|808080|A6A6A6|999999|595959|8A8A8A|767171|AEAAAA|D9D9D9)"[^>]*\/>/g, '<w:color w:val="BFBFBF"/>');
  res["word/document.xml"] = gris(head + out.join("") + sect + "</w:body></w:document>");
  for (const [k, v] of Object.entries(archivos)) {
    if (/^word\/header\d*\.xml$/.test(k)) {
      let h = v.replace(/SCREG_2XXXX_XXX _ XXXX XX XX|SCREG_\d{5}_[^<]*? _ \d{4} \d{2} \d{2}/g, E(d.codigoDoc));
      h = h.replace(/>ARQUITECTURA<\/w:t>([\s\S]*?)<w:t(?: xml:space="preserve")?>  I  <\/w:t>([\s\S]*?<w:t[^>]*)>DISEÑO DE ESPACIOS<\/w:t>/g, (_m: string, a: string, b: string) => `>${E(d.servicios)}</w:t>${a}<w:t></w:t>${b}></w:t>`);
      res[k] = gris(h);
    } else if (/^word\/footer\d*\.xml$/.test(k)) res[k] = gris(v);
  }
  return res;
}
const FUENTES_URL = "https://regenerativo.co/portal/assets/docfonts";
// Fuentes de regenerativo incrustadas en el Word (Metronic Pro y Stolzl), para que el PDF que arma Microsoft salga con la letra real
const FUENTES_DOC: [string, Record<string, string>][] = [
  ["Metronic Pro", { Regular: "mp-r", Bold: "mp-b", Italic: "mp-i" }],
  ["METRONICPRO-SEMIBOLD", { Regular: "mp-sb" }], ["Metronic Pro Bold", { Regular: "mp-b" }], ["Metronic Pro Italic", { Regular: "mp-i" }],
  ["MetronicPro-Light", { Regular: "mp-l" }], ["METRONICPRO-LIGHTITALIC", { Regular: "mp-li" }],
  ["Stolzl Medium", { Regular: "st-m" }], ["Stolzl Light", { Regular: "st-l" }], ["Stolzl Book", { Regular: "st-b" }],
];
const LLAVES: Record<string, string> = { "mp-r": "{2BF3700E-1750-5F50-BFF9-22404A7D2AC7}", "mp-b": "{BF5989BD-C5A2-5F53-98EA-86C34760B6AC}", "mp-sb": "{30AAE685-1DE9-5EDE-B01B-068DB96A3D8C}",
  "mp-l": "{BA09C502-3D98-57B5-BB91-E35AFA5C9769}", "mp-i": "{7361F9FE-AE90-5847-8862-D84DFADE0F3F}", "mp-li": "{655AD001-C8FA-5ED9-AC92-A2A8D42F3FB5}",
  "st-m": "{EDCC2940-515B-579A-8722-FC430542FE11}", "st-l": "{6FD71215-F7DA-52FA-9492-3F4ED3D458A3}", "st-b": "{BF43B586-7C5D-5FEE-ADC1-B9250A255B91}" };
async function incrustarFuentes(z: Record<string, Uint8Array>) {
  const aTexto = strFromU8, aBytes = (t: string) => strToU8(t);
  const cargar = async (k: string) => { const r = await fetch(`${FUENTES_URL}/${k}.odttf`); if (!r.ok) throw new Error("No se pudieron cargar las fuentes de regenerativo."); return new Uint8Array(await r.arrayBuffer()); };
  let ft = aTexto(z["word/fontTable.xml"]);
  if (!/xmlns:r=/.test(ft)) ft = ft.replace("<w:fonts ", '<w:fonts xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ');
  const usadas = new Set<string>(), rels: string[] = [];
  for (const [nombre, tipos] of FUENTES_DOC) {
    const emb = Object.entries(tipos).map(([t, k]) => { usadas.add(k); return `<w:embed${t} r:id="rIdF${k.replace("-", "")}" w:fontKey="${LLAVES[k]}"/>`; }).join("");
    const nom = nombre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`<w:font w:name="${nom}">([\\s\\S]*?)</w:font>`);
    if (re.test(ft)) ft = ft.replace(re, (_m: string, d: string) => `<w:font w:name="${nombre}">${d.replace(/<w:embed(Regular|Bold|Italic|BoldItalic) [^>]*\/>/g, "")}${emb}</w:font>`);
    else ft = ft.replace("</w:fonts>", `<w:font w:name="${nombre}"><w:charset w:val="00"/><w:family w:val="auto"/><w:pitch w:val="variable"/>${emb}</w:font></w:fonts>`);
  }
  for (const k of usadas) {
    z[`word/fonts/${k}.odttf`] = await cargar(k);
    rels.push(`<Relationship Id="rIdF${k.replace("-", "")}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/${k}.odttf"/>`);
  }
  z["word/fontTable.xml"] = aBytes(ft);
  z["word/_rels/fontTable.xml.rels"] = aBytes(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join("")}</Relationships>`);
  let ct = aTexto(z["[Content_Types].xml"]);
  if (!/Extension="odttf"/.test(ct)) ct = ct.replace("<Default ", '<Default Extension="odttf" ContentType="application/vnd.openxmlformats-officedocument.obfuscatedFont"/><Default ');
  z["[Content_Types].xml"] = aBytes(ct);
  let st = aTexto(z["word/settings.xml"]);
  if (!/<w:embedTrueTypeFonts/.test(st)) st = /<w:zoom [^>]*\/>/.test(st) ? st.replace(/(<w:zoom [^>]*\/>)/, "$1<w:embedTrueTypeFonts/>") : st.replace(/(<w:settings [^>]*>)/, "$1<w:embedTrueTypeFonts/>");
  st = st.replace(/<w:saveSubsetFonts\/>/, "");
  z["word/settings.xml"] = aBytes(st);
  return z;
}

// Valor en letras (pesos colombianos)
function enLetras(n: any) {
  const U = ["", "un", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte", "veintiún", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve"];
  const D = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
  const C = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];
  const cien = (x: number): string => { if (x === 100) return "cien"; const c = Math.floor(x / 100), r = x % 100; const dr = r < 30 ? U[r] : D[Math.floor(r / 10)] + (r % 10 ? " y " + U[r % 10] : ""); return [C[c], dr].filter(Boolean).join(" "); };
  const mil = (x: number): string => { const m = Math.floor(x / 1000), r = x % 1000; return [m ? (m === 1 ? "mil" : cien(m) + " mil") : "", r ? cien(r) : ""].filter(Boolean).join(" "); };
  n = Math.round(Number(n) || 0); if (!n) return "Cero pesos COP"; if (n === 1) return "Un peso COP";
  const mill = Math.floor(n / 1e6), r = n % 1e6;
  let t = [mill ? (mill === 1 ? "un millón" : mil(mill) + " millones") : "", r ? mil(r) : ""].filter(Boolean).join(" ");
  t += (mill && !r ? " de pesos COP" : " pesos COP");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

async function contexto(encargoId: string) {
  const { data: e } = await admin.from("encargos").select("*, cliente:clientes(*)").eq("id", encargoId).single();
  if (!e) throw new Error("Encargo no encontrado.");
  const { data: p } = await admin.from("propuestas").select("*").eq("encargo_id", encargoId).maybeSingle();
  return { e, p: p || {}, c: e.cliente || {}, base: e.onedrive_carpeta || `REG/${String(e.nombre).toUpperCase()}` };
}
const corto = (n: string) => String(n || "").replace(/^\s*\d{2}\s+I\s+/, "").trim().toUpperCase();
const docCliente = (c: any, p: any) => [c.tipo_documento, c.documento].filter(Boolean).join(" ") || (p.documento_cliente && p.documento_cliente !== "XXX" ? p.documento_cliente : "");

// ---- Leer lo que dice el Word (para cuando se termina a mano) y armar el PDF desde el Word ----
const desXml = (t: string) => t.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const parrafos = (xml: string) => (xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || [])
  .map((p) => desXml((p.match(/<w:t(?:\s[^>]*)?>[^<]*<\/w:t>/g) || []).map((t) => t.replace(/<[^>]+>/g, "")).join("")).trim()).filter(Boolean);
function leerCuenta(xml: string) {
  const ps = parrafos(xml);
  const tras = (et: string) => { const i = ps.findIndex((p) => p.toLowerCase().startsWith(et)); return i >= 0 ? ps[i + 1] || "" : ""; };
  const v = tras("la suma de");
  const valor = Number(((v.match(/\d[\d.]*/) || [""])[0]).replace(/\./g, "")) || null;
  const concepto = tras("por concepto de");
  return { valor, concepto: concepto && !/^X+$/.test(concepto) ? concepto : null };
}
async function pdfDesdeWord(at: string, ruta: string, devolver = false) {
  const r = await G(at, `/me/drive/root:/${enc(ruta)}:/content`); if (!r.ok) throw new Error("No encontré el Word de la cuenta de cobro.");
  const z = unzipSync(new Uint8Array(await r.arrayBuffer()));
  const rels = z["word/_rels/fontTable.xml.rels"] ? strFromU8(z["word/_rels/fontTable.xml.rels"]) : "";
  let word: any;
  if (!/odttf/.test(rels) || !/embedTrueTypeFonts/.test(strFromU8(z["word/settings.xml"]))) { await incrustarFuentes(z); word = await subir(at, ruta, zipSync(z)); }
  else word = await (await G(at, `/me/drive/root:/${enc(ruta)}?$select=id,webUrl,lastModifiedDateTime`)).json();
  const datos = leerCuenta(strFromU8(z["word/document.xml"]));
  const rp = await G(at, `/me/drive/items/${word.id}/content?format=pdf`); if (!rp.ok) throw new Error("No se pudo convertir el Word a PDF.");
  const bytes = new Uint8Array(await rp.arrayBuffer());
  const pdf = await subir(at, ruta.replace(/\.docx$/i, ".pdf"), bytes);
  let b64 = ""; if (devolver) { let t = ""; for (let i = 0; i < bytes.length; i += 0x8000) t += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); b64 = btoa(t); }
  return { word, pdf, ...datos, ...(devolver ? { pdf_base64: b64 } : {}) };
}
async function guardarCuenta(encargoId: string, nombre: string, d: Record<string, unknown>) {
  const numero = (nombre.match(/_ (\d{1,3})$/) || [])[1] || null;
  await admin.from("cuentas_cobro").upsert({ encargo_id: encargoId, nombre, numero, ...d, actualizado: new Date().toISOString() }, { onConflict: "encargo_id,nombre" });
}
// Cada hora: cada Word de cuenta de cobro que cambió (y lleva 10 minutos sin tocarse) se vuelve PDF con la letra real
async function revisarCuentas() {
  const at = await accesoGraph();
  const { data: encs } = await admin.from("encargos").select("id,nombre,onedrive_carpeta").not("onedrive_carpeta", "is", null);
  const res: any[] = [];
  for (const e of encs || []) {
    const carpeta = `${e.onedrive_carpeta}/${CARPETA}`;
    const r = await G(at, `/me/drive/root:/${enc(carpeta)}:/children?$top=200&$select=name,file,lastModifiedDateTime,webUrl`); if (!r.ok) continue;
    const l = ((await r.json()).value || []).filter((x: any) => x.file);
    for (const w of l.filter((x: any) => /^CCREG_.*\.docx$/i.test(x.name) && !x.name.startsWith("~"))) {
      const base = w.name.replace(/\.docx$/i, ""), pdf = l.find((x: any) => x.name === base + ".pdf");
      const tW = new Date(w.lastModifiedDateTime).getTime(), tP = pdf ? new Date(pdf.lastModifiedDateTime).getTime() : 0;
      if (tW - tP < 120e3 || Date.now() - tW < 10 * 60e3) continue;   // sin cambios, o todavía lo están editando
      try { const x = await pdfDesdeWord(at, `${carpeta}/${w.name}`);
        await guardarCuenta(e.id, base, { valor: x.valor, ...(x.concepto ? { concepto: x.concepto } : {}), word_web: x.word.webUrl, pdf_web: x.pdf.webUrl });
        res.push({ encargo: e.nombre, cuenta: base, valor: x.valor }); }
      catch (err) { res.push({ encargo: e.nombre, cuenta: base, error: (err as Error).message }); }
    }
  }
  return { actualizadas: res };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const usuario = createClient(URL_SB, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const b = await req.json();
    const { data: k } = await admin.from("integraciones").select("refresh_token").eq("id", "cron").maybeSingle();
    const conClave = !!k?.refresh_token && b.clave === k.refresh_token;
    if (b.accion === "revisar") { if (!conClave) return json({ error: "Sin acceso." }, 403); return json(await revisarCuentas()); }
    const { data: esAdmin } = await usuario.rpc("es_admin");
    if (!esAdmin && !conClave) return json({ error: "Solo administración hace cuentas de cobro." }, 403);
    const { e, p, c, base } = await contexto(String(b.encargo_id || ""));
    const at = await accesoGraph();
    const carpeta = `${base}/${CARPETA}`;
    // Número siguiente: el mayor de las cuentas que ya hay en la carpeta (CCREG_… _ 01 o «CUENTA DE COBRO 01») más uno
    const ya = (await existentes(at, carpeta)).filter((n) => /CCREG_|CUENTA DE COBRO/i.test(n));
    const nums = ya.map((n) => Number((n.match(/(?:_ |COBRO\s*(?:No\.?\s*)?)(\d{1,3})(?=\.\w+$| _)/i) || [])[1] || 0));
    const numero = String(Math.max(0, ...nums) + 1).padStart(2, "0");
    if (b.accion === "datos") return json({ numero, pagado: !!e.pagado_total, existentes: ya, cliente: { nombre: c.nombre || "", documento: docCliente(c, p), email: c.email || "", telefono: c.telefono || "", direccion: [c.direccion, c.ciudad].filter(Boolean).join(", ") } });
    if (b.accion === "pdf") {
      const nombre = String(b.nombre || "").replace(/\.(docx|pdf)$/i, "");
      if (!/^CCREG_[^/\\]+$/.test(nombre)) return json({ error: "Cuenta de cobro no válida." }, 400);
      const x = await pdfDesdeWord(at, `${carpeta}/${nombre}.docx`, conClave && !!b.devolver);
      await guardarCuenta(e.id, nombre, { valor: x.valor, ...(x.concepto ? { concepto: x.concepto } : {}), word_web: x.word.webUrl, pdf_web: x.pdf.webUrl });
      return json({ ok: true, nombre, valor: x.valor, concepto: x.concepto, pdf: x.pdf.webUrl, word: x.word.webUrl, ...(x.pdf_base64 ? { pdf_base64: x.pdf_base64 } : {}) });
    }
    if (b.accion !== "crear") return json({ error: "Acción no válida." }, 400);
    const manual = !!b.manual;
    if (e.pagado_total) return json({ error: "Este encargo ya está pagado: no lleva más cuentas de cobro." }, 400);
    const valor = Math.round(Number(b.valor) || 0); if (valor <= 0 && !manual) return json({ error: "Escribe el valor a cobrar." }, 400);
    const concepto = String(b.concepto || "").trim(); if (!concepto && !manual) return json({ error: "Escribe el concepto." }, 400);
    const fecha = /^\d{4}-\d{2}-\d{2}$/.test(b.fecha || "") ? b.fecha : new Date().toISOString().slice(0, 10);
    // Datos del cliente: lo que se escribe en el formulario queda guardado en su ficha
    const cl = b.cliente || {};
    if (c.id) { const cambios: Record<string, string> = {}; if (cl.email && cl.email !== c.email) cambios.email = cl.email; if (cl.telefono && cl.telefono !== c.telefono) cambios.telefono = cl.telefono;
      if (cl.direccion && cl.direccion !== [c.direccion, c.ciudad].filter(Boolean).join(", ")) cambios.direccion = cl.direccion;
      if (cl.documento && cl.documento !== docCliente(c, p)) { cambios.documento = cl.documento; cambios.tipo_documento = ""; }
      if (Object.keys(cambios).length) await admin.from("clientes").update(cambios).eq("id", c.id); }
    const X = (v: any) => String(v ?? "").trim() || "XXX", NA = (v: any) => String(v ?? "").trim() || "N/A";
    const servicios = ((e.servicios?.length ? e.servicios : p.servicios) || []).map((s: string) => s.toUpperCase()).join("  I  ") || "XXX";
    const datos = [
      ["Nombre del cliente", X(c.nombre).toUpperCase()], ["Documento del cliente", X(cl.documento || docCliente(c, p)), 1], ["Correo del cliente", X(cl.email || c.email), 1],
      ["Teléfono del cliente", X(cl.telefono || c.telefono), 1], ["Dirección del cliente", X(cl.direccion || [c.direccion, c.ciudad].filter(Boolean).join(", ")), 1],
      ["Nombre del propietario", NA(p.propietario)], ["Ubicación del propietario", X(p.ubicacion_propietario)], ["Encargo", `${corto(e.nombre)}  I  ${e.codigo}`],
      ["Ubicación del encargo", X(p.ubicacion || e.ciudad)], ["Dirección del encargo", X(p.direccion || e.direccion)],
      ["Área predio", NA(p.area_predio)], ["Área construida en licencia", NA(p.area_licencia)], ["Área construida existente", NA(p.area_existente)], ["Área intervenida", NA(p.area_intervenida)],
      ["Categoría de trabajo", X(p.categoria_trabajo)], ["Categoría de servicios Regenerativo", servicios], ["Duración", X(p.duracion)]];
    const cod = String(e.codigo || "").replace(/^SCREG_/i, "");
    const nombre = `CCREG_${cod}_${corto(e.nombre)} _ ${numero}`;
    const r0 = await G(at, `/me/drive/root:/${enc(PLANTILLA)}:/content`); if (!r0.ok) throw new Error("No encontré la plantilla del membrete en OneDrive.");
    const z = unzipSync(new Uint8Array(await r0.arrayBuffer()));
    const textos: Record<string, string> = {}; for (const k of Object.keys(z)) if (/^word\/(document|header\d*|footer\d*)\.xml$/.test(k)) textos[k] = strFromU8(z[k]);
    const listo = armarCuenta(textos, { numero, datos, debeA: "ANDRÉS FERNANDO CORREA PARDO  I  REGENERATIVO", debeDatos: "RUT 1.014.283.923-9  I  Bogotá, Colombia  I  info@regenerativo.co  I  +57 320 215 0932",
      concepto: concepto || "XXX", valor: valor ? cop(valor) : "XXX COP", letras: valor ? enLetras(valor) : "XXX pesos COP", nota: "Valores sin IVA. Regenerativo no genera factura; el cobro se hace por cuenta de cobro.",
      anexos: "Anexos: RUT  I  Certificación bancaria  I  Documento de identidad", firma: "Andrés Fernando Correa Pardo", mp: "M.P. No. A1322021-1014283923",
      codigoDoc: `${nombre} _ ${fecha.replace(/-/g, " ")}`, servicios });
    for (const [k, v] of Object.entries(listo)) z[k] = strToU8(v);
    await incrustarFuentes(z);
    const word = await subir(at, `${carpeta}/${nombre}.docx`, zipSync(z));
    if (manual) {   // a mano: solo el Word; el PDF se arma solo cuando se termine (revisión de cada hora)
      await guardarCuenta(e.id, nombre, { concepto: concepto || null, valor: valor || null, fecha, manual: true, word_web: word.webUrl, pdf_web: null });
      return json({ ok: true, manual: true, nombre, numero, word: word.webUrl });
    }
    const rp = await G(at, `/me/drive/items/${word.id}/content?format=pdf`); if (!rp.ok) throw new Error("El Word quedó guardado, pero no se pudo convertir a PDF.");
    const pdf = await subir(at, `${carpeta}/${nombre}.pdf`, new Uint8Array(await rp.arrayBuffer()));
    await guardarCuenta(e.id, nombre, { concepto, valor, fecha, manual: false, word_web: word.webUrl, pdf_web: pdf.webUrl });
    return json({ ok: true, nombre, numero, word: word.webUrl, pdf: pdf.webUrl });
  } catch (err) { return json({ error: (err as Error).message }, 500); }
});
