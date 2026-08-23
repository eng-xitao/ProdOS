import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

const SEVERITY_LABEL = { baixa: "Baixa", media: "Média", alta: "Alta" };
const STATUS_LABEL = { aberta: "Aberta", em_tratativa: "Em tratativa", resolvida: "Resolvida" };

/**
 * Não Conformidades: registro do que deu errado na produção — qual
 * OP, qual etapa, gravidade — e acompanhamento até resolver. Ajuda a
 * enxergar padrões (mesmo defeito se repetindo na mesma etapa).
 */
export default function QualidadeNaoConformidadesPage() {
  const { company, profile } = useAuth();
  const [items, setItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("aberta");

  const [showForm, setShowForm] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [stageId, setStageId] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("media");
  const [saving, setSaving] = useState(false);

  const [resolvingId, setResolvingId] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");

  async function loadAll() {
    setLoading(true);
    const [ncRes, ordersRes, stagesRes] = await Promise.all([
      supabase.from("quality_nonconformities").select("id, description, severity, status, resolution_notes, created_at, resolved_at, production_orders:production_order_id (code), production_stages:stage_id (name)").order("created_at", { ascending: false }),
      supabase.from("production_orders").select("id, code").order("code"),
      supabase.from("production_stages").select("id, name").order("sort_order"),
    ]);
    setItems(ncRes.data ?? []);
    setOrders(ordersRes.data ?? []);
    setStages(stagesRes.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (company?.id) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  async function createNonconformity(e) {
    e.preventDefault();
    if (!company?.id || !description) return;
    setSaving(true);
    await supabase.from("quality_nonconformities").insert({
      company_id: company.id,
      production_order_id: orderId || null,
      stage_id: stageId || null,
      description, severity,
      reported_by: profile.id,
    });
    setOrderId(""); setStageId(""); setDescription(""); setSeverity("media"); setShowForm(false);
    await loadAll();
    setSaving(false);
  }

  async function updateStatus(id, status) {
    const payload = { status };
    if (status === "resolvida") {
      payload.resolved_at = new Date().toISOString();
      payload.resolution_notes = resolutionNotes || null;
    }
    await supabase.from("quality_nonconformities").update(payload).eq("id", id);
    setResolvingId(""); setResolutionNotes("");
    await loadAll();
  }

  const filtered = filter === "todas" ? items : items.filter((i) => i.status === filter);

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={styles.title}>Não Conformidades</h1>
        <p style={styles.subtitle}>Registro do que deu errado na produção e o que foi feito a respeito.</p>
      </header>

      <button style={styles.addBtn} onClick={() => setShowForm((v) => !v)} type="button">
        {showForm ? "Cancelar" : "+ Registrar não conformidade"}
      </button>

      {showForm && (
        <form onSubmit={createNonconformity} style={styles.form}>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Ordem de Produção (opcional)</span>
            <select style={styles.input} value={orderId} onChange={(e) => setOrderId(e.target.value)}>
              <option value="">Selecione...</option>
              {orders.map((o) => <option key={o.id} value={o.id}>{o.code}</option>)}
            </select>
          </label>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Etapa (opcional)</span>
            <select style={styles.input} value={stageId} onChange={(e) => setStageId(e.target.value)}>
              <option value="">Selecione...</option>
              {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Gravidade</span>
            <select style={styles.input} value={severity} onChange={(e) => setSeverity(e.target.value)}>
              {Object.entries(SEVERITY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label style={{ ...styles.field, gridColumn: "1 / -1" }}>
            <span style={styles.fieldLabel}>O que aconteceu</span>
            <textarea style={styles.textarea} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} required />
          </label>
          <button style={styles.submitBtn} type="submit" disabled={saving}>{saving ? "Salvando..." : "Registrar"}</button>
        </form>
      )}

      <div style={styles.filterRow}>
        {["aberta", "em_tratativa", "resolvida", "todas"].map((f) => (
          <button key={f} style={{ ...styles.filterBtn, ...(filter === f ? styles.filterBtnActive : {}) }} onClick={() => setFilter(f)} type="button">
            {f === "todas" ? "Todas" : STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={styles.dim}>Carregando...</p>
      ) : filtered.length === 0 ? (
        <p style={styles.dim}>Nenhuma não conformidade nessa situação.</p>
      ) : (
        <div style={styles.list}>
          {filtered.map((i) => (
            <div key={i.id} style={styles.card}>
              <div style={styles.cardHeader}>
                <div style={styles.cardTags}>
                  {i.production_orders?.code && <span style={styles.tag}>{i.production_orders.code}</span>}
                  {i.production_stages?.name && <span style={styles.tag}>{i.production_stages.name}</span>}
                  <span style={{ ...styles.badge, ...severityStyle(i.severity) }}>{SEVERITY_LABEL[i.severity]}</span>
                </div>
                <span style={{ ...styles.badge, ...statusStyle(i.status) }}>{STATUS_LABEL[i.status]}</span>
              </div>
              <p style={styles.description}>{i.description}</p>
              {i.resolution_notes && <p style={styles.resolution}>Resolução: {i.resolution_notes}</p>}
              <span style={styles.date}>{new Date(i.created_at).toLocaleString("pt-BR")}</span>

              {i.status !== "resolvida" && (
                <div style={styles.cardActions}>
                  {i.status === "aberta" && (
                    <button style={styles.actionBtn} onClick={() => updateStatus(i.id, "em_tratativa")} type="button">Marcar em tratativa</button>
                  )}
                  {resolvingId === i.id ? (
                    <div style={styles.resolveForm}>
                      <input style={styles.input} value={resolutionNotes} onChange={(e) => setResolutionNotes(e.target.value)} placeholder="O que foi feito pra resolver?" />
                      <button style={styles.resolveBtn} onClick={() => updateStatus(i.id, "resolvida")} type="button">Confirmar resolução</button>
                    </div>
                  ) : (
                    <button style={styles.resolveBtn} onClick={() => setResolvingId(i.id)} type="button">Marcar como resolvida</button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function severityStyle(s) {
  if (s === "alta") return { background: "rgba(217,105,95,0.15)", color: "var(--red)" };
  if (s === "media") return { background: "rgba(232,163,61,0.15)", color: "var(--amber)" };
  return { background: "rgba(79,174,126,0.15)", color: "var(--green)" };
}

function statusStyle(s) {
  if (s === "resolvida") return { background: "rgba(79,174,126,0.15)", color: "var(--green)" };
  if (s === "em_tratativa") return { background: "rgba(232,163,61,0.15)", color: "var(--amber)" };
  return { background: "rgba(217,105,95,0.15)", color: "var(--red)" };
}

const styles = {
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0" },
  dim: { color: "var(--text-dim)", fontSize: 14 },
  addBtn: {
    background: "var(--amber)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)",
    padding: "9px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", marginBottom: 16,
  },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  fieldLabel: { fontSize: 11, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" },
  input: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "9px 10px", color: "var(--text)", fontSize: 13, flex: 1,
  },
  textarea: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "9px 10px", color: "var(--text)", fontSize: 13, resize: "vertical",
  },
  form: {
    display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14,
    background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: 20, marginBottom: 20, maxWidth: 720,
  },
  submitBtn: {
    gridColumn: "1 / -1", background: "var(--green)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)",
    padding: "10px 0", fontWeight: 700, fontSize: 13, cursor: "pointer",
  },
  filterRow: { display: "flex", gap: 8, marginBottom: 16 },
  filterBtn: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "7px 14px", fontSize: 12.5, fontWeight: 600, color: "var(--text-dim)", cursor: "pointer",
  },
  filterBtnActive: { background: "var(--amber)", color: "#FFFFFF", borderColor: "var(--amber)" },
  list: { display: "flex", flexDirection: "column", gap: 12, maxWidth: 720 },
  card: { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 16 },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  cardTags: { display: "flex", gap: 6, flexWrap: "wrap" },
  tag: { fontSize: 11, background: "var(--panel-2)", padding: "3px 8px", borderRadius: 6, color: "var(--text-dim)", fontWeight: 600 },
  badge: { padding: "3px 10px", borderRadius: 20, fontSize: 11.5, fontWeight: 700 },
  description: { fontSize: 13.5, margin: "8px 0", lineHeight: 1.5 },
  resolution: { fontSize: 12.5, color: "var(--green)", margin: "4px 0" },
  date: { fontSize: 11, color: "var(--text-dim)" },
  cardActions: { display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" },
  actionBtn: {
    background: "transparent", border: "1px solid var(--amber)", color: "var(--amber)", borderRadius: "var(--radius)",
    padding: "7px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer",
  },
  resolveBtn: {
    background: "var(--green)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)",
    padding: "7px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer",
  },
  resolveForm: { display: "flex", gap: 8, flex: 1, minWidth: 260 },
};
