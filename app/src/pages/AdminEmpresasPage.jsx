import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

const SUB_STATUS_LABEL = { trial: "Em teste", active: "Ativa", overdue: "Em atraso", canceled: "Cancelada" };
const APPROVAL_LABEL = { pending: "Pendente", approved: "Aprovada", rejected: "Não aprovada" };

/**
 * Empresas: visão central de TODAS as empresas clientes da
 * plataforma, com métricas gerais e controle manual — pra você (dono
 * da plataforma) gerenciar tudo sem entrar em cada empresa. Igual
 * qualquer painel de admin de SaaS (Stripe, RD Station, etc.).
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

  const metrics = useMemo(() => {
    const active = companies.filter((c) => c.subscription_status === "active");
    const trial = companies.filter((c) => c.subscription_status === "trial");
    const overdue = companies.filter((c) => c.subscription_status === "overdue");
    const canceled = companies.filter((c) => c.subscription_status === "canceled");
    const mrr = active.reduce((sum, c) => sum + Number(c.plans?.price ?? 0), 0);
    return { total: companies.length, active: active.length, trial: trial.length, overdue: overdue.length, canceled: canceled.length, mrr };
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

      <div style={styles.metricsRow}>
        <MetricCard label="Total de empresas" value={metrics.total} />
        <MetricCard label="Ativas" value={metrics.active} color="var(--green)" />
        <MetricCard label="Em teste" value={metrics.trial} color="var(--amber)" />
        <MetricCard label="Em atraso" value={metrics.overdue} color="var(--red)" />
        <MetricCard label="Canceladas" value={metrics.canceled} color="var(--text-dim)" />
        <MetricCard label="MRR (ativas)" value={`R$ ${metrics.mrr.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} color="var(--amber)" wide />
      </div>

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
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
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
                </tr>
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
};
