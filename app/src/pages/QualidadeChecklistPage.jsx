import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { Link } from "react-router-dom";

/**
 * Checklist de Qualidade: define os itens de inspeção de cada etapa
 * de produção, uma vez só. Esses itens reaparecem automaticamente
 * toda vez que alguém for inspecionar uma OP naquela etapa.
 */
export default function QualidadeChecklistPage() {
  const { company } = useAuth();
  const [stages, setStages] = useState([]);
  const [items, setItems] = useState([]);
  const [stageId, setStageId] = useState("");
  const [newItemText, setNewItemText] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  async function loadStages() {
    const { data } = await supabase.from("production_stages").select("id, name").order("sort_order");
    setStages(data ?? []);
  }

  async function loadItems(sid) {
    if (!sid) { setItems([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("quality_checklist_items")
      .select("id, item_text, sort_order")
      .eq("stage_id", sid)
      .order("sort_order");
    setItems(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (company?.id) loadStages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  useEffect(() => { loadItems(stageId); }, [stageId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function addItem(e) {
    e.preventDefault();
    if (!newItemText.trim() || !stageId) return;
    setSaving(true);
    await supabase.from("quality_checklist_items").insert({
      company_id: company.id, stage_id: stageId, item_text: newItemText, sort_order: items.length,
    });
    setNewItemText("");
    await loadItems(stageId);
    setSaving(false);
  }

  async function removeItem(id) {
    if (!window.confirm("Tem certeza que deseja excluir? Essa ação não pode ser desfeita.")) return;
    await supabase.from("quality_checklist_items").delete().eq("id", id);
    loadItems(stageId);
  }

  if (stages.length === 0) {
    return (
      <div style={styles.notice}>
        Nenhuma etapa de produção cadastrada ainda. Cadastre em{" "}
        <Link to="/etapas" style={styles.link}>Cadastro → Etapas de Produção</Link> antes de montar um checklist.
      </div>
    );
  }

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={styles.title}>Checklist de Qualidade</h1>
        <p style={styles.subtitle}>
          Defina os pontos de inspeção de cada etapa. Eles aparecem automaticamente em PCP →
          Inspeção de Qualidade toda vez que alguém for inspecionar uma OP naquela etapa.
        </p>
      </header>

      <label style={styles.field}>
        <span style={styles.fieldLabel}>Etapa</span>
        <select style={styles.input} value={stageId} onChange={(e) => setStageId(e.target.value)}>
          <option value="">Selecione uma etapa...</option>
          {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>

      {stageId && (
        <>
          <form onSubmit={addItem} style={styles.form}>
            <input
              style={styles.input}
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              placeholder="Ex: Solda sem porosidade visível"
            />
            <button style={styles.addBtn} type="submit" disabled={saving}>Adicionar</button>
          </form>

          {loading ? (
            <p style={styles.dim}>Carregando...</p>
          ) : items.length === 0 ? (
            <p style={styles.dim}>Nenhum item nessa etapa ainda.</p>
          ) : (
            <div style={styles.list}>
              {items.map((it) => (
                <div key={it.id} style={styles.listItem}>
                  <span>{it.item_text}</span>
                  <button style={styles.removeBtn} onClick={() => removeItem(it.id)} type="button">Remover</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const styles = {
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0", maxWidth: 640, lineHeight: 1.5 },
  notice: {
    background: "rgba(232,163,61,0.1)", border: "1px solid var(--amber)", color: "var(--text)",
    borderRadius: "var(--radius)", padding: "14px 16px", fontSize: 13.5, lineHeight: 1.5, maxWidth: 620,
  },
  link: { color: "var(--amber)", fontWeight: 600 },
  dim: { color: "var(--text-dim)", fontSize: 14 },
  field: { display: "flex", flexDirection: "column", gap: 6, marginTop: 16, marginBottom: 16, maxWidth: 320 },
  fieldLabel: { fontSize: 11, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" },
  input: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "9px 10px", color: "var(--text)", fontSize: 13, flex: 1,
  },
  form: { display: "flex", gap: 10, marginBottom: 16, maxWidth: 560 },
  addBtn: {
    background: "var(--amber)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)",
    padding: "9px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer",
  },
  list: { display: "flex", flexDirection: "column", gap: 8, maxWidth: 560 },
  listItem: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "10px 14px", fontSize: 13.5,
  },
  removeBtn: {
    background: "transparent", border: "1px solid var(--line)", color: "var(--red)", borderRadius: "var(--radius)",
    padding: "5px 10px", fontSize: 12, cursor: "pointer",
  },
};
