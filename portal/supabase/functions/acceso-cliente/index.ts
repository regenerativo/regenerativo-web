// Asigna o cambia la contraseña de acceso del cliente de un encargo (solo administración).
// Cada encargo tiene una cuenta de cliente propia; cambiar la contraseña la recrea
// y cierra todas las sesiones abiertas con la contraseña anterior.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const responder = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const usuario = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: esAdmin } = await usuario.rpc("es_admin");
    if (!esAdmin) return responder({ error: "Solo administración puede asignar accesos." }, 403);

    const { encargo_id, clave, quitar } = await req.json();
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: enc, error: e0 } = await admin.from("encargos").select("id,codigo,cliente_usuario_id").eq("id", encargo_id).single();
    if (e0 || !enc) return responder({ error: "Encargo no encontrado." }, 404);

    // Borrar la cuenta anterior cierra todas sus sesiones.
    if (enc.cliente_usuario_id) await admin.auth.admin.deleteUser(enc.cliente_usuario_id);
    if (quitar) {
      await admin.from("encargos").update({ cliente_usuario_id: null, acceso_clave: null }).eq("id", enc.id);
      return responder({ ok: true, quitado: true });
    }
    if (typeof clave !== "string" || clave.length < 8) return responder({ error: "La contraseña debe tener al menos 8 caracteres." }, 400);

    const email = `${enc.codigo.toLowerCase()}@clientes.portal.regenerativo.co`;
    const { data: creado, error: e1 } = await admin.auth.admin.createUser({
      email, password: clave, email_confirm: true, user_metadata: { tipo: "cliente_encargo", encargo: enc.codigo },
    });
    if (e1) throw e1;
    await admin.from("miembros_encargo").upsert({ encargo_id: enc.id, usuario_id: creado.user.id, rol: "cliente" });
    await admin.from("encargos").update({ cliente_usuario_id: creado.user.id, acceso_clave: clave }).eq("id", enc.id);
    return responder({ ok: true });
  } catch (err) {
    return responder({ error: (err as Error).message ?? String(err) }, 500);
  }
});
