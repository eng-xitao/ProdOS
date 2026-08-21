// Edge Function: asaas-webhook
// Recebe as notificações de pagamento do Asaas e atualiza o status
// de assinatura da empresa correspondente (ativa, atrasada, cancelada).
//
// Como implantar: Supabase → Edge Functions → Create a new function
// → nome exato "asaas-webhook" → cole este código → Deploy.
// Depois, no painel do Asaas → Integrações → Webhooks, cadastre a URL
// pública dessa função (algo tipo https://SEU-PROJETO.supabase.co/functions/v1/asaas-webhook)
// e copie o "Token de autenticação" gerado — configure ele aqui como
// segredo ASAAS_WEBHOOK_TOKEN.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ASAAS_WEBHOOK_TOKEN = Deno.env.get("ASAAS_WEBHOOK_TOKEN");

// Usa a chave de serviço (não a anon key) porque essa função precisa
// atualizar QUALQUER empresa, não só a de um usuário logado — o
// Supabase já disponibiliza essas variáveis automaticamente.
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

serve(async (req) => {
  try {
    // Confere o token de segurança do webhook. IMPORTANTE: confirme no
    // painel do Asaas qual o nome exato do header usado pra enviar esse
    // token (pode ser "asaas-access-token" ou outro nome parecido) —
    // ajuste a linha abaixo se necessário depois de testar.
    const receivedToken = req.headers.get("asaas-access-token");
    if (ASAAS_WEBHOOK_TOKEN && receivedToken !== ASAAS_WEBHOOK_TOKEN) {
      return new Response("Unauthorized", { status: 401 });
    }

    const payload = await req.json();
    const eventType = payload.event;
    const payment = payload.payment;

    // Eventos que não são de cobrança (ex: transferência, nota fiscal)
    // não têm o que fazer aqui — só confirma recebimento.
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
      // Guarda o evento no histórico, sempre — mesmo que não mude o status
      await supabase.from("billing_events").insert({
        company_id: companyId,
        event_type: eventType,
        payment_id: payment.id,
        raw_payload: payload,
      });

      if (newStatus) {
        await supabase.from("companies").update({ subscription_status: newStatus }).eq("id", companyId);
      }
    }

    return new Response("ok", { status: 200 });
  } catch (e) {
    return new Response(String(e), { status: 500 });
  }
});
