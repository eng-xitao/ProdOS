import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import ModulePage from "../components/ModulePage";

export default function ProducaoPage() {
  const { company } = useAuth();
  const [stages, setStages] = useState([]);

  async function loadStages() {
    const { data } = await supabase
      .from("production_stages")
      .select("id, name, sort_order")
      .order("sort_order", { ascending: true });
    setStages(data ?? []);
  }

  useEffect(() => {
    if (company?.id) loadStages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  const stageOptions = stages.map((s) => ({ value: s.id, label: s.name }));

  return (
    <div>
      {stages.length === 0 ? (
        <div style={styles.notice}>
          Antes de cadastrar ordens de produção, configure ao menos uma etapa do seu processo
          logo abaixo (ex: "Recebimento", "Em produção", "Entregue" — o que fizer sentido para o seu negócio).
        </div>
      ) : (
        <ModulePage
          table="production_orders"
          title="Produção"
          subtitle="Ordens de produção e etapa atual"
          emptyLabel="Nenhuma ordem de produção cadastrada ainda."
          fields={[
            { key: "code", label: "Código", placeholder: "OP-0001", required: true },
            { key: "product_name", label: "Produto/Serviço", placeholder: "Ex: Portão basculante", required: true },
            { key: "quantity", label: "Quantidade", type: "number", required: true },
            { key: "stage_id", label: "Etapa", type: "select", required: true, options: stageOptions },
            { key: "due_date", label: "Prazo", type: "date" },
          ]}
        />
      )}

      <StageEditor stages={stages} onChange={loadStages} />
    </div>
  );
}

/**
 * Gestão das etapas do processo produtivo — cada empresa define
 * livremente o próprio fluxo, para servir qualquer segmento.
 */
function StageEditor({ stages, onChange }) {
  const { company } = useAuth();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function addStage(e) {
    e.preventDefault();
    if (!company?.id) {
      setError("Não foi possível identificar sua empresa. Saia e entre novamente.");
      return;
    }
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    const nextOrder = stages.length > 0 ? Math.max(...stages.map((s) => s.sort_order)) + 1 : 0;
    const { error } = await supabase
      .from("production_stages")
      .insert({ company_id: company.id, name: name.trim(), sort_order: nextOrder });
    if (error) setError(error.message);
    else {
      setName("");
      onChange();
    }
    setSaving(false);
  }

  async function removeStage(id) {
    await supabase.from("production_stages").delete().eq("id", id);
    onChange();
  }

  return (
    <div style={styles.wrap}>
      <h2 style={styles.title}>Etapas do seu processo</h2>
      <p style={styles.subtitle}>
        Configure as etapas do jeito que fizer sentido para o seu negócio — não precisa ser produção
        industrial. A ordem abaixo define a sequência exibida nas ordens.
      </p>

      {error && <div style={styles.error}>{error}</div>}

      <form onSubmit={addStage} style={styles.form}>
        <input
          style={styles.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Corte, Triagem, Revisão, Faturamento..."
        />
        <button style={styles.addBtn} type="submit" disabled={saving}>
          {saving ? "Salvando..." : "+ Adicionar etapa"}
        </button>
      </form>

      {stages.length === 0 ? (
        <p style={styles.dim}>Nenhuma etapa configurada ainda.</p>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Ordem</th>
                <th style={styles.th}>Etapa</th>
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {stages.map((s) => (
                <tr key={s.id}>
                  <td style={styles.td}>{s.sort_order}</td>
                  <td style={styles.td}>{s.name}</td>
                  <td style={{ ...styles.td, textAlign: "right" }}>
                    <button style={styles.deleteBtn} onClick={() => removeStage(s.id)} type="button">
                      Remover
                    </button>
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

const styles = {
  notice: {
    background: "rgba(232,163,61,0.1)",
    border: "1px solid var(--amber)",
    color: "var(--text)",
    borderRadius: "var(--radius)",
    padding: "14px 16px",
    fontSize: 13.5,
    lineHeight: 1.5,
    marginBottom: 28,
    maxWidth: 620,
  },
  wrap: {
    marginTop: 36,
    paddingTop: 28,
    borderTop: "1px solid var(--line)",
  },
  title: { fontFamily: "var(--font-display)", fontSize: 18, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 18px", maxWidth: 560, lineHeight: 1.5 },
  form: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 12,
    background: "var(--panel)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius)",
    padding: 16,
    marginBottom: 18,
    maxWidth: 520,
  },
  input: {
    background: "var(--panel-2)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius)",
    padding: "9px 10px",
    color: "var(--text)",
    fontSize: 13,
  },
  addBtn: {
    background: "var(--green)",
    color: "#052014",
    border: "none",
    borderRadius: "var(--radius)",
    padding: "9px 16px",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  dim: { color: "var(--text-dim)", fontSize: 14 },
  tableWrap: { border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden", maxWidth: 480 },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: "var(--text-dim)",
    padding: "10px 14px",
    background: "var(--panel)",
    borderBottom: "1px solid var(--line)",
  },
  td: { padding: "10px 14px", fontSize: 13.5, background: "var(--panel)", borderBottom: "1px solid var(--line)" },
  deleteBtn: {
    background: "transparent",
    border: "1px solid var(--line)",
    color: "var(--red)",
    borderRadius: "var(--radius)",
    padding: "5px 10px",
    fontSize: 12,
    cursor: "pointer",
  },
  error: {
    background: "rgba(217,105,95,0.12)",
    border: "1px solid var(--red)",
    color: "var(--red)",
    borderRadius: "var(--radius)",
    padding: "10px 12px",
    fontSize: 13,
    marginBottom: 16,
    maxWidth: 520,
  },
};
