// Edge Function: create-subscription
// Cria um link de checkout de assinatura recorrente no Asaas pro
// plano escolhido, e devolve a URL pra redirecionar o usuário.
//
// Como implantar: Supabase → Edge Functions → Create a new function
// → nome exato "create-subscription" → cole este código → Deploy.
// Precisa do segredo ASAAS_API_KEY configurado (ver README/instruções).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
// Troque pra "https://api.asaas.com/v3" quando sair do sandbox e for produção de verdade
const ASAAS_BASE_URL = Deno.env.get("ASAAS_BASE_URL") ?? "https://api-sandbox.asaas.com/v3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Preços de exemplo — ajuste pros valores reais que você definir
const PLAN_PRICES = {
  basico: { name: "Plano Básico", value: 97.0 },
  intermediario: { name: "Plano Intermediário", value: 197.0 },
  premium: { name: "Plano Premium", value: 397.0 },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { companyId, plan } = await req.json();
    const planInfo = PLAN_PRICES[plan];

    if (!companyId || !planInfo) {
      return new Response(JSON.stringify({ error: "Dados inválidos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + 1);
    const nextDueDateStr = nextDueDate.toISOString().slice(0, 10);

    const body = {
      billingTypes: ["PIX", "BOLETO", "CREDIT_CARD"],
      chargeTypes: ["RECURRENT"],
      minutesToExpire: 60,
      callback: {
        cancelUrl: "https://www.prodos.app.br/assinatura?status=cancelado",
        expiredUrl: "https://www.prodos.app.br/assinatura?status=expirado",
        successUrl: "https://www.prodos.app.br/assinatura?status=sucesso",
      },
      items: [
        { description: `${planInfo.name} — ProdOS`, name: planInfo.name, quantity: 1, value: planInfo.value },
      ],
      subscription: { cycle: "MONTHLY", nextDueDate: nextDueDateStr },
      // Guarda o ID da empresa aqui — é assim que o webhook vai saber
      // depois pra qual empresa liberar o acesso quando o pagamento confirmar
      externalReference: companyId,
    };

    const res = await fetch(`${ASAAS_BASE_URL}/checkouts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "access_token": ASAAS_API_KEY ?? "" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(JSON.stringify({ error: errText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const checkoutUrl = `https://asaas.com/checkoutSession/show?id=${data.id}`;

    return new Response(JSON.stringify({ checkoutUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
