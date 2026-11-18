// Revisión automática del correo (cada hora, pg_cron): lee las alertas de Bancolombia que llegan a
// facturacion@ / apardo@ y las deja en Finanzas → Por confirmar (origen «correo»). No repite: la referencia
// es el identificador del correo (ref_correo único). Solo se usa con la clave interna (integraciones 'cron').
import { createClient } from "npm:@supabase/supabase-js@2";

const TENANT = "d5bde326-cff3-4067-b8ed-8821209cee21";
const CLIENTE = "5fb20396-2b10-470b-b028-86f4b6e9d9ca";
const PROPIOS = /CORREA\s+PARDO|3202150932/i;   // cuentas y llaves de Andrés: movimiento del socio, no gasto
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const json = (c: unknown, s = 200) => new Response(JSON.stringify(c), { status: s, headers: { "Content-Type": "application/json" } });

async function token() {
  const { data: ig } = await admin.from("integraciones").select("refresh_token").eq("id", "onedrive").maybeSingle();
  if (!ig?.refresh_token) throw new Error("Microsoft no está conectado.");
  const r = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENTE, client_secret: Deno.env.get("MS_CLIENT_SECRET") ?? "", scope: "offline_access Mail.Read", grant_type: "refresh_token", refresh_token: ig.refresh_token }),
  });
  const t = await r.json(); if (!r.ok) throw new Error(t.error_description || "Sin permiso de correo.");
  return t.access_token as string;
}

// $1,500,000.00 · $28.919,00 · $30.000 → número
function valor(s: string) {
  let v = s.replace(/[^\d.,]/g, "");
  if (/[.,]\d{2}$/.test(v)) v = v.slice(0, -3);
  return Number(v.replace(/[.,]/g, "")) || 0;
}
function fecha(t: string, recibido: string) {
  const m = t.match(/(\d{2})\/(\d{2})\/(\d{2,4})/);
  if (!m) return new Date(new Date(recibido).getTime() - 5 * 3600e3).toISOString().slice(0, 10);
  const y = m[3].length === 2 ? "20" + m[3] : m[3];
  return `${y}-${m[2]}-${m[1]}`;
}
const limpio = (s: string) => s.replace(/\s+/g, " ").trim();

