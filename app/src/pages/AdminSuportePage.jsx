import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

const STATUS_LABEL = { aberto: "Aberto", em_andamento: "Em andamento", resolvido: "Resolvido" };

/**
 * Suporte (admin): todos os chamados de todas as empresas clientes,
 * num lugar só. Responde direto por aqui — o cliente recebe e-mail
 * avisando e vê a resposta em Suporte, dentro da própria conta dele.
 */
export default function AdminSuportePage() {
  const { profile } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("aberto");
  const [selectedId, setSelectedId] = useState("");
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);

  async function loadTickets() {
    setLoading(true);
    const { data } = await supabase
      .from("platform_support_tickets")
      .select("id, subject, status, created_at, updated_at, companies:company_id (name)")
      .order("updated_at", { ascending: false });
    setTickets(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (profile?.is_platform_admin) loadTickets();
  }, [profile?.is_platform_admin]);

  async function openTicket(id) {
    setSelectedId(id);
    const { data } = await supabase
      .from("platform_support_ticket_messages")
      .select("id, message, is_admin_reply, created_at")
      .eq("ticket_id", id)
      .order("created_at", { ascending: true });
    setMessages(data ?? []);
  }

  async function sendReply() {
    if (!newMessage.trim() || !selectedId) return;
    setSending(true);
    await supabase.from("platform_support_ticket_messages").insert({
      ticket_id: selectedId, author_profile_id: profile.id, is_admin_reply: true, message: newMessage,
    });
    const ticket = tickets.find((t) => t.id === selectedId);
    if (ticket?.status === "aberto") {
      await supabase.from("platform_support_tickets").update({ status: "em_andamento" }).eq("id", selectedId);
    }
    supabase.functions.invoke("notify-ticket-message", { body: { ticketId: selectedId } });
    setNewMessage("");
    await openTicket(selectedId);
    await loadTickets();
    setSending(false);
  }

  async function changeStatus(status) {
    setChangingStatus(true);
    await supabase.from("platform_support_tickets").update({ status }).eq("id", selectedId);
    await loadTickets();
    setChangingStatus(false);
  }

  if (!profile?.is_platform_admin) return null;

  const filtered = filter === "todos" ? tickets : tickets.filter((t) => t.status === filter);
  const selectedTicket = tickets.find((t) => t.id === selectedId);

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={styles.title}>Suporte</h1>
        <p style={styles.subtitle}>Chamados de todas as empresas clientes, num lugar só.</p>
      </header>

      <div style={styles.filterRow}>
        {["aberto", "em_andamento", "resolvido", "todos"].map((f) => (
          <button key={f} style={{ ...styles.filterBtn, ...(filter === f ? styles.filterBtnActive : {}) }} onClick={() => setFilter(f)} type="button">
            {f === "todos" ? "Todos" : STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      <div style={styles.layout}>
        <div style={styles.ticketList}>
          {loading ? (
            <p style={styles.dim}>Carregando...</p>
          ) : filtered.length === 0 ? (
            <p style={styles.dim}>Nenhum chamado nessa situação.</p>
          ) : (
            filtered.map((t) => (
              <button key={t.id} style={{ ...styles.ticketItem, ...(selectedId === t.id ? styles.ticketItemActive : {}) }} onClick={() => openTicket(t.id)} type="button">
                <span style={styles.ticketCompany}>{t.companies?.name}</span>
                <span style={styles.ticketSubject}>{t.subject}</span>
                <span style={{ ...styles.badge, ...statusStyle(t.status) }}>{STATUS_LABEL[t.status]}</span>
              </button>
            ))
          )}
        </div>

        {selectedId && (
          <div style={styles.thread}>
            <div style={styles.threadHeader}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{selectedTicket?.companies?.name}</div>
                <div style={{ fontSize: 12.5, color: "var(--text-dim)" }}>{selectedTicket?.subject}</div>
              </div>
              <select style={styles.statusSelect} value={selectedTicket?.status ?? "aberto"} disabled={changingStatus} onChange={(e) => changeStatus(e.target.value)}>
                {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div style={styles.messagesBox}>
              {messages.map((m) => (
                <div key={m.id} style={{ ...styles.message, ...(m.is_admin_reply ? styles.messageAdmin : styles.messageMine) }}>
                  <span style={styles.messageAuthor}>{m.is_admin_reply ? "Você (ProdOS)" : "Cliente"}</span>
                  <p style={styles.messageText}>{m.message}</p>
                  <span style={styles.messageDate}>{new Date(m.created_at).toLocaleString("pt-BR")}</span>
                </div>
              ))}
            </div>
            <div style={styles.replyRow}>
              <input style={styles.replyInput} value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Responder..." onKeyDown={(e) => e.key === "Enter" && sendReply()} />
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
  return { background: "rgba(92,143,217,0.15)", color: "#5C8FD9" };
}

const styles = {
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0" },
  dim: { color: "var(--text-dim)", fontSize: 13 },
  filterRow: { display: "flex", gap: 8, marginBottom: 16 },
  filterBtn: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "7px 14px", fontSize: 12.5, fontWeight: 600, color: "var(--text-dim)", cursor: "pointer",
  },
  filterBtnActive: { background: "var(--amber)", color: "#FFFFFF", borderColor: "var(--amber)" },
  layout: { display: "grid", gridTemplateColumns: "280px 1fr", gap: 16, alignItems: "start" },
  ticketList: { display: "flex", flexDirection: "column", gap: 8 },
  ticketItem: {
    display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start",
    background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "10px 12px", cursor: "pointer", textAlign: "left",
  },
  ticketItemActive: { borderColor: "var(--amber)", borderWidth: 2 },
  ticketCompany: { fontSize: 11, color: "var(--text-dim)", fontWeight: 700, textTransform: "uppercase" },
  ticketSubject: { fontSize: 13, fontWeight: 600 },
  badge: { padding: "2px 8px", borderRadius: 20, fontSize: 10.5, fontWeight: 700, marginTop: 2 },
  thread: {
    background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: 16, display: "flex", flexDirection: "column", gap: 12, minHeight: 300,
  },
  threadHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--line)", paddingBottom: 12 },
  statusSelect: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "6px 10px", fontSize: 12.5, color: "var(--text)",
  },
  messagesBox: { display: "flex", flexDirection: "column", gap: 10, maxHeight: 400, overflowY: "auto" },
  message: { padding: "8px 12px", borderRadius: "var(--radius)", maxWidth: "80%" },
  messageMine: { background: "var(--panel-2)", alignSelf: "flex-start" },
  messageAdmin: { background: "rgba(232,163,61,0.1)", alignSelf: "flex-end" },
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
