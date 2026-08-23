import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ASAAS_WEBHOOK_TOKEN = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

async function sendOverdueEmail(companyId: string) {
  const { data: company } = await supabase.from("companies").select("name, email").eq("id", companyId).single();
  if (!company?.email) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "ProdOS <naoresponda@prodos.app.br>",
      to: [company.email],
      subject: "Pagamento em atraso - ProdOS",
      html: `<p>Ola, ${company.name}!</p><p>Identificamos que o pagamento da sua assinatura do ProdOS venceu e ainda nao foi confirmado.</p><p>Regularize em <a href="https://app.prodos.app.br/assinatura">app.prodos.app.br/assinatura</a> para evitar a suspensao do acesso.</p>`,
    }),
  });
}

serve(async (req) => {
  try {
    const receivedToken = req.headers.get("asaas-access-token");
    if (ASAAS_WEBHOOK_TOKEN && receivedToken !== ASAAS_WEBHOOK_TOKEN) {
      return new Response("Unauthorized", { status: 401 });
    }

    const payload = await req.json();
    const eventType = payload.event;
    const payment = payload.payment;

    if (!payment) {
      return new Response("ok", { status: 200 });
    }

    const companyId = payment.externalReference;

    let newStatus = null;
    if (["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"].includes(eventType)) {
      newStatus = "active";
    } else if (eventType === "PAYMENT_OVERDUE") {
      newStatus = "overdue";
    } else if (eventType === "PAYMENT_DELETED") {
      newStatus = "canceled";
    }

    if (companyId) {
      await supabase.from("billing_events").insert({
        company_id: companyId,
        event_type: eventType,
        payment_id: payment.id,
        raw_payload: payload,
      });

      if (newStatus) {
        await supabase.from("companies").update({ subscription_status: newStatus }).eq("id", companyId);
      }

      if (eventType === "PAYMENT_OVERDUE") {
        await sendOverdueEmail(companyId);
      }
    }

    return new Response("ok", { status: 200 });
  } catch (e) {
    return new Response(String(e), { status: 500 });
  }
});
