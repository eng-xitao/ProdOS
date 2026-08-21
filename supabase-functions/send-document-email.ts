// Edge Function: send-document-email
// Envia um documento (Orçamento, Pedido, Cotação...) por e-mail via
// Resend, com o PDF já anexado — chamado pelos botões "Enviar por
// E-mail" em Cotações, Orçamentos, Pedidos de Compra e Pedidos de Venda.
//
// Como implantar: Supabase → Edge Functions → Create a new function
// → nome exato "send-document-email" → cole este código → Deploy.
// Usa o mesmo segredo RESEND_API_KEY já configurado pra outra função.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { to, subject, message, attachmentBase64, attachmentFilename } = await req.json();

    if (!to || !subject || !attachmentBase64) {
      return new Response(JSON.stringify({ error: "Dados incompletos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "ProdOS <naoresponda@prodos.app.br>",
        to: [to],
        subject,
        html: message,
        attachments: [
          {
            filename: attachmentFilename ?? "documento.pdf",
            content: attachmentBase64,
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(JSON.stringify({ error: errText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
