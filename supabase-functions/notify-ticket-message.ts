// Edge Function: notify-ticket-message
// Manda e-mail avisando de uma nova mensagem num ticket de suporte da
// plataforma: se quem escreveu foi um cliente, avisa todos os admins
// da plataforma; se foi um admin respondendo, avisa o cliente que abriu.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendEmail(to: string, subject: string, html: string) {
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "ProdOS <naoresponda@prodos.app.br>", to: [to], subject, html }),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { ticketId } = await req.json();
    if (!ticketId) {
      return new Response(JSON.stringify({ error: "ticketId obrigatorio" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: ticket } = await supabase
      .from("platform_support_tickets")
      .select("id, subject, company_id, companies:company_id (name, email)")
      .eq("id", ticketId).single();
    if (!ticket) {
      return new Response(JSON.stringify({ error: "Ticket nao encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: lastMessage } = await supabase
      .from("platform_support_ticket_messages")
      .select("message, is_admin_reply")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: false })
      .limit(1).single();
    if (!lastMessage) {
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (lastMessage.is_admin_reply) {
      if (ticket.companies?.email) {
        await sendEmail(
          ticket.companies.email,
          `Nova resposta no seu chamado: ${ticket.subject}`,
          `<p>Ola, ${ticket.companies.name}!</p><p>Voce recebeu uma resposta no chamado "${ticket.subject}":</p><blockquote>${lastMessage.message}</blockquote><p>Acesse <a href="https://app.prodos.app.br/suporte">app.prodos.app.br/suporte</a> para ver e responder.</p>`
        );
      }
    } else {
      const { data: admins } = await supabase.from("profiles").select("email").eq("is_platform_admin", true);
      for (const admin of admins ?? []) {
        if (!admin.email) continue;
        await sendEmail(
          admin.email,
          `Novo chamado de suporte: ${ticket.subject} (${ticket.companies?.name})`,
          `<p>A empresa <strong>${ticket.companies?.name}</strong> escreveu no chamado "${ticket.subject}":</p><blockquote>${lastMessage.message}</blockquote><p>Acesse <a href="https://app.prodos.app.br/admin/suporte">app.prodos.app.br/admin/suporte</a> para responder.</p>`
        );
      }
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
