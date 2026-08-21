// Edge Function: create-subscription
// Cria um link de checkout de assinatura recorrente no Asaas pro
// plano escolhido, e devolve a URL pra redirecionar o usuário.
//
// Como implantar: Supabase → Edge Functions → Create a new function
// → nome exato "create-subscription" → cole este código → Deploy.
// Precisa dos segredos ASAAS_API_KEY, SUPABASE_URL e
// SUPABASE_SERVICE_ROLE_KEY (os dois últimos o Supabase já injeta
// automaticamente em toda função, não precisa configurar).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
// Troque pra "https://api.asaas.com/v3" quando sair do sandbox e for produção de verdade
const ASAAS_BASE_URL = Deno.env.get("ASAAS_BASE_URL") ?? "https://api-sandbox.asaas.com/v3";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { companyId, plan } = await req.json();

    if (!companyId || !plan) {
      return new Response(JSON.stringify({ error: "Dados inválidos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Busca o preço direto da tabela "plans" — assim, se o preço for
    // ajustado em Administração → Planos, o checkout já cobra o valor
    // certo automaticamente, sem precisar mexer em código.
    const { data: planRow, error: planError } = await supabase
      .from("plans")
      .select("name, price")
      .eq("key", plan)
      .eq("active", true)
      .single();

    if (planError || !planRow) {
      return new Response(JSON.stringify({ error: "Plano não encontrado" }), {
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
        { description: `${planRow.name} — ProdOS`, name: planRow.name, quantity: 1, value: Number(planRow.price) },
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
