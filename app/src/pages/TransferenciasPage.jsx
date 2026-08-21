import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { Link } from "react-router-dom";

export default function TransferenciasPage() {
  const { company } = useAuth();
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [productId, setProductId] = useState("");
  const [fromWarehouseId, setFromWarehouseId] = useState("");
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [quantity, setQuantity] = useState("");

  async function loadBaseData() {
    const [w, p] = await Promise.all([
      supabase.from("warehouses").select("id, name").order("name"),
      supabase.from("products").select("id, sku, name, unit").order("name"),
    ]);
    setWarehouses(w.data ?? []);
    setProducts(p.data ?? []);
  }

  async function loadTransfers() {
    const { data } = await supabase
      .from("warehouse_transfers")
      .select("id, quantity, created_at, products:product_id (sku, name, unit), from:from_warehouse_id (name), to:to_warehouse_id (name)")
      .order("created_at", { ascending: false })
      .limit(30);
    setTransfers(data ?? []);
  }

  useEffect(() => {
    if (company?.id) { loadBaseData(); loadTransfers(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  async function submitTransfer(e) {
    e.preventDefault();
    setError("");
    if (!company?.id || !productId || !fromWarehouseId || !toWarehouseId || !quantity) return;
    if (fromWarehouseId === toWarehouseId) {
      setError("O almoxarifado de origem e destino não podem ser o mesmo.");
      return;
    }
    setSaving(true);
    const qty = Number(quantity);

    const { data: fromLevel } = await supabase
      .from("stock_levels").select("id, quantity").eq("product_id", productId).eq("warehouse_id", fromWarehouseId).maybeSingle();

    const currentFrom = Number(fromLevel?.quantity ?? 0);
    const newFrom = Math.max(0, currentFrom - qty);
    if (fromLevel) {
      await supabase.from("stock_levels").update({ quantity: newFrom, updated_at: new Date().toISOString() }).eq("id", fromLevel.id);
    } else {
      await supabase.from("stock_levels").insert({ company_id: company.id, product_id: productId, warehouse_id: fromWarehouseId, quantity: 0 });
    }

    const { data: toLevel } = await supabase
      .from("stock_levels").select("id, quantity").eq("product_id", productId).eq("warehouse_id", toWarehouseId).maybeSingle();

    if (toLevel) {
      await supabase.from("stock_levels").update({ quantity: Number(toLevel.quantity) + qty, updated_at: new Date().toISOString() }).eq("id", toLevel.id);
    } else {
      await supabase.from("stock_levels").insert({ company_id: company.id, product_id: productId, warehouse_id: toWarehouseId, quantity: qty });
    }

    await supabase.from("warehouse_transfers").insert({
      company_id: company.id, product_id: productId, from_warehouse_id: fromWarehouseId, to_warehouse_id: toWarehouseId, quantity: qty,
    });

    await supabase.from("stock_movements").insert([
      {
        company_id: company.id, product_id: productId, warehouse_id: fromWarehouseId,
        movement_type: "saida", quantity: qty, reference_type: "transferencia",
        notes: "Transferência para outro almoxarifado",
      },
      {
        company_id: company.id, product_id: productId, warehouse_id: toWarehouseId,
        movement_type: "entrada", quantity: qty, reference_type: "transferencia",
        notes: "Transferência recebida de outro almoxarifado",
      },
    ]);

    setProductId(""); setFromWarehouseId(""); setToWarehouseId(""); setQuantity("");
    setSaving(false);
    loadTransfers();
  }

  if (warehouses.length < 2) {
    return (
      <div style={styles.notice}>
        Você precisa de pelo menos 2 almoxarifados cadastrados para transferir entre eles.
        Cadastre em <Link to="/almoxarifados" style={styles.link}>Cadastro → Almoxarifados</Link>.
      </div>
    );
  }

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={styles.title}>Transferências entre Almoxarifados</h1>
        <p style={styles.subtitle}>Mova quantidade de um local para outro sem perder o rastro.</p>
      </header>

      {error && <div style={styles.error}>{error}</div>}

      <form onSubmit={submitTransfer} style={styles.form}>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>Produto</span>
          <select style={styles.input} value={productId} onChange={(e) => setProductId(e.target.value)} required>
            <option value="">Selecione...</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
          </select>
        </label>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>De</span>
          <select style={styles.input} value={fromWarehouseId} onChange={(e) => setFromWarehouseId(e.target.value)} required>
            <option value="">Selecione...</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </label>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>Para</span>
          <select style={styles.input} value={toWarehouseId} onChange={(e) => setToWarehouseId(e.target.value)} required>
            <option value="">Selecione...</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </label>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>Quantidade</span>
          <input style={styles.input} type="number" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
        </label>
        <button style={styles.addBtn} type="submit" disabled={saving}>{saving ? "Transferindo..." : "Transferir"}</button>
      </form>

      {transfers.length > 0 && (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr><th style={styles.th}>Produto</th><th style={styles.th}>De</th><th style={styles.th}>Para</th><th style={styles.th}>Qtd.</th><th style={styles.th}>Data</th></tr>
            </thead>
            <tbody>
              {transfers.map((t) => (
                <tr key={t.id}>
                  <td style={styles.td}>{t.products?.sku} — {t.products?.name}</td>
                  <td style={styles.td}>{t.from?.name}</td>
                  <td style={styles.td}>{t.to?.name}</td>
                  <td style={styles.td}>{t.quantity} {t.products?.unit}</td>
                  <td style={styles.td}>{new Date(t.created_at).toLocaleDateString("pt-BR")}</td>
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
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0", maxWidth: 620, lineHeight: 1.5 },
  notice: {
    background: "rgba(232,163,61,0.1)", border: "1px solid var(--amber)", color: "var(--text)",
    borderRadius: "var(--radius)", padding: "14px 16px", fontSize: 13.5, lineHeight: 1.5, maxWidth: 620,
  },
  link: { color: "var(--amber)", fontWeight: 600 },
  field: { display: "flex", flexDirection: "column", gap: 6, marginTop: 16, marginBottom: 16, maxWidth: 260 },
  fieldLabel: { fontSize: 11, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" },
  input: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "9px 10px", color: "var(--text)", fontSize: 13,
  },
  form: {
    display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: 12, alignItems: "end",
    background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 16, marginBottom: 18,
  },
  addBtn: {
    background: "var(--green)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)",
    padding: "9px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", height: 38, whiteSpace: "nowrap",
  },
  tableWrap: { border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden", overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em",
    color: "var(--text-dim)", padding: "10px 14px", background: "var(--panel)", borderBottom: "1px solid var(--line)",
  },
  td: { padding: "10px 14px", fontSize: 13.5, background: "var(--panel)", borderBottom: "1px solid var(--line)" },
  error: {
    background: "rgba(217,105,95,0.12)", border: "1px solid var(--red)", color: "var(--red)",
    borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 13, marginBottom: 16, maxWidth: 620,
  },
};
