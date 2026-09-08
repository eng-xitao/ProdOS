import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { Link } from "react-router-dom";

const MATERIAL_TYPES = ["materia_prima", "insumo", "componente"];
const MATERIAL_LABEL = { materia_prima: "Matéria-prima", insumo: "Insumo", componente: "Componente" };
const EXPIRY_WARNING_DAYS = 30;

export default function AlmoxarifadoPage() {
  const { company } = useAuth();
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [levels, setLevels] = useState([]);
  const [batches, setBatches] = useState([]);
  const [expiringBatches, setExpiringBatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [adjustProductId, setAdjustProductId] = useState("");
  const [adjustType, setAdjustType] = useState("entrada");
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustLocationId, setAdjustLocationId] = useState("");
  const [adjustBatchNumber, setAdjustBatchNumber] = useState("");
  const [adjustExpiryDate, setAdjustExpiryDate] = useState("");
  const [adjustBatchId, setAdjustBatchId] = useState("");

  async function loadWarehouses() {
    const { data, error: e } = await supabase
      .from("warehouses")
      .select("id,name,active,warehouse_type")
      .eq("company_id", company.id)
      .eq("active", true)
      .order("name");
    if (e) setError(e.message); else setWarehouses(data ?? []);
  }

  async function loadProducts() {
    const { data, error: e } = await supabase
      .from("products")
      .select("id,sku,name,unit,type")
      .eq("company_id", company.id)
      .in("type", MATERIAL_TYPES)
      .eq("active", true)
      .order("name");
    if (e) setError(e.message); else setProducts(data ?? []);
  }

  async function loadExpiringBatches() {
    const limit = new Date();
    limit.setDate(limit.getDate() + EXPIRY_WARNING_DAYS);
    const { data } = await supabase
      .from("stock_batches")
      .select("id,batch_number,expiry_date,quantity,products:product_id(sku,name,unit),warehouses:warehouse_id(name)")
      .eq("company_id", company.id)
      .not("expiry_date", "is", null)
      .lte("expiry_date", limit.toISOString().slice(0, 10))
      .gt("quantity", 0)
      .order("expiry_date", { ascending: true });
    setExpiringBatches(data ?? []);
  }

  async function loadLocations(wid) {
    if (!wid) { setLocations([]); return; }
    const { data, error: e } = await supabase
      .from("warehouse_locations")
      .select("id,code")
      .eq("company_id", company.id)
      .eq("warehouse_id", wid)
      .order("code");
    if (e) setError(e.message); else setLocations(data ?? []);
  }

  async function loadLevels(wid) {
    if (!wid) { setLevels([]); setBatches([]); return; }
    setLoading(true);
    setError("");

    const [{ data: stock, error: stockError }, { data: batchData, error: batchError }] = await Promise.all([
      supabase
        .from("stock_levels")
        .select("id,quantity,product_id,location_id,products:product_id(id,sku,name,unit,type),warehouse_locations:location_id(code)")
        .eq("company_id", company.id)
        .eq("warehouse_id", wid),
      supabase
        .from("stock_batches")
        .select("id,product_id,batch_number,expiry_date,quantity")
        .eq("company_id", company.id)
        .eq("warehouse_id", wid)
        .gt("quantity", 0)
        .order("expiry_date", { ascending: true, nullsFirst: false }),
    ]);

    if (stockError) setError(stockError.message);
    if (batchError) setError(batchError.message);

    const map = new Map();
    (products ?? []).forEach((p) => {
      if (!MATERIAL_TYPES.includes(p.type)) return;
      map.set(p.id, { id: p.id, product_id: p.id, products: p, quantity: 0, locations: [] });
    });

    (stock ?? []).forEach((row) => {
      const p = row.products;
      if (!p || !MATERIAL_TYPES.includes(p.type)) return;
      const key = p.id;
      if (!map.has(key)) map.set(key, { id: key, product_id: key, products: p, quantity: 0, locations: [] });
      const item = map.get(key);
      const quantity = Number(row.quantity || 0);
      item.quantity += quantity;
      item.locations.push({ id: row.location_id, code: row.warehouse_locations?.code || "Sem localização", quantity });
    });

    let rows = Array.from(map.values());
    if (typeFilter) rows = rows.filter((r) => r.products.type === typeFilter);
    if (productFilter) rows = rows.filter((r) => r.product_id === productFilter);
    rows.sort((a, b) => String(a.products.name || "").localeCompare(String(b.products.name || ""), "pt-BR"));

    setLevels(rows);
    setBatches(batchData ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (company?.id) {
      loadWarehouses();
      loadProducts();
      loadExpiringBatches();
    }
  }, [company?.id]);

  useEffect(() => {
    loadLocations(warehouseId);
    setAdjustLocationId("");
    setAdjustBatchId("");
    loadLevels(warehouseId);
  }, [warehouseId, typeFilter, productFilter, products.length]);

  const materialWarehouses = warehouses.filter((w) => {
    const name = String(w.name || "").toLowerCase();
    const type = String(w.warehouse_type || "").toLowerCase();
    return !name.includes("produto acabado") && !type.includes("produto_acabado") && !type.includes("produto acabado");
  });
  const filteredProducts = typeFilter ? products.filter((p) => p.type === typeFilter) : products;
  const selectedWarehouse = materialWarehouses.find((w) => w.id === warehouseId);
  const selectedProduct = products.find((p) => p.id === productFilter);
  const batchesForProduct = batches.filter((b) => b.product_id === adjustProductId);

  useEffect(() => {
    if (warehouseId && !materialWarehouses.some((w) => w.id === warehouseId)) setWarehouseId("");
  }, [warehouses, warehouseId]);

  async function applyAdjustment(e) {
    e.preventDefault();
    setError("");
    const qty = Number(adjustQty);
    if (!company?.id || !warehouseId || !adjustProductId || !qty || qty <= 0) return setError("Informe produto e uma quantidade maior que zero.");
    if (adjustType === "saida" && batchesForProduct.length > 0 && !adjustBatchId) return setError("Escolha o lote da saída.");
    if (adjustType === "entrada" && !adjustLocationId) return setError("Informe a localização de destino da entrada.");
    if (adjustType === "saida" && !adjustLocationId) return setError("Informe a localização de origem da saída.");

    const { data: existing, error: findError } = await supabase
      .from("stock_levels")
      .select("id,quantity")
      .eq("company_id", company.id)
      .eq("product_id", adjustProductId)
      .eq("warehouse_id", warehouseId)
      .eq("location_id", adjustLocationId)
      .maybeSingle();
    if (findError) return setError(findError.message);

    const current = Number(existing?.quantity ?? 0);
    if (adjustType === "saida" && qty > current) return setError(`Saldo insuficiente nessa localização. Disponível: ${current.toLocaleString("pt-BR")}.`);
    const next = adjustType === "entrada" ? current + qty : current - qty;

    const stockResult = existing
      ? await supabase.from("stock_levels").update({ quantity: next, updated_at: new Date().toISOString() }).eq("id", existing.id)
      : await supabase.from("stock_levels").insert({ company_id: company.id, product_id: adjustProductId, warehouse_id: warehouseId, location_id: adjustLocationId, quantity: next });
    if (stockResult.error) return setError(stockResult.error.message);

    if (adjustType === "entrada" && adjustBatchNumber) {
      const { error: batchError } = await supabase.from("stock_batches").insert({ company_id: company.id, product_id: adjustProductId, warehouse_id: warehouseId, batch_number: adjustBatchNumber, expiry_date: adjustExpiryDate || null, quantity: qty });
      if (batchError) return setError(batchError.message);
    }
    if (adjustType === "saida" && adjustBatchId) {
      const batch = batches.find((b) => b.id === adjustBatchId);
      if (qty > Number(batch?.quantity ?? 0)) return setError("Quantidade maior que o saldo do lote selecionado.");
      const { error: batchError } = await supabase.from("stock_batches").update({ quantity: Number(batch.quantity) - qty }).eq("id", adjustBatchId);
      if (batchError) return setError(batchError.message);
    }

    const { data: product } = await supabase.from("products").select("stock_quantity").eq("company_id", company.id).eq("id", adjustProductId).single();
    await supabase.from("products").update({ stock_quantity: Math.max(0, Number(product?.stock_quantity ?? 0) + (adjustType === "entrada" ? qty : -qty)) }).eq("company_id", company.id).eq("id", adjustProductId);
    await supabase.from("stock_movements").insert({ company_id: company.id, product_id: adjustProductId, warehouse_id: warehouseId, movement_type: adjustType, quantity: qty, reference_type: "ajuste", notes: `${adjustType === "entrada" ? "Entrada" : "Saída"} manual — localização ${locations.find((l) => l.id === adjustLocationId)?.code || adjustLocationId}${adjustBatchNumber ? ` — lote ${adjustBatchNumber}` : ""}` });

    setAdjustProductId("");
    setAdjustQty("");
    setAdjustLocationId("");
    setAdjustBatchNumber("");
    setAdjustExpiryDate("");
    setAdjustBatchId("");
    await Promise.all([loadLevels(warehouseId), loadExpiringBatches()]);
  }

  if (materialWarehouses.length === 0) return <div style={styles.notice}>Nenhum almoxarifado de materiais ativo cadastrado. Cadastre em <Link to="/almoxarifados" style={styles.link}>Cadastro → Almoxarifados</Link>.</div>;

  const printDate = new Date().toLocaleString("pt-BR");
  const selectedTypeLabel = typeFilter ? MATERIAL_LABEL[typeFilter] : "Todos os materiais";

  return <div className="stock-material-page">
    <style>{`
      @media print {
        @page { size: A4 portrait; margin: 14mm 12mm 16mm; }
        body { background: #fff !important; color: #111 !important; }
        .screen-only, .stock-material-page form, .stock-material-page .filters, .stock-material-page .expiry-box, .stock-material-page .error-box { display: none !important; }
        .print-only { display: block !important; }
        .print-report-header { display: flex !important; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #222; padding-bottom: 10px; margin-bottom: 14px; }
        .print-logo { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
        .print-meta { text-align: right; font-size: 10px; line-height: 1.5; color: #444; }
        .print-title { font-size: 18px; margin: 0 0 4px; }
        .print-subtitle { font-size: 10px; color: #555; margin: 0; }
        .print-filters { display: grid !important; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px; padding: 8px; border: 1px solid #bbb; }
        .print-filter-label { display: block; font-size: 8px; text-transform: uppercase; color: #666; margin-bottom: 2px; }
        .print-filter-value { font-size: 10px; font-weight: 700; }
        .stock-material-page .tableWrap { border: 1px solid #777 !important; overflow: visible !important; }
        .stock-material-page table { font-size: 10px !important; }
        .stock-material-page th { background: #eee !important; color: #111 !important; border: 1px solid #aaa !important; padding: 7px 8px !important; }
        .stock-material-page td { color: #111 !important; border: 1px solid #bbb !important; padding: 7px 8px !important; background: #fff !important; }
        .print-footer { display: flex !important; justify-content: space-between; border-top: 1px solid #aaa; margin-top: 12px; padding-top: 6px; font-size: 8px; color: #555; }
      }
      @media screen { .print-only { display: none; } }
    `}</style>

    <header style={styles.header} className="screen-only">
      <div style={styles.headerContent}>
        <div><h1 style={styles.title}>Estoque de Materiais</h1><p style={styles.subtitle}>Somente materiais. O saldo é controlado por almoxarifado e pode existir em várias localizações.</p></div>
        <button type="button" onClick={() => window.print()} style={styles.printBtn}>🖨 Imprimir</button>
      </div>
    </header>

    <div className="print-only print-report-header">
      <div>
        <div className="print-logo">ProdOS</div>
        <h1 className="print-title">Relatório de Estoque de Materiais</h1>
        <p className="print-subtitle">Posição de estoque por almoxarifado e localização</p>
      </div>
      <div className="print-meta"><strong>{company?.name || "Empresa"}</strong><br />Emissão: {printDate}</div>
    </div>

    <div className="print-only print-filters">
      <div><span className="print-filter-label">Almoxarifado</span><span className="print-filter-value">{selectedWarehouse?.name || "Não selecionado"}</span></div>
      <div><span className="print-filter-label">Tipo</span><span className="print-filter-value">{selectedTypeLabel}</span></div>
      <div><span className="print-filter-label">Material</span><span className="print-filter-value">{selectedProduct ? `${selectedProduct.sku} — ${selectedProduct.name}` : "Todos"}</span></div>
    </div>

    {expiringBatches.length > 0 && <div style={styles.expiryBox} className="expiry-box"><strong>⚠ Lotes vencendo nos próximos {EXPIRY_WARNING_DAYS} dias</strong>{expiringBatches.map((b) => <div key={b.id} style={styles.expiryRow}><span>{b.products?.sku} — {b.products?.name} · lote {b.batch_number}</span><span>{Number(b.quantity).toLocaleString("pt-BR")} {b.products?.unit} · {b.warehouses?.name}</span><span>{new Date(b.expiry_date + "T00:00:00").toLocaleDateString("pt-BR")}</span></div>)}</div>}

    <div style={styles.filters} className="filters">
      <label style={styles.field}><span style={styles.fieldLabel}>Almoxarifado</span><select style={styles.input} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}><option value="">Selecione...</option>{materialWarehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
      <label style={styles.field}><span style={styles.fieldLabel}>Tipo de Material</span><select style={styles.input} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option value="">Todos</option>{Object.entries(MATERIAL_LABEL).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      <label style={styles.field}><span style={styles.fieldLabel}>Material</span><select style={styles.input} value={productFilter} onChange={(e) => setProductFilter(e.target.value)}><option value="">Todos</option>{filteredProducts.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}</select></label>
    </div>

    {warehouseId && <>
      <form onSubmit={applyAdjustment} style={styles.form}>
        <label style={styles.field}><span style={styles.fieldLabel}>Material</span><select style={styles.input} value={adjustProductId} onChange={(e) => { setAdjustProductId(e.target.value); setAdjustBatchId(""); }} required><option value="">Selecione...</option>{filteredProducts.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}</select></label>
        <label style={styles.field}><span style={styles.fieldLabel}>Movimento</span><select style={styles.input} value={adjustType} onChange={(e) => setAdjustType(e.target.value)}><option value="entrada">Entrada (+)</option><option value="saida">Saída (-)</option></select></label>
        <label style={styles.field}><span style={styles.fieldLabel}>Quantidade</span><input style={styles.input} type="number" min="0.0001" step="any" value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} required /></label>
        <label style={styles.field}><span style={styles.fieldLabel}>{adjustType === "entrada" ? "Localização destino" : "Localização origem"}</span><select style={styles.input} value={adjustLocationId} onChange={(e) => setAdjustLocationId(e.target.value)} required><option value="">Selecione...</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.code}</option>)}</select></label>
        {adjustType === "entrada" && <><label style={styles.field}><span style={styles.fieldLabel}>Nº do lote</span><input style={styles.input} value={adjustBatchNumber} onChange={(e) => setAdjustBatchNumber(e.target.value)} placeholder="Opcional" /></label><label style={styles.field}><span style={styles.fieldLabel}>Validade</span><input style={styles.input} type="date" value={adjustExpiryDate} onChange={(e) => setAdjustExpiryDate(e.target.value)} disabled={!adjustBatchNumber} /></label></>}
        {adjustType === "saida" && batchesForProduct.length > 0 && <label style={styles.field}><span style={styles.fieldLabel}>Lote</span><select style={styles.input} value={adjustBatchId} onChange={(e) => setAdjustBatchId(e.target.value)} required><option value="">Selecione...</option>{batchesForProduct.map((b) => <option key={b.id} value={b.id}>{b.batch_number} — {Number(b.quantity).toLocaleString("pt-BR")} disp.</option>)}</select></label>}
        <button style={styles.addBtn} type="submit">Aplicar movimento</button>
      </form>

      {error && <div style={styles.error} className="error-box">{error}</div>}
      {loading ? <p style={styles.dim}>Carregando...</p> : levels.length === 0 ? <p style={styles.dim}>Nenhum material cadastrado para os filtros selecionados.</p> : <div style={styles.tableWrap} className="tableWrap"><table style={styles.table}><thead><tr><th style={styles.th}>SKU</th><th style={styles.th}>Material</th><th style={styles.th}>Tipo</th><th style={styles.th}>Total</th><th style={styles.th}>Localizações</th></tr></thead><tbody>{levels.map((r) => <tr key={r.id}><td style={styles.td}>{r.products.sku}</td><td style={styles.td}>{r.products.name}</td><td style={styles.td}>{MATERIAL_LABEL[r.products.type]}</td><td style={styles.td}><strong>{r.quantity.toLocaleString("pt-BR")} {r.products.unit || ""}</strong></td><td style={styles.td}>{r.locations.length ? r.locations.map((l) => <div key={l.id || l.code}>{l.code}: <strong>{l.quantity.toLocaleString("pt-BR")}</strong> {r.products.unit || ""}</div>) : "—"}</td></tr>)}</tbody></table></div>}
    </>}

    <div className="print-only print-footer"><span>ProdOS · Relatório de Estoque de Materiais</span><span>Documento gerado pelo sistema</span></div>
  </div>;
}

