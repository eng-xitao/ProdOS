import { useEffect, useMemo, useState, Fragment } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

const SUB_STATUS_LABEL = { trial: "Em teste", active: "Ativa", overdue: "Em atraso", canceled: "Cancelada" };
const APPROVAL_LABEL = { pending: "Pendente", approved: "Aprovada", rejected: "Não aprovada" };
const BILLING_EVENT_LABEL = {
  PAYMENT_CONFIRMED: "Pagamento confirmado", PAYMENT_RECEIVED: "Pagamento recebido",
  PAYMENT_OVERDUE: "Pagamento vencido", PAYMENT_DELETED: "Cobrança removida",
  PAYMENT_CREATED: "Cobrança gerada", PAYMENT_UPDATED: "Cobrança atualizada",
};

/**
 * Empresas: visão central de TODAS as empresas clientes da
 * plataforma — métricas, crescimento, controle manual de plano e
 * status, histórico financeiro e a opção de logar como o cliente
 * pra dar suporte. Igual qualquer painel de admin de SaaS.
 */
export default function AdminEmpresasPage() {
  const { profile } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [plans, setPlans] = useState([]);
  const [userCounts, setUserCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("todas");
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState("");
  const [expandedId, setExpandedId] = useState("");
  const [billingEvents, setBillingEvents] = useState([]);
  const [loadingBilling, setLoadingBilling] = useState(false);
  const [impersonatingId, setImpersonatingId] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const [{ data: companiesData }, { data: plansData }, { data: profilesData }] = await Promise.all([
      supabase.from("companies").select("*, plans:plan_id (name, price, key)").order("created_at", { ascending: false }),
      supabase.from("plans").select("id, key, name, price").eq("active", true).order("sort_order"),
      supabase.from("profiles").select("company_id"),
    ]);

    const counts = {};
    (profilesData ?? []).forEach((p) => { counts[p.company_id] = (counts[p.company_id] ?? 0) + 1; });

    setCompanies(companiesData ?? []);
    setPlans(plansData ?? []);
    setUserCounts(counts);
    setLoading(false);
  }

  useEffect(() => {
    if (profile?.is_platform_admin) load();
  }, [profile?.is_platform_admin]);

  async function changePlan(companyId, planId) {
    setSavingId(companyId);
    await supabase.from("companies").update({ plan_id: planId }).eq("id", companyId);
    await load();
    setSavingId("");
  }

  async function changeStatus(companyId, status) {
    setSavingId(companyId);
    await supabase.from("companies").update({ subscription_status: status }).eq("id", companyId);
    await load();
    setSavingId("");
  }

  async function toggleExpand(companyId) {
    if (expandedId === companyId) {
      setExpandedId("");
      return;
    }
    setExpandedId(companyId);
    setLoadingBilling(true);
    const { data } = await supabase
      .from("billing_events")
      .select("id, event_type, payment_id, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(20);
    setBillingEvents(data ?? []);
    setLoadingBilling(false);
  }

  async function impersonate(companyId) {
    setError("");
    setImpersonatingId(companyId);
    const { data, error } = await supabase.functions.invoke("impersonate-company", { body: { companyId } });
    if (error || data?.error) {
      setError(data?.error ?? "Não foi possível entrar como essa empresa. Confirme se ela tem um administrador cadastrado.");
    } else {
      window.open(data.actionLink, "_blank");
    }
    setImpersonatingId("");
  }

  const metrics = useMemo(() => {
    const active = companies.filter((c) => c.subscription_status === "active");
    const trial = companies.filter((c) => c.subscription_status === "trial");
    const overdue = companies.filter((c) => c.subscription_status === "overdue");
    const canceled = companies.filter((c) => c.subscription_status === "canceled");
    const mrr = active.reduce((sum, c) => sum + Number(c.plans?.price ?? 0), 0);

    const decided = active.length + overdue.length + canceled.length; // já saíram do trial
    const conversionRate = decided > 0 ? ((active.length + overdue.length) / decided) * 100 : null;
    const churnRate = decided > 0 ? (canceled.length / decided) * 100 : null;

    return { total: companies.length, active: active.length, trial: trial.length, overdue: overdue.length, canceled: canceled.length, mrr, conversionRate, churnRate };
  }, [companies]);

  const signupsByMonth = useMemo(() => {
    const map = {};
    companies.forEach((c) => {
      const key = c.created_at?.slice(0, 7);
      if (!key) return;
      map[key] = (map[key] ?? 0) + 1;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([key, value]) => {
        const [year, month] = key.split("-");
        const label = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
        return { label, value };
      });
  }, [companies]);

  const filtered = companies.filter((c) => {
    if (filter !== "todas" && c.subscription_status !== filter) return false;
    if (search && !c.name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (!profile?.is_platform_admin) return null;

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={styles.title}>Empresas</h1>
        <p style={styles.subtitle}>Todas as empresas clientes da plataforma, com controle manual de plano e status.</p>
      </header>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.metricsRow}>
        <MetricCard label="Total de empresas" value={metrics.total} />
        <MetricCard label="Ativas" value={metrics.active} color="var(--green)" />
        <MetricCard label="Em teste" value={metrics.trial} color="var(--amber)" />
        <MetricCard label="Em atraso" value={metrics.overdue} color="var(--red)" />
        <MetricCard label="Canceladas" value={metrics.canceled} color="var(--text-dim)" />
        <MetricCard label="MRR (ativas)" value={`R$ ${metrics.mrr.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} color="var(--amber)" wide />
        <MetricCard label="Conversão trial→pago" value={metrics.conversionRate !== null ? `${metrics.conversionRate.toFixed(0)}%` : "—"} color="var(--green)" />
        <MetricCard label="Cancelamento" value={metrics.churnRate !== null ? `${metrics.churnRate.toFixed(0)}%` : "—"} color="var(--red)" />
      </div>

      {signupsByMonth.length > 0 && (
        <div style={styles.chartBox}>
          <span style={styles.chartLabel}>Novos cadastros por mês</span>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={signupsByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" name="Cadastros" fill="var(--amber)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={styles.filterRow}>
        <input style={styles.search} placeholder="Buscar empresa..." value={search} onChange={(e) => setSearch(e.target.value)} />
        {["todas", "trial", "active", "overdue", "canceled"].map((f) => (
          <button key={f} style={{ ...styles.filterBtn, ...(filter === f ? styles.filterBtnActive : {}) }} onClick={() => setFilter(f)} type="button">
            {f === "todas" ? "Todas" : SUB_STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={styles.dim}>Carregando...</p>
      ) : filtered.length === 0 ? (
        <p style={styles.dim}>Nenhuma empresa encontrada.</p>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Empresa</th>
                <th style={styles.th}>Usuários</th>
                <th style={styles.th}>Plano</th>
                <th style={styles.th}>Assinatura</th>
                <th style={styles.th}>Aprovação</th>
                <th style={styles.th}>Criada em</th>
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <Fragment key={c.id}>
                  <tr>
                    <td style={styles.td}>
                      <div style={{ fontWeight: 700 }}>{c.name}</div>
                      <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>{c.email ?? "sem e-mail"}</div>
                    </td>
                    <td style={styles.td}>{userCounts[c.id] ?? 0}</td>
                    <td style={styles.td}>
                      <select
                        style={styles.inlineSelect}
                        value={c.plan_id ?? ""}
                        disabled={savingId === c.id}
                        onChange={(e) => changePlan(c.id, e.target.value)}
                      >
                        {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </td>
                    <td style={styles.td}>
                      <select
                        style={styles.inlineSelect}
                        value={c.subscription_status ?? "trial"}
                        disabled={savingId === c.id}
                        onChange={(e) => changeStatus(c.id, e.target.value)}
                      >
                        {Object.entries(SUB_STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </td>
                    <td style={styles.td}>
                      <span style={{ ...styles.badge, ...approvalStyle(c.approval_status) }}>{APPROVAL_LABEL[c.approval_status]}</span>
                    </td>
                    <td style={styles.td}>{new Date(c.created_at).toLocaleDateString("pt-BR")}</td>
                    <td style={{ ...styles.td, textAlign: "right" }}>
                      <button style={styles.linkBtn} onClick={() => toggleExpand(c.id)} type="button">
                        {expandedId === c.id ? "Fechar" : "Financeiro"}
                      </button>
                      <button style={styles.impersonateBtn} onClick={() => impersonate(c.id)} disabled={impersonatingId === c.id} type="button">
                        {impersonatingId === c.id ? "Gerando..." : "Entrar como"}
                      </button>
                    </td>
                  </tr>
                  {expandedId === c.id && (
                    <tr>
                      <td colSpan={7} style={{ ...styles.td, background: "var(--panel-2)" }}>
                        {loadingBilling ? (
                          <span style={styles.dim}>Carregando...</span>
                        ) : billingEvents.length === 0 ? (
                          <span style={styles.dim}>Nenhum evento de cobrança registrado ainda pra essa empresa.</span>
                        ) : (
                          <div style={styles.billingList}>
                            {billingEvents.map((e) => (
                              <div key={e.id} style={styles.billingRow}>
                                <span>{BILLING_EVENT_LABEL[e.event_type] ?? e.event_type}</span>
                                <span style={styles.dim}>{new Date(e.created_at).toLocaleString("pt-BR")}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, color, wide }) {
  return (
    <div style={{ ...styles.metricCard, ...(wide ? { minWidth: 180 } : {}) }}>
      <span style={styles.metricLabel}>{label}</span>
      <span style={{ ...styles.metricValue, color: color ?? "var(--text)" }}>{value}</span>
    </div>
  );
}

function approvalStyle(status) {
  if (status === "approved") return { background: "rgba(79,174,126,0.15)", color: "var(--green)" };
  if (status === "rejected") return { background: "rgba(217,105,95,0.15)", color: "var(--red)" };
  return { background: "rgba(232,163,61,0.15)", color: "var(--amber)" };
}

const styles = {
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0" },
  dim: { color: "var(--text-dim)", fontSize: 14 },
  metricsRow: { display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 20 },
  metricCard: {
    background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "12px 16px", display: "flex", flexDirection: "column", gap: 4, minWidth: 130,
  },
  metricLabel: { fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-dim)", fontWeight: 700 },
  metricValue: { fontFamily: "var(--font-display)", fontSize: 20 },
  chartBox: { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 16, marginBottom: 20 },
  chartLabel: { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-dim)", fontWeight: 700 },
  filterRow: { display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", alignItems: "center" },
  search: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "7px 12px", fontSize: 13, color: "var(--text)", minWidth: 200,
  },
  filterBtn: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "7px 14px", fontSize: 12.5, fontWeight: 600, color: "var(--text-dim)", cursor: "pointer",
  },
  filterBtnActive: { background: "var(--amber)", color: "#FFFFFF", borderColor: "var(--amber)" },
  tableWrap: { border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden", overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em",
    color: "var(--text-dim)", padding: "10px 14px", background: "var(--panel)", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap",
  },
  td: { padding: "10px 14px", fontSize: 13.5, background: "var(--panel)", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" },
  inlineSelect: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "5px 8px", fontSize: 12.5, color: "var(--text)",
  },
  badge: { padding: "3px 10px", borderRadius: 20, fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap" },
  linkBtn: {
    background: "transparent", border: "1px solid var(--line)", color: "var(--text-dim)", borderRadius: "var(--radius)",
    padding: "6px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", marginRight: 8,
  },
  impersonateBtn: {
    background: "var(--amber)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)",
    padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer",
  },
  billingList: { display: "flex", flexDirection: "column", gap: 6, whiteSpace: "normal" },
  billingRow: { display: "flex", justifyContent: "space-between", fontSize: 12.5, maxWidth: 500 },
  error: {
    background: "rgba(217,105,95,0.12)", border: "1px solid var(--red)", color: "var(--red)",
    borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 13, marginBottom: 16,
  },
};
