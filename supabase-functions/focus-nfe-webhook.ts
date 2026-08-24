// Edge Function: focus-nfe-webhook
// Recebe as notificacoes assincronas do Focus NFe (uma NFe enviada
// pode demorar pra autorizar na SEFAZ) e atualiza o status em `invoices`.
// Configure esse endpoint como "gatilho" (webhook) no painel do Focus NFe.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

serve(async (req) => {
  try {
    const payload = await req.json();
    const ref = payload.ref;
    if (!ref) return new Response("ok", { status: 200 });

    let status = "processando";
    if (payload.status === "autorizado") status = "autorizado";
    else if (payload.status === "erro_autorizacao" || payload.status === "cancelado") status = payload.status === "cancelado" ? "cancelado" : "erro";

    const baseUrl = payload.caminho_danfe?.startsWith("http") ? "" : "https://api.focusnfe.com.br";

    await supabase.from("invoices").update({
      status,
      chave_nfe: payload.chave_nfe ?? null,
      numero: payload.numero ?? null,
      serie: payload.serie ?? null,
      danfe_url: payload.caminho_danfe ? `${baseUrl}${payload.caminho_danfe}` : undefined,
      xml_url: payload.caminho_xml_nota_fiscal ? `${baseUrl}${payload.caminho_xml_nota_fiscal}` : undefined,
      error_message: status === "erro" ? (payload.mensagem_sefaz ?? JSON.stringify(payload)) : null,
      raw_response: payload,
      updated_at: new Date().toISOString(),
    }).eq("ref", ref);

    return new Response("ok", { status: 200 });
  } catch (e) {
    return new Response(String(e), { status: 500 });
  }
});
