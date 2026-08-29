import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

const STATUS_LABEL = {
  pending_payment: "Aguardando pagamento",
  active: "Ativa",
  overdue: "Pagamento em atraso",
  canceled: "Cancelada",
  vitalicio: "Vitalícia",
};

const STATUS_COLOR = {
  pending_payment: "var(--amber)",
  active: "var(--green)",
  overdue: "var(--red)",
  canceled: "var(--red)",
  vitalicio: "var(--blue, #2563EB)",
};

export default function AssinaturaPage() {
  const { profile, company, refreshCompany } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingPlanId, setProcessingPlanId] = useState("");
  const [confirmingPlanId, setConfirmingPlanId] = useState("");
  const [canceling, setCanceling] = useState(false);
  const [error, setError] = useState("");
  const [userCount, setUserCount] = useState(null);

  async function loadPlans() {
    setLoading(true);
    const { data } = await supabase.from("plans").select("*").eq("active", true).eq("product_key", "prodos").order("sort_order");
    setPlans(data ?? []);
    setLoading(false);
  }

  async function loadUserCount() {
    const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("company_id", profile.company_id);
    setUserCount(count ?? 0);
  }

  useEffect(() => {
    loadPlans();
    if (profile?.company_id) loadUserCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.company_id]);

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

  // "Assinar" nunca gera a cobrança na hora — primeiro pede confirmação
  // (segundo clique), pra ninguém criar uma cobrança real sem querer.
  async function confirmAndSubscribe(plan) {
    setError("");
    setConfirmingPlanId("");
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

  async function cancelSubscription() {
    if (!window.confirm("Cancelar sua assinatura? O acesso aos recursos do plano continua até o fim do período já pago.")) return;
    setCanceling(true);
    setError("");

    const { data, error } = await supabase.functions.invoke("cancel-subscription", {
      body: { companyId: profile.company_id },
    });

    if (error || data?.error) {
      setError("Não foi possível cancelar a assinatura agora. Tente novamente em instantes.");
    } else {
      await refreshCompany();
    }
    setCanceling(false);
  }

  const currentPlanId = company?.plan_id;

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
        {["active","vitalicio"].includes(company?.subscription_status) && (
          <button style={styles.cancelBtn} onClick={cancelSubscription} disabled={canceling} type="button">
            {canceling ? "Cancelando..." : "Cancelar assinatura"}
          </button>
        )}
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {loading ? (
        <p style={styles.dim}>Carregando planos...</p>
      ) : (
        <div style={styles.grid}>
          {plans.map((plan) => {
            const isCurrent = plan.id === currentPlanId && ["active","vitalicio"].includes(company?.subscription_status);
            const hasPromo = plan.promo_active && plan.promo_price != null;
            const basePrice = hasPromo ? Number(plan.promo_price) : Number(plan.price);
            const extraSeats = Math.max((userCount ?? 0) - (plan.included_users ?? 2), 0);
            const totalWithSeats = basePrice + extraSeats * Number(plan.extra_user_price ?? 0);

            return (
              <div key={plan.id} style={{ ...styles.card, ...(isCurrent ? styles.cardCurrent : {}) }}>
                {isCurrent && <div style={styles.currentTag}>Seu plano atual</div>}
                <h2 style={styles.planName}>{plan.name}</h2>
                <div style={styles.price}>
                  {hasPromo && (
                    <span style={styles.priceOld}>R$ {Number(plan.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  )}
                  R$ {basePrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  <span style={styles.priceSuffix}>/mês</span>
                </div>
                {hasPromo && plan.promo_description && <p style={styles.promoText}>{plan.promo_description}</p>}
                {Number(plan.adesao_price) > 0 && (
                  <p style={styles.adesaoInfo}>
                    + R$ {Number(plan.adesao_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} de adesão (única vez, na contratação)
                  </p>
                )}
                <p style={styles.description}>{plan.description}</p>
                <p style={styles.seatsInfo}>
                  Inclui até {plan.included_users ?? 2} usuário{(plan.included_users ?? 2) !== 1 ? "s" : ""}
                  {Number(plan.extra_user_price) > 0 && ` — usuário extra: R$ ${Number(plan.extra_user_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês`}
                </p>
                {extraSeats > 0 && (
                  <p style={styles.seatsWarning}>
                    Sua empresa tem {userCount} usuários ({extraSeats} acima do plano) — total real:{" "}
                    <strong>R$ {totalWithSeats.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês</strong>
                  </p>
                )}
                <div style={styles.featuresList}>
                  {(plan.features ?? []).map((f) => <span key={f} style={styles.featureTag}>{f}</span>)}
                </div>
                {confirmingPlanId === plan.id ? (
                  <div style={styles.confirmBox}>
                    <p style={styles.confirmText}>
                      Confirma assinar o <strong>{plan.name}</strong>?
                      {Number(plan.adesao_price) > 0 && (
                        <> Você vai pagar <strong>R$ {Number(plan.adesao_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} de adesão</strong> (única vez) e depois</>
                      )}{" "}
                      <strong>R$ {totalWithSeats.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês</strong>.
                      Isso gera cobrança real no Asaas.
                    </p>
                    <div style={styles.confirmActions}>
                      <button style={styles.confirmYesBtn} onClick={() => confirmAndSubscribe(plan)} type="button">
                        Sim, assinar
                      </button>
                      <button style={styles.confirmNoBtn} onClick={() => setConfirmingPlanId("")} type="button">
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    style={{ ...styles.subscribeBtn, ...(isCurrent ? styles.subscribeBtnDisabled : {}) }}
                    onClick={() => setConfirmingPlanId(plan.id)}
                    disabled={isCurrent || processingPlanId === plan.id}
                    type="button"
                  >
                    {isCurrent ? "Plano atual" : processingPlanId === plan.id ? "Gerando link..." : "Assinar este plano"}
                  </button>
                )}
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
  cancelBtn: {
    background: "transparent", border: "1px solid var(--red)", color: "var(--red)",
    borderRadius: "var(--radius)", padding: "8px 14px", fontWeight: 700, fontSize: 12.5, cursor: "pointer",
  },
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
  priceOld: { fontSize: 15, color: "var(--text-dim)", textDecoration: "line-through", marginRight: 8, fontWeight: 400 },
  promoText: { fontSize: 12, color: "var(--green)", fontWeight: 700, margin: "2px 0 0" },
  seatsInfo: { fontSize: 11.5, color: "var(--text-dim)", margin: "6px 0 0", lineHeight: 1.4 },
  adesaoInfo: { fontSize: 11.5, color: "var(--amber)", fontWeight: 700, margin: "2px 0 0" },
  seatsWarning: {
    fontSize: 11.5, color: "var(--amber)", margin: "6px 0 0", lineHeight: 1.4,
    background: "rgba(232,163,61,0.1)", padding: "6px 8px", borderRadius: 6,
  },
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
  confirmBox: {
    background: "var(--panel-2)", border: "1px solid var(--amber)", borderRadius: "var(--radius)", padding: 12,
  },
  confirmText: { fontSize: 12.5, lineHeight: 1.5, margin: "0 0 10px" },
  confirmActions: { display: "flex", gap: 8 },
  confirmYesBtn: {
    flex: 1, background: "var(--amber)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)",
    padding: "9px 0", fontWeight: 700, fontSize: 12.5, cursor: "pointer",
  },
  confirmNoBtn: {
    flex: 1, background: "transparent", border: "1px solid var(--line)", color: "var(--text-dim)", borderRadius: "var(--radius)",
    padding: "9px 0", fontWeight: 600, fontSize: 12.5, cursor: "pointer",
  },
  error: {
    background: "rgba(217,105,95,0.12)", border: "1px solid var(--red)", color: "var(--red)",
    borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 13, marginBottom: 16, maxWidth: 640,
  },
};
