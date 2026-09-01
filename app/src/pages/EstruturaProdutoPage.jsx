import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { confirmDelete } from "../lib/deleteGuard";
import { openPrintWindow, brandHeader } from "../lib/printDocument";

const TYPE_LABEL = {
  acabado: "Produto acabado",
  componente: "Componente / semiacabado",
  materia_prima: "Matéria-prima",
  insumo: "Insumo",
  maquina: "Máquina",
};

const TYPE_HELP = {
  acabado: "É o item que será vendido/entregue ao cliente. Normalmente é o produto pai da BOM.",
  componente: "É um conjunto ou item intermediário que pode ter sua própria estrutura e entrar em outro produto.",
  materia_prima: "Material básico consumido na fabricação, normalmente comprado de fornecedor.",
  insumo: "Material de consumo usado no processo, sem necessariamente fazer parte da estrutura física do produto.",
  maquina: "Recurso produtivo/equipamento. Não deve ser cadastrado como componente de uma BOM.",
};

const TYPE_ICON = { acabado: "◆", componente: "◇", materia_prima: "▰", insumo: "•", maquina: "⚙" };

function TypeBadge({ type }) {
  return (
    <span style={{ ...styles.badge, ...(styles.badges[type] ?? {}) }}>
      <span>{TYPE_ICON[type] ?? "•"}</span> {TYPE_LABEL[type] ?? type}
    </span>
  );
}

function TypeCard({ type, title, description }) {
  return (
    <div style={{ ...styles.typeCard, ...(styles.typeCards[type] ?? {}) }}>
      <div style={styles.typeCardTitle}><span>{TYPE_ICON[type]}</span>{title}</div>
      <div style={styles.typeCardText}>{description}</div>
    </div>
  );
}

