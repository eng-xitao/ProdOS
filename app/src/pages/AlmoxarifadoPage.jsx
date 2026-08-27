import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { Link } from "react-router-dom";
import CurrencyInput from "../components/CurrencyInput";

const MATERIAL_TYPE_LABEL = {
  materia_prima: "Matéria-prima",
  insumo: "Insumo",
  maquina: "Máquina",
  componente: "Componente",
};

const EXPIRY_WARNING_DAYS = 30;

/**
 * Mostra e ajusta a quantidade de cada produto em cada almoxarifado
 * (local de estoque). Entradas podem registrar lote e validade — útil
 * pra matéria-prima/insumo que vence — e saídas descontam de um lote
 * específico. Lotes vencendo em até 30 dias aparecem em destaque.
 */
export default function AlmoxarifadoPage() {
  const { company } = useAuth();
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [levels, setLevels] = useState([]);
  const [batches, setBatches] = useState([]);
  const [expiringBatches, setExpiringBatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [adjustProductId, setAdjustProductId] = useState("");
  const [adjustType, setAdjustType] = useState("entrada");
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustBatchNumber, setAdjustBatchNumber] = useState("");
  const [adjustExpiryDate, setAdjustExpiryDate] = useState("");
  const [adjustBatchId, setAdjustBatchId] = useState(""); // pra saída: de qual lote descontar
  const [adjustLocationId, setAdjustLocationId] = useState("");

  const [showNewItemForm, setShowNewItemForm] = useState(false);
  const [newItemSku, setNewItemSku] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newItemType, setNewItemType] = useState("materia_prima");
  const [newItemUnit, setNewItemUnit] = useState("");
  const [newItemCost, setNewItemCost] = useState(0);
  const [newItemSaving, setNewItemSaving] = useState(false);

  async function loadWarehouses() {
    const { data } = await supabase.from("warehouses").select("id, name").order("name");
    setWarehouses(data ?? []);
  }

  async function loadProducts() {
    const { data } = await supabase.from("products").select("id, sku, name, unit").order("name");
    setProducts(data ?? []);
  }

  async function loadExpiringBatches() {
    const limit = new Date();
    limit.setDate(limit.getDate() + EXPIRY_WARNING_DAYS);
    const { data } = await supabase
      .from("stock_batches")
      .select("id, batch_number, expiry_date, quantity, products:product_id (sku, name, unit), warehouses:warehouse_id (name)")
      .not("expiry_date", "is", null)
      .lte("expiry_date", limit.toISOString().slice(0, 10))
      .gt("quantity", 0)
      .order("expiry_date", { ascending: true });
    setExpiringBatches(data ?? []);
  }

  async function loadLocations(wid) {
    if (!wid) { setLocations([]); return; }
    const { data } = await supabase.from("warehouse_locations").select("id, code").eq("warehouse_id", wid).order("code");
    setLocations(data ?? []);
  }

  async function loadLevels(wid) {
    if (!wid) { setLevels([]); setBatches([]); return; }
    setLoading(true);

    const [{ data: allProducts, error: productsError }, { data: existingLevels, error: levelsError }, { data: batchesData }] = await Promise.all([
      supabase.from("products").select("id, sku, name, unit").order("name"),
      supabase.from("stock_levels").select("id, quantity, product_id, location_id, warehouse_locations:location_id (code)").eq("warehouse_id", wid),
      supabase.from("stock_batches").select("id, product_id, batch_number, expiry_date, quantity").eq("warehouse_id", wid).gt("quantity", 0).order("expiry_date", { ascending: true, nullsFirst: false }),
    ]);

    if (productsError) setError(productsError.message);
    if (levelsError) setError(levelsError.message);

    // Um produto pode ter mais de um registro de estoque nesse
    // almoxarifado (um por localização) — soma tudo pra mostrar o
    // total, e guarda o detalhe por localização à parte.
    const totalByProduct = {};
    const byProductLocations = {};
    (existingLevels ?? []).forEach((l) => {
      totalByProduct[l.product_id] = (totalByProduct[l.product_id] ?? 0) + Number(l.quantity);
      if (l.location_id) {
        byProductLocations[l.product_id] = byProductLocations[l.product_id] ?? [];
        byProductLocations[l.product_id].push({ code: l.warehouse_locations?.code, quantity: l.quantity });
      }
    });

    const merged = (allProducts ?? []).map((p) => ({
      id: `${p.id}`,
      product_id: p.id,
      quantity: totalByProduct[p.id] ?? 0,
      locationDetail: byProductLocations[p.id] ?? [],
      products: p,
    }));

    setLevels(merged);
    setBatches(batchesData ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (company?.id) { loadWarehouses(); loadProducts(); loadExpiringBatches(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  useEffect(() => {
    loadLevels(warehouseId);
    loadLocations(warehouseId);
    setAdjustBatchId("");
    setAdjustLocationId("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseId]);

  const batchesForProduct = batches.filter((b) => b.product_id === adjustProductId);

  async function applyAdjustment(e) {
    e.preventDefault();
    setError("");
    if (!company?.id || !warehouseId || !adjustProductId || !adjustQty) return;

    if (adjustType === "saida" && batchesForProduct.length > 0 && !adjustBatchId) {
      setError("Esse produto tem lotes registrados — escolha de qual lote a saída vai descontar.");
      return;
    }

    const { data: existingRow } = await supabase
      .from("stock_levels")
      .select("id, quantity")
      .eq("product_id", adjustProductId)
      .eq("warehouse_id", warehouseId)
      .eq("location_id", adjustLocationId || null)
      .maybeSingle();

    const delta = adjustType === "entrada" ? Number(adjustQty) : -Number(adjustQty);
    const newQuantity = Math.max(0, Number(existingRow?.quantity ?? 0) + delta);

    if (existingRow) {
      const { error } = await supabase.from("stock_levels").update({ quantity: newQuantity, updated_at: new Date().toISOString() }).eq("id", existingRow.id);
      if (error) setError(error.message);
    } else {
      const { error } = await supabase.from("stock_levels").insert({
        company_id: company.id, product_id: adjustProductId, warehouse_id: warehouseId,
        location_id: adjustLocationId || null, quantity: newQuantity,
      });
      if (error) setError(error.message);
    }

    // Lote: entrada com nº de lote cria um lote novo; saída desconta do lote escolhido
    if (adjustType === "entrada" && adjustBatchNumber) {
      await supabase.from("stock_batches").insert({
        company_id: company.id, product_id: adjustProductId, warehouse_id: warehouseId,
        batch_number: adjustBatchNumber, expiry_date: adjustExpiryDate || null, quantity: Number(adjustQty),
      });
    } else if (adjustType === "saida" && adjustBatchId) {
      const batch = batches.find((b) => b.id === adjustBatchId);
      const newBatchQty = Math.max(0, Number(batch?.quantity ?? 0) - Number(adjustQty));
      await supabase.from("stock_batches").update({ quantity: newBatchQty }).eq("id", adjustBatchId);
    }

    // Mantém o total do Produto (usado pelo MRP) coerente com o ajuste
    const { data: product } = await supabase.from("products").select("stock_quantity").eq("id", adjustProductId).single();
    const newTotal = Math.max(0, Number(product?.stock_quantity ?? 0) + delta);
    await supabase.from("products").update({ stock_quantity: newTotal }).eq("id", adjustProductId);

    await supabase.from("stock_movements").insert({
      company_id: company.id,
      product_id: adjustProductId,
      warehouse_id: warehouseId,
      movement_type: adjustType,
      quantity: Number(adjustQty),
      reference_type: "ajuste",
      notes: adjustBatchNumber ? `Lote ${adjustBatchNumber}` : "Ajuste manual",
    });

    setAdjustProductId(""); setAdjustQty(""); setAdjustBatchNumber(""); setAdjustExpiryDate(""); setAdjustBatchId(""); setAdjustLocationId("");
    loadLevels(warehouseId);
    loadExpiringBatches();
  }

  async function createMaterialItem(e) {
    e.preventDefault();
    if (!company?.id || !newItemSku || !newItemName) return;
    setNewItemSaving(true);
    setError("");

    const { error } = await supabase.from("products").insert({
      company_id: company.id,
      sku: newItemSku,
      name: newItemName,
      type: newItemType,
      unit: newItemUnit || null,
      cost: newItemCost,
      stock_quantity: 0,
    });

    if (error) {
      setError(error.message);
    } else {
      setNewItemSku(""); setNewItemName(""); setNewItemType("materia_prima"); setNewItemUnit(""); setNewItemCost(0);
      setShowNewItemForm(false);
      await loadProducts();
    }
    setNewItemSaving(false);
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
          Quantidade de cada produto em cada local de estoque. Registre lote e validade na entrada
          de matéria-prima/insumo que vence — o sistema avisa quando estiver perto de vencer.
        </p>
      </header>

      {expiringBatches.length > 0 && (
        <div style={styles.expiryBox}>
          <span style={styles.expiryTitle}>⚠ Lotes vencendo nos próximos {EXPIRY_WARNING_DAYS} dias</span>
          <div style={styles.expiryList}>
            {expiringBatches.map((b) => {
              const isPast = new Date(b.expiry_date + "T00:00:00") < new Date();
              return (
                <div key={b.id} style={styles.expiryRow}>
                  <span>{b.products?.sku} — {b.products?.name} (lote {b.batch_number})</span>
                  <span>{Number(b.quantity).toLocaleString("pt-BR")} {b.products?.unit} · {b.warehouses?.name}</span>
                  <span style={{ color: isPast ? "var(--red)" : "var(--amber)", fontWeight: 700 }}>
                    {isPast ? "Vencido" : "Vence"} {new Date(b.expiry_date + "T00:00:00").toLocaleDateString("pt-BR")}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <button style={styles.addItemBtn} onClick={() => setShowNewItemForm((v) => !v)} type="button">
        {showNewItemForm ? "Cancelar" : "+ Cadastrar matéria-prima / insumo / máquina"}
      </button>

      {error && <div style={styles.error}>{error}</div>}

      {showNewItemForm && (
        <form onSubmit={createMaterialItem} style={styles.form}>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>SKU</span>
            <input style={styles.input} value={newItemSku} onChange={(e) => setNewItemSku(e.target.value)} placeholder="Ex: MP-001" required />
          </label>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Nome</span>
            <input style={styles.input} value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="Ex: Chapa de aço 2mm" required />
          </label>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Classe</span>
            <select style={styles.input} value={newItemType} onChange={(e) => setNewItemType(e.target.value)}>
              {Object.entries(MATERIAL_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Unidade</span>
            <input style={styles.input} value={newItemUnit} onChange={(e) => setNewItemUnit(e.target.value)} placeholder="un, kg, m..." />
          </label>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Custo</span>
            <CurrencyInput value={newItemCost} onChange={setNewItemCost} />
          </label>
          <button style={styles.addBtn} type="submit" disabled={newItemSaving}>
            {newItemSaving ? "Salvando..." : "Cadastrar"}
          </button>
        </form>
      )}

      <label style={styles.field}>
        <span style={styles.fieldLabel}>Almoxarifado</span>
        <select style={styles.input} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
          <option value="">Selecione um local...</option>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </label>

      {warehouseId && (
        <>
          <form onSubmit={applyAdjustment} style={styles.form}>
            <label style={styles.field}>
              <span style={styles.fieldLabel}>Produto</span>
              <select style={styles.input} value={adjustProductId} onChange={(e) => { setAdjustProductId(e.target.value); setAdjustBatchId(""); }} required>
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
            {locations.length > 0 && (
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Localização (opcional)</span>
                <select style={styles.input} value={adjustLocationId} onChange={(e) => setAdjustLocationId(e.target.value)}>
                  <option value="">Sem localização específica</option>
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.code}</option>)}
                </select>
              </label>
            )}

            {adjustType === "entrada" && (
              <>
                <label style={styles.field}>
                  <span style={styles.fieldLabel}>Nº do lote (opcional)</span>
                  <input style={styles.input} value={adjustBatchNumber} onChange={(e) => setAdjustBatchNumber(e.target.value)} placeholder="Ex: L-2026-08" />
                </label>
                <label style={styles.field}>
                  <span style={styles.fieldLabel}>Validade (opcional)</span>
                  <input style={styles.input} type="date" value={adjustExpiryDate} onChange={(e) => setAdjustExpiryDate(e.target.value)} disabled={!adjustBatchNumber} />
                </label>
              </>
            )}

            {adjustType === "saida" && batchesForProduct.length > 0 && (
              <label style={styles.field}>
                <span style={styles.fieldLabel}>De qual lote?</span>
                <select style={styles.input} value={adjustBatchId} onChange={(e) => setAdjustBatchId(e.target.value)} required>
                  <option value="">Selecione...</option>
                  {batchesForProduct.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.batch_number} — {Number(b.quantity).toLocaleString("pt-BR")} disp.{b.expiry_date ? ` — vence ${new Date(b.expiry_date + "T00:00:00").toLocaleDateString("pt-BR")}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <button style={styles.addBtn} type="submit">Aplicar</button>
          </form>

          {loading ? (
            <p style={styles.dim}>Carregando...</p>
          ) : levels.length === 0 ? (
            <p style={styles.dim}>Nenhum produto cadastrado ainda.</p>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr><th style={styles.th}>SKU</th><th style={styles.th}>Produto</th><th style={styles.th}>Quantidade</th><th style={styles.th}>Localizações</th></tr>
                </thead>
                <tbody>
                  {levels.map((l) => (
                    <tr key={l.id}>
                      <td style={styles.td}>{l.products?.sku}</td>
                      <td style={styles.td}>{l.products?.name}</td>
                      <td style={styles.td}>{Number(l.quantity).toLocaleString("pt-BR")} {l.products?.unit}</td>
                      <td style={styles.td}>
                        {l.locationDetail.length === 0
                          ? "—"
                          : l.locationDetail.map((d) => `${d.code} (${Number(d.quantity).toLocaleString("pt-BR")})`).join(", ")}
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
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0", maxWidth: 620, lineHeight: 1.5 },
  notice: {
    background: "rgba(232,163,61,0.1)", border: "1px solid var(--amber)", color: "var(--text)",
    borderRadius: "var(--radius)", padding: "14px 16px", fontSize: 13.5, lineHeight: 1.5, maxWidth: 620,
  },
  link: { color: "var(--amber)", fontWeight: 600 },
  expiryBox: {
    background: "rgba(232,163,61,0.08)", border: "1px solid var(--amber)", borderRadius: "var(--radius)",
    padding: "12px 16px", marginBottom: 20, maxWidth: 720,
  },
  expiryTitle: { fontSize: 12.5, fontWeight: 700, color: "var(--amber)" },
  expiryList: { display: "flex", flexDirection: "column", gap: 6, marginTop: 8 },
  expiryRow: { display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12.5, flexWrap: "wrap" },
  field: { display: "flex", flexDirection: "column", gap: 6, marginTop: 16, marginBottom: 16, maxWidth: 320 },
  fieldLabel: { fontSize: 11, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" },
  input: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "9px 10px", color: "var(--text)", fontSize: 13,
  },
  form: {
    display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, alignItems: "end",
    background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: 16, marginBottom: 18, maxWidth: 860,
  },
  addBtn: {
    background: "var(--green)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)",
    padding: "9px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", height: 38,
  },
  addItemBtn: {
    background: "transparent", color: "var(--amber)", border: "1px solid var(--amber)", borderRadius: "var(--radius)",
    padding: "9px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", marginTop: 4,
  },
  dim: { color: "var(--text-dim)", fontSize: 14 },
  tableWrap: { border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden", overflowX: "auto", maxWidth: 640 },
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
