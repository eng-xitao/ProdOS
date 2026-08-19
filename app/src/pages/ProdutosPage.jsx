import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import ModulePage from "../components/ModulePage";

const TYPE_LABEL = {
  acabado: "Produto acabado",
  componente: "Componente",
  materia_prima: "Matéria-prima",
};

export default function ProdutosPage() {
  return (
    <div>
      <ModulePage
        table="products"
        title="Produtos"
        subtitle="Cadastro de produtos, componentes e matérias-primas"
        emptyLabel="Nenhum produto cadastrado ainda."
        fields={[
          { key: "sku", label: "SKU", placeholder: "Ex: PRD-001", required: true },
          { key: "name", label: "Nome", placeholder: "Ex: Portão basculante 3x2m", required: true },
          {
            key: "type",
            label: "Tipo",
            type: "select",
            required: true,
            options: ["acabado", "componente", "materia_prima"],
          },
          { key: "unit", label: "Unidade", placeholder: "un, kg, m..." },
          { key: "cost", label: "Custo (R$)", type: "number" },
          { key: "sale_price", label: "Preço de venda (R$)", type: "number" },
          { key: "lead_time_days", label: "Lead time (dias)", type: "number" },
        ]}
      />
      <BomEditor />
    </div>
  );
}

/**
 * Gestão da estrutura de produto (BOM): escolhe um produto "pai" (geralmente
 * um produto acabado) e lista/adiciona os componentes que o formam.
 */
function BomEditor() {
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
    await supabase.from("product_components").delete().eq("id", id);
    loadComponents(parentId);
  }

  const availableComponents = products.filter((p) => p.id !== parentId);

  return (
    <div style={styles.wrap}>
      <h2 style={styles.title}>Estrutura de produto (BOM)</h2>
      <p style={styles.subtitle}>
        Escolha um produto e defina de quais componentes/matérias-primas ele é formado.
        Isso será usado pelo cálculo de MRP para saber o que comprar ou produzir.
      </p>

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
  wrap: {
    marginTop: 36,
    paddingTop: 28,
    borderTop: "1px solid var(--line)",
  },
  title: { fontFamily: "var(--font-display)", fontSize: 18, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 18px", maxWidth: 560, lineHeight: 1.5 },
  field: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 16, maxWidth: 420 },
  fieldLabel: { fontSize: 11, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" },
  input: {
    background: "var(--panel-2)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius)",
    padding: "9px 10px",
    color: "var(--text)",
    fontSize: 13,
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
    marginBottom: 18,
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
    height: 38,
  },
  dim: { color: "var(--text-dim)", fontSize: 14 },
  tableWrap: { border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden", maxWidth: 640 },
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
    maxWidth: 560,
  },
};
