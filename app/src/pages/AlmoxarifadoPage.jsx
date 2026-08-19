import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { Link } from "react-router-dom";

/**
 * Mostra e ajusta a quantidade de cada produto em cada almoxarifado
 * (local de estoque). Um mesmo produto pode ter quantidades
 * diferentes em locais diferentes (ex: insumos vs produtos acabados).
 */
export default function AlmoxarifadoPage() {
  const { company } = useAuth();
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [levels, setLevels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [adjustProductId, setAdjustProductId] = useState("");
  const [adjustType, setAdjustType] = useState("entrada");
  const [adjustQty, setAdjustQty] = useState("");

  async function loadWarehouses() {
    const { data } = await supabase.from("warehouses").select("id, name").order("name");
    setWarehouses(data ?? []);
  }

  async function loadProducts() {
    const { data } = await supabase.from("products").select("id, sku, name, unit").order("name");
    setProducts(data ?? []);
  }

  async function loadLevels(wid) {
    if (!wid) { setLevels([]); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("stock_levels")
      .select("id, quantity, product_id, products:product_id (sku, name, unit)")
      .eq("warehouse_id", wid);
    if (error) setError(error.message);
    setLevels(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (company?.id) { loadWarehouses(); loadProducts(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  useEffect(() => {
    loadLevels(warehouseId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseId]);

  async function applyAdjustment(e) {
    e.preventDefault();
    setError("");
    if (!company?.id || !warehouseId || !adjustProductId || !adjustQty) return;

    const existing = levels.find((l) => l.product_id === adjustProductId);
    const delta = adjustType === "entrada" ? Number(adjustQty) : -Number(adjustQty);
    const newQuantity = Math.max(0, Number(existing?.quantity ?? 0) + delta);

    if (existing) {
      const { error } = await supabase.from("stock_levels").update({ quantity: newQuantity, updated_at: new Date().toISOString() }).eq("id", existing.id);
      if (error) setError(error.message);
    } else {
      const { error } = await supabase.from("stock_levels").insert({
        company_id: company.id, product_id: adjustProductId, warehouse_id: warehouseId, quantity: newQuantity,
      });
      if (error) setError(error.message);
    }

    setAdjustProductId(""); setAdjustQty("");
    loadLevels(warehouseId);
  }

  if (warehouses.length === 0) {
    return (
      <div style={styles.notice}>
        Nenhum almoxarifado cadastrado ainda. Cadastre em{" "}
        <Link to="/almoxarifados" style={styles.link}>Cadastro → Almoxarifados</Link>{" "}
        (ex: "Almoxarifado de Insumos", "Depósito de Produtos Acabados").
      </div>
    );
  }

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={styles.title}>Almoxarifado</h1>
        <p style={styles.subtitle}>
          Quantidade de cada produto em cada local de estoque. Um mesmo produto pode ter
          quantidades diferentes em almoxarifados diferentes.
        </p>
      </header>

      <label style={styles.field}>
        <span style={styles.fieldLabel}>Almoxarifado</span>
        <select style={styles.input} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
          <option value="">Selecione um local...</option>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </label>

      {warehouseId && (
        <>
          {error && <div style={styles.error}>{error}</div>}

          <form onSubmit={applyAdjustment} style={styles.form}>
            <label style={styles.field}>
              <span style={styles.fieldLabel}>Produto</span>
              <select style={styles.input} value={adjustProductId} onChange={(e) => setAdjustProductId(e.target.value)} required>
                <option value="">Selecione...</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
              </select>
            </label>
            <label style={styles.field}>
              <span style={styles.fieldLabel}>Movimento</span>
              <select style={styles.input} value={adjustType} onChange={(e) => setAdjustType(e.target.value)}>
                <option value="entrada">Entrada (+)</option>
                <option value="saida">Saída (-)</option>
              </select>
            </label>
            <label style={styles.field}>
              <span style={styles.fieldLabel}>Quantidade</span>
              <input style={styles.input} type="number" step="any" value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} required />
            </label>
            <button style={styles.addBtn} type="submit">Aplicar</button>
          </form>

          {loading ? (
            <p style={styles.dim}>Carregando...</p>
          ) : levels.length === 0 ? (
            <p style={styles.dim}>Nenhum produto com estoque registrado neste almoxarifado ainda.</p>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr><th style={styles.th}>SKU</th><th style={styles.th}>Produto</th><th style={styles.th}>Quantidade</th></tr>
                </thead>
                <tbody>
                  {levels.filter((l) => Number(l.quantity) > 0).map((l) => (
                    <tr key={l.id}>
                      <td style={styles.td}>{l.products?.sku}</td>
                      <td style={styles.td}>{l.products?.name}</td>
                      <td style={styles.td}>{Number(l.quantity).toLocaleString("pt-BR")} {l.products?.unit}</td>
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
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0", maxWidth: 620, lineHeight: 1.5 },
  notice: {
    background: "rgba(232,163,61,0.1)", border: "1px solid var(--amber)", color: "var(--text)",
    borderRadius: "var(--radius)", padding: "14px 16px", fontSize: 13.5, lineHeight: 1.5, maxWidth: 620,
  },
  link: { color: "var(--amber)", fontWeight: 600 },
  field: { display: "flex", flexDirection: "column", gap: 6, marginTop: 16, marginBottom: 16, maxWidth: 320 },
  fieldLabel: { fontSize: 11, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" },
  input: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "9px 10px", color: "var(--text)", fontSize: 13,
  },
  form: {
    display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 12, alignItems: "end",
    background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: 16, marginBottom: 18, maxWidth: 720,
  },
  addBtn: {
    background: "var(--green)", color: "#052014", border: "none", borderRadius: "var(--radius)",
    padding: "9px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", height: 38,
  },
  dim: { color: "var(--text-dim)", fontSize: 14 },
  tableWrap: { border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden", maxWidth: 640 },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em",
    color: "var(--text-dim)", padding: "10px 14px", background: "var(--panel)", borderBottom: "1px solid var(--line)",
  },
  td: { padding: "10px 14px", fontSize: 13.5, background: "var(--panel)", borderBottom: "1px solid var(--line)" },
  error: {
    background: "rgba(217,105,95,0.12)", border: "1px solid var(--red)", color: "var(--red)",
    borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 13, marginTop: 8, maxWidth: 620,
  },
};
