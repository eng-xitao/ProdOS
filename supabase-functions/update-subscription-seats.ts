// Edge Function: update-subscription-seats
// Recalcula o valor da assinatura no Asaas sempre que o numero de
// usuarios de uma empresa muda (adicionar ou remover alguem). Preco
// = preco do plano + (usuarios acima do incluso) x valor por usuario extra.
// So mexe em empresas que ja tem assinatura ativa no Asaas (trial nao precisa).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
const ASAAS_BASE_URL = Deno.env.get("ASAAS_BASE_URL") ?? "https://api-sandbox.asaas.com/v3";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

serve(async (req) => {
  try {
    const { companyId } = await req.json();
    if (!companyId) {
      return new Response(JSON.stringify({ error: "companyId obrigatorio" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const { data: company } = await supabase
      .from("companies")
      .select("asaas_subscription_id, plans:plan_id (price, included_users, extra_user_price)")
      .eq("id", companyId).single();

    if (!company?.asaas_subscription_id || !company.plans) {
      return new Response(JSON.stringify({ skipped: true }), { headers: { "Content-Type": "application/json" } });
    }

    const { count: userCount } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId);

    const included = company.plans.included_users ?? 2;
    const extraPrice = Number(company.plans.extra_user_price ?? 0);
    const extraSeats = Math.max((userCount ?? 0) - included, 0);
    const newValue = round2(Number(company.plans.price) + extraSeats * extraPrice);

    const res = await fetch(`${ASAAS_BASE_URL}/subscriptions/${company.asaas_subscription_id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "access_token": ASAAS_API_KEY ?? "" },
      body: JSON.stringify({ value: newValue }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(JSON.stringify({ error: errText }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ userCount, extraSeats, newValue }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
