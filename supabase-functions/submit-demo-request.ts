// Edge Function: submit-demo-request
// Recebe o formulario publico de "Solicitar demonstracao" (sem login)
// e cria automaticamente uma oportunidade no Kanban do super_admin,
// na primeira etapa do funil dele, com o pedido registrado como
// interacao. Tambem avisa por e-mail.

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { name, companyName, email, phone, message } = await req.json();
    if (!name || !email) {
      return new Response(JSON.stringify({ error: "Nome e e-mail sao obrigatorios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: superAdmin } = await supabase.from("profiles").select("company_id, email").eq("platform_role", "super_admin").limit(1).single();
    if (!superAdmin?.company_id) {
      return new Response(JSON.stringify({ error: "Nao foi possivel processar a solicitacao agora" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: firstStage } = await supabase
      .from("opportunity_stages")
      .select("id")
      .eq("company_id", superAdmin.company_id)
      .order("sort_order", { ascending: true })
      .limit(1).single();

    const { data: opportunity } = await supabase.from("opportunities").insert({
      company_id: superAdmin.company_id,
      title: `Demo: ${companyName || name}`,
      stage_id: firstStage?.id ?? null,
      estimated_value: 0,
    }).select("id").single();

    if (opportunity) {
      const noteParts = [`Solicitou demonstracao pelo site.`, `Contato: ${email}${phone ? " / " + phone : ""}`];
      if (message) noteParts.push(`Mensagem: ${message}`);
      await supabase.from("opportunity_interactions").insert({
        company_id: superAdmin.company_id,
        opportunity_id: opportunity.id,
        type: "nota",
        note: noteParts.join("\n"),
      });
    }

    if (superAdmin.email) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "ProdOS <naoresponda@prodos.app.br>",
          to: [superAdmin.email],
          subject: `Novo pedido de demonstracao: ${companyName || name}`,
          html: `<p><strong>${name}</strong>${companyName ? ` (${companyName})` : ""} pediu uma demonstracao do ProdOS.</p><p>E-mail: ${email}${phone ? `<br>Telefone: ${phone}` : ""}</p>${message ? `<p>Mensagem: ${message}</p>` : ""}<p>Ja registramos como oportunidade no seu Kanban.</p>`,
        }),
      });
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
