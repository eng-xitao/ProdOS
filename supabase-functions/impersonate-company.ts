// Edge Function: impersonate-company
// Gera um link de acesso temporario pra logar como o administrador
// de uma empresa cliente, sem precisar da senha dela - usado pelo
// botao "Entrar como" na tela Administracao -> Empresas. So funciona
// se quem chamar ja for is_platform_admin. Toda chamada fica
// registrada em admin_audit_log.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Nao autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: actorProfile } = await supabase.from("profiles").select("id, is_platform_admin").eq("id", userData.user.id).single();
    if (!actorProfile?.is_platform_admin) {
      return new Response(JSON.stringify({ error: "Acesso restrito ao admin da plataforma" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { companyId } = await req.json();
    if (!companyId) {
      return new Response(JSON.stringify({ error: "Empresa nao informada" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: targetProfile } = await supabase
      .from("profiles").select("id, email, full_name")
      .eq("company_id", companyId).eq("role", "admin")
      .order("created_at", { ascending: true }).limit(1).single();
    if (!targetProfile?.email) {
      return new Response(JSON.stringify({ error: "Nenhum administrador encontrado nessa empresa" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({ type: "magiclink", email: targetProfile.email });
    if (linkError || !linkData) {
      return new Response(JSON.stringify({ error: linkError?.message ?? "Erro ao gerar link" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    await supabase.from("admin_audit_log").insert({
      actor_profile_id: actorProfile.id, action: "impersonate_company", target_company_id: companyId,
      target_profile_id: targetProfile.id, details: { target_email: targetProfile.email, target_name: targetProfile.full_name },
    });
    return new Response(JSON.stringify({ actionLink: linkData.properties.action_link }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
