import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import CurrencyInput from "../components/CurrencyInput";

// As mesmas seções que existem no menu — o admin da plataforma
// escolhe quais delas cada plano libera.
const ALL_FEATURES = [
  "Cadastro", "PCP", "Comercial", "Compras", "Logística", "Custos",
  "Financeiro", "RH", "CRM", "Frotas", "Relatórios", "Configurações", "Fiscal",
];

export default function PlanosAdminPage() {
  const { profile } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({});

  async function loadPlans() {
    setLoading(true);
    const { data, error } = await supabase.from("plans").select("*").order("sort_order");
    if (error) setError(error.message);
    setPlans(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (profile?.is_platform_admin) loadPlans();
  }, [profile?.is_platform_admin]);

  function startEdit(plan) {
    setEditingId(plan.id);
    setForm({ ...plan, features: plan.features ?? [] });
  }

  function toggleFeature(feature) {
    setForm((f) => ({
      ...f,
      features: f.features.includes(feature) ? f.features.filter((x) => x !== feature) : [...f.features, feature],
    }));
  }

  async function saveEdit() {
    setError("");
    const { error } = await supabase
      .from("plans")
      .update({
        name: form.name,
        price: Number(form.price),
        description: form.description,
        features: form.features,
        active: form.active,
        included_users: Number(form.included_users ?? 2),
        adesao_price: Number(form.adesao_price ?? 0),
        extra_user_price: Number(form.extra_user_price ?? 0),
        promo_active: !!form.promo_active,
        promo_price: form.promo_active ? Number(form.promo_price ?? 0) : null,
        promo_description: form.promo_active ? (form.promo_description ?? null) : null,
        promo_ends_at: form.promo_active ? (form.promo_ends_at || null) : null,
      })
      .eq("id", editingId);

    if (error) setError(error.message);
    else {
      setEditingId(null);
      loadPlans();
    }
  }

  async function createNewPlan() {
    setError("");
    const key = window.prompt("Identificador interno do novo plano (sem espaço, ex: enterprise):");
    if (!key) return;
    const { error } = await supabase.from("plans").insert({
      key, name: "Novo Plano", price: 0, description: "", features: [], sort_order: plans.length + 1,
    });
    if (error) setError(error.message);
    else loadPlans();
  }

  async function deletePlan(id) {
    if (!window.confirm("Excluir este plano? Empresas vinculadas a ele ficam sem plano definido.")) return;
    await supabase.from("plans").delete().eq("id", id);
    loadPlans();
  }

  if (!profile?.is_platform_admin || profile?.platform_role !== "super_admin") {
    return (
      <div style={styles.blocked}>
        <h1 style={styles.blockedTitle}>Acesso não permitido</h1>
        <p style={styles.blockedText}>Esta área é exclusiva do super admin da plataforma.</p>
      </div>
    );
  }

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={styles.title}>Planos (Administração da Plataforma)</h1>
        <p style={styles.subtitle}>
          Defina o preço e o que cada plano libera. Essas mudanças valem pra toda empresa
          cliente que estiver naquele plano — inclusive as que já estão pagando.
        </p>
      </header>

      {error && <div style={styles.error}>{error}</div>}

      <button style={styles.addBtn} onClick={createNewPlan} type="button">+ Novo Plano</button>

      {loading ? (
        <p style={styles.dim}>Carregando...</p>
      ) : (
        <div style={styles.grid}>
          {plans.map((plan) => (
            <div key={plan.id} style={styles.card}>
              {editingId === plan.id ? (
                <>
                  <label style={styles.field}>
                    <span style={styles.fieldLabel}>Nome</span>
                    <input style={styles.input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </label>
                  <label style={styles.field}>
                    <span style={styles.fieldLabel}>Preço mensal</span>
                    <CurrencyInput value={Number(form.price ?? 0)} onChange={(num) => setForm({ ...form, price: num })} />
                  </label>
                  <label style={styles.field}>
                    <span style={styles.fieldLabel}>Taxa de adesão (única vez)</span>
                    <CurrencyInput value={Number(form.adesao_price ?? 0)} onChange={(num) => setForm({ ...form, adesao_price: num })} />
                  </label>
                  <label style={styles.field}>
                    <span style={styles.fieldLabel}>Usuários inclusos</span>
                    <input
                      style={styles.input} type="number" min="1"
                      value={form.included_users ?? 2}
                      onChange={(e) => setForm({ ...form, included_users: Number(e.target.value) })}
                    />
                  </label>
                  <label style={styles.field}>
                    <span style={styles.fieldLabel}>Valor por usuário adicional</span>
                    <CurrencyInput value={Number(form.extra_user_price ?? 0)} onChange={(num) => setForm({ ...form, extra_user_price: num })} />
                  </label>
                  <label style={styles.field}>
                    <span style={styles.fieldLabel}>Descrição</span>
                    <input style={styles.input} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                  </label>

                  <div style={styles.promoBox}>
                    <label style={styles.checkboxRow}>
                      <input type="checkbox" checked={form.promo_active ?? false} onChange={(e) => setForm({ ...form, promo_active: e.target.checked })} />
                      <span>Preço promocional ativo</span>
                    </label>
                    {form.promo_active && (
                      <>
                        <label style={styles.field}>
                          <span style={styles.fieldLabel}>Preço promocional</span>
                          <CurrencyInput value={Number(form.promo_price ?? 0)} onChange={(num) => setForm({ ...form, promo_price: num })} />
                        </label>
                        <label style={styles.field}>
                          <span style={styles.fieldLabel}>Descrição da promoção</span>
                          <input style={styles.input} value={form.promo_description ?? ""} onChange={(e) => setForm({ ...form, promo_description: e.target.value })} placeholder="Ex: Lançamento — 3 primeiros meses" />
                        </label>
                        <label style={styles.field}>
                          <span style={styles.fieldLabel}>Promoção válida até (opcional)</span>
                          <input style={styles.input} type="date" value={form.promo_ends_at ?? ""} onChange={(e) => setForm({ ...form, promo_ends_at: e.target.value || null })} />
                        </label>
                      </>
                    )}
                  </div>
                  <span style={styles.fieldLabel}>O que libera</span>
                  <div style={styles.featureGrid}>
                    {ALL_FEATURES.map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => toggleFeature(f)}
                        style={{ ...styles.featureBtn, ...(form.features.includes(f) ? styles.featureBtnActive : {}) }}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                  <label style={styles.checkboxRow}>
                    <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                    <span>Plano ativo (visível pras empresas)</span>
                  </label>
                  <div style={styles.actionsRow}>
                    <button style={styles.saveBtn} onClick={saveEdit} type="button">Salvar</button>
                    <button style={styles.cancelBtn} onClick={() => setEditingId(null)} type="button">Cancelar</button>
                  </div>
                </>
              ) : (
                <>
                  <div style={styles.cardHeader}>
                    <h2 style={styles.cardTitle}>{plan.name}</h2>
                    {!plan.active && <span style={styles.inactiveTag}>Inativo</span>}
                  </div>
                  <div style={styles.price}>R$ {Number(plan.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}<span style={styles.priceSuffix}>/mês</span></div>
                  {Number(plan.adesao_price) > 0 && (
                    <p style={styles.seatsInfo}>+ R$ {Number(plan.adesao_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} de adesão (única vez)</p>
                  )}
                  {plan.promo_active && (
                    <span style={styles.promoBadge}>Promo: R$ {Number(plan.promo_price ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} — {plan.promo_description}</span>
                  )}
                  <p style={styles.seatsInfo}>
                    {plan.included_users ?? 2} usuário(s) inclusos · +R$ {Number(plan.extra_user_price ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/usuário extra
                  </p>
                  <p style={styles.description}>{plan.description}</p>
                  <div style={styles.featuresList}>
                    {(plan.features ?? []).map((f) => <span key={f} style={styles.featureTag}>{f}</span>)}
                  </div>
                  <div style={styles.actionsRow}>
                    <button style={styles.editBtn} onClick={() => startEdit(plan)} type="button">Editar</button>
                    <button style={styles.deleteBtn} onClick={() => deletePlan(plan.id)} type="button">Excluir</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0", maxWidth: 640, lineHeight: 1.5 },
  dim: { color: "var(--text-dim)", fontSize: 14 },
  addBtn: {
    background: "var(--green)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)",
    padding: "9px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", margin: "16px 0",
  },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 },
  card: { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 20 },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontFamily: "var(--font-display)", fontSize: 17, margin: 0 },
  inactiveTag: { fontSize: 11, color: "var(--red)", fontWeight: 700 },
  price: { fontSize: 26, fontWeight: 700, color: "var(--amber)", margin: "10px 0 4px" },
  priceSuffix: { fontSize: 13, color: "var(--text-dim)", fontWeight: 400 },
  promoBox: {
    display: "flex", flexDirection: "column", gap: 10,
    background: "var(--panel-2)", border: "1px dashed var(--line)", borderRadius: "var(--radius)", padding: 12,
  },
  promoBadge: {
    display: "inline-block", background: "rgba(79,174,126,0.15)", color: "var(--green)",
    borderRadius: 20, padding: "4px 10px", fontSize: 11.5, fontWeight: 700,
  },
  seatsInfo: { fontSize: 11.5, color: "var(--text-dim)", margin: "4px 0" },
  description: { fontSize: 13, color: "var(--text-dim)", margin: "0 0 14px", lineHeight: 1.5 },
  featuresList: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 },
  featureTag: {
    fontSize: 11.5, background: "var(--panel-2)", color: "var(--text)", padding: "3px 9px",
    borderRadius: 20, border: "1px solid var(--line)",
  },
  field: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 },
  fieldLabel: { fontSize: 11, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" },
  input: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "8px 10px", color: "var(--text)", fontSize: 13,
  },
  featureGrid: { display: "flex", flexWrap: "wrap", gap: 6, margin: "8px 0 14px" },
  featureBtn: {
    fontSize: 11.5, background: "var(--panel-2)", color: "var(--text-dim)", padding: "5px 10px",
    borderRadius: 20, border: "1px solid var(--line)", cursor: "pointer",
  },
  featureBtnActive: { background: "var(--amber)", color: "#FFFFFF", borderColor: "var(--amber)" },
  checkboxRow: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 14 },
  actionsRow: { display: "flex", gap: 8 },
  saveBtn: {
    background: "var(--amber)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)",
    padding: "8px 14px", fontWeight: 700, fontSize: 12.5, cursor: "pointer",
  },
  cancelBtn: {
    background: "transparent", color: "var(--text-dim)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "8px 14px", fontWeight: 600, fontSize: 12.5, cursor: "pointer",
  },
  editBtn: {
    background: "transparent", color: "var(--text)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "8px 14px", fontWeight: 600, fontSize: 12.5, cursor: "pointer",
  },
  deleteBtn: {
    background: "transparent", color: "var(--red)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "8px 14px", fontWeight: 600, fontSize: 12.5, cursor: "pointer",
  },
  blocked: { maxWidth: 480, marginTop: 60 },
  blockedTitle: { fontFamily: "var(--font-display)", fontSize: 20, color: "var(--red)", margin: 0 },
  blockedText: { color: "var(--text-dim)", fontSize: 14, lineHeight: 1.6, marginTop: 12 },
  error: {
    background: "rgba(217,105,95,0.12)", border: "1px solid var(--red)", color: "var(--red)",
    borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 13, marginBottom: 16,
  },
};
