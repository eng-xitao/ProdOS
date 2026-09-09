// Edge Function: emit-nfe
// Emite uma NF-e via Focus NFe a partir de um Pedido de Venda. Usa o
// token proprio da empresa (Configuracoes -> Fiscal), monta o payload
// no formato esperado pela API e registra o resultado em `invoices`.
// Doc oficial: https://doc.focusnfe.com.br/reference/emitir_nfe
//
// Suporta faturamento PARCIAL: o chamador manda `items` com a
// quantidade que quer faturar agora (pode ser menor que o total do
// pedido, quando o estoque ainda nao cobre tudo). A funcao valida
// contra o saldo pendente de cada item (quantity - invoiced_quantity),
// registra o que foi faturado em `invoice_items`, atualiza
// sales_order_items.invoiced_quantity, e recalcula o status do pedido
// (parcialmente_faturado / faturado).
//
// Suporta modo `simulate: true` para testes: pula a chamada real pra
// API do Focus NFe e fabrica uma resposta "autorizada" na hora, mas
// passa pelo MESMO caminho de codigo depois (grava invoice, atualiza
// saldo por item, recalcula status do pedido) -- assim testar a
// simulacao valida o mesmo fluxo que a emissao real usaria.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function onlyDigits(v: string | null | undefined) {
  return (v ?? "").replace(/\D/g, "");
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { companyId, salesOrderId, items: requestedItems, simulate } = await req.json();
    if (!companyId || !salesOrderId) {
      return jsonResponse({ error: "Dados invalidos" }, 400);
    }

    const { data: company } = await supabase.from("companies").select("*").eq("id", companyId).single();
    if (!simulate) {
      if (!company?.focus_nfe_token) {
        return jsonResponse({ error: "Configure o token do Focus NFe em Configuracoes > Fiscal antes de emitir." }, 400);
      }
      if (!company.logradouro || !company.municipio || !company.uf || !company.cep) {
        return jsonResponse({ error: "Complete o endereco da empresa em Configuracoes > Fiscal antes de emitir." }, 400);
      }
    }

    const { data: order } = await supabase
      .from("sales_orders")
      .select("id, code, total_value, customer_id, customers:customer_id (*)")
      .eq("id", salesOrderId).single();
    if (!order) {
      return jsonResponse({ error: "Pedido de venda nao encontrado" }, 404);
    }

    const customer = order.customers;
    if (!simulate && (!customer?.logradouro || !customer?.municipio || !customer?.uf || !customer?.cep)) {
      return jsonResponse({ error: "Complete o endereco estruturado do cliente (Cadastro > Clientes) antes de emitir." }, 400);
    }

    // Saldo pendente de cada item do pedido (fonte da verdade pra validar o que pode ser faturado agora)
    const { data: orderItems } = await supabase
      .from("sales_order_items")
      .select("id, product_id, quantity, invoiced_quantity, unit_price, discount_percent")
      .eq("sales_order_id", salesOrderId);

    if (!orderItems || orderItems.length === 0) {
      return jsonResponse({ error: "Pedido sem itens" }, 400);
    }

    const balanceByProduct = new Map(orderItems.map((it: any) => [it.product_id, it]));

    // Se o chamador nao mandou items customizados, fatura o saldo pendente inteiro (comportamento padrao).
    const itemsToInvoiceRaw = (requestedItems && requestedItems.length > 0)
      ? requestedItems.map((it: any) => ({ productId: it.productId, quantity: Number(it.quantity), unitPrice: Number(it.unitPrice) }))
      : orderItems
          .filter((it: any) => Number(it.quantity) - Number(it.invoiced_quantity) > 0)
          .map((it: any) => ({ productId: it.product_id, quantity: Number(it.quantity) - Number(it.invoiced_quantity), unitPrice: Number(it.unit_price) }));

    if (itemsToInvoiceRaw.length === 0) {
      return jsonResponse({ error: "Nenhum item com saldo pendente para faturar." }, 400);
    }

    // Valida cada item contra o saldo pendente real do pedido
    for (const it of itemsToInvoiceRaw) {
      const orderItem = balanceByProduct.get(it.productId);
      if (!orderItem) {
        return jsonResponse({ error: `Item nao pertence a este pedido (product_id ${it.productId}).` }, 400);
      }
      const pending = Number(orderItem.quantity) - Number(orderItem.invoiced_quantity);
      if (it.quantity <= 0) {
        return jsonResponse({ error: "Quantidade a faturar precisa ser maior que zero." }, 400);
      }
      if (it.quantity > pending + 0.0001) {
        return jsonResponse({ error: `Quantidade maior que o saldo pendente. Pendente: ${pending}.` }, 400);
      }
    }

    // Dados fiscais dos produtos (nao vem do payload do front)
    const productIds = itemsToInvoiceRaw.map((it: any) => it.productId);
    const { data: productsData } = await supabase
      .from("products")
      .select("id, name, sku, ncm, cfop_padrao, unit, stock_quantity")
      .in("id", productIds);
    const productById = new Map((productsData ?? []).map((p: any) => [p.id, p]));

    // Trava de estoque: nao deixa faturar mais do que o disponivel de verdade
    // (estoque fisico menos o que ja esta reservado por OUTROS pedidos em aberto).
    for (const it of itemsToInvoiceRaw) {
      const product = productById.get(it.productId);
      const { data: reservedByOthers } = await supabase.rpc("reserved_quantity", { p_product_id: it.productId, p_exclude_order_id: salesOrderId });
      const available = Number(product?.stock_quantity ?? 0) - Number(reservedByOthers ?? 0);
      if (it.quantity > available + 0.0001) {
        return jsonResponse({ error: `Estoque insuficiente para "${product?.name ?? it.productId}". Disponível: ${available} ${product?.unit ?? ""} (estoque físico menos o que já está reservado por outros pedidos). Solicitado: ${it.quantity}.` }, 400);
      }
    }

    const missingNcm = itemsToInvoiceRaw.find((it: any) => !productById.get(it.productId)?.ncm);
    if (!simulate && missingNcm) {
      return jsonResponse({ error: `Produto "${productById.get(missingNcm.productId)?.name}" sem NCM cadastrado. Complete em Cadastro > Produtos.` }, 400);
    }

    const isInterestadual = customer?.uf && company?.uf && customer.uf !== company.uf;

    const nfeItems = itemsToInvoiceRaw.map((it: any, index: number) => {
      const product = productById.get(it.productId);
      const valorBruto = round2(it.quantity * it.unitPrice);
      return {
        numero_item: index + 1,
        codigo_produto: product?.sku ?? String(index + 1),
        descricao: product?.name ?? "Produto",
        cfop: isInterestadual ? "6102" : (product?.cfop_padrao ?? "5102"),
        quantidade_comercial: it.quantity,
        quantidade_tributavel: it.quantity,
        valor_unitario_comercial: it.unitPrice,
        valor_unitario_tributavel: it.unitPrice,
        unidade_comercial: product?.unit ?? "UN",
        unidade_tributavel: product?.unit ?? "UN",
        valor_bruto: valorBruto,
        codigo_ncm: product?.ncm,
        inclui_no_total: 1,
        icms_origem: 0,
        icms_situacao_tributaria: company?.regime_tributario === 1 ? "102" : "40", // simplificado: Simples Nacional x Regime Normal isento (ajustar conforme o caso real)
        pis_situacao_tributaria: "07",
        cofins_situacao_tributaria: "07",
      };
    });

    const valorTotal = round2(nfeItems.reduce((sum: number, it: any) => sum + it.valor_bruto, 0));
    const ref = `pedido_${order.code}_${Date.now()}`;

    let data: Record<string, unknown>;
    let status: string;

    if (simulate) {
      const fakeSuffix = Math.random().toString(36).slice(2, 10).toUpperCase();
      data = {
        status: "autorizado",
        chave_nfe: `SIMULADO-${fakeSuffix}`,
        numero: String(Math.floor(Math.random() * 900000) + 100000),
        serie: "1",
        caminho_danfe: null,
        caminho_xml_nota_fiscal: null,
      };
      status = "autorizado";
    } else {
      const payload: Record<string, unknown> = {
        natureza_operacao: "Venda de mercadoria",
        data_emissao: new Date().toISOString(),
        tipo_documento: 1, // saida
        finalidade_emissao: 1, // normal
        consumidor_final: 1,
        presenca_comprador: 9,
        local_destino: isInterestadual ? 2 : 1,

        cnpj_emitente: onlyDigits(company.cnpj),
        nome_emitente: company.name,
        logradouro_emitente: company.logradouro,
        numero_emitente: company.numero ?? "S/N",
        bairro_emitente: company.bairro,
        municipio_emitente: company.municipio,
        uf_emitente: company.uf,
        cep_emitente: onlyDigits(company.cep),
        inscricao_estadual_emitente: company.inscricao_estadual,
        regime_tributario_emitente: company.regime_tributario ?? 1,

        nome_destinatario: customer.name,
        ...(onlyDigits(customer.document).length === 14
          ? { cnpj_destinatario: onlyDigits(customer.document) }
          : { cpf_destinatario: onlyDigits(customer.document) }),
        indicador_inscricao_estadual_destinatario: Number(customer.indicador_ie ?? 9),
        logradouro_destinatario: customer.logradouro,
        numero_destinatario: customer.numero ?? "S/N",
        bairro_destinatario: customer.bairro,
        municipio_destinatario: customer.municipio,
        uf_destinatario: customer.uf,
        cep_destinatario: onlyDigits(customer.cep),
        pais_destinatario: "Brasil",
        telefone_destinatario: onlyDigits(customer.phone),

        valor_produtos: valorTotal,
        valor_total: valorTotal,
        modalidade_frete: 9,
        items: nfeItems,
      };

      const baseUrl = company.focus_nfe_ambiente === "producao"
        ? "https://api.focusnfe.com.br/v2"
        : "https://homologacao.focusnfe.com.br/v2";

      const authHeader = "Basic " + btoa(`${company.focus_nfe_token}:`);

      const res = await fetch(`${baseUrl}/nfe?ref=${encodeURIComponent(ref)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": authHeader },
        body: JSON.stringify(payload),
      });

      data = await res.json();
      status = "processando";
      if (data.status === "autorizado") status = "autorizado";
      else if (res.status >= 400) status = "erro";
    }

    const baseUrlForLinks = company?.focus_nfe_ambiente === "producao"
      ? "https://api.focusnfe.com.br"
      : "https://homologacao.focusnfe.com.br";

    const { data: invoice, error: invoiceError } = await supabase.from("invoices").insert({
      company_id: companyId,
      sales_order_id: salesOrderId,
      customer_id: order.customer_id,
      ref,
      status,
      simulated: !!simulate,
      chave_nfe: data.chave_nfe ?? null,
      numero: data.numero ?? null,
      serie: data.serie ?? null,
      valor_total: valorTotal,
      danfe_url: data.caminho_danfe ? `${baseUrlForLinks}${data.caminho_danfe}` : null,
      xml_url: data.caminho_xml_nota_fiscal ? `${baseUrlForLinks}${data.caminho_xml_nota_fiscal}` : null,
      error_message: status === "erro" ? (data.mensagem ?? JSON.stringify(data.erros ?? data)) : null,
      raw_response: data,
    }).select().single();

    if (invoiceError) {
      return jsonResponse({ error: invoiceError.message }, 500);
    }

    if (status === "erro") {
      return jsonResponse({ error: invoice.error_message, invoice }, 422);
    }

    // Nota efetivamente saiu (autorizada ou em processamento) -- registra o que foi
    // faturado e atualiza o saldo pendente do pedido.
    await supabase.from("invoice_items").insert(
      itemsToInvoiceRaw.map((it: any) => ({
        company_id: companyId,
        invoice_id: invoice.id,
        product_id: it.productId,
        quantity: it.quantity,
        unit_price: it.unitPrice,
      }))
    );

    for (const it of itemsToInvoiceRaw) {
      const orderItem = balanceByProduct.get(it.productId);
      await supabase.from("sales_order_items")
        .update({ invoiced_quantity: Number(orderItem.invoiced_quantity) + it.quantity })
        .eq("id", orderItem.id);
    }

    const { data: refreshedItems } = await supabase
      .from("sales_order_items")
      .select("quantity, invoiced_quantity")
      .eq("sales_order_id", salesOrderId);
    const allInvoiced = (refreshedItems ?? []).every((it: any) => Number(it.invoiced_quantity) >= Number(it.quantity) - 0.0001);
    const anyInvoiced = (refreshedItems ?? []).some((it: any) => Number(it.invoiced_quantity) > 0);
    const newOrderStatus = allInvoiced ? "faturado" : anyInvoiced ? "parcialmente_faturado" : "aberto";
    await supabase.from("sales_orders").update({ status: newOrderStatus }).eq("id", salesOrderId);

    return jsonResponse({ invoice, orderStatus: newOrderStatus });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
});

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
