// Edge Function: notify-approval-decision
// Avisa a empresa automaticamente por e-mail assim que ela e
// aprovada ou rejeitada em Administracao -> Aprovacoes.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

serve(async (req) => {
  try {
    const { companyId, status } = await req.json();
    if (!companyId || !status) return new Response(JSON.stringify({ error: "Dados invalidos" }), { status: 400, headers: { "Content-Type": "application/json" } });
    if (status !== "approved" && status !== "rejected") return new Response(JSON.stringify({ skipped: true }), { headers: { "Content-Type": "application/json" } });

    const { data: company } = await supabase.from("companies").select("name, email").eq("id", companyId).single();
    if (!company?.email) return new Response(JSON.stringify({ skipped: true, reason: "sem e-mail" }), { headers: { "Content-Type": "application/json" } });

    const isApproved = status === "approved";
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "ProdOS <naoresponda@prodos.app.br>",
        to: [company.email],
        subject: isApproved ? "Seu acesso ao ProdOS foi liberado!" : "Sobre o seu cadastro no ProdOS",
        html: isApproved
          ? `<p>Ola, ${company.name}!</p><p>Seu cadastro foi aprovado e o acesso completo ao ProdOS ja esta liberado.</p><p>Entre em <a href="https://app.prodos.app.br">app.prodos.app.br</a> para comecar.</p>`
          : `<p>Ola, ${company.name}.</p><p>Analisamos seu cadastro no ProdOS e, no momento, nao conseguimos aprovar o acesso.</p><p>Se voce acredita que isso e um engano, responda este e-mail que nossa equipe revisa novamente.</p>`,
      }),
    });

    return new Response(JSON.stringify({ sent: true }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
