// Propuesta preliminar en Word: documento del cliente (solo con la clave interna 'cron').
//   'plantilla_documento' → agrega "Documento del cliente: XXX" a la plantilla SCREG_2XXXX_PROPUESTA.docx
//   'leer_clientes'       → lee de cada propuesta los renglones del cliente (nombre, documento, NIT, cédula)
//   'poner_documento'     → {ruta, valor}: agrega el renglón "Documento del cliente" a un Word
//   'ordenar_datos'       → ordena los datos del encargo (contacto primero) y resalta los importantes
//   'reemplazar_todo'     → cambia todos los renglones con un texto dado y el código del encabezado
//   'grises'              → todos los grises pasan al gris regenerativo (BFBFBF)
import { createClient } from "npm:@supabase/supabase-js@2";
import { unzipSync, zipSync, strFromU8, strToU8 } from "npm:fflate@0.8.2";

const TENANT = "d5bde326-cff3-4067-b8ed-8821209cee21";
const CLIENTE = "5fb20396-2b10-470b-b028-86f4b6e9d9ca";
const ALCANCE = "offline_access Files.ReadWrite Mail.Read User.Read";
const PROPUESTAS = "REG/REG  I  GESTION INTEGRAL/ZL_REG_PROPUESTAS";
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const json = (c: unknown, s = 200) => new Response(JSON.stringify(c), { status: s, headers: { "Content-Type": "application/json" } });
const enc = (p: string) => p.split("/").map(encodeURIComponent).join("/");

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
async function bajar(at: string, ruta: string) {
  const r = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${enc(ruta)}:/content`, { headers: { Authorization: `Bearer ${at}` } });
  return r.ok ? await r.arrayBuffer() : null;
}
async function subir(at: string, ruta: string, datos: Uint8Array) {
  const r = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${enc(ruta)}:/content?@microsoft.graph.conflictBehavior=replace`, {
    method: "PUT", headers: { Authorization: `Bearer ${at}`, "Content-Type": "application/octet-stream" }, body: datos,
  });
  if (!r.ok) throw new Error(`No se pudo guardar ${ruta}`);
}

const RE_T = /<w:t(?:\s[^>]*)?>[^<]*<\/w:t>/g;
const textoParrafo = (p: string) => (p.match(RE_T) || []).map(t => t.replace(/<[^>]+>/g, "")).join("").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
function abrir(buf: ArrayBuffer) {
  const z = unzipSync(new Uint8Array(buf)); const xml = strFromU8(z["word/document.xml"]);
  return { z, xml, parrafos: xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || [] };
}
// Copia el renglón "Nombre del cliente: …" debajo, como "Documento del cliente: valor" (mismo formato)
function conDocumento(buf: ArrayBuffer, valor: string) {
  const { z, xml, parrafos } = abrir(buf);
  if (parrafos.some(p => /^Documento del cliente\s*:/i.test(textoParrafo(p)))) return null;
  const base = parrafos.find(p => /^Nombre del cliente\s*:/i.test(textoParrafo(p)));
  if (!base) return null;
  const total = (base.match(RE_T) || []).length; let n = 0; let etiqueta = false;
  const nuevo = base.replace(/<w:t(\s[^>]*)?>([^<]*)<\/w:t>/g, (_m, at, t) => {
    n++;
    if (!etiqueta && /cliente/i.test(t)) {
      etiqueta = true;
      const lab = t.replace(/Nombre del cliente/i, "Documento del cliente").replace(/^Nombre del /i, "Documento del ");
      const solo = lab.includes(":") ? lab.slice(0, lab.indexOf(":") + 1) : lab;
      return `<w:t xml:space="preserve">${solo}${n === total ? " " + valor.replace(/&/g, "&amp;").replace(/</g, "&lt;") : ""}</w:t>`;
    }
    if (!etiqueta && /^\s*Nombre/i.test(t)) return `<w:t${at || ""}>${t.replace(/Nombre/i, "Documento")}</w:t>`;
    if (n === total) return `<w:t xml:space="preserve"> ${valor.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</w:t>`;
    return /:/.test(t) ? `<w:t${at || ""}>${t.replace(/:.*/, ":")}</w:t>` : (etiqueta ? `<w:t${at || ""}></w:t>` : `<w:t${at || ""}>${t}</w:t>`);
  }).replace(/ w14:paraId="[^"]*"/g, "").replace(/ w14:textId="[^"]*"/g, "");
  if (!/Documento del cliente/i.test(textoParrafo(nuevo))) return null;
  z["word/document.xml"] = strToU8(xml.replace(base, base + nuevo));
  return zipSync(z);
}

