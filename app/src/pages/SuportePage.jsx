import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

const STATUS_LABEL = { aberto: "Aberto", em_andamento: "Em andamento", resolvido: "Resolvido" };

/**
 * Suporte: a empresa cliente abre chamados pra ProdOS e conversa por
 * aqui — sem precisar de WhatsApp/e-mail solto. O admin da plataforma
 * vê e responde em Administração → Suporte.
 */
export default function SuportePage() {
  const { company, profile } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);

  const [showNewForm, setShowNewForm] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newMessageText, setNewMessageText] = useState("");
  const [creating, setCreating] = useState(false);

  async function loadTickets() {
    setLoading(true);
    const { data } = await supabase
      .from("platform_support_tickets")
      .select("id, subject, status, created_at, updated_at")
      .order("updated_at", { ascending: false });
    setTickets(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (company?.id) loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  async function openTicket(id) {
    setSelectedId(id);
    const { data } = await supabase
      .from("platform_support_ticket_messages")
      .select("id, message, is_admin_reply, created_at")
      .eq("ticket_id", id)
      .order("created_at", { ascending: true });
    setMessages(data ?? []);
  }

  async function createTicket(e) {
    e.preventDefault();
    if (!company?.id || !newSubject || !newMessageText) return;
    setCreating(true);

    const { data: ticket, error } = await supabase
      .from("platform_support_tickets")
      .insert({ company_id: company.id, created_by: profile.id, subject: newSubject })
      .select("id").single();

    if (!error && ticket) {
      await supabase.from("platform_support_ticket_messages").insert({
        ticket_id: ticket.id, author_profile_id: profile.id, is_admin_reply: false, message: newMessageText,
      });
      supabase.functions.invoke("notify-ticket-message", { body: { ticketId: ticket.id } });
      setNewSubject(""); setNewMessageText(""); setShowNewForm(false);
      await loadTickets();
      openTicket(ticket.id);
    }
    setCreating(false);
  }

  async function sendReply() {
    if (!newMessage.trim() || !selectedId) return;
    setSending(true);
    await supabase.from("platform_support_ticket_messages").insert({
      ticket_id: selectedId, author_profile_id: profile.id, is_admin_reply: false, message: newMessage,
    });
    supabase.functions.invoke("notify-ticket-message", { body: { ticketId: selectedId } });
    setNewMessage("");
    await openTicket(selectedId);
    await loadTickets();
    setSending(false);
  }

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={styles.title}>Suporte</h1>
        <p style={styles.subtitle}>Abra um chamado pra equipe do ProdOS e acompanhe por aqui.</p>
      </header>

      <button style={styles.addBtn} onClick={() => setShowNewForm((v) => !v)} type="button">
        {showNewForm ? "Cancelar" : "+ Novo chamado"}
      </button>

      {showNewForm && (
        <form onSubmit={createTicket} style={styles.form}>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Assunto</span>
            <input style={styles.input} value={newSubject} onChange={(e) => setNewSubject(e.target.value)} placeholder="Ex: Romaneio não está gerando o PDF" required />
          </label>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Descreva o problema</span>
            <textarea style={styles.textarea} rows={4} value={newMessageText} onChange={(e) => setNewMessageText(e.target.value)} required />
          </label>
          <button style={styles.submitBtn} type="submit" disabled={creating}>{creating ? "Enviando..." : "Abrir chamado"}</button>
        </form>
      )}

      <div style={styles.layout}>
        <div style={styles.ticketList}>
          {loading ? (
            <p style={styles.dim}>Carregando...</p>
          ) : tickets.length === 0 ? (
            <p style={styles.dim}>Nenhum chamado aberto ainda.</p>
          ) : (
            tickets.map((t) => (
              <button key={t.id} style={{ ...styles.ticketItem, ...(selectedId === t.id ? styles.ticketItemActive : {}) }} onClick={() => openTicket(t.id)} type="button">
                <span style={styles.ticketSubject}>{t.subject}</span>
                <span style={{ ...styles.badge, ...statusStyle(t.status) }}>{STATUS_LABEL[t.status]}</span>
              </button>
            ))
          )}
        </div>

        {selectedId && (
          <div style={styles.thread}>
            <div style={styles.messagesBox}>
              {messages.map((m) => (
                <div key={m.id} style={{ ...styles.message, ...(m.is_admin_reply ? styles.messageAdmin : styles.messageMine) }}>
                  <span style={styles.messageAuthor}>{m.is_admin_reply ? "Equipe ProdOS" : "Você"}</span>
                  <p style={styles.messageText}>{m.message}</p>
                  <span style={styles.messageDate}>{new Date(m.created_at).toLocaleString("pt-BR")}</span>
                </div>
              ))}
            </div>
            <div style={styles.replyRow}>
              <input style={styles.replyInput} value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Escreva uma mensagem..." onKeyDown={(e) => e.key === "Enter" && sendReply()} />
              <button style={styles.sendBtn} onClick={sendReply} disabled={sending} type="button">Enviar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function statusStyle(status) {
  if (status === "resolvido") return { background: "rgba(79,174,126,0.15)", color: "var(--green)" };
  if (status === "em_andamento") return { background: "rgba(232,163,61,0.15)", color: "var(--amber)" };
  return { background: "rgba(92,143,217,0.15)", color: "var(--blue, #5C8FD9)" };
}

const styles = {
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0" },
  dim: { color: "var(--text-dim)", fontSize: 13 },
  addBtn: {
    background: "var(--amber)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)",
    padding: "9px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", marginBottom: 16,
  },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  fieldLabel: { fontSize: 11, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" },
  input: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "9px 10px", color: "var(--text)", fontSize: 13,
  },
  textarea: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "9px 10px", color: "var(--text)", fontSize: 13, resize: "vertical",
  },
  form: {
    display: "flex", flexDirection: "column", gap: 12,
    background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: 20, marginBottom: 20, maxWidth: 560,
  },
  submitBtn: {
    background: "var(--green)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)",
    padding: "10px 0", fontWeight: 700, fontSize: 13, cursor: "pointer",
  },
  layout: { display: "grid", gridTemplateColumns: "260px 1fr", gap: 16, alignItems: "start" },
  ticketList: { display: "flex", flexDirection: "column", gap: 8 },
  ticketItem: {
    display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start",
    background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "10px 12px", cursor: "pointer", textAlign: "left",
  },
  ticketItemActive: { borderColor: "var(--amber)", borderWidth: 2 },
  ticketSubject: { fontSize: 13, fontWeight: 600 },
  badge: { padding: "2px 8px", borderRadius: 20, fontSize: 10.5, fontWeight: 700 },
  thread: {
    background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: 16, display: "flex", flexDirection: "column", gap: 12, minHeight: 300,
  },
  messagesBox: { display: "flex", flexDirection: "column", gap: 10, maxHeight: 420, overflowY: "auto" },
  message: { padding: "8px 12px", borderRadius: "var(--radius)", maxWidth: "80%" },
  messageMine: { background: "var(--panel-2)", alignSelf: "flex-end" },
  messageAdmin: { background: "rgba(232,163,61,0.1)", alignSelf: "flex-start" },
  messageAuthor: { fontSize: 10.5, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" },
  messageText: { fontSize: 13, margin: "4px 0", whiteSpace: "pre-wrap" },
  messageDate: { fontSize: 10.5, color: "var(--text-dim)" },
  replyRow: { display: "flex", gap: 8 },
  replyInput: {
    flex: 1, background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "9px 12px", color: "var(--text)", fontSize: 13,
  },
  sendBtn: {
    background: "var(--amber)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)",
    padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer",
  },
};