const styles = {
  notice: { padding: 24, background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)", color: "var(--text)" },
  link: { color: "var(--blue)", textDecoration: "none", fontWeight: 700 },
  header: { marginBottom: 18 },
  headerContent: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 },
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0", maxWidth: 760, lineHeight: 1.5 },
  filters: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12, padding: 16, background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)", marginBottom: 16 },
  form: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, padding: 16, background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)", marginBottom: 16 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: 700, color: "var(--text-dim)" },
  input: { width: "100%", minHeight: 40, boxSizing: "border-box", padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--field)", color: "var(--text)" },
  addBtn: { alignSelf: "end", minHeight: 40, padding: "0 16px", border: 0, borderRadius: 8, background: "var(--blue)", color: "#fff", fontWeight: 700, cursor: "pointer" },
  printBtn: { minHeight: 40, padding: "0 16px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--panel)", color: "var(--text)", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" },
  error: { padding: 12, marginBottom: 16, borderRadius: 8, border: "1px solid var(--red)", color: "var(--red)", background: "var(--panel)" },
  dim: { color: "var(--text-dim)" },
  expiryBox: { padding: 14, marginBottom: 16, background: "var(--panel)", border: "1px solid var(--amber)", borderRadius: "var(--radius)" },
  expiryRow: { display: "grid", gridTemplateColumns: "2fr 1fr 120px", gap: 12, paddingTop: 8, fontSize: 13 },
  tableWrap: { overflowX: "auto", background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { textAlign: "left", padding: 12, borderBottom: "1px solid var(--line)", color: "var(--text-dim)" },
  td: { padding: 12, borderBottom: "1px solid var(--line)", verticalAlign: "top" },
};
