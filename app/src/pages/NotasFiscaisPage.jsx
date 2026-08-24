import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { Link } from "react-router-dom";

const STATUS_LABEL = { processando: "Processando", autorizado: "Autorizada", erro: "Erro", cancelado: "Cancelada" };

/**
 * Notas Fiscais: emite NF-e a partir de um Pedido de Venda (via
 * Focus NFe) e mostra o histórico com acesso ao DANFE. A emissão
 * assíncrona é atualizada automaticamente pelo webhook do Focus.
 */
export default function NotasFiscaisPage() {
  const { company } = useAuth();
  const [orders, setOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [orderId, setOrderId] = useState("");
  const [emitting, setEmitting] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadOrders() {
    const { data } = await supabase
      .from("sales_orders")
      .select("id, code, total_value, customers:customer_id (name)")
      .order("order_date", { ascending: false });
    setOrders(data ?? []);
  }

  async function loadInvoices() {
    setLoading(true);
    const { data } = await supabase
      .from("invoices")
      .select("id, ref, status, chave_nfe, numero, serie, valor_total, danfe_url, error_message, created_at, sales_orders:sales_order_id (code), customers:customer_id (name)")
      .order("created_at", { ascending: false });
    setInvoices(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (company?.id) { loadOrders(); loadInvoices(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  async function emit() {
    if (!company?.id || !orderId) return;
    setEmitting(true);
    setError("");

    const { data, error } = await supabase.functions.invoke("emit-nfe", {
      body: { companyId: company.id, salesOrderId: orderId },
    });

    if (error || data?.error) {
      setError(data?.error ?? "Não foi possível emitir a NF-e. Tente novamente em instantes.");
    } else {
      setOrderId("");
      await loadInvoices();
    }
    setEmitting(false);
  }

  const fiscalIncomplete = !company?.focus_nfe_token || !company?.logradouro;

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={styles.title}>Notas Fiscais</h1>
        <p style={styles.subtitle}>Emita NF-e a partir de um Pedido de Venda, via Focus NFe.</p>
      </header>

      {fiscalIncomplete && (
        <div style={styles.notice}>
          Antes de emitir, complete a{" "}
          <Link to="/fiscal" style={styles.link}>Configuração Fiscal</Link> (endereço da empresa e
          token do Focus NFe).
        </div>
      )}

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.form}>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>Pedido de Venda</span>
          <select style={styles.input} value={orderId} onChange={(e) => setOrderId(e.target.value)}>
            <option value="">Selecione...</option>
            {orders.map((o) => (
              <option key={o.id} value={o.id}>{o.code} — {o.customers?.name} — R$ {Number(o.total_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</option>
            ))}
          </select>
        </label>
        <button style={styles.emitBtn} onClick={emit} disabled={!orderId || emitting || fiscalIncomplete} type="button">
          {emitting ? "Emitindo..." : "Emitir NF-e"}
        </button>
      </div>

      <div style={styles.wrap}>
        <h2 style={styles.title2}>Histórico</h2>
        {loading ? (
          <p style={styles.dim}>Carregando...</p>
        ) : invoices.length === 0 ? (
          <p style={styles.dim}>Nenhuma nota emitida ainda.</p>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Pedido</th><th style={styles.th}>Cliente</th><th style={styles.th}>Número</th>
                  <th style={styles.th}>Valor</th><th style={styles.th}>Status</th><th style={styles.th}>Data</th><th style={styles.th}></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td style={styles.td}>{inv.sales_orders?.code ?? "—"}</td>
                    <td style={styles.td}>{inv.customers?.name ?? "—"}</td>
                    <td style={styles.td}>{inv.numero ? `${inv.numero}/${inv.serie}` : "—"}</td>
                    <td style={styles.td}>R$ {Number(inv.valor_total ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                    <td style={styles.td}>
                      <span style={{ ...styles.badge, ...statusStyle(inv.status) }}>{STATUS_LABEL[inv.status]}</span>
                      {inv.status === "erro" && inv.error_message && (
                        <div style={styles.errorDetail}>{inv.error_message}</div>
                      )}
                    </td>
                    <td style={styles.td}>{new Date(inv.created_at).toLocaleString("pt-BR")}</td>
                    <td style={styles.td}>
                      {inv.danfe_url && (
                        <a href={inv.danfe_url} target="_blank" rel="noreferrer" style={styles.danfeLink}>DANFE</a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function statusStyle(status) {
  if (status === "autorizado") return { background: "rgba(79,174,126,0.15)", color: "var(--green)" };
  if (status === "erro") return { background: "rgba(217,105,95,0.15)", color: "var(--red)" };
  if (status === "cancelado") return { background: "rgba(138,135,128,0.15)", color: "var(--text-dim)" };
  return { background: "rgba(232,163,61,0.15)", color: "var(--amber)" };
}

const styles = {
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  title2: { fontFamily: "var(--font-display)", fontSize: 18, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0" },
  dim: { color: "var(--text-dim)", fontSize: 14 },
  wrap: { marginTop: 32, paddingTop: 24, borderTop: "1px solid var(--line)" },
  notice: {
    background: "rgba(232,163,61,0.1)", border: "1px solid var(--amber)", color: "var(--text)",
    borderRadius: "var(--radius)", padding: "12px 16px", fontSize: 13, lineHeight: 1.5, maxWidth: 620, marginBottom: 16,
  },
  link: { color: "var(--amber)", fontWeight: 600 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  fieldLabel: { fontSize: 11, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" },
  input: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "9px 10px", color: "var(--text)", fontSize: 13, minWidth: 320,
  },
  form: {
    display: "flex", gap: 12, alignItems: "end",
    background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: 20, marginBottom: 20, maxWidth: 720,
  },
  emitBtn: {
    background: "var(--amber)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)",
    padding: "9px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer", height: 38,
  },
  tableWrap: { border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden", overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em",
    color: "var(--text-dim)", padding: "10px 14px", background: "var(--panel)", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap",
  },
  td: { padding: "10px 14px", fontSize: 13.5, background: "var(--panel)", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" },
  badge: { padding: "3px 10px", borderRadius: 20, fontSize: 11.5, fontWeight: 700 },
  errorDetail: { fontSize: 11, color: "var(--red)", marginTop: 4, whiteSpace: "normal", maxWidth: 260 },
  danfeLink: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "5px 10px", fontSize: 12, fontWeight: 700, color: "var(--amber)", textDecoration: "none",
  },
  error: {
    background: "rgba(217,105,95,0.12)", border: "1px solid var(--red)", color: "var(--red)",
    borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 13, marginBottom: 16, maxWidth: 720,
  },
};
