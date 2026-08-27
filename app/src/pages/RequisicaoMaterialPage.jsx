import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { confirmDelete } from "../lib/deleteGuard";

const STATUS_LABEL = { pendente: "Pendente", atendida: "Atendida", parcial: "Atendida parcialmente", cancelada: "Cancelada" };
const STATUS_COLOR = { pendente: "var(--amber)", atendida: "var(--green)", parcial: "var(--amber)", cancelada: "var(--text-dim)" };

/**
 * Requisição interna de material: a produção (ou qualquer setor)
 * pede material ao almoxarifado. Quando o almoxarifado atende, o
 * estoque é descontado sozinho — sem passar por Pedido de Compra,
 * já que o material já está na empresa.
 */
export default function RequisicaoMaterialPage() {
  const { company, profile } = useAuth();
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [orders, setOrders] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [warehouseId, setWarehouseId] = useState("");
  const [productionOrderId, setProductionOrderId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([{ productId: "", quantity: "" }]);
  const [saving, setSaving] = useState(false);

  const [fulfillingId, setFulfillingId] = useState(null);

  async function loadAll() {
    setLoading(true);
    const [{ data: prods }, { data: whs }, { data: ops }, { data: reqs }] = await Promise.all([
      supabase.from("products").select("id, sku, name, unit").order("name"),
      supabase.from("warehouses").select("id, name").order("name"),
      supabase.from("production_orders").select("id, code").order("code", { ascending: false }).limit(100),
      supabase
        .from("material_requests")
        .select("id, code, status, notes, created_at, warehouse_id, warehouses:warehouse_id (name), production_orders:production_order_id (code), profiles:requested_by (full_name), material_request_items (id, product_id, quantity_requested, quantity_fulfilled, products:product_id (sku, name, unit))")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    setProducts(prods ?? []);
    setWarehouses(whs ?? []);
    setOrders(ops ?? []);
    setRequests(reqs ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (company?.id) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  function updateItem(i, field, value) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)));
  }
  function addItemRow() { setItems((prev) => [...prev, { productId: "", quantity: "" }]); }
  function removeItemRow(i) { setItems((prev) => prev.filter((_, idx) => idx !== i)); }

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    const validItems = items.filter((it) => it.productId && Number(it.quantity) > 0);
    if (!warehouseId || validItems.length === 0) {
      setError("Escolha o almoxarifado e pelo menos um item com quantidade.");
      return;
    }
    setSaving(true);

    const { data: code } = await supabase.rpc("next_material_request_code", { p_company_id: company.id });
    const { data: request, error: reqError } = await supabase
      .from("material_requests")
      .insert({
        company_id: company.id,
        code,
        requested_by: profile?.id ?? null,
        production_order_id: productionOrderId || null,
        warehouse_id: warehouseId,
        notes: notes || null,
      })
      .select("id").single();

    if (reqError) { setError(reqError.message); setSaving(false); return; }

    await supabase.from("material_request_items").insert(
      validItems.map((it) => ({
        company_id: company.id,
        request_id: request.id,
        product_id: it.productId,
        quantity_requested: Number(it.quantity),
      }))
    );

    setWarehouseId(""); setProductionOrderId(""); setNotes(""); setItems([{ productId: "", quantity: "" }]);
    setSaving(false);
    await loadAll();
  }

  async function fulfillRequest(request) {
    setFulfillingId(request.id);
    setError("");
    let anyShortage = false;

    for (const item of request.material_request_items ?? []) {
      const remaining = Number(item.quantity_requested) - Number(item.quantity_fulfilled);
      if (remaining <= 0) continue;

      const { data: level } = await supabase
        .from("stock_levels")
        .select("id, quantity")
        .eq("product_id", item.product_id)
        .eq("warehouse_id", request.warehouse_id)
        .is("location_id", null)
        .maybeSingle();

      const available = Number(level?.quantity ?? 0);
      const toFulfill = Math.min(available, remaining);

      if (toFulfill < remaining) anyShortage = true;
      if (toFulfill <= 0) continue;

      await supabase.from("stock_levels").update({ quantity: available - toFulfill }).eq("id", level.id);
      await supabase.from("material_request_items").update({ quantity_fulfilled: Number(item.quantity_fulfilled) + toFulfill }).eq("id", item.id);
      await supabase.from("stock_movements").insert({
        company_id: company.id,
        product_id: item.product_id,
        warehouse_id: request.warehouse_id,
        movement_type: "saida",
        quantity: toFulfill,
        reference_type: "requisicao",
        reference_code: request.code,
      });
    }

    await supabase.from("material_requests").update({
      status: anyShortage ? "parcial" : "atendida",
      fulfilled_at: new Date().toISOString(),
    }).eq("id", request.id);

    if (anyShortage) {
      setError(`Requisição ${request.code} atendida parcialmente — não havia estoque suficiente pra todos os itens.`);
    }

    setFulfillingId(null);
    await loadAll();
  }

  async function cancelRequest(id) {
    if (!(await confirmDelete(company, "esta requisição"))) return;
    await supabase.from("material_requests").update({ status: "cancelada" }).eq("id", id);
    await loadAll();
  }

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={styles.title}>Requisição de Material</h1>
        <p style={styles.subtitle}>
          Peça material ao almoxarifado — ao atender, o estoque é descontado sozinho.
        </p>
      </header>

      {error && <div style={styles.error}>{error}</div>}

      <form onSubmit={handleCreate} style={styles.form}>
        <p style={styles.formTitle}>Nova requisição</p>
        <div style={styles.row}>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Almoxarifado</span>
            <select style={styles.input} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required>
              <option value="">Selecione...</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </label>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Ordem de Produção (opcional)</span>
            <select style={styles.input} value={productionOrderId} onChange={(e) => setProductionOrderId(e.target.value)}>
              <option value="">— Não vinculada —</option>
              {orders.map((o) => <option key={o.id} value={o.id}>{o.code}</option>)}
            </select>
          </label>
        </div>

        {items.map((it, i) => (
          <div key={i} style={styles.itemRow}>
            <select style={styles.input} value={it.productId} onChange={(e) => updateItem(i, "productId", e.target.value)} required>
              <option value="">Selecione o produto...</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
            </select>
            <input style={{ ...styles.input, width: 120 }} type="number" step="any" placeholder="Qtd." value={it.quantity} onChange={(e) => updateItem(i, "quantity", e.target.value)} required />
            {items.length > 1 && (
              <button type="button" style={styles.removeBtn} onClick={() => removeItemRow(i)}>✕</button>
            )}
          </div>
        ))}
        <button type="button" style={styles.addItemBtn} onClick={addItemRow}>+ Adicionar item</button>

        <label style={styles.field}>
          <span style={styles.fieldLabel}>Observações (opcional)</span>
          <input style={styles.input} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex: urgente pra OP em andamento" />
        </label>

        <button style={styles.saveBtn} type="submit" disabled={saving}>{saving ? "Enviando..." : "Enviar requisição"}</button>
      </form>

      <h2 style={styles.title2}>Requisições recentes</h2>
      {loading ? (
        <p style={styles.dim}>Carregando...</p>
      ) : requests.length === 0 ? (
        <p style={styles.dim}>Nenhuma requisição registrada ainda.</p>
      ) : (
        <div style={styles.list}>
          {requests.map((r) => (
            <div key={r.id} style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <span style={styles.reqCode}>{r.code}</span>
                  {r.production_orders?.code && <span style={styles.reqOp}> · {r.production_orders.code}</span>}
                  <span style={{ ...styles.statusBadge, color: STATUS_COLOR[r.status] }}> {STATUS_LABEL[r.status]}</span>
                </div>
                <span style={styles.dim}>{new Date(r.created_at).toLocaleString("pt-BR")}</span>
              </div>
              <p style={styles.reqMeta}>
                Almoxarifado: {r.warehouses?.name ?? "—"} · Solicitado por: {r.profiles?.full_name ?? "—"}
                {r.notes && <> · {r.notes}</>}
              </p>
              <ul style={styles.itemsList}>
                {r.material_request_items.map((it) => (
                  <li key={it.id} style={styles.dim}>
                    {it.products?.sku} — {it.products?.name}: {it.quantity_fulfilled}/{it.quantity_requested} {it.products?.unit}
                  </li>
                ))}
              </ul>
              {r.status === "pendente" && (
                <div style={styles.cardActions}>
                  <button style={styles.fulfillBtn} onClick={() => fulfillRequest(r)} disabled={fulfillingId === r.id} type="button">
                    {fulfillingId === r.id ? "Atendendo..." : "Atender"}
                  </button>
                  <button style={styles.cancelBtn} onClick={() => cancelRequest(r.id)} type="button">Cancelar</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  title2: { fontFamily: "var(--font-display)", fontSize: 16, margin: "0 0 12px" },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0" },
  dim: { color: "var(--text-dim)", fontSize: 12.5 },
  form: {
    display: "flex", flexDirection: "column", gap: 12,
    background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: 20, marginBottom: 28, maxWidth: 640,
  },
  formTitle: { fontSize: 13, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.04em", margin: "0 0 4px" },
  row: { display: "flex", gap: 12, flexWrap: "wrap" },
  field: { display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 160 },
  fieldLabel: { fontSize: 11, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" },
  input: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "9px 10px", color: "var(--text)", fontSize: 13,
  },
  itemRow: { display: "flex", gap: 8 },
  removeBtn: {
    background: "transparent", border: "1px solid var(--line)", color: "var(--red)", borderRadius: "var(--radius)",
    width: 36, cursor: "pointer", fontSize: 13,
  },
  addItemBtn: {
    alignSelf: "flex-start", background: "transparent", border: "none", color: "var(--amber)",
    fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: 0,
  },
  saveBtn: {
    background: "var(--amber)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)",
    padding: "10px 0", fontWeight: 700, fontSize: 13, cursor: "pointer", marginTop: 6,
  },
  list: { display: "flex", flexDirection: "column", gap: 12, maxWidth: 720 },
  card: { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 16 },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  reqCode: { fontWeight: 700, fontSize: 14 },
  reqOp: { color: "var(--text-dim)", fontSize: 13 },
  statusBadge: { fontSize: 12, fontWeight: 700, marginLeft: 8 },
  reqMeta: { fontSize: 12.5, color: "var(--text-dim)", margin: "0 0 8px" },
  itemsList: { margin: "0 0 10px", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 2 },
  cardActions: { display: "flex", gap: 8 },
  fulfillBtn: {
    background: "var(--green)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)",
    padding: "7px 16px", fontWeight: 700, fontSize: 12.5, cursor: "pointer",
  },
  cancelBtn: {
    background: "transparent", color: "var(--text-dim)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "7px 16px", fontWeight: 600, fontSize: 12.5, cursor: "pointer",
  },
  error: {
    background: "rgba(217,105,95,0.12)", border: "1px solid var(--red)", color: "var(--red)",
    borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 13, marginBottom: 16, maxWidth: 640,
  },
};
