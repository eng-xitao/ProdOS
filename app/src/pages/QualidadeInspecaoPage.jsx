import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { Link } from "react-router-dom";

/**
 * Inspeção de Qualidade: escolhe uma OP e a etapa em que ela está,
 * puxa automaticamente o checklist cadastrado pra essa etapa, e
 * registra aprovado/reprovado por item. Se algum item reprovar,
 * sugere abrir uma não conformidade.
 */
export default function QualidadeInspecaoPage() {
  const { company, profile } = useAuth();
  const [orders, setOrders] = useState([]);
  const [checklistItems, setChecklistItems] = useState([]);
  const [orderId, setOrderId] = useState("");
  const [results, setResults] = useState({}); // item_id -> boolean
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState([]);
  const [saved, setSaved] = useState(false);

  async function loadOrders() {
    const { data } = await supabase
      .from("production_orders")
      .select("id, code, stage_id, products:product_id (name), production_stages:stage_id (name)")
      .neq("status", "concluida")
      .order("code");
    setOrders(data ?? []);
  }

  async function loadHistory() {
    const { data } = await supabase
      .from("quality_inspections")
      .select("id, overall_status, created_at, production_orders:production_order_id (code), production_stages:stage_id (name)")
      .order("created_at", { ascending: false })
      .limit(15);
    setHistory(data ?? []);
  }

  useEffect(() => {
    if (company?.id) { loadOrders(); loadHistory(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  const selectedOrder = orders.find((o) => o.id === orderId);

  useEffect(() => {
    async function loadChecklist() {
      if (!selectedOrder?.stage_id) { setChecklistItems([]); return; }
      const { data } = await supabase
        .from("quality_checklist_items")
        .select("id, item_text")
        .eq("stage_id", selectedOrder.stage_id)
        .order("sort_order");
      setChecklistItems(data ?? []);
      setResults({});
    }
    loadChecklist();
  }, [selectedOrder?.stage_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const allAnswered = checklistItems.length > 0 && checklistItems.every((it) => results[it.id] !== undefined);
  const hasFailure = useMemo(() => Object.values(results).some((v) => v === false), [results]);

  async function saveInspection() {
    if (!company?.id || !orderId || !allAnswered) return;
    setSaving(true);
    setSaved(false);

    const resultsPayload = checklistItems.map((it) => ({ item_text: it.item_text, passed: results[it.id] }));

    await supabase.from("quality_inspections").insert({
      company_id: company.id,
      production_order_id: orderId,
      stage_id: selectedOrder.stage_id,
      inspector_profile_id: profile.id,
      results: resultsPayload,
      overall_status: hasFailure ? "reprovado" : "aprovado",
      notes: notes || null,
    });

    setOrderId(""); setResults({}); setNotes("");
    setSaved(true);
    await loadHistory();
    setSaving(false);
  }

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={styles.title}>Inspeção de Qualidade</h1>
        <p style={styles.subtitle}>
          Escolha a OP — o checklist da etapa em que ela está aparece automaticamente, configurado
          em PCP → Checklist de Qualidade.
        </p>
      </header>

      {saved && <div style={styles.success}>Inspeção registrada.</div>}

      <label style={styles.field}>
        <span style={styles.fieldLabel}>Ordem de Produção</span>
        <select style={styles.input} value={orderId} onChange={(e) => { setOrderId(e.target.value); setSaved(false); }}>
          <option value="">Selecione...</option>
          {orders.map((o) => (
            <option key={o.id} value={o.id}>{o.code} — {o.products?.name} ({o.production_stages?.name ?? "sem etapa"})</option>
          ))}
        </select>
      </label>

      {orderId && checklistItems.length === 0 && (
        <div style={styles.notice}>
          Nenhum checklist cadastrado pra etapa "{selectedOrder?.production_stages?.name}" ainda. Cadastre em{" "}
          <Link to="/qualidade/checklist" style={styles.link}>PCP → Checklist de Qualidade</Link>.
        </div>
      )}

      {orderId && checklistItems.length > 0 && (
        <>
          <div style={styles.checklistBox}>
            {checklistItems.map((it) => (
              <div key={it.id} style={styles.checklistRow}>
                <span style={styles.checklistText}>{it.item_text}</span>
                <div style={styles.checklistBtns}>
                  <button
                    style={{ ...styles.checkBtn, ...(results[it.id] === true ? styles.checkBtnPass : {}) }}
                    onClick={() => setResults((r) => ({ ...r, [it.id]: true }))}
                    type="button"
                  >
                    Aprovado
                  </button>
                  <button
                    style={{ ...styles.checkBtn, ...(results[it.id] === false ? styles.checkBtnFail : {}) }}
                    onClick={() => setResults((r) => ({ ...r, [it.id]: false }))}
                    type="button"
                  >
                    Reprovado
                  </button>
                </div>
              </div>
            ))}
          </div>

          <label style={styles.field}>
            <span style={styles.fieldLabel}>Observações (opcional)</span>
            <textarea style={styles.textarea} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>

          {hasFailure && (
            <div style={styles.warning}>
              Um ou mais itens reprovados. Depois de salvar, considere abrir uma{" "}
              <Link to="/qualidade/nao-conformidades" style={styles.link}>Não Conformidade</Link>.
            </div>
          )}

          <button style={styles.saveBtn} onClick={saveInspection} disabled={!allAnswered || saving} type="button">
            {saving ? "Salvando..." : "Salvar inspeção"}
          </button>
        </>
      )}

      <div style={styles.wrap}>
        <h2 style={styles.title2}>Últimas inspeções</h2>
        {history.length === 0 ? (
          <p style={styles.dim}>Nenhuma inspeção registrada ainda.</p>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr><th style={styles.th}>OP</th><th style={styles.th}>Etapa</th><th style={styles.th}>Resultado</th><th style={styles.th}>Data</th></tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td style={styles.td}>{h.production_orders?.code}</td>
                    <td style={styles.td}>{h.production_stages?.name}</td>
                    <td style={styles.td}>
                      <span style={{ ...styles.badge, ...(h.overall_status === "aprovado" ? styles.badgePass : styles.badgeFail) }}>
                        {h.overall_status === "aprovado" ? "Aprovado" : "Reprovado"}
                      </span>
                    </td>
                    <td style={styles.td}>{new Date(h.created_at).toLocaleString("pt-BR")}</td>
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

const styles = {
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  title2: { fontFamily: "var(--font-display)", fontSize: 18, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0", maxWidth: 640, lineHeight: 1.5 },
  dim: { color: "var(--text-dim)", fontSize: 14 },
  wrap: { marginTop: 32, paddingTop: 24, borderTop: "1px solid var(--line)" },
  field: { display: "flex", flexDirection: "column", gap: 6, marginTop: 16, marginBottom: 16, maxWidth: 480 },
  fieldLabel: { fontSize: 11, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" },
  input: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "9px 10px", color: "var(--text)", fontSize: 13,
  },
  textarea: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "9px 10px", color: "var(--text)", fontSize: 13, resize: "vertical",
  },
  notice: {
    background: "rgba(232,163,61,0.1)", border: "1px solid var(--amber)", color: "var(--text)",
    borderRadius: "var(--radius)", padding: "12px 16px", fontSize: 13, lineHeight: 1.5, maxWidth: 560, marginBottom: 16,
  },
  warning: {
    background: "rgba(217,105,95,0.1)", border: "1px solid var(--red)", color: "var(--text)",
    borderRadius: "var(--radius)", padding: "12px 16px", fontSize: 13, lineHeight: 1.5, maxWidth: 560, marginBottom: 16,
  },
  success: {
    background: "rgba(79,174,126,0.1)", border: "1px solid var(--green)", color: "var(--green)",
    borderRadius: "var(--radius)", padding: "10px 14px", fontSize: 13, marginBottom: 16, maxWidth: 560,
  },
  link: { color: "var(--amber)", fontWeight: 600 },
  checklistBox: { display: "flex", flexDirection: "column", gap: 8, maxWidth: 620, marginBottom: 8 },
  checklistRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
    background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: "10px 14px",
  },
  checklistText: { fontSize: 13.5, flex: 1 },
  checklistBtns: { display: "flex", gap: 6, flexShrink: 0 },
  checkBtn: {
    background: "var(--panel-2)", border: "1px solid var(--line)", color: "var(--text-dim)", borderRadius: "var(--radius)",
    padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer",
  },
  checkBtnPass: { background: "rgba(79,174,126,0.15)", borderColor: "var(--green)", color: "var(--green)" },
  checkBtnFail: { background: "rgba(217,105,95,0.15)", borderColor: "var(--red)", color: "var(--red)" },
  saveBtn: {
    background: "var(--amber)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)",
    padding: "10px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer",
  },
  tableWrap: { border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden", overflowX: "auto", maxWidth: 700 },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em",
    color: "var(--text-dim)", padding: "10px 14px", background: "var(--panel)", borderBottom: "1px solid var(--line)",
  },
  td: { padding: "10px 14px", fontSize: 13.5, background: "var(--panel)", borderBottom: "1px solid var(--line)" },
  badge: { padding: "3px 10px", borderRadius: 20, fontSize: 11.5, fontWeight: 700 },
  badgePass: { background: "rgba(79,174,126,0.15)", color: "var(--green)" },
  badgeFail: { background: "rgba(217,105,95,0.15)", color: "var(--red)" },
};
