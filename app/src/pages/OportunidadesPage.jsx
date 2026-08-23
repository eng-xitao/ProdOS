import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { Link } from "react-router-dom";
import CurrencyInput from "../components/CurrencyInput";

const INTERACTION_LABEL = { ligacao: "Ligação", reuniao: "Reunião", email: "E-mail", nota: "Nota" };

/**
 * Oportunidades: Kanban de verdade (arraste os cards entre as
 * etapas), com painel do funil no topo, histórico de interações por
 * oportunidade, e marcação de Ganha/Perdida separada da etapa.
 */
export default function OportunidadesPage() {
  const { company, profile } = useAuth();
  const [stages, setStages] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [draggingId, setDraggingId] = useState("");

  const [showNewForm, setShowNewForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCustomerId, setNewCustomerId] = useState("");
  const [newValue, setNewValue] = useState(0);
  const [newDate, setNewDate] = useState("");
  const [creating, setCreating] = useState(false);

  async function loadAll() {
    const [stagesRes, oppsRes, customersRes] = await Promise.all([
      supabase.from("opportunity_stages").select("id, name").order("sort_order", { ascending: true }),
      supabase.from("opportunities").select("id, title, customer_id, stage_id, estimated_value, expected_close_date, status, created_at, customers:customer_id (name)").order("created_at", { ascending: false }),
      supabase.from("customers").select("id, name").order("name"),
    ]);
    setStages(stagesRes.data ?? []);
    setOpportunities(oppsRes.data ?? []);
    setCustomers(customersRes.data ?? []);
    setLoaded(true);
  }

  useEffect(() => {
    if (company?.id) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  const customerOptions = customers.map((c) => ({ value: c.id, label: c.name }));
  const openOpportunities = opportunities.filter((o) => o.status === "aberta");
  const selected = opportunities.find((o) => o.id === selectedId);

  const funnelMetrics = useMemo(() => {
    const totalOpen = openOpportunities.length;
    const totalOpenValue = openOpportunities.reduce((sum, o) => sum + Number(o.estimated_value ?? 0), 0);
    const won = opportunities.filter((o) => o.status === "ganha");
    const lost = opportunities.filter((o) => o.status === "perdida");
    const decided = won.length + lost.length;
    const conversionRate = decided > 0 ? (won.length / decided) * 100 : null;
    const wonValue = won.reduce((sum, o) => sum + Number(o.estimated_value ?? 0), 0);
    return { totalOpen, totalOpenValue, conversionRate, wonCount: won.length, lostCount: lost.length, wonValue };
  }, [opportunities, openOpportunities]);

  async function createOpportunity(e) {
    e.preventDefault();
    if (!company?.id || !newTitle || stages.length === 0) return;
    setCreating(true);
    const { error } = await supabase.from("opportunities").insert({
      company_id: company.id, title: newTitle, customer_id: newCustomerId || null,
      stage_id: stages[0].id, estimated_value: newValue, expected_close_date: newDate || null,
    });
    if (!error) {
      setNewTitle(""); setNewCustomerId(""); setNewValue(0); setNewDate(""); setShowNewForm(false);
      await loadAll();
    }
    setCreating(false);
  }

  async function moveToStage(oppId, stageId) {
    setOpportunities((prev) => prev.map((o) => (o.id === oppId ? { ...o, stage_id: stageId } : o)));
    await supabase.from("opportunities").update({ stage_id: stageId }).eq("id", oppId);
  }

  async function setStatus(oppId, status) {
    await supabase.from("opportunities").update({ status }).eq("id", oppId);
    setSelectedId("");
    await loadAll();
  }

  if (loaded && stages.length === 0) {
    return (
      <div style={styles.notice}>
        Antes de cadastrar oportunidades, configure ao menos uma etapa do seu funil em{" "}
        <Link to="/etapas-comercial" style={styles.link}>Comercial → Etapas</Link>.
      </div>
    );
  }

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={styles.title}>Oportunidades</h1>
        <p style={styles.subtitle}>Arraste os cards entre as etapas pra mover o funil.</p>
      </header>

      <div style={styles.metricsRow}>
        <MetricCard label="Abertas" value={funnelMetrics.totalOpen} />
        <MetricCard label="Valor em aberto" value={`R$ ${funnelMetrics.totalOpenValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} color="var(--amber)" wide />
        <MetricCard label="Taxa de conversão" value={funnelMetrics.conversionRate !== null ? `${funnelMetrics.conversionRate.toFixed(0)}%` : "—"} color="var(--green)" />
        <MetricCard label="Ganhas" value={funnelMetrics.wonCount} color="var(--green)" />
        <MetricCard label="Perdidas" value={funnelMetrics.lostCount} color="var(--red)" />
        <MetricCard label="Valor ganho" value={`R$ ${funnelMetrics.wonValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} color="var(--green)" wide />
      </div>

      <button style={styles.addBtn} onClick={() => setShowNewForm((v) => !v)} type="button">
        {showNewForm ? "Cancelar" : "+ Nova oportunidade"}
      </button>

      {showNewForm && (
        <form onSubmit={createOpportunity} style={styles.form}>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Título</span>
            <input style={styles.input} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Ex: Projeto reforma industrial" required />
          </label>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Cliente</span>
            <select style={styles.input} value={newCustomerId} onChange={(e) => setNewCustomerId(e.target.value)}>
              <option value="">Selecione...</option>
              {customerOptions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Valor estimado</span>
            <CurrencyInput value={newValue} onChange={setNewValue} />
          </label>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Previsão de fechamento</span>
            <input style={styles.input} type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          </label>
          <button style={styles.submitBtn} type="submit" disabled={creating}>{creating ? "Criando..." : "Criar"}</button>
        </form>
      )}

      <div style={styles.board}>
        {stages.map((stage) => {
          const stageOpps = openOpportunities.filter((o) => o.stage_id === stage.id);
          const stageValue = stageOpps.reduce((sum, o) => sum + Number(o.estimated_value ?? 0), 0);
          return (
            <div
              key={stage.id}
              style={styles.column}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => draggingId && moveToStage(draggingId, stage.id)}
            >
              <div style={styles.columnHeader}>
                <span style={styles.columnTitle}>{stage.name}</span>
                <span style={styles.columnSub}>{stageOpps.length} · R$ {stageValue.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</span>
              </div>
              <div style={styles.columnBody}>
                {stageOpps.map((o) => (
                  <div
                    key={o.id}
                    style={styles.card}
                    draggable
                    onDragStart={() => setDraggingId(o.id)}
                    onDragEnd={() => setDraggingId("")}
                    onClick={() => setSelectedId(o.id)}
                  >
                    <span style={styles.cardTitle}>{o.title}</span>
                    {o.customers?.name && <span style={styles.cardCustomer}>{o.customers.name}</span>}
                    <div style={styles.cardFooter}>
                      <span style={styles.cardValue}>R$ {Number(o.estimated_value ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</span>
                      {o.expected_close_date && <span style={styles.cardDate}>{new Date(o.expected_close_date + "T00:00:00").toLocaleDateString("pt-BR")}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <OpportunityPanel
          opportunity={selected}
          onClose={() => setSelectedId("")}
          onSetStatus={setStatus}
          companyId={company.id}
          profileId={profile.id}
        />
      )}
    </div>
  );
}

function OpportunityPanel({ opportunity, onClose, onSetStatus, companyId, profileId }) {
  const [interactions, setInteractions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState("nota");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("opportunity_interactions")
      .select("id, type, note, created_at")
      .eq("opportunity_id", opportunity.id)
      .order("created_at", { ascending: false });
    setInteractions(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [opportunity.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function addInteraction(e) {
    e.preventDefault();
    if (!note.trim()) return;
    setSaving(true);
    await supabase.from("opportunity_interactions").insert({
      company_id: companyId, opportunity_id: opportunity.id, author_profile_id: profileId, type, note,
    });
    setNote("");
    await load();
    setSaving(false);
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div style={styles.panelHeader}>
          <div>
            <h2 style={styles.panelTitle}>{opportunity.title}</h2>
            <span style={styles.panelSub}>{opportunity.customers?.name ?? "Sem cliente"}</span>
          </div>
          <button style={styles.closeBtn} onClick={onClose} type="button">✕</button>
        </div>

        <div style={styles.panelActions}>
          <button style={styles.winBtn} onClick={() => onSetStatus(opportunity.id, "ganha")} type="button">Marcar como Ganha</button>
          <button style={styles.loseBtn} onClick={() => onSetStatus(opportunity.id, "perdida")} type="button">Marcar como Perdida</button>
        </div>

        <div style={styles.panelBody}>
          <span style={styles.sectionLabel}>Histórico</span>
          {loading ? (
            <p style={styles.dim}>Carregando...</p>
          ) : interactions.length === 0 ? (
            <p style={styles.dim}>Nenhuma interação registrada ainda.</p>
          ) : (
            <div style={styles.interactionList}>
              {interactions.map((i) => (
                <div key={i.id} style={styles.interactionItem}>
                  <span style={styles.interactionType}>{INTERACTION_LABEL[i.type]}</span>
                  <p style={styles.interactionNote}>{i.note}</p>
                  <span style={styles.interactionDate}>{new Date(i.created_at).toLocaleString("pt-BR")}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={addInteraction} style={styles.interactionForm}>
          <select style={styles.typeSelect} value={type} onChange={(e) => setType(e.target.value)}>
            {Object.entries(INTERACTION_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input style={styles.noteInput} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex: Liguei, cliente decide semana que vem" />
          <button style={styles.addNoteBtn} type="submit" disabled={saving}>Adicionar</button>
        </form>
      </div>
    </div>
  );
}

function MetricCard({ label, value, color, wide }) {
  return (
    <div style={{ ...styles.metricCard, ...(wide ? { minWidth: 170 } : {}) }}>
      <span style={styles.metricLabel}>{label}</span>
      <span style={{ ...styles.metricValue, color: color ?? "var(--text)" }}>{value}</span>
    </div>
  );
}

const styles = {
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0" },
  dim: { color: "var(--text-dim)", fontSize: 12.5 },
  notice: {
    background: "rgba(232,163,61,0.1)", border: "1px solid var(--amber)", color: "var(--text)",
    borderRadius: "var(--radius)", padding: "14px 16px", fontSize: 13.5, lineHeight: 1.5, maxWidth: 620,
  },
  link: { color: "var(--amber)", fontWeight: 600 },
  metricsRow: { display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 },
  metricCard: {
    background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "12px 16px", display: "flex", flexDirection: "column", gap: 4, minWidth: 120,
  },
  metricLabel: { fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-dim)", fontWeight: 700 },
  metricValue: { fontFamily: "var(--font-display)", fontSize: 19 },
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
  form: {
    display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14,
    background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: 20, marginBottom: 20, alignItems: "end",
  },
  submitBtn: {
    background: "var(--green)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)",
    padding: "10px 0", fontWeight: 700, fontSize: 13, cursor: "pointer",
  },
  board: { display: "flex", gap: 14, overflowX: "auto", paddingBottom: 12 },
  column: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    minWidth: 260, maxWidth: 260, display: "flex", flexDirection: "column", maxHeight: 620,
  },
  columnHeader: { padding: "12px 14px", borderBottom: "1px solid var(--line)" },
  columnTitle: { fontSize: 13, fontWeight: 700, display: "block" },
  columnSub: { fontSize: 11, color: "var(--text-dim)" },
  columnBody: { padding: 10, display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" },
  card: {
    background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: 10, cursor: "grab", display: "flex", flexDirection: "column", gap: 4,
  },
  cardTitle: { fontSize: 12.5, fontWeight: 700 },
  cardCustomer: { fontSize: 11.5, color: "var(--text-dim)" },
  cardFooter: { display: "flex", justifyContent: "space-between", marginTop: 4 },
  cardValue: { fontSize: 12, fontWeight: 700, color: "var(--amber)" },
  cardDate: { fontSize: 11, color: "var(--text-dim)" },
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex",
    justifyContent: "flex-end", zIndex: 1000,
  },
  panel: {
    background: "var(--panel)", width: 420, maxWidth: "90vw", height: "100%", overflowY: "auto",
    padding: 24, display: "flex", flexDirection: "column", gap: 16,
  },
  panelHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  panelTitle: { fontFamily: "var(--font-display)", fontSize: 17, margin: 0 },
  panelSub: { fontSize: 12.5, color: "var(--text-dim)" },
  closeBtn: { background: "transparent", border: "none", color: "var(--text-dim)", fontSize: 16, cursor: "pointer" },
  panelActions: { display: "flex", gap: 8 },
  winBtn: {
    flex: 1, background: "var(--green)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)",
    padding: "9px 0", fontWeight: 700, fontSize: 12.5, cursor: "pointer",
  },
  loseBtn: {
    flex: 1, background: "transparent", border: "1px solid var(--red)", color: "var(--red)", borderRadius: "var(--radius)",
    padding: "9px 0", fontWeight: 700, fontSize: 12.5, cursor: "pointer",
  },
  panelBody: { display: "flex", flexDirection: "column", gap: 10, flex: 1 },
  sectionLabel: { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-dim)", fontWeight: 700 },
  interactionList: { display: "flex", flexDirection: "column", gap: 10 },
  interactionItem: { background: "var(--panel-2)", borderRadius: "var(--radius)", padding: "8px 10px" },
  interactionType: { fontSize: 10.5, fontWeight: 700, color: "var(--amber)", textTransform: "uppercase" },
  interactionNote: { fontSize: 13, margin: "4px 0", whiteSpace: "pre-wrap" },
  interactionDate: { fontSize: 10.5, color: "var(--text-dim)" },
  interactionForm: { display: "flex", flexDirection: "column", gap: 8 },
  typeSelect: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "8px 10px", fontSize: 12.5, color: "var(--text)",
  },
  noteInput: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "8px 10px", fontSize: 13, color: "var(--text)",
  },
  addNoteBtn: {
    background: "var(--amber)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)",
    padding: "9px 0", fontWeight: 700, fontSize: 12.5, cursor: "pointer",
  },
};
