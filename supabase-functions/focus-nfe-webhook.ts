// Edge Function: focus-nfe-webhook
// Recebe as notificacoes assincronas do Focus NFe (uma NFe enviada
// pode demorar pra autorizar na SEFAZ) e atualiza o status em `invoices`.
// Configure esse endpoint como "gatilho" (webhook) no painel do Focus NFe.
//
// Se a nota vier como erro/cancelada DEPOIS de ja termos reservado o
// saldo (invoiced_quantity) no emit-nfe, essa reserva precisa ser
// revertida -- senao o pedido fica "faturado" sem nota valida
// nenhuma. Usa invoice_items (o que foi registrado no momento da
// emissao) pra saber exatamente quanto devolver a cada item, e
// recalcula o status do pedido depois.

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

    const { data: invoice } = await supabase
      .from("invoices")
      .select("id, sales_order_id, status")
      .eq("ref", ref)
      .maybeSingle();

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

    // Nota falhou/cancelou depois de ja termos reservado o saldo faturado -- devolve.
    const wasReserved = invoice && invoice.status !== "erro" && invoice.status !== "cancelado";
    if (invoice && wasReserved && (status === "erro" || status === "cancelado")) {
      const { data: invoiceItems } = await supabase
        .from("invoice_items")
        .select("product_id, quantity")
        .eq("invoice_id", invoice.id);

      for (const item of invoiceItems ?? []) {
        const { data: orderItem } = await supabase
          .from("sales_order_items")
          .select("id, invoiced_quantity")
          .eq("sales_order_id", invoice.sales_order_id)
          .eq("product_id", item.product_id)
          .maybeSingle();
        if (orderItem) {
          const restored = Math.max(0, Number(orderItem.invoiced_quantity) - Number(item.quantity));
          await supabase.from("sales_order_items").update({ invoiced_quantity: restored }).eq("id", orderItem.id);
        }
      }

      const { data: refreshedItems } = await supabase
        .from("sales_order_items")
        .select("quantity, invoiced_quantity")
        .eq("sales_order_id", invoice.sales_order_id);
      const allInvoiced = (refreshedItems ?? []).every((it: any) => Number(it.invoiced_quantity) >= Number(it.quantity) - 0.0001);
      const anyInvoiced = (refreshedItems ?? []).some((it: any) => Number(it.invoiced_quantity) > 0);
      const newOrderStatus = allInvoiced ? "faturado" : anyInvoiced ? "parcialmente_faturado" : "aberto";
      await supabase.from("sales_orders").update({ status: newOrderStatus }).eq("id", invoice.sales_order_id);
    }

    return new Response("ok", { status: 200 });
  } catch (e) {
    return new Response(String(e), { status: 500 });
  }
});