// Ordena el bloque de renglones "Etiqueta: valor" y pone en negrita el valor de los importantes.
function ordenarDatos(xml: string, o: any): string | null {
  const RT = /<w:t(?:\s[^>]*)?>[^<]*<\/w:t>/g;
  const txt = (p: string) => (p.match(RT) || []).map(t => t.replace(/<[^>]+>/g, "")).join("").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const lab = (p: string) => { const m = txt(p).match(/^([^:]{3,60}):/); return m ? m[1].trim().toLowerCase() : null; };
  const orden: string[] = o.orden.map((x: string) => x.toLowerCase()), negrita: string[] = (o.negrita || []).map((x: string) => x.toLowerCase());
  const ps: string[] = xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || [];
  const blq = ps.filter(p => orden.includes(lab(p) || ""));
  if (!blq.length) return null;
  const base = blq.find(p => lab(p) === String(o.despues || "").toLowerCase()) || blq[0];
  const conTexto = (p: string, t: string) => { let i = 0; return p.replace(/<w:t(\s[^>]*)?>[^<]*<\/w:t>/g, () => i++ ? "<w:t></w:t>" : `<w:t xml:space="preserve">${esc(t)}</w:t>`).replace(/ w14:(paraId|textId)="[^"]*"/g, ""); };
  const nuevos = ((o.nuevas || []) as string[]).filter(l => !blq.some(p => lab(p) === l.split(":")[0].trim().toLowerCase())).map(l => conTexto(base, l));
  const ini = xml.indexOf(blq[0]), finP = blq[blq.length - 1], fin = xml.indexOf(finP) + finP.length;
  let resto = xml.slice(ini, fin); for (const p of blq) resto = resto.replace(p, "");
  if (/<w:t[ >]/.test(resto)) return null;               // hay texto intercalado: no se toca
  const todos = [...blq, ...nuevos];
  const ord = orden.map(l => todos.find(p => lab(p) === l)).filter(Boolean) as string[];
  const neg = (p: string) => {
    const l = lab(p) || ""; if (!negrita.includes(l)) return p;
    const t = txt(p), k = t.indexOf(":"), r = (p.match(/<w:r[ >][\s\S]*?<\/w:r>/) || [])[0]; if (!r) return p;
    const rpr = (r.match(/<w:rPr>[\s\S]*?<\/w:rPr>/) || ["<w:rPr></w:rPr>"])[0];
    const rprN = rpr.replace(/(w:ascii|w:hAnsi)="[^"]*"/g, `$1="${o.fuenteNegrita || "METRONICPRO-SEMIBOLD"}"`);
    const corridas = `<w:r>${rpr}<w:t xml:space="preserve">${esc(t.slice(0, k + 1))} </w:t></w:r><w:r>${rprN}<w:t xml:space="preserve">${esc(t.slice(k + 1).trim())}</w:t></w:r>`;
    const sinR = p.replace(/<w:r[ >][\s\S]*?<\/w:r>/g, "");
    return sinR.replace(/<\/w:p>$/, corridas + "</w:p>");
  };
  return xml.slice(0, ini) + ord.map(neg).join("") + resto + xml.slice(fin);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);
  const b = await req.json().catch(() => ({}));
  const { data: k } = await admin.from("integraciones").select("refresh_token").eq("id", "cron").maybeSingle();
  if (!k?.refresh_token || b.clave !== k.refresh_token) return json({ error: "Sin acceso." }, 403);
  try {
    const at = await accesoGraph();
    if (b.accion === "plantilla_documento" || b.accion === "poner_documento") {
      const ruta = b.accion === "plantilla_documento" ? `${PROPUESTAS}/SCREG_2XXXX_PROPUESTA.docx` : String(b.ruta || "");
      const buf = await bajar(at, ruta); if (!buf) return json({ error: "No encontré el Word: " + ruta }, 404);
      const nuevo = conDocumento(buf, b.valor || "XXX");
      if (nuevo) await subir(at, ruta, nuevo);
      const prueba = nuevo ? abrir(nuevo.buffer as ArrayBuffer).parrafos.map(textoParrafo).filter(t => /cliente\s*:/i.test(t)) : [];
      return json({ ok: true, cambiado: !!nuevo, renglones: prueba });
    }
    if (b.accion === "reemplazar_renglones") {
      // {ruta?, cambios:[{de, a}]}: cambia el texto de los renglones cuyo texto completo es 'de' (conserva el formato)
      const ruta = String(b.ruta || `${PROPUESTAS}/SCREG_2XXXX_PROPUESTA.docx`);
      const buf = await bajar(at, ruta); if (!buf) return json({ error: "No encontré el Word: " + ruta }, 404);
      const { z, xml, parrafos } = abrir(buf); let nuevo = xml; const hechos: string[] = [];
      for (const c of (b.cambios || []) as { de: string; a: string }[]) {
        const p = parrafos.find(q => textoParrafo(q) === c.de); if (!p) continue;
        let primero = true;
        const r = p.replace(/<w:t(\s[^>]*)?>([^<]*)<\/w:t>/g, () => { const v = primero ? `<w:t xml:space="preserve">${c.a.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</w:t>` : "<w:t></w:t>"; primero = false; return v; });
        nuevo = nuevo.replace(p, r); hechos.push(c.de + " → " + c.a);
      }
      if (hechos.length) { z["word/document.xml"] = strToU8(nuevo); await subir(at, ruta, zipSync(z)); }
      return json({ ok: true, hechos });
    }
    if (b.accion === "insertar_despues") {
      // {ruta?, despues: "Documento del cliente", lineas: ["Correo del cliente: XXX", ...]}: renglones nuevos con el mismo formato
      const ruta = String(b.ruta || `${PROPUESTAS}/SCREG_2XXXX_PROPUESTA.docx`);
      const buf = await bajar(at, ruta); if (!buf) return json({ error: "No encontré el Word: " + ruta }, 404);
      const { z, xml, parrafos } = abrir(buf);
      const lineas = (b.lineas || []) as string[];
      const faltan = lineas.filter(l => !parrafos.some(p => textoParrafo(p).startsWith(l.split(":")[0] + ":")));
      if (!faltan.length) return json({ ok: true, hechos: [] });
      const base = parrafos.find(p => textoParrafo(p).startsWith(String(b.despues || ""))); if (!base) return json({ error: "No encontré el renglón base." }, 404);
      const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
      const nuevos = faltan.map(l => { let primero = true; return base.replace(/<w:t(\s[^>]*)?>([^<]*)<\/w:t>/g, () => { const v = primero ? `<w:t xml:space="preserve">${esc(l)}</w:t>` : "<w:t></w:t>"; primero = false; return v; }).replace(/ w14:paraId="[^"]*"/g, "").replace(/ w14:textId="[^"]*"/g, ""); }).join("");
      z["word/document.xml"] = strToU8(xml.replace(base, base + nuevos)); await subir(at, ruta, zipSync(z));
      return json({ ok: true, hechos: faltan });
    }
    if (b.accion === "ordenar_datos") {
      // {ruta?, orden:[etiquetas], negrita:[etiquetas], nuevas:["Etiqueta: XXX"], despues}: ordena el bloque de datos del encargo
      const ruta = String(b.ruta || `${PROPUESTAS}/SCREG_2XXXX_PROPUESTA.docx`);
      const buf = await bajar(at, ruta); if (!buf) return json({ error: "No encontré el Word: " + ruta }, 404);
      const { z, xml } = abrir(buf);
      const nuevo = ordenarDatos(xml, b); if (!nuevo) return json({ error: "No se pudo ordenar el bloque de datos." }, 422);
      z["word/document.xml"] = strToU8(nuevo); await subir(at, ruta, zipSync(z));
      return json({ ok: true, renglones: abrir(zipSync(z).buffer as ArrayBuffer).parrafos.map(textoParrafo).filter(t => /^[^:]{3,60}:/.test(t)).slice(0, 20) });
    }
    if (b.accion === "reemplazar_todo") {
      // {ruta?, cambios:[{de, a}], encabezado:[{de, a}]}: cambia todos los renglones con ese texto y el código del encabezado
      const ruta = String(b.ruta || `${PROPUESTAS}/SCREG_2XXXX_PROPUESTA.docx`);
      const buf = await bajar(at, ruta); if (!buf) return json({ error: "No encontré el Word: " + ruta }, 404);
      const { z, xml, parrafos } = abrir(buf); let nuevo = xml; const conteo: Record<string, number> = {};
      const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
      for (const c of (b.cambios || []) as { de: string; a: string }[]) {
        let n = 0;
        for (const p of parrafos) {
          if (textoParrafo(p) !== c.de || !nuevo.includes(p)) continue;
          let primero = true;
          const r = p.replace(/<w:t(\s[^>]*)?>([^<]*)<\/w:t>/g, () => { const v = primero ? `<w:t xml:space="preserve">${esc(c.a)}</w:t>` : "<w:t></w:t>"; primero = false; return v; });
          nuevo = nuevo.replace(p, r); n++;
        }
        conteo[c.de] = n;
      }
      z["word/document.xml"] = strToU8(nuevo);
      for (const k of Object.keys(z)) if (/^word\/header\d*\.xml$/.test(k)) {
        let h = strFromU8(z[k]);
        for (const c of (b.encabezado || []) as { de: string; a: string }[]) { const n0 = h.split(esc(c.de)).length - 1; h = h.split(esc(c.de)).join(esc(c.a)); conteo["encabezado: " + c.de] = (conteo["encabezado: " + c.de] || 0) + n0; }
        z[k] = strToU8(h);
      }
      await subir(at, ruta, zipSync(z));
      return json({ ok: true, conteo });
    }
    if (b.accion === "grises") {
      // {ruta?}: todos los grises del documento, encabezados y pies pasan al gris regenerativo (el de «Servicios», BFBFBF)
      const ruta = String(b.ruta || `${PROPUESTAS}/SCREG_2XXXX_PROPUESTA.docx`);
      const buf = await bajar(at, ruta); if (!buf) return json({ error: "No encontré el Word: " + ruta }, 404);
      const z = unzipSync(new Uint8Array(buf)); const conteo: Record<string, number> = {};
      for (const k of Object.keys(z)) if (/^word\/(document|header\d*|footer\d*)\.xml$/.test(k)) {
        const x = strFromU8(z[k]); let n = 0;
        const y = x.replace(/<w:color w:val="(6E6E6E|7F7F7F|808080|A6A6A6|999999|595959|8A8A8A|767171|AEAAAA|D9D9D9|BFBFBF)"[^>]*\/>/g, (m) => { if (m === '<w:color w:val="BFBFBF"/>') return m; n++; return '<w:color w:val="BFBFBF"/>'; });
        if (n) { z[k] = strToU8(y); conteo[k] = n; }
      }
      if (Object.keys(conteo).length) await subir(at, ruta, zipSync(z));
      return json({ ok: true, conteo });
    }
    if (b.accion === "leer_clientes") {
      const { data: ps } = await admin.from("propuestas").select("codigo,nombre,archivo_ruta").not("archivo_ruta", "is", null);
      const out: unknown[] = [];
      for (const p of ps || []) {
        try {
          const buf = await bajar(at, p.archivo_ruta); if (!buf) { out.push({ codigo: p.codigo, error: "sin archivo" }); continue; }
          const lineas = abrir(buf).parrafos.map(textoParrafo).filter(t => t.length < 220 && /cliente\s*:|propietario\s*:|\bNIT\b|\bC\.?\s?C\.?\s?[\d.]{5,}|c[ée]dula|identificad/i.test(t));
          out.push({ codigo: p.codigo, lineas });
        } catch (e) { out.push({ codigo: p.codigo, error: (e as Error).message }); }
      }
      return json({ ok: true, propuestas: out });
    }
    return json({ error: "Acción no válida." }, 400);
  } catch (e) { return json({ error: (e as Error).message }, 500); }
});
