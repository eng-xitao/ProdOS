import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

const STATUS_LABEL = { pending: "Em análise", approved: "Aprovado", rejected: "Não aprovado" };

/**
 * Aprovações (só pro admin da plataforma): toda empresa nova nasce
 * com approval_status = 'pending' e fica travada em PendingApprovalPage
 * até ser aprovada aqui. Isso evita que qualquer pessoa que se
 * cadastre no site tenha acesso automático ao sistema.
 */
export default function AprovacoesPage() {
  const { profile } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("companies")
      .select("id, name, segment, approval_status, created_at, plans:plan_id (name)")
      .order("created_at", { ascending: false });
    setCompanies(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (profile?.is_platform_admin) load();
  }, [profile?.is_platform_admin]);

  async function setStatus(id, status) {
    await supabase.from("companies").update({ approval_status: status }).eq("id", id);
    load();
  }

  if (!profile?.is_platform_admin || !["super_admin","comercial"].includes(profile?.platform_role)) return null;

  const filtered = filter === "todos" ? companies : companies.filter((c) => c.approval_status === filter);

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={styles.title}>Aprovações</h1>
        <p style={styles.subtitle}>
          Toda empresa que se cadastra no ProdOS fica bloqueada até ser aprovada aqui pelo time
          comercial. Ninguém acessa o sistema antes disso.
        </p>
      </header>

      <div style={styles.filterRow}>
        {["pending", "approved", "rejected", "todos"].map((f) => (
          <button
            key={f}
            style={{ ...styles.filterBtn, ...(filter === f ? styles.filterBtnActive : {}) }}
            onClick={() => setFilter(f)}
            type="button"
          >
            {f === "todos" ? "Todos" : STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={styles.dim}>Carregando...</p>
      ) : filtered.length === 0 ? (
        <p style={styles.dim}>Nenhuma empresa nessa situação.</p>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Empresa</th>
                <th style={styles.th}>Segmento</th>
                <th style={styles.th}>Plano</th>
                <th style={styles.th}>Cadastrada em</th>
                <th style={styles.th}>Situação</th>
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td style={styles.td}>{c.name}</td>
                  <td style={styles.td}>{c.segment ?? "—"}</td>
                  <td style={styles.td}>{c.plans?.name ?? "—"}</td>
                  <td style={styles.td}>{new Date(c.created_at).toLocaleDateString("pt-BR")}</td>
                  <td style={styles.td}>
                    <span style={{ ...styles.badge, ...badgeStyle(c.approval_status) }}>{STATUS_LABEL[c.approval_status]}</span>
                  </td>
                  <td style={{ ...styles.td, textAlign: "right", whiteSpace: "nowrap" }}>
                    {c.approval_status !== "approved" && (
                      <button style={styles.approveBtn} onClick={() => setStatus(c.id, "approved")} type="button">Aprovar</button>
                    )}
                    {c.approval_status !== "rejected" && (
                      <button style={styles.rejectBtn} onClick={() => setStatus(c.id, "rejected")} type="button">Não aprovar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function badgeStyle(status) {
  if (status === "approved") return { background: "rgba(79,174,126,0.15)", color: "var(--green)" };
  if (status === "rejected") return { background: "rgba(217,105,95,0.15)", color: "var(--red)" };
  return { background: "rgba(232,163,61,0.15)", color: "var(--amber)" };
}

const styles = {
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0", maxWidth: 680, lineHeight: 1.5 },
  dim: { color: "var(--text-dim)", fontSize: 14 },
  filterRow: { display: "flex", gap: 8, marginBottom: 20 },
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
  badge: { padding: "3px 10px", borderRadius: 20, fontSize: 11.5, fontWeight: 700 },
  approveBtn: {
    background: "var(--green)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)",
    padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", marginRight: 8,
  },
  rejectBtn: {
    background: "transparent", border: "1px solid var(--line)", color: "var(--red)", borderRadius: "var(--radius)",
    padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer",
  },
};
