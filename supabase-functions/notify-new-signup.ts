// Edge Function: notify-new-signup
// Avisa todos os admins da plataforma por e-mail quando uma empresa
// nova se cadastra e fica pendente de aprovacao.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

serve(async (req) => {
  try {
    const { companyId } = await req.json();
    if (!companyId) return new Response(JSON.stringify({ error: "companyId obrigatorio" }), { status: 400, headers: { "Content-Type": "application/json" } });

    const { data: company } = await supabase.from("companies").select("name, email, segment, plans:plan_id (name)").eq("id", companyId).single();
    if (!company) return new Response(JSON.stringify({ error: "Empresa nao encontrada" }), { status: 404, headers: { "Content-Type": "application/json" } });

    const { data: admins } = await supabase.from("profiles").select("email").not("platform_role", "is", null);

    for (const admin of admins ?? []) {
      if (!admin.email) continue;
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "ProdOS <naoresponda@prodos.app.br>",
          to: [admin.email],
          subject: `Novo cadastro aguardando aprovacao: ${company.name}`,
          html: `<p>A empresa <strong>${company.name}</strong> (${company.email ?? "sem e-mail"}) acabou de se cadastrar no ProdOS, plano <strong>${company.plans?.name ?? "Basico"}</strong>, e esta aguardando aprovacao.</p><p>Acesse <a href="https://app.prodos.app.br/admin/aprovacoes">app.prodos.app.br/admin/aprovacoes</a> para revisar.</p>`,
        }),
      });
    }

    return new Response(JSON.stringify({ notified: (admins ?? []).length }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
