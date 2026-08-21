import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

/**
 * Gestão de Crédito e Cobrança: cruza o limite de crédito de cada
 * cliente (Cadastro → Clientes) com o total em aberto em Contas a
 * Receber, pra dizer se ele ainda pode comprar fiado. Pra quem está
 * atrasado, gera uma mensagem de cobrança pronta (WhatsApp/e-mail),
 * com tom mais leve pra atrasos recentes e mais firme pra atrasos
 * antigos.
 */
export default function CreditoCobrancaPage() {
  const { company } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [openMessageFor, setOpenMessageFor] = useState(null);

  useEffect(() => {
    if (company?.id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  async function load() {
    setLoading(true);
    const [{ data: customers }, { data: entries }, { data: contacts }] = await Promise.all([
      supabase.from("customers").select("id, name, credit_limit").order("name"),
      supabase
        .from("financial_entries")
        .select("customer_id, amount, due_date, paid")
        .eq("entry_type", "receita")
        .eq("paid", false)
        .not("customer_id", "is", null),
      supabase.from("contacts").select("customer_id, name, email, phone").not("customer_id", "is", null),
    ]);

    const today = new Date().toISOString().slice(0, 10);
    const openByCustomer = {};
    const overdueByCustomer = {};
    (entries ?? []).forEach((e) => {
      openByCustomer[e.customer_id] = (openByCustomer[e.customer_id] ?? 0) + Number(e.amount);
      if (e.due_date < today) {
        if (!overdueByCustomer[e.customer_id]) overdueByCustomer[e.customer_id] = { total: 0, oldestDueDate: e.due_date };
        overdueByCustomer[e.customer_id].total += Number(e.amount);
        if (e.due_date < overdueByCustomer[e.customer_id].oldestDueDate) overdueByCustomer[e.customer_id].oldestDueDate = e.due_date;
      }
    });

    const contactByCustomer = {};
    (contacts ?? []).forEach((c) => {
      if (!contactByCustomer[c.customer_id]) contactByCustomer[c.customer_id] = c;
    });

    const result = (customers ?? []).map((c) => {
      const openTotal = openByCustomer[c.id] ?? 0;
      const overdue = overdueByCustomer[c.id];
      const creditLimit = Number(c.credit_limit ?? 0);
      const available = creditLimit - openTotal;
      const daysOverdue = overdue ? Math.floor((new Date(today) - new Date(overdue.oldestDueDate)) / 86400000) : 0;
      return {
        ...c,
        creditLimit,
        openTotal,
        available,
        overdueTotal: overdue?.total ?? 0,
        daysOverdue,
        contact: contactByCustomer[c.id],
      };
    });

    result.sort((a, b) => b.overdueTotal - a.overdueTotal || b.openTotal - a.openTotal);
    setRows(result);
    setLoading(false);
  }

  const totalOverdue = rows.reduce((sum, r) => sum + r.overdueTotal, 0);
  const blockedCount = rows.filter((r) => r.available < 0).length;

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={styles.title}>Gestão de Crédito e Cobrança</h1>
        <p style={styles.subtitle}>
          Compara o limite de crédito de cada cliente (Cadastro → Clientes) com o total em aberto
          em Contas a Receber, e monta mensagens de cobrança pra quem está atrasado.
        </p>
      </header>

      <div style={styles.summaryRow}>
        <div style={styles.summaryCard}>
          <span style={styles.summaryLabel}>Total em atraso</span>
          <span style={{ ...styles.summaryValue, color: "var(--red)" }}>
            R$ {totalOverdue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </span>
        </div>
        <div style={styles.summaryCard}>
          <span style={styles.summaryLabel}>Clientes acima do limite</span>
          <span style={{ ...styles.summaryValue, color: blockedCount > 0 ? "var(--red)" : "var(--green)" }}>{blockedCount}</span>
        </div>
      </div>

      {loading ? (
        <p style={styles.dim}>Calculando...</p>
      ) : rows.length === 0 ? (
        <p style={styles.dim}>Nenhum cliente cadastrado ainda.</p>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Cliente</th>
                <th style={styles.th}>Limite de crédito</th>
                <th style={styles.th}>Em aberto</th>
                <th style={styles.th}>Disponível</th>
                <th style={styles.th}>Em atraso</th>
                <th style={styles.th}>Situação</th>
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <RowWithMessage key={r.id} row={r} open={openMessageFor === r.id} onToggle={() => setOpenMessageFor(openMessageFor === r.id ? null : r.id)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RowWithMessage({ row: r, open, onToggle }) {
  const message = useMemo(() => (r.overdueTotal > 0 ? buildCollectionMessage(r) : null), [r]);
  const whatsappLink = r.contact?.phone
    ? `https://wa.me/55${r.contact.phone.replace(/\D/g, "")}?text=${encodeURIComponent(message ?? "")}`
    : null;
  const mailtoLink = r.contact?.email
    ? `mailto:${r.contact.email}?subject=${encodeURIComponent(`Cobrança — ${r.name}`)}&body=${encodeURIComponent(message ?? "")}`
    : null;

  return (
    <>
      <tr>
        <td style={styles.td}>{r.name}</td>
        <td style={styles.td}>R$ {r.creditLimit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
        <td style={styles.td}>R$ {r.openTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
        <td style={{ ...styles.td, color: r.available < 0 ? "var(--red)" : "var(--green)", fontWeight: 700 }}>
          R$ {r.available.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
        </td>
        <td style={{ ...styles.td, color: r.overdueTotal > 0 ? "var(--red)" : "var(--text-dim)" }}>
          {r.overdueTotal > 0
            ? `R$ ${r.overdueTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (${r.daysOverdue}d)`
            : "—"}
        </td>
        <td style={styles.td}>
          <span style={{ ...styles.badge, ...situationStyle(r) }}>{situationLabel(r)}</span>
        </td>
        <td style={{ ...styles.td, textAlign: "right" }}>
          {r.overdueTotal > 0 && (
            <button style={styles.msgBtn} onClick={onToggle} type="button">
              {open ? "Fechar" : "Cobrar"}
            </button>
          )}
        </td>
      </tr>
      {open && message && (
        <tr>
          <td colSpan={7} style={{ ...styles.td, background: "var(--panel-2)" }}>
            <div style={styles.messageBox}>
              <textarea style={styles.textarea} readOnly value={message} rows={4} />
              <div style={styles.messageActions}>
                {whatsappLink && (
                  <a style={{ ...styles.msgLink, ...styles.whatsappLink }} href={whatsappLink} target="_blank" rel="noreferrer">
                    Enviar por WhatsApp
                  </a>
                )}
                {mailtoLink && (
                  <a style={styles.msgLink} href={mailtoLink}>Enviar por e-mail</a>
                )}
                {!whatsappLink && !mailtoLink && (
                  <span style={styles.dim}>Cadastre telefone ou e-mail em Cadastro → Contatos pra enviar direto.</span>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function situationLabel(r) {
  if (r.overdueTotal > 0) return "Em atraso";
  if (r.available < 0) return "Limite estourado";
  return "Ok";
}

function situationStyle(r) {
  if (r.overdueTotal > 0) return { background: "rgba(217,105,95,0.15)", color: "var(--red)" };
  if (r.available < 0) return { background: "rgba(232,163,61,0.15)", color: "var(--amber)" };
  return { background: "rgba(79,174,126,0.15)", color: "var(--green)" };
}

function buildCollectionMessage({ name, overdueTotal, daysOverdue }) {
  const valueStr = `R$ ${overdueTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  if (daysOverdue <= 7) {
    return `Olá, ${name}! Tudo bem? Passando pra lembrar que há um valor de ${valueStr} em aberto, vencido há ${daysOverdue} dia(s). Qualquer dúvida sobre o pagamento, é só chamar por aqui. Obrigado!`;
  }
  if (daysOverdue <= 30) {
    return `Olá, ${name}. Notamos que o valor de ${valueStr} está em aberto há ${daysOverdue} dias. Poderia nos confirmar a previsão de pagamento? Ficamos à disposição pra combinar a melhor forma.`;
  }
  return `Olá, ${name}. O valor de ${valueStr} está em atraso há ${daysOverdue} dias e precisamos regularizar essa pendência o quanto antes. Pedimos que entre em contato conosco ainda hoje pra tratarmos do pagamento.`;
}

const styles = {
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0", maxWidth: 680, lineHeight: 1.5 },
  dim: { color: "var(--text-dim)", fontSize: 13 },
  summaryRow: { display: "flex", gap: 14, marginBottom: 20 },
  summaryCard: {
    background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "14px 20px", display: "flex", flexDirection: "column", gap: 4, minWidth: 200,
  },
  summaryLabel: { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-dim)", fontWeight: 700 },
  summaryValue: { fontFamily: "var(--font-display)", fontSize: 20 },
  tableWrap: { border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden", overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em",
    color: "var(--text-dim)", padding: "10px 14px", background: "var(--panel)", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap",
  },
  td: { padding: "10px 14px", fontSize: 13.5, background: "var(--panel)", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" },
  badge: { padding: "3px 10px", borderRadius: 20, fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap" },
  msgBtn: {
    background: "var(--amber)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)",
    padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer",
  },
  messageBox: { display: "flex", flexDirection: "column", gap: 10, whiteSpace: "normal", padding: "8px 0" },
  textarea: {
    width: "100%", maxWidth: 640, background: "var(--panel)", border: "1px solid var(--line)",
    borderRadius: "var(--radius)", padding: 10, color: "var(--text)", fontSize: 13, resize: "vertical",
  },
  messageActions: { display: "flex", gap: 10, alignItems: "center" },
  msgLink: {
    display: "inline-block", background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "8px 14px", fontSize: 12.5, fontWeight: 700, color: "var(--text)", textDecoration: "none",
  },
  whatsappLink: { background: "rgba(79,174,126,0.15)", color: "var(--green)", borderColor: "transparent" },
};
