import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { confirmDelete } from "../lib/deleteGuard";
import { openPrintWindow, brandHeader } from "../lib/printDocument";

const TYPE_LABEL = {
  acabado: "Produto acabado",
  componente: "Componente",
  materia_prima: "Matéria-prima",
  insumo: "Insumo",
  maquina: "Máquina",
};

/**
 * Estrutura do Produto (BOM): escolhe um produto "pai" (geralmente
 * um produto acabado) e lista/adiciona os componentes que o formam.
 * Usado pelo MRP pra saber o que comprar ou produzir.
 */
export default function EstruturaProdutoPage() {
  const { company } = useAuth();
  const [products, setProducts] = useState([]);
  const [parentId, setParentId] = useState("");
  const [components, setComponents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [newComponentId, setNewComponentId] = useState("");
  const [newQuantity, setNewQuantity] = useState("");

  async function loadProducts() {
    const { data } = await supabase.from("products").select("id, sku, name, type").order("name");
    setProducts(data ?? []);
  }

  async function loadComponents(pid) {
    if (!pid) { setComponents([]); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("product_components")
      .select("id, quantity, component_id, products:component_id (sku, name, unit)")
      .eq("parent_product_id", pid);
    if (error) setError(error.message);
    setComponents(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (company?.id) loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  useEffect(() => {
    loadComponents(parentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentId]);

  async function addComponent(e) {
    e.preventDefault();
    setError("");
    if (!company?.id) {
      setError("Não foi possível identificar sua empresa. Saia e entre novamente.");
      return;
    }
    if (!newComponentId || !newQuantity) return;
    if (newComponentId === parentId) {
      setError("Um produto não pode ser componente de si mesmo.");
      return;
    }
    const { error } = await supabase.from("product_components").insert({
      company_id: company.id,
      parent_product_id: parentId,
      component_id: newComponentId,
      quantity: Number(newQuantity),
    });
    if (error) setError(error.message);
    else {
      setNewComponentId("");
      setNewQuantity("");
      loadComponents(parentId);
    }
  }

  async function removeComponent(id) {
    if (!(await confirmDelete(company))) return;
    await supabase.from("product_components").delete().eq("id", id);
    loadComponents(parentId);
  }

  function printBom() {
    const parent = products.find((p) => p.id === parentId);
    if (!parent) return;

    const rows = components.map((c) => `
      <tr>
        <td>${c.products?.sku ?? ""}</td>
        <td>${c.products?.name ?? ""}</td>
        <td>${c.quantity} ${c.products?.unit ?? ""} / unidade</td>
      </tr>
    `).join("");

    const html = `
      ${brandHeader(company, "ESTRUTURA DO PRODUTO (BOM)", [
        ["Produto", `${parent.sku} — ${parent.name}`],
        ["Classe", TYPE_LABEL[parent.type] ?? parent.type],
      ])}
      <div class="section-title">Componentes</div>
      ${rows ? `
        <table>
          <thead><tr><th>SKU</th><th>Componente</th><th>Qtd. por unidade</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      ` : `<div class="notes-box">Nenhum componente cadastrado ainda para este produto.</div>`}
    `;

    openPrintWindow(`Estrutura do Produto — ${parent.sku}`, html);
  }

  const availableComponents = products.filter((p) => p.id !== parentId);

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={styles.title}>Estrutura do Produto (BOM)</h1>
        <p style={styles.subtitle}>
          Escolha um produto e defina de quais componentes/matérias-primas ele é formado.
          Isso é usado pelo cálculo de MRP para saber o que comprar ou produzir.
        </p>
      </header>

      <div style={styles.topRow}>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>Produto</span>
          <select style={styles.input} value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">Selecione um produto...</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.sku} — {p.name} ({TYPE_LABEL[p.type]})
              </option>
            ))}
          </select>
        </label>
        <button style={styles.printBtn} onClick={printBom} disabled={!parentId} type="button">🖨 Imprimir</button>
      </div>

      {parentId && (
        <>
          {error && <div style={styles.error}>{error}</div>}

          <form onSubmit={addComponent} style={styles.form}>
            <label style={styles.field}>
              <span style={styles.fieldLabel}>Componente</span>
              <select
                style={styles.input}
                value={newComponentId}
                onChange={(e) => setNewComponentId(e.target.value)}
                required
              >
                <option value="">Selecione...</option>
                {availableComponents.map((p) => (
                  <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>
                ))}
              </select>
            </label>
            <label style={styles.field}>
              <span style={styles.fieldLabel}>Quantidade por unidade</span>
              <input
                style={styles.input}
                type="number"
                step="any"
                value={newQuantity}
                onChange={(e) => setNewQuantity(e.target.value)}
                placeholder="Ex: 4"
                required
              />
            </label>
            <button style={styles.addBtn} type="submit">+ Adicionar</button>
          </form>

          {loading ? (
            <p style={styles.dim}>Carregando...</p>
          ) : components.length === 0 ? (
            <p style={styles.dim}>Nenhum componente definido para este produto ainda.</p>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>SKU</th>
                    <th style={styles.th}>Componente</th>
                    <th style={styles.th}>Qtd. por unidade</th>
                    <th style={styles.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {components.map((c) => (
                    <tr key={c.id}>
                      <td style={styles.td}>{c.products?.sku}</td>
                      <td style={styles.td}>{c.products?.name}</td>
                      <td style={styles.td}>{c.quantity} {c.products?.unit}</td>
                      <td style={{ ...styles.td, textAlign: "right" }}>
                        <button style={styles.deleteBtn} onClick={() => removeComponent(c.id)} type="button">
                          Remover
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const styles = {
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0", maxWidth: 560, lineHeight: 1.5 },
  topRow: { display: "flex", gap: 12, alignItems: "flex-end", marginTop: 20, marginBottom: 16 },
  field: { display: "flex", flexDirection: "column", gap: 6, maxWidth: 420, flex: 1 },
  fieldLabel: { fontSize: 11, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" },
  input: {
    background: "var(--panel-2)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius)",
    padding: "9px 10px",
    color: "var(--text)",
    fontSize: 13,
  },
  printBtn: {
    background: "var(--amber)", color: "#FFFFFF", border: "none",
    borderRadius: "var(--radius)", padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap",
  },
  form: {
    display: "grid",
    gridTemplateColumns: "1fr 180px auto",
    gap: 12,
    alignItems: "end",
    background: "var(--panel)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius)",
    padding: 16,
    marginBottom: 20,
  },
  addBtn: {
    background: "var(--amber)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)",
    padding: "9px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap",
  },
  dim: { color: "var(--text-dim)", fontSize: 13 },
  tableWrap: { border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden", overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em",
    color: "var(--text-dim)", padding: "10px 14px", background: "var(--panel-2)", borderBottom: "1px solid var(--line)",
  },
  td: { padding: "10px 14px", fontSize: 13.5, borderBottom: "1px solid var(--line)" },
  deleteBtn: {
    background: "transparent", border: "1px solid var(--red)", color: "var(--red)", borderRadius: "var(--radius)",
    padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer",
  },
  error: {
    background: "rgba(217,105,95,0.12)", border: "1px solid var(--red)", color: "var(--red)",
    borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 13, marginBottom: 16, maxWidth: 620,
  },
};
