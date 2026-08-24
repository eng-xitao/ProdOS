// Edge Function: emit-nfe
// Emite uma NF-e via Focus NFe a partir de um Pedido de Venda. Usa o
// token proprio da empresa (Configuracoes -> Fiscal), monta o payload
// no formato esperado pela API e registra o resultado em `invoices`.
// Doc oficial: https://doc.focusnfe.com.br/reference/emitir_nfe

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { companyId, salesOrderId } = await req.json();
    if (!companyId || !salesOrderId) {
      return new Response(JSON.stringify({ error: "Dados invalidos" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: company } = await supabase.from("companies").select("*").eq("id", companyId).single();
    if (!company?.focus_nfe_token) {
      return new Response(JSON.stringify({ error: "Configure o token do Focus NFe em Configuracoes > Fiscal antes de emitir." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!company.logradouro || !company.municipio || !company.uf || !company.cep) {
      return new Response(JSON.stringify({ error: "Complete o endereco da empresa em Configuracoes > Fiscal antes de emitir." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: order } = await supabase
      .from("sales_orders")
      .select("id, code, total_value, customer_id, customers:customer_id (*)")
      .eq("id", salesOrderId).single();
    if (!order) {
      return new Response(JSON.stringify({ error: "Pedido de venda nao encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const customer = order.customers;
    if (!customer?.logradouro || !customer?.municipio || !customer?.uf || !customer?.cep) {
      return new Response(JSON.stringify({ error: "Complete o endereco estruturado do cliente (Cadastro > Clientes) antes de emitir." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: items } = await supabase
      .from("sales_order_items")
      .select("quantity, unit_price, discount_percent, products:product_id (name, sku, ncm, cfop_padrao, unit)")
      .eq("sales_order_id", salesOrderId);

    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ error: "Pedido sem itens" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const missingNcm = items.find((it: any) => !it.products?.ncm);
    if (missingNcm) {
      return new Response(JSON.stringify({ error: `Produto "${missingNcm.products?.name}" sem NCM cadastrado. Complete em Cadastro > Produtos.` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const isInterestadual = customer.uf && company.uf && customer.uf !== company.uf;

    const nfeItems = items.map((it: any, index: number) => {
      const valorBruto = round2(Number(it.quantity) * Number(it.unit_price));
      return {
        numero_item: index + 1,
        codigo_produto: it.products?.sku ?? String(index + 1),
        descricao: it.products?.name ?? "Produto",
        cfop: isInterestadual ? "6102" : (it.products?.cfop_padrao ?? "5102"),
        quantidade_comercial: Number(it.quantity),
        quantidade_tributavel: Number(it.quantity),
        valor_unitario_comercial: Number(it.unit_price),
        valor_unitario_tributavel: Number(it.unit_price),
        unidade_comercial: it.products?.unit ?? "UN",
        unidade_tributavel: it.products?.unit ?? "UN",
        valor_bruto: valorBruto,
        codigo_ncm: it.products.ncm,
        inclui_no_total: 1,
        icms_origem: 0,
        icms_situacao_tributaria: company.regime_tributario === 1 ? "102" : "40", // simplificado: Simples Nacional x Regime Normal isento (ajustar conforme o caso real)
        pis_situacao_tributaria: "07",
        cofins_situacao_tributaria: "07",
      };
    });

    const valorTotal = round2(nfeItems.reduce((sum: number, it: any) => sum + it.valor_bruto, 0));
    const ref = `pedido_${order.code}_${Date.now()}`;

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

    const data = await res.json();

    let status = "processando";
    if (data.status === "autorizado") status = "autorizado";
    else if (res.status >= 400) status = "erro";

    const { data: invoice, error: invoiceError } = await supabase.from("invoices").insert({
      company_id: companyId,
      sales_order_id: salesOrderId,
      customer_id: order.customer_id,
      ref,
      status,
      chave_nfe: data.chave_nfe ?? null,
      numero: data.numero ?? null,
      serie: data.serie ?? null,
      valor_total: valorTotal,
      danfe_url: data.caminho_danfe ? `${baseUrl.replace("/v2", "")}${data.caminho_danfe}` : null,
      xml_url: data.caminho_xml_nota_fiscal ? `${baseUrl.replace("/v2", "")}${data.caminho_xml_nota_fiscal}` : null,
      error_message: status === "erro" ? (data.mensagem ?? JSON.stringify(data.erros ?? data)) : null,
      raw_response: data,
    }).select().single();

    if (invoiceError) {
      return new Response(JSON.stringify({ error: invoiceError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (status === "erro") {
      return new Response(JSON.stringify({ error: invoice.error_message, invoice }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ invoice }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
