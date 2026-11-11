// Invita a una persona a un encargo (solo administración).
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
    if (!esAdmin) return responder({ error: "Solo administración puede invitar." }, 403);
    const { data: { user: quien } } = await usuario.auth.getUser();

    const { email, encargo_id, rol, redirect } = await req.json();
    const correo = String(email || "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) return responder({ error: "Correo no válido." }, 400);
    if (!["equipo", "cliente"].includes(rol)) return responder({ error: "Rol no válido." }, 400);

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error: e1 } = await admin.from("invitaciones")
      .insert({ email: correo, encargo_id, rol, invitado_por: quien?.id });
    if (e1) throw e1;

    const { error: e2 } = await admin.auth.admin.inviteUserByEmail(correo, { redirectTo: redirect });
    if (e2) {
      // Ya tiene cuenta: se agrega directamente al encargo.
      const { data: perfil } = await admin.from("perfiles").select("id").ilike("email", correo).maybeSingle();
      if (!perfil) throw e2;
      await admin.from("miembros_encargo").upsert({ encargo_id, usuario_id: perfil.id, rol });
      await admin.from("invitaciones").update({ estado: "aceptada" }).ilike("email", correo).eq("estado", "pendiente");
      return responder({ ok: true, existente: true });
    }
    return responder({ ok: true });
  } catch (err) {
    return responder({ error: (err as Error).message ?? String(err) }, 500);
  }
});
