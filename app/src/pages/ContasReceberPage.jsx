import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

export default function ContasReceberPage() {
  const { company } = useAuth();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("financial_entries")
      .select("id, description, amount, due_date, paid, installment_number, total_installments, customers:customer_id (name), sales_orders:sales_order_id (code)")
      .eq("entry_type", "receita")
      .not("sales_order_id", "is", null)
      .order("due_date", { ascending: true });
    setEntries(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (company?.id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  async function togglePaid(id, current) {
    await supabase.from("financial_entries").update({ paid: !current }).eq("id", id);
    load();
  }

  const totalPending = entries.filter((e) => !e.paid).reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={styles.title}>Contas a Receber</h1>
        <p style={styles.subtitle}>
          Parcelas geradas a partir de Pedidos de Venda faturados. Total em aberto:{" "}
          <strong style={{ color: "var(--amber)" }}>R$ {totalPending.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong>
        </p>
      </header>

      {loading ? (
        <p style={styles.dim}>Carregando...</p>
      ) : entries.length === 0 ? (
        <p style={styles.dim}>
          Nenhuma conta a receber ainda. Gere parcelas a partir de um Pedido de Venda faturado
          em Comercial → Pedidos de Venda.
        </p>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Descrição</th>
                <th style={styles.th}>Cliente</th>
                <th style={styles.th}>Parcela</th>
                <th style={styles.th}>Valor</th>
                <th style={styles.th}>Vencimento</th>
                <th style={styles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td style={styles.td}>{e.description}</td>
                  <td style={styles.td}>{e.customers?.name ?? "—"}</td>
                  <td style={styles.td}>{e.installment_number ? `${e.installment_number}/${e.total_installments}` : "—"}</td>
                  <td style={styles.td}>R$ {Number(e.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                  <td style={styles.td}>{e.due_date ? new Date(e.due_date + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</td>
                  <td style={styles.td}>
                    <button
                      style={{ ...styles.statusBtn, ...(e.paid ? styles.paidBtn : styles.pendingBtn) }}
                      onClick={() => togglePaid(e.id, e.paid)}
                      type="button"
                    >
                      {e.paid ? "Recebido" : "Pendente"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const styles = {
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0", maxWidth: 640, lineHeight: 1.5 },
  dim: { color: "var(--text-dim)", fontSize: 14, maxWidth: 500 },
  tableWrap: { border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden", overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em",
    color: "var(--text-dim)", padding: "10px 14px", background: "var(--panel)", borderBottom: "1px solid var(--line)",
  },
  td: { padding: "10px 14px", fontSize: 13.5, background: "var(--panel)", borderBottom: "1px solid var(--line)" },
  statusBtn: {
    border: "none", borderRadius: "var(--radius)", padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer",
  },
  paidBtn: { background: "rgba(79,174,126,0.15)", color: "var(--green)" },
  pendingBtn: { background: "rgba(232,163,61,0.15)", color: "var(--amber)" },
};
