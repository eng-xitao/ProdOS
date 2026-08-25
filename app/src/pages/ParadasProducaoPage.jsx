import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

const REASON_LABEL = {
  falta_material: "Falta de material",
  quebra_maquina: "Quebra de máquina",
  falta_operador: "Falta de operador",
  troca_ferramenta: "Troca de ferramenta",
  manutencao_preventiva: "Manutenção preventiva",
  outro: "Outro",
};

/**
 * Paradas de Produção: registra quando uma etapa parou de produzir
 * e por quê — isso alimenta a análise de gargalos.
 */
export default function ParadasProducaoPage() {
  const { company } = useAuth();
  const [orders, setOrders] = useState([]);
  const [stages, setStages] = useState([]);
  const [stoppages, setStoppages] = useState([]);
  const [loading, setLoading] = useState(true);

  const [orderId, setOrderId] = useState("");
  const [stageId, setStageId] = useState("");
  const [reason, setReason] = useState("falta_material");
  const [description, setDescription] = useState("");
  const [startedAt, setStartedAt] = useState("");
  const [minutes, setMinutes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadAll() {
    setLoading(true);
    const [{ data: ordersData }, { data: stagesData }, { data: stoppagesData }] = await Promise.all([
      supabase.from("production_orders").select("id, code").order("code", { ascending: false }).limit(100),
      supabase.from("production_stages").select("id, name").order("sort_order"),
      supabase
        .from("production_stoppages")
        .select("id, reason, description, started_at, minutes, production_orders:production_order_id (code), production_stages:stage_id (name)")
        .order("started_at", { ascending: false })
        .limit(100),
    ]);
    setOrders(ordersData ?? []);
    setStages(stagesData ?? []);
    setStoppages(stoppagesData ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (company?.id) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  async function handleSave(e) {
    e.preventDefault();
    setError("");
    if (!stageId) { setError("Escolha a etapa onde ocorreu a parada."); return; }
    if (!minutes || Number(minutes) <= 0) { setError("Informe a duração da parada em minutos."); return; }
    setSaving(true);

    const { error: insertError } = await supabase.from("production_stoppages").insert({
      company_id: company.id,
      production_order_id: orderId || null,
      stage_id: stageId,
      reason,
      description: description || null,
      started_at: startedAt ? new Date(startedAt).toISOString() : new Date().toISOString(),
      minutes: Number(minutes),
    });

    if (insertError) {
      setError(insertError.message);
    } else {
      setOrderId(""); setStageId(""); setReason("falta_material"); setDescription(""); setStartedAt(""); setMinutes("");
      await loadAll();
    }
    setSaving(false);
  }

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={styles.title}>Paradas de Produção</h1>
        <p style={styles.subtitle}>Registre quando uma etapa parou de produzir e por quê — isso alimenta a análise de gargalos.</p>
      </header>

      {error && <div style={styles.error}>{error}</div>}

      <form onSubmit={handleSave} style={styles.form}>
        <div style={styles.row}>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Ordem de Produção (opcional)</span>
            <select style={styles.input} value={orderId} onChange={(e) => setOrderId(e.target.value)}>
              <option value="">— Não vinculada a uma OP —</option>
              {orders.map((o) => <option key={o.id} value={o.id}>{o.code}</option>)}
            </select>
          </label>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Etapa</span>
            <select style={styles.input} value={stageId} onChange={(e) => setStageId(e.target.value)} required>
              <option value="">Selecione...</option>
              {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        </div>

        <div style={styles.row}>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Motivo</span>
            <select style={styles.input} value={reason} onChange={(e) => setReason(e.target.value)}>
              {Object.entries(REASON_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Duração (minutos)</span>
            <input style={styles.input} type="number" min="1" value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="Ex: 45" />
          </label>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Data/hora (opcional)</span>
            <input style={styles.input} type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} />
          </label>
        </div>

        <label style={styles.field}>
          <span style={styles.fieldLabel}>Descrição (opcional)</span>
          <input style={styles.input} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalhe o que aconteceu" />
        </label>

        <button style={styles.saveBtn} type="submit" disabled={saving}>{saving ? "Salvando..." : "Registrar parada"}</button>
      </form>

      <div style={styles.wrap}>
        <h2 style={styles.title2}>Últimas paradas registradas</h2>
        {loading ? (
          <p style={styles.dim}>Carregando...</p>
        ) : stoppages.length === 0 ? (
          <p style={styles.dim}>Nenhuma parada registrada ainda.</p>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr><th style={styles.th}>Etapa</th><th style={styles.th}>OP</th><th style={styles.th}>Motivo</th><th style={styles.th}>Duração</th><th style={styles.th}>Quando</th></tr>
              </thead>
              <tbody>
                {stoppages.map((s) => (
                  <tr key={s.id}>
                    <td style={styles.td}>{s.production_stages?.name ?? "—"}</td>
                    <td style={styles.td}>{s.production_orders?.code ?? "—"}</td>
                    <td style={styles.td}>{REASON_LABEL[s.reason]}</td>
                    <td style={styles.td}>{s.minutes} min</td>
                    <td style={styles.td}>{new Date(s.started_at).toLocaleString("pt-BR")}</td>
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
  title2: { fontFamily: "var(--font-display)", fontSize: 18, margin: "0 0 12px" },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0" },
  dim: { color: "var(--text-dim)", fontSize: 13 },
  form: {
    display: "flex", flexDirection: "column", gap: 14,
    background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: 20, marginBottom: 28, maxWidth: 720,
  },
  row: { display: "flex", gap: 14, flexWrap: "wrap" },
  field: { display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 160 },
  fieldLabel: { fontSize: 11, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" },
  input: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "9px 10px", color: "var(--text)", fontSize: 13,
  },
  saveBtn: {
    background: "var(--amber)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)",
    padding: "10px 0", fontWeight: 700, fontSize: 13, cursor: "pointer",
  },
  wrap: { marginTop: 8 },
  tableWrap: { border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden", overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em",
    color: "var(--text-dim)", padding: "10px 14px", background: "var(--panel)", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap",
  },
  td: { padding: "10px 14px", fontSize: 13.5, background: "var(--panel)", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" },
  error: {
    background: "rgba(217,105,95,0.12)", border: "1px solid var(--red)", color: "var(--red)",
    borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 13, marginBottom: 16, maxWidth: 720,
  },
};
