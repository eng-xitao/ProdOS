// Edge Function: notify-lgpd-request
// Avisa o Encarregado (DPO) da plataforma por e-mail quando uma
// empresa cliente abre uma solicitacao LGPD (acesso, exclusao,
// portabilidade, correcao). A LGPD exige resposta agil, entao esse
// aviso automatico evita que o pedido passe despercebido.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TYPE_LABEL: Record<string, string> = {
  acesso: "Acesso aos dados",
  exclusao: "Exclusao dos dados",
  portabilidade: "Portabilidade dos dados",
  correcao: "Correcao de dados",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { requestId } = await req.json();
    if (!requestId) {
      return new Response(JSON.stringify({ error: "requestId obrigatorio" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: request } = await supabase
      .from("lgpd_requests")
      .select("id, request_type, details, companies:company_id (name, email)")
      .eq("id", requestId).single();
    if (!request) {
      return new Response(JSON.stringify({ error: "Solicitacao nao encontrada" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: settings } = await supabase.from("platform_settings").select("dpo_email, dpo_name").eq("id", true).single();

    let recipients: string[] = [];
    if (settings?.dpo_email) {
      recipients = [settings.dpo_email];
    } else {
      const { data: admins } = await supabase.from("profiles").select("email").eq("platform_role", "super_admin");
      recipients = (admins ?? []).map((a) => a.email).filter(Boolean);
    }

    for (const to of recipients) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "ProdOS <naoresponda@prodos.app.br>",
          to: [to],
          subject: `Solicitacao LGPD: ${TYPE_LABEL[request.request_type]} - ${request.companies?.name}`,
          html: `<p>A empresa <strong>${request.companies?.name}</strong> abriu uma solicitacao de <strong>${TYPE_LABEL[request.request_type]}</strong> de dados.</p>${request.details ? `<p>Detalhes: ${request.details}</p>` : ""}<p>A LGPD exige resposta agil. Acesse <a href="https://app.prodos.app.br/admin/lgpd">app.prodos.app.br/admin/lgpd</a> para tratar.</p>`,
        }),
      });
    }

    return new Response(JSON.stringify({ success: true, notified: recipients.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