function leer(texto: string, recibido: string) {
  const t = limpio(texto);
  const i = t.indexOf("Bancolombia:"); if (i < 0) return null;
  const f = t.slice(i + 12, i + 400);
  if (/c[oó]digo/i.test(f) && !/\$/.test(f)) return null;
  const monto = f.match(/\$\s?[\d.,]+/); if (!monto) return null;
  const v = valor(monto[0]); if (!v) return null;
  const h = f.match(/a las (\d{1,2}:\d{2})/i);
  const hora = h ? h[1] : new Date(new Date(recibido).getTime() - 5 * 3600e3).toISOString().slice(11, 16);
  const base = { fecha: fecha(f, recibido), hora, valor: v, correo_texto: f.split(/\. (Si tienes|Con Bre-b|¿Dudas|Dudas)/)[0] + "." };
  let m;
  if ((m = f.match(/Compraste \$[\d.,]+ en (.+?) con tu (.+?), el/i)))
    return { ...base, tipo: "gasto", descripcion: limpio(m[1]), medio: limpio(m[2]), nota_correo: null };
  if ((m = f.match(/Pagaste \$[\d.,]+ (?:a|en) (.+?)(?: desde| con|, el| el)/i)))
    return { ...base, tipo: "gasto", descripcion: "Pago a " + limpio(m[1]), medio: (f.match(/(cuenta \*\d+|T\.\w+ \*\d+)/i) || [""])[0] || null, nota_correo: null };
  if ((m = f.match(/recibiste un pago de (.+?) por \$[\d.,]+ en tu (cuenta \*\d+)/i))) {
    const propio = PROPIOS.test(m[1]);
    return { ...base, tipo: propio ? "socio" : "ingreso", descripcion: "Pago recibido de " + limpio(m[1]), medio: m[2],
      nota_correo: propio ? "Viene de ti: ¿aporte del socio o pago de un cliente?" : "¿De qué proyecto es este pago?" };
  }
  if ((m = f.match(/transferiste \$[\d.,]+ (?:a la llave (\S+) )?desde tu (cuenta \*\d+) a (?:la cuenta )?(.+?) el \d/i))) {
    const destino = limpio(m[3]); const propio = PROPIOS.test(destino) || PROPIOS.test(m[1] || "");
    return { ...base, tipo: propio ? "socio" : "gasto", descripcion: "Transferencia a " + destino, medio: m[2],
      nota_correo: propio ? "Va a tu cuenta personal: retiro del socio" : "¿A qué corresponde esta transferencia?" };
  }
  if ((m = f.match(/recibiste \$[\d.,]+/i)) || /te (transfirieron|consignaron)/i.test(f))
    return { ...base, tipo: "ingreso", descripcion: "Ingreso recibido", medio: null, nota_correo: "¿De qué proyecto es este pago?" };
  return { ...base, tipo: "gasto", descripcion: "Movimiento Bancolombia", medio: null, nota_correo: "Revisa este movimiento" };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);
  let b: any = {}; try { b = await req.json(); } catch (_) { /* vacío */ }
  const { data: cl } = await admin.from("integraciones").select("refresh_token").eq("id", "cron").maybeSingle();
  if (!cl?.refresh_token || b.clave !== cl.refresh_token) return json({ error: "Sin acceso." }, 403);
  try {
    const at = await token();
    const desde = b.desde || new Date(Date.now() - 3 * 864e5).toISOString();
    const filtro = `receivedDateTime ge ${desde}`;
    let url = `https://graph.microsoft.com/v1.0/me/messages?$select=id,internetMessageId,receivedDateTime,from,body&$filter=${encodeURIComponent(filtro)}&$top=50`;
    let nuevos = 0, leidos = 0, ignorados = 0;
    // Lo que Andrés ya cargó manda: no se traen avisos de días que él ya organizó (último movimiento cargado por él)
    const { data: ult } = await admin.from("fin_movimientos").select("fecha").neq("origen", "correo").eq("estado", "confirmado").order("fecha", { ascending: false }).limit(1);
    const organizadoHasta = ult?.[0]?.fecha || "2000-01-01";
    while (url) {
      const r = await fetch(url, { headers: { Authorization: `Bearer ${at}`, Prefer: 'outlook.body-content-type="text"' } });
      const d = await r.json(); if (!r.ok) throw new Error(d?.error?.message || `Graph ${r.status}`);
      for (const m of d.value || []) {
        const de = (m.from?.emailAddress?.address || "").toLowerCase();
        if (!/notificacionesbancolombia\.com$/.test(de)) continue;
        leidos++;
        const mov = leer(m.body?.content || "", m.receivedDateTime);
        if (!mov) { ignorados++; continue; }
        const ref = String(m.internetMessageId || m.id).replace(/[<>]/g, "").split("@")[0];
        if (mov.fecha <= organizadoHasta) { ignorados++; continue; }
        const { data: ya } = await admin.from("fin_movimientos").select("id").like("ref_correo", `${ref}%`).limit(1);
        if (ya?.length) continue;
        // ya cargado por él (mismo valor, ±3 días)
        const d0 = new Date(mov.fecha); const f = (n: number) => new Date(d0.getTime() + n * 864e5).toISOString().slice(0, 10);
        const { data: igual } = await admin.from("fin_movimientos").select("id").neq("origen", "correo").eq("valor", mov.valor).gte("fecha", f(-3)).lte("fecha", f(3)).limit(1);
        if (igual?.length) { ignorados++; continue; }
        const { error } = await admin.from("fin_movimientos").insert({ ...mov, estado: "por_confirmar", origen: "correo", ref_correo: ref });
        if (!error) nuevos++;
      }
      url = d["@odata.nextLink"] || "";
    }
    return json({ ok: true, leidos, nuevos, ignorados });
  } catch (e) { return json({ error: (e as Error).message }, 500); }
});
