// Edge Function: send-trial-reminders
// Roda todo dia via pg_cron (job "send-trial-reminders-daily") e manda
// um e-mail pras empresas cujo periodo de teste acaba em ate 3 dias.
// So manda uma vez por empresa (controla pela coluna trial_reminder_sent_at).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

serve(async () => {
  try {
    const in3Days = new Date();
    in3Days.setDate(in3Days.getDate() + 3);
    const { data: companies } = await supabase
      .from("companies").select("id, name, email, trial_ends_at")
      .eq("subscription_status", "trial").is("trial_reminder_sent_at", null)
      .lte("trial_ends_at", in3Days.toISOString()).gte("trial_ends_at", new Date().toISOString());

    let sent = 0;
    for (const company of companies ?? []) {
      if (!company.email) continue;
      const daysLeft = Math.max(0, Math.ceil((new Date(company.trial_ends_at).getTime() - Date.now()) / 86400000));
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "ProdOS <naoresponda@prodos.app.br>",
          to: [company.email],
          subject: `Seu teste gratuito do ProdOS acaba em ${daysLeft} dia${daysLeft !== 1 ? "s" : ""}`,
          html: `<p>Ola, ${company.name}!</p><p>Seu periodo de teste gratuito do ProdOS acaba em <strong>${daysLeft} dia${daysLeft !== 1 ? "s" : ""}</strong>.</p><p>Pra continuar usando sem interrupcao, escolha um plano em <a href="https://app.prodos.app.br/assinatura">app.prodos.app.br/assinatura</a>.</p><p>Qualquer duvida, e so responder este e-mail.</p>`,
        }),
      });
      await supabase.from("companies").update({ trial_reminder_sent_at: new Date().toISOString() }).eq("id", company.id);
      sent += 1;
    }
    return new Response(JSON.stringify({ sent }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
