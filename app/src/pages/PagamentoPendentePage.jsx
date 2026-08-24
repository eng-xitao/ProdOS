import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import logoFull from "../assets/logo-full.png";

/**
 * Tela exibida no lugar do sistema pra empresas que ainda não
 * pagaram a primeira mensalidade. Não existe mais período de teste —
 * o acesso só libera depois que o pagamento é confirmado (o webhook
 * do Asaas atualiza subscription_status pra 'active' automaticamente).
 */
export default function PagamentoPendentePage({ status }) {
  const { profile, signOut } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingPlanId, setProcessingPlanId] = useState("");
  const [confirmingPlanId, setConfirmingPlanId] = useState("");
  const [error, setError] = useState("");

  async function loadPlans() {
    setLoading(true);
    const { data } = await supabase.from("plans").select("*").eq("active", true).order("sort_order");
    setPlans(data ?? []);
    setLoading(false);
  }

  useEffect(() => { loadPlans(); }, []);

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

  const isOverdue = status === "overdue";
  const isCanceled = status === "canceled";

  return (
    <div style={styles.wrap}>
      <div style={styles.panel}>
        <img src={logoFull} alt="ProdOS" style={styles.logo} />
        <h1 style={styles.title}>
          {isOverdue ? "Pagamento em atraso" : isCanceled ? "Assinatura cancelada" : "Escolha um plano pra começar"}
        </h1>
        <p style={styles.text}>
          {isOverdue
            ? "Identificamos que o pagamento da sua assinatura venceu. Regularize abaixo pra voltar a acessar o ProdOS."
            : isCanceled
              ? "Sua assinatura foi cancelada. Escolha um plano abaixo pra reativar o acesso."
              : "Não existe período de teste — escolha um plano abaixo e conclua o primeiro pagamento pra liberar o acesso completo."}
        </p>

        {error && <div style={styles.error}>{error}</div>}

        {loading ? (
          <p style={styles.dim}>Carregando planos...</p>
        ) : (
          <div style={styles.grid}>
            {plans.map((plan) => {
              const hasPromo = plan.promo_active && plan.promo_price != null;
              const basePrice = hasPromo ? Number(plan.promo_price) : Number(plan.price);
              return (
                <div key={plan.id} style={styles.card}>
                  <h2 style={styles.planName}>{plan.name}</h2>
                  <div style={styles.price}>
                    {hasPromo && <span style={styles.priceOld}>R$ {Number(plan.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>}
                    R$ {basePrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    <span style={styles.priceSuffix}>/mês</span>
                  </div>
                  <p style={styles.description}>{plan.description}</p>
                  <p style={styles.seatsInfo}>
                    Inclui {plan.included_users ?? 2} usuário(s){Number(plan.extra_user_price) > 0 && ` — extra: R$${Number(plan.extra_user_price).toLocaleString("pt-BR")}/usuário`}
                  </p>

                  {confirmingPlanId === plan.id ? (
                    <div style={styles.confirmBox}>
                      <p style={styles.confirmText}>
                        Confirma assinar o <strong>{plan.name}</strong> por{" "}
                        <strong>R$ {basePrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês</strong>?
                      </p>
                      <div style={styles.confirmActions}>
                        <button style={styles.confirmYesBtn} onClick={() => confirmAndSubscribe(plan)} type="button">Sim, pagar</button>
                        <button style={styles.confirmNoBtn} onClick={() => setConfirmingPlanId("")} type="button">Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <button style={styles.subscribeBtn} onClick={() => setConfirmingPlanId(plan.id)} disabled={processingPlanId === plan.id} type="button">
                      {processingPlanId === plan.id ? "Gerando link..." : "Assinar este plano"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <button style={styles.signOutBtn} onClick={signOut} type="button">Sair</button>
      </div>
    </div>
  );
}

const styles = {
  wrap: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: 20 },
  panel: { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: "40px 36px", maxWidth: 900, textAlign: "center" },
  logo: { height: 40, marginBottom: 20 },
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: "0 0 10px" },
  text: { color: "var(--text-dim)", fontSize: 14, lineHeight: 1.6, margin: "0 0 24px", maxWidth: 560, marginLeft: "auto", marginRight: "auto" },
  dim: { color: "var(--text-dim)", fontSize: 14 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 },
  card: { background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 20, textAlign: "left" },
  planName: { fontSize: 16, margin: "0 0 6px" },
  price: { fontFamily: "var(--font-display)", fontSize: 22, color: "var(--amber)", marginBottom: 8 },
  priceOld: { fontSize: 14, color: "var(--text-dim)", textDecoration: "line-through", marginRight: 6, fontWeight: 400 },
  priceSuffix: { fontSize: 12, color: "var(--text-dim)", fontWeight: 400 },
  description: { fontSize: 12.5, color: "var(--text-dim)", margin: "0 0 6px" },
  seatsInfo: { fontSize: 11, color: "var(--text-dim)", marginBottom: 14 },
  subscribeBtn: { width: "100%", background: "var(--amber)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)", padding: "10px 0", fontWeight: 700, fontSize: 13, cursor: "pointer" },
  confirmBox: { background: "var(--panel)", border: "1px solid var(--amber)", borderRadius: "var(--radius)", padding: 12 },
  confirmText: { fontSize: 12, lineHeight: 1.5, margin: "0 0 10px" },
  confirmActions: { display: "flex", gap: 8 },
  confirmYesBtn: { flex: 1, background: "var(--amber)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)", padding: "8px 0", fontWeight: 700, fontSize: 12, cursor: "pointer" },
  confirmNoBtn: { flex: 1, background: "transparent", border: "1px solid var(--line)", color: "var(--text-dim)", borderRadius: "var(--radius)", padding: "8px 0", fontWeight: 600, fontSize: 12, cursor: "pointer" },
  signOutBtn: { background: "transparent", border: "1px solid var(--line)", color: "var(--text)", borderRadius: "var(--radius)", padding: "10px 20px", fontWeight: 600, fontSize: 13, cursor: "pointer" },
  error: { background: "rgba(217,105,95,0.12)", border: "1px solid var(--red)", color: "var(--red)", borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 13, marginBottom: 16 },
};
