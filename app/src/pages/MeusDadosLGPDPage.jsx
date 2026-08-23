import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

const TYPE_LABEL = {
  acesso: "Acesso aos meus dados",
  exclusao: "Exclusão dos meus dados",
  portabilidade: "Portabilidade dos meus dados",
  correcao: "Correção de algum dado",
};
const STATUS_LABEL = { aberta: "Aberta", em_andamento: "Em andamento", concluida: "Concluída" };

/**
 * Meus Dados (LGPD): direito do titular de dados garantido pela
 * LGPD — pedir acesso, exclusão, portabilidade ou correção dos dados
 * que o ProdOS guarda sobre a empresa. A equipe é avisada por e-mail
 * assim que uma solicitação é aberta.
 */
export default function MeusDadosLGPDPage() {
  const { company, profile } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState("acesso");
  const [details, setDetails] = useState("");
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  async function loadRequests() {
    setLoading(true);
    const { data } = await supabase
      .from("lgpd_requests")
      .select("id, request_type, details, status, admin_notes, created_at, resolved_at")
      .order("created_at", { ascending: false });
    setRequests(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (company?.id) loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  async function submitRequest(e) {
    e.preventDefault();
    if (!company?.id) return;
    setSaving(true);
    const { data: request, error } = await supabase
      .from("lgpd_requests")
      .insert({ company_id: company.id, requested_by: profile.id, request_type: type, details: details || null })
      .select("id").single();

    if (!error && request) {
      supabase.functions.invoke("notify-lgpd-request", { body: { requestId: request.id } });
      setDetails(""); setType("acesso"); setShowForm(false);
      await loadRequests();
    }
    setSaving(false);
  }

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={styles.title}>Meus Dados (LGPD)</h1>
        <p style={styles.subtitle}>
          Pela Lei Geral de Proteção de Dados, você pode solicitar acesso, correção, portabilidade
          ou exclusão dos dados que o ProdOS guarda sobre sua empresa. Toda solicitação é
          respondida por e-mail.
        </p>
      </header>

      <button style={styles.addBtn} onClick={() => setShowForm((v) => !v)} type="button">
        {showForm ? "Cancelar" : "+ Nova solicitação"}
      </button>

      {showForm && (
        <form onSubmit={submitRequest} style={styles.form}>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>O que você precisa?</span>
            <select style={styles.input} value={type} onChange={(e) => setType(e.target.value)}>
              {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Detalhes (opcional)</span>
            <textarea style={styles.textarea} rows={3} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Ex: preciso da lista de todos os funcionários cadastrados" />
          </label>
          {type === "exclusao" && (
            <div style={styles.warning}>
              A exclusão total dos dados encerra sua conta no ProdOS. Nossa equipe vai confirmar com
              você antes de executar.
            </div>
          )}
          <button style={styles.submitBtn} type="submit" disabled={saving}>{saving ? "Enviando..." : "Enviar solicitação"}</button>
        </form>
      )}

      <div style={styles.wrap}>
        <h2 style={styles.title2}>Histórico</h2>
        {loading ? (
          <p style={styles.dim}>Carregando...</p>
        ) : requests.length === 0 ? (
          <p style={styles.dim}>Nenhuma solicitação feita ainda.</p>
        ) : (
          <div style={styles.list}>
            {requests.map((r) => (
              <div key={r.id} style={styles.card}>
                <div style={styles.cardHeader}>
                  <span style={styles.cardType}>{TYPE_LABEL[r.request_type]}</span>
                  <span style={{ ...styles.badge, ...statusStyle(r.status) }}>{STATUS_LABEL[r.status]}</span>
                </div>
                {r.details && <p style={styles.cardDetails}>{r.details}</p>}
                {r.admin_notes && <p style={styles.cardResponse}>Resposta: {r.admin_notes}</p>}
                <span style={styles.cardDate}>{new Date(r.created_at).toLocaleString("pt-BR")}</span>
              </div>
            ))}
          </div>
        )}
      </div>
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
  title2: { fontFamily: "var(--font-display)", fontSize: 18, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0", maxWidth: 640, lineHeight: 1.5 },
  dim: { color: "var(--text-dim)", fontSize: 14 },
  wrap: { marginTop: 32, paddingTop: 24, borderTop: "1px solid var(--line)" },
  addBtn: {
    background: "var(--amber)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)",
    padding: "9px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", marginBottom: 16,
  },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  fieldLabel: { fontSize: 11, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" },
  input: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "9px 10px", color: "var(--text)", fontSize: 13,
  },
  textarea: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "9px 10px", color: "var(--text)", fontSize: 13, resize: "vertical",
  },
  form: {
    display: "flex", flexDirection: "column", gap: 14,
    background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: 20, marginBottom: 20, maxWidth: 560,
  },
  warning: {
    background: "rgba(217,105,95,0.1)", border: "1px solid var(--red)", color: "var(--text)",
    borderRadius: "var(--radius)", padding: "10px 14px", fontSize: 12.5, lineHeight: 1.5,
  },
  submitBtn: {
    background: "var(--green)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)",
    padding: "10px 0", fontWeight: 700, fontSize: 13, cursor: "pointer",
  },
  list: { display: "flex", flexDirection: "column", gap: 10, maxWidth: 560 },
  card: { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 14 },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  cardType: { fontSize: 13.5, fontWeight: 700 },
  badge: { padding: "3px 10px", borderRadius: 20, fontSize: 11.5, fontWeight: 700 },
  cardDetails: { fontSize: 13, margin: "8px 0 4px", color: "var(--text-dim)" },
  cardResponse: { fontSize: 13, margin: "4px 0", color: "var(--green)" },
  cardDate: { fontSize: 11, color: "var(--text-dim)" },
};
