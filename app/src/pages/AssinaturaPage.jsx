import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

const STATUS_LABEL = {
  trial: "Em período de teste",
  active: "Ativa",
  overdue: "Pagamento em atraso",
  canceled: "Cancelada",
};

const STATUS_COLOR = {
  trial: "var(--amber)",
  active: "var(--green)",
  overdue: "var(--red)",
  canceled: "var(--red)",
};

export default function AssinaturaPage() {
  const { profile, company, refreshCompany } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingPlanId, setProcessingPlanId] = useState("");
  const [error, setError] = useState("");

  async function loadPlans() {
    setLoading(true);
    const { data } = await supabase.from("plans").select("*").eq("active", true).order("sort_order");
    setPlans(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadPlans();
  }, []);

  useEffect(() => {
    // Quando a pessoa volta do checkout do Asaas, o parâmetro "status"
    // aparece na URL — recarrega os dados da empresa pra refletir
    // o pagamento (o webhook já deve ter atualizado o status).
    const params = new URLSearchParams(window.location.search);
    if (params.get("status")) {
      refreshCompany();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function subscribe(plan) {
    setError("");
    setProcessingPlanId(plan.id);

    const { data, error } = await supabase.functions.invoke("create-subscription", {
      body: { companyId: profile.company_id, plan: plan.key },
    });

    if (error || data?.error) {
      setError("Não foi possível gerar o link de pagamento agora. Tente novamente em instantes.");
      setProcessingPlanId("");
      return;
    }

    window.location.href = data.checkoutUrl;
  }

  const currentPlanId = company?.plan_id;
  const trialDaysLeft = company?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(company.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <h1 style={styles.title}>Assinatura</h1>
        <p style={styles.subtitle}>Escolha o plano que melhor atende sua empresa.</p>
      </header>

      <div style={styles.statusCard}>
        <div>
          <div style={styles.statusLabel}>Status atual</div>
          <div style={{ ...styles.statusValue, color: STATUS_COLOR[company?.subscription_status] }}>
            {STATUS_LABEL[company?.subscription_status] ?? "—"}
          </div>
        </div>
        {company?.subscription_status === "trial" && trialDaysLeft !== null && (
          <div style={styles.trialInfo}>
            {trialDaysLeft > 0 ? `${trialDaysLeft} dia${trialDaysLeft !== 1 ? "s" : ""} restante${trialDaysLeft !== 1 ? "s" : ""} de teste` : "Teste encerrado"}
          </div>
        )}
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {loading ? (
        <p style={styles.dim}>Carregando planos...</p>
      ) : (
        <div style={styles.grid}>
          {plans.map((plan) => {
            const isCurrent = plan.id === currentPlanId && company?.subscription_status === "active";
            return (
              <div key={plan.id} style={{ ...styles.card, ...(isCurrent ? styles.cardCurrent : {}) }}>
                {isCurrent && <div style={styles.currentTag}>Seu plano atual</div>}
                <h2 style={styles.planName}>{plan.name}</h2>
                <div style={styles.price}>
                  R$ {Number(plan.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  <span style={styles.priceSuffix}>/mês</span>
                </div>
                <p style={styles.description}>{plan.description}</p>
                <div style={styles.featuresList}>
                  {(plan.features ?? []).map((f) => <span key={f} style={styles.featureTag}>{f}</span>)}
                </div>
                <button
                  style={{ ...styles.subscribeBtn, ...(isCurrent ? styles.subscribeBtnDisabled : {}) }}
                  onClick={() => subscribe(plan)}
                  disabled={isCurrent || processingPlanId === plan.id}
                  type="button"
                >
                  {isCurrent ? "Plano atual" : processingPlanId === plan.id ? "Gerando link..." : "Assinar este plano"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles = {
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0" },
  dim: { color: "var(--text-dim)", fontSize: 14 },
  statusCard: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "16px 20px", marginBottom: 24, maxWidth: 640,
  },
  statusLabel: { fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.04em" },
  statusValue: { fontSize: 18, fontWeight: 700, marginTop: 4 },
  trialInfo: { fontSize: 13, color: "var(--text-dim)" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 },
  card: {
    background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: 22, position: "relative",
  },
  cardCurrent: { borderColor: "var(--amber)", borderWidth: 2 },
  currentTag: {
    position: "absolute", top: -10, left: 20, background: "var(--amber)", color: "#FFFFFF",
    fontSize: 10.5, fontWeight: 700, padding: "3px 10px", borderRadius: 20, textTransform: "uppercase",
  },
  planName: { fontFamily: "var(--font-display)", fontSize: 18, margin: "6px 0 4px" },
  price: { fontSize: 28, fontWeight: 700, color: "var(--amber)", margin: "8px 0 6px" },
  priceSuffix: { fontSize: 13, color: "var(--text-dim)", fontWeight: 400 },
  description: { fontSize: 13, color: "var(--text-dim)", lineHeight: 1.5, margin: "0 0 14px", minHeight: 38 },
  featuresList: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 },
  featureTag: {
    fontSize: 11.5, background: "var(--panel-2)", color: "var(--text)", padding: "3px 9px",
    borderRadius: 20, border: "1px solid var(--line)",
  },
  subscribeBtn: {
    width: "100%", background: "var(--amber)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)",
    padding: "11px 0", fontWeight: 700, fontSize: 13.5, cursor: "pointer",
  },
  subscribeBtnDisabled: { background: "var(--panel-2)", color: "var(--text-dim)", cursor: "default" },
  error: {
    background: "rgba(217,105,95,0.12)", border: "1px solid var(--red)", color: "var(--red)",
    borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 13, marginBottom: 16, maxWidth: 640,
  },
};
