// Edge Function: send-invite-email
// Envia o e-mail de convite de usuário via Resend, chamado pelo
// ProdOS logo depois de criar o convite em Configurações → Usuários.
//
// Como implantar: Supabase → Edge Functions → Create a new function
// → nome exato "send-invite-email" → cole este código → Deploy.
// Depois configure o segredo RESEND_API_KEY (ver README).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  gerente: "Gerente",
  vendas: "Vendas",
  compras: "Compras",
  producao: "Produção",
  financeiro: "Financeiro",
  rh: "RH",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { to, inviterName, companyName, role } = await req.json();

    if (!to || !companyName) {
      return new Response(JSON.stringify({ error: "Dados incompletos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const roleLabel = ROLE_LABEL[role] ?? role;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #222;">
        <div style="height: 5px; background: #E8A33D; margin-bottom: 20px;"></div>
        <p>Olá!</p>
        <p>${inviterName ?? "Um administrador"} convidou você para acessar a <strong>${companyName}</strong> no ProdOS, com o papel de <strong>${roleLabel}</strong>.</p>
        <p>Para aceitar, crie sua conta usando exatamente este e-mail:</p>
        <div style="background: #FDF1E0; padding: 10px 14px; font-weight: bold; text-align: center; margin: 16px 0; border-radius: 6px;">${to}</div>
        <div style="text-align: center; margin: 20px 0;">
          <a href="https://www.prodos.app.br/login" style="background: #1A1400; color: #fff; padding: 10px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Criar minha conta</a>
        </div>
        <p style="font-size: 12px; color: #888;">Se você não esperava este convite, pode ignorar este e-mail com segurança.</p>
        <p style="font-size: 11px; color: #aaa; margin-top: 24px;">ProdOS — Sistema Operacional da Produção</p>
      </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "ProdOS <naoresponda@prodos.app.br>",
        to: [to],
        subject: `Você foi convidado para a ${companyName} no ProdOS`,
        html,
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
