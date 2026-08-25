import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import ModulePage from "../components/ModulePage";

/**
 * Apontamento de Produção. A tela abre com um fluxo rápido, feito
 * pra celular/tablet no chão de fábrica: escolhe a OP (botão grande),
 * escolhe a etapa (botão grande), ajusta a quantidade com +/- grandes,
 * e registra num toque. A tabela completa (pra quem edita pelo
 * computador) continua disponível embaixo.
 */
export default function ApontamentoProducaoPage() {
  const { company } = useAuth();
  const [orders, setOrders] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [stages, setStages] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!company?.id) return;
    loadBaseData();
  }, [company?.id]);

  function loadBaseData() {
    supabase.from("production_orders").select("id, code, products:product_id (name)").in("status", ["planejada", "em_andamento"]).order("code").then(({ data }) => setOrders(data ?? []));
    supabase.from("employees").select("id, full_name").eq("status", "ativo").order("full_name").then(({ data }) => setEmployees(data ?? []));
    supabase.from("production_stages").select("id, name").order("sort_order").then(({ data }) => setStages(data ?? []));
  }

  const orderOptions = orders.map((o) => ({ value: o.id, label: o.code }));
  const employeeOptions = employees.map((e) => ({ value: e.id, label: e.full_name }));
  const stageOptions = stages.map((s) => ({ value: s.id, label: s.name }));

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={styles.title}>Apontamento de Produção</h1>
        <p style={styles.subtitle}>Registre o que foi produzido — o progresso da OP é atualizado sozinho.</p>
      </header>

      <QuickApontamento orders={orders} stages={stages} employees={employees} onSaved={() => { loadBaseData(); setRefreshKey((k) => k + 1); }} />

      <div style={styles.wrap}>
        <h2 style={styles.title2}>Histórico completo</h2>
        <ModulePage
          key={refreshKey}
          table="production_time_logs"
          title=""
          subtitle=""
          emptyLabel="Nenhum apontamento registrado ainda."
          fields={[
            { key: "production_order_id", label: "Ordem de Produção", type: "select", options: orderOptions, required: true },
            { key: "employee_id", label: "Colaborador", type: "select", options: employeeOptions },
            { key: "stage_id", label: "Etapa", type: "select", options: stageOptions },
            { key: "log_date", label: "Data", type: "date", required: true },
            { key: "start_time", label: "Início", type: "time" },
            { key: "end_time", label: "Fim", type: "time" },
            { key: "hours", label: "Horas trabalhadas", type: "number", placeholder: "Ex: 4.5" },
            { key: "quantity_produced", label: "Qtd. produzida", type: "number", placeholder: "Ex: 50" },
            { key: "quantity_scrapped", label: "Qtd. refugada", type: "number", placeholder: "Ex: 2" },
            { key: "notes", label: "Observações", placeholder: "Campo livre" },
          ]}
        />
      </div>
    </div>
  );
}