/**
 * Estrutura do Produto (BOM).
 * Regra de negócio: o produto pai é um Produto acabado ou Componente/semiacabado.
 * Os itens da estrutura são Componentes, Matérias-primas ou Insumos.
 * Máquinas pertencem aos recursos/centros de trabalho e não à BOM.
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
    if (!company?.id) return;
    const { data, error: loadError } = await supabase
      .from("products")
      .select("id, sku, name, type, unit")
      .eq("company_id", company.id)
      .order("name");
    if (loadError) setError(loadError.message);
    setProducts(data ?? []);
  }

  async function loadComponents(pid) {
    if (!pid) { setComponents([]); return; }
    setLoading(true);
    const { data, error: loadError } = await supabase
      .from("product_components")
      .select("id, quantity, component_id, products:component_id (sku, name, type, unit)")
      .eq("parent_product_id", pid);
    if (loadError) setError(loadError.message);
    setComponents(data ?? []);
    setLoading(false);
  }

  useEffect(() => { loadProducts(); }, [company?.id]);
  useEffect(() => { loadComponents(parentId); }, [parentId]);

  const parentProducts = useMemo(
    () => products.filter((p) => ["acabado", "componente"].includes(p.type)),
    [products]
  );

  const availableComponents = useMemo(
    () => products.filter((p) => p.id !== parentId && ["componente", "materia_prima", "insumo"].includes(p.type)),
    [products, parentId]
  );

  const groupedComponents = useMemo(() => ({
    componente: availableComponents.filter((p) => p.type === "componente"),
    materia_prima: availableComponents.filter((p) => p.type === "materia_prima"),
    insumo: availableComponents.filter((p) => p.type === "insumo"),
  }), [availableComponents]);

  const selectedParent = products.find((p) => p.id === parentId);

  async function addComponent(e) {
    e.preventDefault();
    setError("");
    if (!company?.id) return setError("Não foi possível identificar sua empresa. Saia e entre novamente.");
    if (!parentId) return setError("Selecione primeiro o produto que terá sua estrutura cadastrada.");
    if (!newComponentId || !newQuantity || Number(newQuantity) <= 0) return;
    const selected = products.find((p) => p.id === newComponentId);
    if (!selected || !["componente", "materia_prima", "insumo"].includes(selected.type)) {
      setError("Somente Componentes, Matérias-primas e Insumos podem entrar na estrutura do produto.");
      return;
    }
    const { error: insertError } = await supabase.from("product_components").insert({
      company_id: company.id,
      parent_product_id: parentId,
      component_id: newComponentId,
      quantity: Number(newQuantity),
    });
    if (insertError) setError(insertError.message);
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
    if (!selectedParent) return;
    const rows = components.map((c) => `
      <tr>
        <td>${c.products?.sku ?? ""}</td>
        <td>${c.products?.name ?? ""}</td>
        <td>${TYPE_LABEL[c.products?.type] ?? c.products?.type ?? ""}</td>
        <td>${c.quantity} ${c.products?.unit ?? ""}</td>
      </tr>
    `).join("");
    const html = `
      ${brandHeader(company, "ESTRUTURA DO PRODUTO (BOM)", [
        ["Produto pai", `${selectedParent.sku} — ${selectedParent.name}`],
        ["Classe", TYPE_LABEL[selectedParent.type] ?? selectedParent.type],
      ])}
      <div class="section-title">Materiais e componentes da estrutura</div>
      ${rows ? `<table><thead><tr><th>SKU</th><th>Item</th><th>Tipo</th><th>Qtd. por unidade</th></tr></thead><tbody>${rows}</tbody></table>` : `<div class="notes-box">Nenhum item cadastrado ainda para este produto.</div>`}
    `;
    openPrintWindow(`Estrutura do Produto — ${selectedParent.sku}`, html);
  }

  return (
    <div>
      <header style={{ marginBottom: 18 }}>
        <h1 style={styles.title}>Estrutura do Produto (BOM)</h1>
        <p style={styles.subtitle}>
          Monte a composição de um produto de forma clara: primeiro escolha o <strong>Produto</strong> ou <strong>Componente/semiacabado</strong> que será fabricado e depois informe os materiais que o formam.
        </p>
      </header>

      <section style={styles.legend}>
        <div style={styles.legendTitle}>Entenda cada tipo antes de montar a BOM</div>
        <div style={styles.typeGrid}>
          <TypeCard type="acabado" title="PRODUTO ACABADO" description="Item final fabricado e normalmente vendido ao cliente." />
          <TypeCard type="componente" title="COMPONENTE / SEMIACABADO" description="Conjunto intermediário que pode ter sua própria BOM." />
          <TypeCard type="materia_prima" title="MATÉRIA-PRIMA" description="Material básico que entra fisicamente na fabricação." />
          <TypeCard type="insumo" title="INSUMO" description="Material consumido no processo de fabricação." />
        </div>
        <div style={styles.rule}><strong>Regra da BOM:</strong> Produto acabado/semiacabado → Componentes + Matérias-primas + Insumos. <span>Máquinas não entram na BOM.</span></div>
      </section>

      <section style={styles.selectorCard}>
        <div style={styles.sectionHeading}>1. Produto que será fabricado</div>
        <div style={styles.sectionHint}>Aqui você escolhe o <strong>produto pai</strong>. Máquinas, matérias-primas e insumos não podem ser selecionados como produto pai.</div>
        <div style={styles.topRow}>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Produto / semiacabado</span>
            <select style={styles.input} value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">Selecione o produto que terá a BOM...</option>
              {parentProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} — {p.name} · {TYPE_LABEL[p.type]}
                </option>
              ))}
            </select>
          </label>
          <button style={styles.printBtn} onClick={printBom} disabled={!parentId} type="button">🖨 Imprimir BOM</button>
        </div>
        {selectedParent && (
          <div style={styles.selectedProduct}>
            <div><span style={styles.selectedLabel}>PRODUTO PAI</span><strong>{selectedParent.sku} — {selectedParent.name}</strong></div>
            <TypeBadge type={selectedParent.type} />
          </div>
        )}
      </section>

      {parentId && (
        <>
          {error && <div style={styles.error}>{error}</div>}

          <section style={styles.builderCard}>
            <div style={styles.sectionHeading}>2. Adicionar itens à estrutura</div>
            <div style={styles.sectionHint}>Escolha somente o que realmente compõe ou é consumido na fabricação do produto.</div>
            <form onSubmit={addComponent} style={styles.form}>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Componente / MP / Insumo</span>
                <select style={styles.input} value={newComponentId} onChange={(e) => setNewComponentId(e.target.value)} required>
                  <option value="">Selecione o item...</option>
                  {Object.entries(groupedComponents).map(([type, items]) => items.length > 0 && (
                    <optgroup key={type} label={TYPE_LABEL[type]}>
                      {items.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Quantidade por unidade</span>
                <input style={styles.input} type="number" min="0.000001" step="any" value={newQuantity} onChange={(e) => setNewQuantity(e.target.value)} placeholder="Ex.: 4" required />
              </label>
              <button style={styles.addBtn} type="submit">+ Adicionar item</button>
            </form>
            <div style={styles.formHelp}>
              <span><b>Componente</b> = conjunto/semiacabado</span>
              <span><b>MP</b> = matéria-prima</span>
              <span><b>Insumo</b> = consumo de processo</span>
            </div>
          </section>

          <section style={styles.resultCard}>
            <div style={styles.resultHeader}>
              <div><div style={styles.sectionHeading}>3. Composição cadastrada</div><div style={styles.sectionHint}>Estes são os itens que o MRP poderá considerar para calcular necessidades.</div></div>
              <div style={styles.count}>{components.length} {components.length === 1 ? "item" : "itens"}</div>
            </div>
            {loading ? (
              <p style={styles.dim}>Carregando estrutura...</p>
            ) : components.length === 0 ? (
              <div style={styles.empty}><strong>Nenhum item cadastrado.</strong><span>Adicione componentes, matérias-primas ou insumos acima.</span></div>
            ) : (
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead><tr><th style={styles.th}>SKU</th><th style={styles.th}>Item</th><th style={styles.th}>Tipo</th><th style={styles.th}>Quantidade</th><th style={styles.th}></th></tr></thead>
                  <tbody>{components.map((c) => (
                    <tr key={c.id}>
                      <td style={styles.tdStrong}>{c.products?.sku}</td>
                      <td style={styles.td}>{c.products?.name}</td>
                      <td style={styles.td}><TypeBadge type={c.products?.type} /></td>
                      <td style={styles.td}>{c.quantity} {c.products?.unit ?? ""}</td>
                      <td style={{ ...styles.td, textAlign: "right" }}><button style={styles.deleteBtn} onClick={() => removeComponent(c.id)} type="button">Remover</button></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

const styles = {
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0", maxWidth: 760, lineHeight: 1.55 },
  legend: { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 16, marginBottom: 16 },
  legendTitle: { fontSize: 12, fontWeight: 800, color: "var(--text)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 12 },
  typeGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 10 },
  typeCard: { border: "1px solid var(--line)", borderRadius: 10, padding: 12, background: "var(--panel-2)" },
  typeCards: {
    acabado: { borderLeft: "4px solid var(--amber)" },
    componente: { borderLeft: "4px solid var(--green)" },
    materia_prima: { borderLeft: "4px solid #7b8cff" },
    insumo: { borderLeft: "4px solid #b28cff" },
  },
  typeCardTitle: { display: "flex", gap: 7, alignItems: "center", fontSize: 11, fontWeight: 800, marginBottom: 5 },
  typeCardText: { color: "var(--text-dim)", fontSize: 11.5, lineHeight: 1.4 },
  rule: { marginTop: 12, padding: "9px 11px", background: "rgba(232,164,64,.08)", border: "1px solid rgba(232,164,64,.22)", borderRadius: 8, fontSize: 12, color: "var(--text-dim)" },
  selectorCard: { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 16, marginBottom: 16 },
  builderCard: { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 16, marginBottom: 16 },
  resultCard: { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 16 },
  sectionHeading: { fontSize: 14, fontWeight: 800, color: "var(--text)" },
  sectionHint: { color: "var(--text-dim)", fontSize: 12, marginTop: 3, lineHeight: 1.45 },
  topRow: { display: "flex", gap: 12, alignItems: "flex-end", marginTop: 14 },
  field: { display: "flex", flexDirection: "column", gap: 6, maxWidth: 620, flex: 1 },
  fieldLabel: { fontSize: 11, color: "var(--text-dim)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em" },
  input: { background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: "10px 11px", color: "var(--text)", fontSize: 13, width: "100%" },
  printBtn: { background: "var(--amber)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)", padding: "10px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" },
  selectedProduct: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 12, padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 9, background: "var(--panel-2)" },
  selectedLabel: { display: "block", fontSize: 9, fontWeight: 800, color: "var(--text-dim)", letterSpacing: ".08em", marginBottom: 3 },
  form: { display: "grid", gridTemplateColumns: "1fr 180px auto", gap: 12, alignItems: "end", marginTop: 14 },
  addBtn: { background: "var(--amber)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)", padding: "10px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" },
  formHelp: { display: "flex", gap: 16, flexWrap: "wrap", color: "var(--text-dim)", fontSize: 11, marginTop: 10 },
  resultHeader: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 12 },
  count: { background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 99, padding: "5px 10px", fontSize: 11, color: "var(--text-dim)", whiteSpace: "nowrap" },
  badge: { display: "inline-flex", alignItems: "center", gap: 4, borderRadius: 99, padding: "4px 8px", fontSize: 10.5, fontWeight: 700, whiteSpace: "nowrap", border: "1px solid var(--line)", background: "var(--panel-2)" },
  badges: { acabado: { color: "var(--amber)" }, componente: { color: "var(--green)" }, materia_prima: { color: "#7b8cff" }, insumo: { color: "#b28cff" }, maquina: { color: "var(--text-dim)" } },
  tableWrap: { border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden", overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--text-dim)", padding: "10px 14px", background: "var(--panel-2)", borderBottom: "1px solid var(--line)" },
  td: { padding: "10px 14px", fontSize: 13, borderBottom: "1px solid var(--line)" },
  tdStrong: { padding: "10px 14px", fontSize: 13, fontWeight: 700, borderBottom: "1px solid var(--line)" },
  deleteBtn: { background: "transparent", border: "1px solid var(--red)", color: "var(--red)", borderRadius: "var(--radius)", padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  dim: { color: "var(--text-dim)", fontSize: 13 },
  empty: { display: "flex", flexDirection: "column", gap: 4, alignItems: "center", justifyContent: "center", padding: "28px 10px", color: "var(--text-dim)", fontSize: 12, textAlign: "center" },
  error: { background: "rgba(217,105,95,0.12)", border: "1px solid var(--red)", color: "var(--red)", borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 13, marginBottom: 16 },
};
