import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

const TYPE_LABEL = { acesso: "Acesso", exclusao: "Exclusão", portabilidade: "Portabilidade", correcao: "Correção" };
const STATUS_LABEL = { aberta: "Aberta", em_andamento: "Em andamento", concluida: "Concluída" };

/**
 * Solicitações LGPD (admin): trata os pedidos de acesso/exclusão/
 * portabilidade/correção que as empresas clientes abrem. Também é
 * onde se configura o Encarregado (DPO) da plataforma — obrigatório
 * pela LGPD.
 */
export default function AdminLgpdPage() {
  const { profile } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("aberta");
  const [savingId, setSavingId] = useState("");
  const [noteDrafts, setNoteDrafts] = useState({});

  const [dpoName, setDpoName] = useState("");
  const [dpoEmail, setDpoEmail] = useState("");
  const [savingDpo, setSavingDpo] = useState(false);
  const [dpoSaved, setDpoSaved] = useState(false);

  async function loadRequests() {
    setLoading(true);
    const { data } = await supabase
      .from("lgpd_requests")
      .select("id, request_type, details, status, admin_notes, created_at, companies:company_id (name, email)")
      .order("created_at", { ascending: false });
    setRequests(data ?? []);
    setLoading(false);
  }

  async function loadSettings() {
    const { data } = await supabase.from("platform_settings").select("dpo_name, dpo_email").eq("id", true).single();
    setDpoName(data?.dpo_name ?? "");
    setDpoEmail(data?.dpo_email ?? "");
  }

  useEffect(() => {
    if (profile?.is_platform_admin) { loadRequests(); loadSettings(); }
  }, [profile?.is_platform_admin]);

  async function saveDpo(e) {
    e.preventDefault();
    setSavingDpo(true);
    await supabase.from("platform_settings").update({ dpo_name: dpoName, dpo_email: dpoEmail, updated_at: new Date().toISOString() }).eq("id", true);
    setDpoSaved(true);
    setSavingDpo(false);
  }

  async function updateRequest(id, status) {
    setSavingId(id);
    const payload = { status };
    if (noteDrafts[id] !== undefined) payload.admin_notes = noteDrafts[id];
    if (status === "concluida") payload.resolved_at = new Date().toISOString();
    await supabase.from("lgpd_requests").update(payload).eq("id", id);
    await loadRequests();
    setSavingId("");
  }

  if (!profile?.is_platform_admin || !["super_admin", "comercial"].includes(profile?.platform_role)) return null;

  const filtered = filter === "todas" ? requests : requests.filter((r) => r.status === filter);

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={styles.title}>Solicitações LGPD</h1>
        <p style={styles.subtitle}>
          Pedidos de acesso, exclusão, portabilidade ou correção de dados abertos pelas empresas
          clientes. A LGPD exige resposta ágil — trate o quanto antes.
        </p>
      </header>

      <div style={styles.dpoBox}>
        <span style={styles.dpoTitle}>Encarregado (DPO) da plataforma</span>
        <p style={styles.dpoText}>
          A LGPD exige a designação de um Encarregado que interage com titulares de dados e com a
          ANPD. Pode ser você mesmo — o importante é ter alguém definido e um contato publicado.
        </p>
        <form onSubmit={saveDpo} style={styles.dpoForm}>
          <input style={styles.input} value={dpoName} onChange={(e) => { setDpoName(e.target.value); setDpoSaved(false); }} placeholder="Nome do Encarregado" />
          <input style={styles.input} type="email" value={dpoEmail} onChange={(e) => { setDpoEmail(e.target.value); setDpoSaved(false); }} placeholder="E-mail do Encarregado" />
          <button style={styles.dpoSaveBtn} type="submit" disabled={savingDpo}>{savingDpo ? "Salvando..." : "Salvar"}</button>
        </form>
        {dpoSaved && <span style={styles.dpoSavedMsg}>Salvo.</span>}
      </div>

      <div style={styles.filterRow}>
        {["aberta", "em_andamento", "concluida", "todas"].map((f) => (
          <button key={f} style={{ ...styles.filterBtn, ...(filter === f ? styles.filterBtnActive : {}) }} onClick={() => setFilter(f)} type="button">
            {f === "todas" ? "Todas" : STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={styles.dim}>Carregando...</p>
      ) : filtered.length === 0 ? (
        <p style={styles.dim}>Nenhuma solicitação nessa situação.</p>
      ) : (
        <div style={styles.list}>
          {filtered.map((r) => (
            <div key={r.id} style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <span style={styles.cardCompany}>{r.companies?.name}</span>
                  <span style={styles.cardType}> — {TYPE_LABEL[r.request_type]}</span>
                </div>
                <span style={{ ...styles.badge, ...statusStyle(r.status) }}>{STATUS_LABEL[r.status]}</span>
              </div>
              {r.details && <p style={styles.cardDetails}>{r.details}</p>}
              <span style={styles.cardDate}>{new Date(r.created_at).toLocaleString("pt-BR")}</span>

              {r.status !== "concluida" && (
                <div style={styles.cardActions}>
                  <input
                    style={styles.noteInput}
                    placeholder="Nota / resposta pro cliente"
                    value={noteDrafts[r.id] ?? r.admin_notes ?? ""}
                    onChange={(e) => setNoteDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                  />
                  {r.status === "aberta" && (
                    <button style={styles.actionBtn} onClick={() => updateRequest(r.id, "em_andamento")} disabled={savingId === r.id} type="button">
                      Marcar em andamento
                    </button>
                  )}
                  <button style={styles.resolveBtn} onClick={() => updateRequest(r.id, "concluida")} disabled={savingId === r.id} type="button">
                    Marcar concluída
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function statusStyle(status) {
  if (status === "concluida") return { background: "rgba(79,174,126,0.15)", color: "var(--green)" };
  if (status === "em_andamento") return { background: "rgba(232,163,61,0.15)", color: "var(--amber)" };
  return { background: "rgba(92,143,217,0.15)", color: "#5C8FD9" };
}

const styles = {
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0", maxWidth: 640, lineHeight: 1.5 },
  dim: { color: "var(--text-dim)", fontSize: 14 },
  dpoBox: {
    background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: 16, marginBottom: 20, maxWidth: 620,
  },
  dpoTitle: { fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-dim)" },
  dpoText: { fontSize: 12.5, lineHeight: 1.5, margin: "6px 0 12px" },
  dpoForm: { display: "flex", gap: 8, flexWrap: "wrap" },
  dpoSaveBtn: {
    background: "var(--amber)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)",
    padding: "9px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer",
  },
  dpoSavedMsg: { fontSize: 12, color: "var(--green)", marginTop: 6, display: "block" },
  input: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "9px 10px", color: "var(--text)", fontSize: 13, flex: 1, minWidth: 180,
  },
  filterRow: { display: "flex", gap: 8, marginBottom: 16 },
  filterBtn: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "7px 14px", fontSize: 12.5, fontWeight: 600, color: "var(--text-dim)", cursor: "pointer",
  },
  filterBtnActive: { background: "var(--amber)", color: "#FFFFFF", borderColor: "var(--amber)" },
  list: { display: "flex", flexDirection: "column", gap: 12, maxWidth: 720 },
  card: { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 16 },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  cardCompany: { fontSize: 13.5, fontWeight: 700 },
  cardType: { fontSize: 13, color: "var(--text-dim)" },
  badge: { padding: "3px 10px", borderRadius: 20, fontSize: 11.5, fontWeight: 700 },
  cardDetails: { fontSize: 13, margin: "8px 0 4px", color: "var(--text-dim)" },
  cardDate: { fontSize: 11, color: "var(--text-dim)" },
  cardActions: { display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" },
  noteInput: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "8px 10px", fontSize: 12.5, color: "var(--text)", flex: 1, minWidth: 200,
  },
  actionBtn: {
    background: "transparent", border: "1px solid var(--amber)", color: "var(--amber)", borderRadius: "var(--radius)",
    padding: "7px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer",
  },
  resolveBtn: {
    background: "var(--green)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)",
    padding: "7px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer",
  },
};