function QuickApontamento({ orders, stages, employees, onSaved }) {
  const { company } = useAuth();
  const [step, setStep] = useState(1);
  const [orderId, setOrderId] = useState("");
  const [stageId, setStageId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [produced, setProduced] = useState(0);
  const [scrapped, setScrapped] = useState(0);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  function reset() {
    setStep(1); setOrderId(""); setStageId(""); setEmployeeId(""); setProduced(0); setScrapped(0);
  }

  async function handleSave() {
    setSaving(true);
    await supabase.from("production_time_logs").insert({
      company_id: company.id,
      production_order_id: orderId,
      stage_id: stageId || null,
      employee_id: employeeId || null,
      log_date: new Date().toISOString().slice(0, 10),
      quantity_produced: produced || 0,
      quantity_scrapped: scrapped || 0,
    });
    setSaving(false);
    setSuccess(true);
    onSaved();
    setTimeout(() => { setSuccess(false); reset(); }, 1800);
  }

  if (success) {
    return (
      <div style={styles.quickCard}>
        <div style={styles.successBox}>✓ Apontamento registrado!</div>
      </div>
    );
  }

  return (
    <div style={styles.quickCard}>
      <p style={styles.quickLabel}>Apontamento rápido</p>

      {step === 1 && (
        <>
          <p style={styles.stepLabel}>1. Qual ordem de produção?</p>
          {orders.length === 0 ? (
            <p style={styles.dim}>Nenhuma ordem em aberto no momento.</p>
          ) : (
            <div style={styles.bigButtonGrid}>
              {orders.map((o) => (
                <button key={o.id} type="button" style={styles.bigButton} onClick={() => { setOrderId(o.id); setStep(2); }}>
                  <span style={styles.bigButtonCode}>{o.code}</span>
                  <span style={styles.bigButtonSub}>{o.products?.name}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {step === 2 && (
        <>
          <p style={styles.stepLabel}>2. Em qual etapa?</p>
          <div style={styles.bigButtonGrid}>
            {stages.map((s) => (
              <button key={s.id} type="button" style={styles.bigButton} onClick={() => { setStageId(s.id); setStep(3); }}>
                <span style={styles.bigButtonCode}>{s.name}</span>
              </button>
            ))}
          </div>
          <button style={styles.backLink} onClick={() => setStep(1)} type="button">← Voltar</button>
        </>
      )}

      {step === 3 && (
        <>
          <p style={styles.stepLabel}>3. Quem apontou? (opcional)</p>
          <div style={styles.bigButtonGrid}>
            <button
              type="button"
              style={{ ...styles.bigButton, ...(employeeId === "" ? styles.bigButtonActive : {}) }}
              onClick={() => setEmployeeId("")}
            >
              <span style={styles.bigButtonCode}>Não informar</span>
            </button>
            {employees.map((e) => (
              <button
                key={e.id} type="button"
                style={{ ...styles.bigButton, ...(employeeId === e.id ? styles.bigButtonActive : {}) }}
                onClick={() => setEmployeeId(e.id)}
              >
                <span style={styles.bigButtonCode}>{e.full_name}</span>
              </button>
            ))}
          </div>
          <button style={styles.nextBtn} onClick={() => setStep(4)} type="button">Continuar →</button>
          <button style={styles.backLink} onClick={() => setStep(2)} type="button">← Voltar</button>
        </>
      )}

      {step === 4 && (
        <>
          <p style={styles.stepLabel}>4. Quanto foi produzido?</p>
          <Stepper label="Produzido" value={produced} onChange={setProduced} color="var(--green)" />
          <Stepper label="Refugado" value={scrapped} onChange={setScrapped} color="var(--red)" />
          <button style={styles.saveBtn} onClick={handleSave} disabled={saving} type="button">
            {saving ? "Salvando..." : "✓ Registrar apontamento"}
          </button>
          <button style={styles.backLink} onClick={() => setStep(3)} type="button">← Voltar</button>
        </>
      )}
    </div>
  );
}

function Stepper({ label, value, onChange, color }) {
  return (
    <div style={styles.stepperRow}>
      <span style={styles.stepperLabel}>{label}</span>
      <div style={styles.stepperControls}>
        <button type="button" style={styles.stepperBtn} onClick={() => onChange(Math.max(0, Number(value) - 1))}>−</button>
        <span style={{ ...styles.stepperValue, color }}>{value}</span>
        <button type="button" style={styles.stepperBtn} onClick={() => onChange(Number(value) + 1)}>+</button>
      </div>
    </div>
  );
}

const styles = {
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  title2: { fontFamily: "var(--font-display)", fontSize: 16, margin: "0 0 12px" },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0" },
  dim: { color: "var(--text-dim)", fontSize: 13 },
  wrap: { marginTop: 32, paddingTop: 24, borderTop: "1px solid var(--line)" },
  quickCard: {
    background: "var(--panel)", border: "2px solid var(--amber)", borderRadius: "var(--radius)",
    padding: 20, marginBottom: 28, maxWidth: 520,
  },
  quickLabel: { fontSize: 11, color: "var(--amber)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 12px" },
  stepLabel: { fontSize: 15, fontWeight: 700, margin: "0 0 14px" },
  bigButtonGrid: { display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 },
  bigButton: {
    display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2,
    background: "var(--panel-2)", border: "2px solid var(--line)", borderRadius: "var(--radius)",
    padding: "16px 18px", cursor: "pointer", textAlign: "left", minHeight: 56,
  },
  bigButtonActive: { borderColor: "var(--amber)", background: "rgba(232,163,61,0.1)" },
  bigButtonCode: { fontSize: 16, fontWeight: 700, color: "var(--text)" },
  bigButtonSub: { fontSize: 12.5, color: "var(--text-dim)" },
  backLink: { background: "transparent", border: "none", color: "var(--text-dim)", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "6px 0" },
  nextBtn: {
    width: "100%", background: "var(--amber)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)",
    padding: "14px 0", fontWeight: 700, fontSize: 15, cursor: "pointer", marginBottom: 6,
  },
  saveBtn: {
    width: "100%", background: "var(--green)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)",
    padding: "16px 0", fontWeight: 700, fontSize: 16, cursor: "pointer", marginBottom: 6, marginTop: 6,
  },
  stepperRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  stepperLabel: { fontSize: 14, fontWeight: 600 },
  stepperControls: { display: "flex", alignItems: "center", gap: 14 },
  stepperBtn: {
    width: 48, height: 48, borderRadius: "50%", border: "2px solid var(--line)", background: "var(--panel-2)",
    fontSize: 24, fontWeight: 700, color: "var(--text)", cursor: "pointer",
  },
  stepperValue: { fontSize: 26, fontWeight: 800, fontFamily: "var(--font-display)", minWidth: 40, textAlign: "center" },
  successBox: { textAlign: "center", fontSize: 18, fontWeight: 700, color: "var(--green)", padding: "20px 0" },
};
