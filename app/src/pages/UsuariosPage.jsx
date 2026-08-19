import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { ROLE_LABEL } from "../lib/permissions";

export default function UsuariosPage() {
  const { session, profile } = useAuth();
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("vendas");

  async function loadMembers() {
    const { data } = await supabase.from("profiles").select("id, full_name, email, role").order("full_name");
    setMembers(data ?? []);
  }

  async function loadInvites() {
    const { data } = await supabase
      .from("user_invites")
      .select("id, email, role, status")
      .eq("status", "pendente")
      .order("created_at", { ascending: false });
    setInvites(data ?? []);
  }

  useEffect(() => {
    loadMembers();
    loadInvites();
  }, []);

  async function sendInvite(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!inviteEmail || !inviteRole) return;
    setSaving(true);

    const { error } = await supabase.from("user_invites").insert({
      company_id: profile.company_id,
      email: inviteEmail.trim().toLowerCase(),
      role: inviteRole,
      invited_by: profile.id,
    });

    if (error) {
      setError(error.message);
    } else {
      setSuccess(
        `Convite criado. Peça para ${inviteEmail} se cadastrar no ProdOS usando exatamente esse e-mail — a pessoa vai entrar direto na sua empresa como ${ROLE_LABEL[inviteRole]}.`
      );
      setInviteEmail("");
      loadInvites();
    }
    setSaving(false);
  }

  async function cancelInvite(id) {
    await supabase.from("user_invites").delete().eq("id", id);
    loadInvites();
  }

  async function changeRole(memberId, newRole) {
    await supabase.from("profiles").update({ role: newRole }).eq("id", memberId);
    loadMembers();
  }

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={styles.title}>Usuários</h1>
        <p style={styles.subtitle}>
          Convide colegas para acessar sua empresa no ProdOS, cada um com um papel que define
          quais áreas do sistema consegue ver.
        </p>
      </header>

      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}

      <form onSubmit={sendInvite} style={styles.form}>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>E-mail do convidado</span>
          <input style={styles.input} type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="pessoa@empresa.com" required />
        </label>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>Papel</span>
          <select style={styles.input} value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
            {Object.entries(ROLE_LABEL).filter(([value]) => value !== "admin").map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <button style={styles.addBtn} type="submit" disabled={saving}>
          {saving ? "Enviando..." : "Convidar"}
        </button>
      </form>

      {invites.length > 0 && (
        <div style={styles.wrap}>
          <h2 style={styles.title2}>Convites pendentes</h2>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr><th style={styles.th}>E-mail</th><th style={styles.th}>Papel</th><th style={styles.th}></th></tr>
              </thead>
              <tbody>
                {invites.map((i) => (
                  <tr key={i.id}>
                    <td style={styles.td}>{i.email}</td>
                    <td style={styles.td}>{ROLE_LABEL[i.role] ?? i.role}</td>
                    <td style={{ ...styles.td, textAlign: "right" }}>
                      <button style={styles.deleteBtn} onClick={() => cancelInvite(i.id)} type="button">Cancelar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={styles.wrap}>
        <h2 style={styles.title2}>Equipe</h2>
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr><th style={styles.th}>Nome</th><th style={styles.th}>E-mail</th><th style={styles.th}>Papel</th></tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td style={styles.td}>{m.full_name}</td>
                  <td style={styles.td}>{m.email}</td>
                  <td style={styles.td}>
                    {m.id === session?.user?.id ? (
                      <span style={styles.dim}>{ROLE_LABEL[m.role] ?? m.role} (você)</span>
                    ) : (
                      <select style={styles.inlineSelect} value={m.role} onChange={(e) => changeRole(m.id, e.target.value)}>
                        {Object.entries(ROLE_LABEL).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const styles = {
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  title2: { fontFamily: "var(--font-display)", fontSize: 18, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0", maxWidth: 640, lineHeight: 1.5 },
  wrap: { marginTop: 32, paddingTop: 24, borderTop: "1px solid var(--line)" },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  fieldLabel: { fontSize: 11, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" },
  input: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "9px 10px", color: "var(--text)", fontSize: 13,
  },
  inlineSelect: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "5px 8px", color: "var(--text)", fontSize: 12.5,
  },
  form: {
    display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 12, alignItems: "end",
    background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: 20, marginTop: 20, maxWidth: 720,
  },
  addBtn: {
    background: "var(--amber)", color: "#1A1400", border: "none", borderRadius: "var(--radius)",
    padding: "9px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", height: 38,
  },
  dim: { color: "var(--text-dim)", fontSize: 13 },
  tableWrap: { border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden", maxWidth: 720 },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em",
    color: "var(--text-dim)", padding: "10px 14px", background: "var(--panel)", borderBottom: "1px solid var(--line)",
  },
  td: { padding: "10px 14px", fontSize: 13.5, background: "var(--panel)", borderBottom: "1px solid var(--line)" },
  deleteBtn: {
    background: "transparent", border: "1px solid var(--line)", color: "var(--red)",
    borderRadius: "var(--radius)", padding: "5px 10px", fontSize: 12, cursor: "pointer",
  },
  error: {
    background: "rgba(217,105,95,0.12)", border: "1px solid var(--red)", color: "var(--red)",
    borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 13, marginBottom: 16, maxWidth: 720,
  },
  success: {
    background: "rgba(79,174,126,0.12)", border: "1px solid var(--green)", color: "var(--green)",
    borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 13, marginBottom: 16, maxWidth: 720, lineHeight: 1.5,
  },
};
