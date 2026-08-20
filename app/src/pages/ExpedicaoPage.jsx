import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

const STATUS_LABEL = { preparando: "Preparando", em_transito: "Em trânsito", entregue: "Entregue" };

export default function ExpedicaoPage() {
  const { company } = useAuth();
  const [shipments, setShipments] = useState([]);
  const [salesOrders, setSalesOrders] = useState([]);
  const [carriers, setCarriers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [shipmentId, setShipmentId] = useState("");
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [processing, setProcessing] = useState(false);

  const [newCode, setNewCode] = useState("");
  const [newOrderId, setNewOrderId] = useState("");
  const [newCarrierId, setNewCarrierId] = useState("");
  const [newWarehouseId, setNewWarehouseId] = useState("");
  const [newDriver, setNewDriver] = useState("");
  const [newPlate, setNewPlate] = useState("");

  async function loadShipments() {
    const { data } = await supabase
      .from("shipments")
      .select("id, code, status, sales_order_id, sales_orders:sales_order_id (code)")
      .order("created_at", { ascending: false });
    setShipments(data ?? []);
  }

  async function loadBaseData() {
    const [orders, carr, wh] = await Promise.all([
      supabase.from("sales_orders").select("id, code").eq("status", "faturado"),
      supabase.from("carriers").select("id, name").order("name"),
      supabase.from("warehouses").select("id, name").order("name"),
    ]);
    setSalesOrders(orders.data ?? []);
    setCarriers(carr.data ?? []);
    setWarehouses(wh.data ?? []);
  }

  async function loadItems(sid) {
    if (!sid) { setItems([]); return; }
    const { data } = await supabase
      .from("shipment_items")
      .select("id, quantity, product_id, products:product_id (sku, name, unit)")
      .eq("shipment_id", sid);
    setItems(data ?? []);
  }

  useEffect(() => {
    if (company?.id) { loadShipments(); loadBaseData(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  useEffect(() => {
    loadItems(shipmentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipmentId]);

  const selectedShipment = shipments.find((s) => s.id === shipmentId);

  async function createShipment(e) {
    e.preventDefault();
    setError("");
    if (!company?.id || !newOrderId || !newWarehouseId) return;
    setCreating(true);

    const { data: shipment, error: shipmentError } = await supabase
      .from("shipments")
      .insert({
        company_id: company.id,
        code: newCode || `ROM-${Date.now().toString().slice(-6)}`,
        sales_order_id: newOrderId,
        carrier_id: newCarrierId || null,
        warehouse_id: newWarehouseId,
        driver_name: newDriver || null,
        vehicle_plate: newPlate || null,
      })
      .select("id")
      .single();

    if (shipmentError) { setError(shipmentError.message); setCreating(false); return; }

    const { data: orderItems } = await supabase
      .from("sales_order_items")
      .select("product_id, quantity")
      .eq("sales_order_id", newOrderId);

    if (orderItems && orderItems.length > 0) {
      const rows = orderItems.map((it) => ({
        company_id: company.id, shipment_id: shipment.id, product_id: it.product_id, quantity: it.quantity,
      }));
      await supabase.from("shipment_items").insert(rows);
    }

    setNewCode(""); setNewOrderId(""); setNewCarrierId(""); setNewWarehouseId(""); setNewDriver(""); setNewPlate("");
    setCreating(false);
    loadShipments();
    setShipmentId(shipment.id);
  }

  async function confirmDeparture() {
    if (!selectedShipment || items.length === 0) return;
    setProcessing(true);
    setError("");

    for (const item of items) {
      const { data: level } = await supabase
        .from("stock_levels")
        .select("id, quantity")
        .eq("product_id", item.product_id)
        .eq("warehouse_id", selectedShipment.warehouse_id)
        .maybeSingle();

      const currentLevel = Number(level?.quantity ?? 0);
      const newLevel = Math.max(0, currentLevel - Number(item.quantity));
      if (level) {
        await supabase.from("stock_levels").update({ quantity: newLevel, updated_at: new Date().toISOString() }).eq("id", level.id);
      }

      const { data: product } = await supabase.from("products").select("stock_quantity").eq("id", item.product_id).single();
      const newStock = Math.max(0, Number(product?.stock_quantity ?? 0) - Number(item.quantity));
      await supabase.from("products").update({ stock_quantity: newStock }).eq("id", item.product_id);

      await supabase.from("stock_movements").insert({
        company_id: company.id,
        product_id: item.product_id,
        warehouse_id: selectedShipment.warehouse_id,
        movement_type: "saida",
        quantity: item.quantity,
        reference_type: "venda",
        reference_code: selectedShipment.code,
      });
    }

    await supabase.from("shipments").update({ status: "em_transito" }).eq("id", shipmentId);
    setProcessing(false);
    loadShipments();
  }

  async function markDelivered() {
    setProcessing(true);
    await supabase.from("shipments").update({ status: "entregue" }).eq("id", shipmentId);
    if (selectedShipment?.sales_order_id) {
      await supabase.from("sales_orders").update({ status: "entregue" }).eq("id", selectedShipment.sales_order_id);
    }
    setProcessing(false);
    loadShipments();
  }

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={styles.title}>Expedição</h1>
        <p style={styles.subtitle}>
          Monte o romaneio de saída a partir de um Pedido de Venda faturado, confirme a saída
          (baixa o estoque do almoxarifado escolhido) e marque como entregue ao final.
        </p>
      </header>

      {error && <div style={styles.error}>{error}</div>}

      {salesOrders.length === 0 ? (
        <p style={styles.dim}>Nenhum Pedido de Venda com status "faturado" disponível para expedir no momento.</p>
      ) : (
        <form onSubmit={createShipment} style={styles.form}>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Código do romaneio</span>
            <input style={styles.input} value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="Opcional, gerado automaticamente" />
          </label>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Pedido de Venda</span>
            <select style={styles.input} value={newOrderId} onChange={(e) => setNewOrderId(e.target.value)} required>
              <option value="">Selecione...</option>
              {salesOrders.map((o) => <option key={o.id} value={o.id}>{o.code}</option>)}
            </select>
          </label>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Transportadora</span>
            <select style={styles.input} value={newCarrierId} onChange={(e) => setNewCarrierId(e.target.value)}>
              <option value="">Selecione...</option>
              {carriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Almoxarifado de saída</span>
            <select style={styles.input} value={newWarehouseId} onChange={(e) => setNewWarehouseId(e.target.value)} required>
              <option value="">Selecione...</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </label>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Motorista</span>
            <input style={styles.input} value={newDriver} onChange={(e) => setNewDriver(e.target.value)} placeholder="Opcional" />
          </label>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Placa do veículo</span>
            <input style={styles.input} value={newPlate} onChange={(e) => setNewPlate(e.target.value)} placeholder="Opcional" />
          </label>
          <button style={styles.addBtn} type="submit" disabled={creating}>
            {creating ? "Criando..." : "+ Criar romaneio"}
          </button>
        </form>
      )}

      <div style={styles.wrap}>
        <h2 style={styles.title2}>Romaneios</h2>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>Selecione um romaneio</span>
          <select style={styles.input} value={shipmentId} onChange={(e) => setShipmentId(e.target.value)} onFocus={loadShipments}>
            <option value="">Selecione...</option>
            {shipments.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — Pedido {s.sales_orders?.code} — {STATUS_LABEL[s.status]}
              </option>
            ))}
          </select>
        </label>

        {shipmentId && items.length > 0 && (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr><th style={styles.th}>Produto</th><th style={styles.th}>Quantidade</th></tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id}>
                    <td style={styles.td}>{it.products?.sku} — {it.products?.name}</td>
                    <td style={styles.td}>{it.quantity} {it.products?.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selectedShipment?.status === "preparando" && (
          <button style={styles.actionBtn} onClick={confirmDeparture} disabled={processing} type="button">
            {processing ? "Confirmando..." : "Confirmar saída (baixa estoque)"}
          </button>
        )}
        {selectedShipment?.status === "em_transito" && (
          <button style={styles.actionBtn} onClick={markDelivered} disabled={processing} type="button">
            {processing ? "Confirmando..." : "Marcar como entregue"}
          </button>
        )}
        {selectedShipment?.status === "entregue" && (
          <p style={{ ...styles.dim, marginTop: 12 }}>Este romaneio já foi entregue. O pedido de venda foi atualizado.</p>
        )}
      </div>
    </div>
  );
}

const styles = {
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  title2: { fontFamily: "var(--font-display)", fontSize: 18, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0", maxWidth: 640, lineHeight: 1.5 },
  wrap: { marginTop: 36, paddingTop: 28, borderTop: "1px solid var(--line)" },
  field: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 16, maxWidth: 320 },
  fieldLabel: { fontSize: 11, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" },
  input: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "9px 10px", color: "var(--text)", fontSize: 13,
  },
  form: {
    display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, alignItems: "end",
    background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 16, marginBottom: 12,
  },
  addBtn: {
    background: "var(--green)", color: "#052014", border: "none", borderRadius: "var(--radius)",
    padding: "9px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", height: 38,
  },
  actionBtn: {
    marginTop: 8, background: "var(--amber)", color: "#1A1400", border: "none",
    borderRadius: "var(--radius)", padding: "12px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer",
  },
  dim: { color: "var(--text-dim)", fontSize: 14 },
  tableWrap: { border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden", maxWidth: 640, marginBottom: 12 },
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
