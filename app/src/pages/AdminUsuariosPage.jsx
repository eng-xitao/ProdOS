import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

const ROLE_LABEL = {
  super_admin: "Super admin (acesso total)",
  suporte: "Suporte (só chamados)",
  comercial: "Comercial (Empresas + Aprovações)",
  financeiro: "Financeiro (Empresas + histórico de cobrança)",
};

/**
 * Administradores da Plataforma: define o papel interno de cada
 * pessoa da equipe (super_admin, suporte, comercial, financeiro).
 * Cada papel só enxerga as telas de Administração relevantes pro
 * trabalho dele — quem promove/rebaixa é sempre o super_admin.
 */
export default function AdminUsuariosPage() {
  const { profile } = useAuth();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");

  async function loadAdmins() {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email, is_platform_admin, platform_role, companies:company_id (name)")
      .eq("is_platform_admin", true)
      .order("full_name");
    setAdmins(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (profile?.platform_role === "super_admin") loadAdmins();
  }, [profile?.platform_role]);

  async function search_() {
    if (!search.trim()) { setResults([]); return; }
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email, is_platform_admin, platform_role, companies:company_id (name)")
      .or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
      .limit(10);
    setResults(data ?? []);
  }

  async function setRole(userId, role) {
    setSavingId(userId);
    await supabase.from("profiles").update({
      platform_role: role || null,
      is_platform_admin: !!role,
    }).eq("id", userId);
    await loadAdmins();
    await search_();
    setSavingId("");
  }

  if (!profile?.is_platform_admin || profile?.platform_role !== "super_admin") return null;

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={styles.title}>Administradores da Plataforma</h1>
        <p style={styles.subtitle}>
          Define o papel de cada pessoa do seu time interno. Cada papel só enxerga as telas de
          Administração relevantes — só o super admin vê e mexe em tudo.
        </p>
      </header>

      <div style={styles.searchRow}>
        <input
          style={styles.search}
          placeholder="Buscar usuário por nome ou e-mail..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search_()}
        />
        <button style={styles.searchBtn} onClick={search_} type="button">Buscar</button>
      </div>

      {results.length > 0 && (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr><th style={styles.th}>Nome</th><th style={styles.th}>E-mail</th><th style={styles.th}>Empresa</th><th style={styles.th}>Papel</th></tr>
            </thead>
            <tbody>
              {results.map((u) => (
                <tr key={u.id}>
                  <td style={styles.td}>{u.full_name}</td>
                  <td style={styles.td}>{u.email}</td>
                  <td style={styles.td}>{u.companies?.name ?? "—"}</td>
                  <td style={styles.td}>
                    <select
                      style={styles.roleSelect}
                      value={u.platform_role ?? ""}
                      disabled={savingId === u.id}
                      onChange={(e) => setRole(u.id, e.target.value)}
                    >
                      <option value="">Sem acesso</option>
                      {Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={styles.wrap}>
        <h2 style={styles.title2}>Admins atuais</h2>
        {loading ? (
          <p style={styles.dim}>Carregando...</p>
        ) : admins.length === 0 ? (
          <p style={styles.dim}>Nenhum admin cadastrado.</p>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr><th style={styles.th}>Nome</th><th style={styles.th}>E-mail</th><th style={styles.th}>Empresa</th><th style={styles.th}>Papel</th></tr>
              </thead>
              <tbody>
                {admins.map((u) => (
                  <tr key={u.id}>
                    <td style={styles.td}>{u.full_name}</td>
                    <td style={styles.td}>{u.email}</td>
                    <td style={styles.td}>{u.companies?.name ?? "—"}</td>
                    <td style={styles.td}>
                      {u.id === profile.id ? (
                        <span style={styles.dim}>{ROLE_LABEL[u.platform_role] ?? "—"} (você)</span>
                      ) : (
                        <select
                          style={styles.roleSelect}
                          value={u.platform_role ?? ""}
                          disabled={savingId === u.id}
                          onChange={(e) => setRole(u.id, e.target.value)}
                        >
                          <option value="">Sem acesso</option>
                          {Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      )}
                    </td>
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
  title2: { fontFamily: "var(--font-display)", fontSize: 18, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0", maxWidth: 640, lineHeight: 1.5 },
  dim: { color: "var(--text-dim)", fontSize: 14 },
  wrap: { marginTop: 32, paddingTop: 24, borderTop: "1px solid var(--line)" },
  searchRow: { display: "flex", gap: 8, marginBottom: 16 },
  search: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "9px 12px", fontSize: 13, color: "var(--text)", minWidth: 280,
  },
  searchBtn: {
    background: "var(--amber)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)",
    padding: "9px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer",
  },
  tableWrap: { border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden", overflowX: "auto", marginBottom: 20 },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em",
    color: "var(--text-dim)", padding: "10px 14px", background: "var(--panel)", borderBottom: "1px solid var(--line)",
  },
  td: { padding: "10px 14px", fontSize: 13.5, background: "var(--panel)", borderBottom: "1px solid var(--line)" },
  roleSelect: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "6px 10px", fontSize: 12.5, color: "var(--text)",
  },
};
