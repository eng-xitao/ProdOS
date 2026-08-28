import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

const STATUS_LABEL = { pendente: "Pendente", parcial: "Parcial", entregue: "Entregue", atrasado: "Atrasado" };
const STATUS_COLOR = { pendente: "var(--text-dim)", parcial: "var(--amber)", entregue: "var(--green)", atrasado: "var(--red)" };

/**
 * Cronograma de Entregas: divide cada item de um Pedido de Venda em
 * parcelas com data prevista própria — a indústria raramente entrega
 * o pedido inteiro de uma vez só. Mostra o que está pendente, em
 * dia, atrasado, e por quanto.
 */
export default function CronogramaEntregasPage() {
  const { company } = useAuth();
  const [orders, setOrders] = useState([]);
  const [orderId, setOrderId] = useState("");
  const [items, setItems] = useState([]);
  const [schedules, setSchedules] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [newSchedule, setNewSchedule] = useState({}); // { [itemId]: { quantity, date } }

  async function loadOrders() {
    setLoading(true);
    const { data } = await supabase
      .from("sales_orders")
      .select("id, code, customers:customer_id (name)")
      .order("order_date", { ascending: false })
      .limit(100);
    setOrders(data ?? []);
    setLoading(false);
  }

  async function loadItems(oid) {
    const { data } = await supabase
      .from("sales_order_items")
      .select("id, quantity, products:product_id (sku, name, unit)")
      .eq("sales_order_id", oid);
    setItems(data ?? []);

    const { data: sched } = await supabase
      .from("sales_order_delivery_schedule")
      .select("id, sales_order_item_id, quantity_scheduled, delivery_date, quantity_delivered, status")
      .in("sales_order_item_id", (data ?? []).map((i) => i.id));

    const grouped = {};
    (sched ?? []).forEach((s) => {
      grouped[s.sales_order_item_id] = grouped[s.sales_order_item_id] ?? [];
      grouped[s.sales_order_item_id].push(s);
    });
    setSchedules(grouped);
  }

  useEffect(() => { if (company?.id) loadOrders(); }, [company?.id]);
  useEffect(() => { if (orderId) loadItems(orderId); }, [orderId]);

  function scheduledSoFar(itemId) {
    return (schedules[itemId] ?? []).reduce((sum, s) => sum + Number(s.quantity_scheduled), 0);
  }

  async function addSchedule(itemId) {
    setError("");
    const draft = newSchedule[itemId];
    if (!draft?.quantity || !draft?.date) {
      setError("Preencha quantidade e data pra essa parcela.");
      return;
    }
    const item = items.find((i) => i.id === itemId);
    const already = scheduledSoFar(itemId);
    if (already + Number(draft.quantity) > Number(item.quantity)) {
      setError(`Isso passa da quantidade do pedido (${item.quantity - already} ${item.products?.unit} ainda sem parcela).`);
      return;
    }

    await supabase.from("sales_order_delivery_schedule").insert({
      company_id: company.id,
      sales_order_item_id: itemId,
      quantity_scheduled: Number(draft.quantity),
      delivery_date: draft.date,
    });
    setNewSchedule((p) => ({ ...p, [itemId]: {} }));
    await loadItems(orderId);
  }

  async function removeSchedule(id) {
    await supabase.from("sales_order_delivery_schedule").delete().eq("id", id);
    await loadItems(orderId);
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={styles.title}>Cronograma de Entregas</h1>
        <p style={styles.subtitle}>Divida cada item do pedido em parcelas, com data prevista própria.</p>
      </header>

      {error && <div style={styles.error}>{error}</div>}

      {loading ? (
        <p style={styles.dim}>Carregando...</p>
      ) : (
        <select style={{ ...styles.input, maxWidth: 360, marginBottom: 20 }} value={orderId} onChange={(e) => setOrderId(e.target.value)}>
          <option value="">Selecione um pedido de venda...</option>
          {orders.map((o) => <option key={o.id} value={o.id}>{o.code} — {o.customers?.name ?? "sem cliente"}</option>)}
        </select>
      )}

      {orderId && items.map((item) => {
        const already = scheduledSoFar(item.id);
        const remaining = Number(item.quantity) - already;
        const itemSchedules = schedules[item.id] ?? [];
        return (
          <div key={item.id} style={styles.itemCard}>
            <div style={styles.itemHeader}>
              <strong>{item.products?.sku} — {item.products?.name}</strong>
              <span style={styles.dim}>Pedido: {item.quantity} {item.products?.unit} · Já programado: {already} · Falta programar: {remaining}</span>
            </div>

            {itemSchedules.length > 0 && (
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead><tr><th style={styles.th}>Quantidade</th><th style={styles.th}>Data prevista</th><th style={styles.th}>Entregue</th><th style={styles.th}>Status</th><th style={styles.th}></th></tr></thead>
                  <tbody>
                    {itemSchedules.map((s) => {
                      const isLate = s.status !== "entregue" && s.delivery_date < today;
                      const effectiveStatus = isLate ? "atrasado" : s.status;
                      return (
                        <tr key={s.id}>
                          <td style={styles.td}>{s.quantity_scheduled} {item.products?.unit}</td>
                          <td style={styles.td}>{new Date(s.delivery_date + "T00:00:00").toLocaleDateString("pt-BR")}</td>
                          <td style={styles.td}>{s.quantity_delivered} {item.products?.unit}</td>
                          <td style={{ ...styles.td, color: STATUS_COLOR[effectiveStatus] }}>{STATUS_LABEL[effectiveStatus]}</td>
                          <td style={{ ...styles.td, textAlign: "right" }}>
                            {s.quantity_delivered === 0 && (
                              <button style={styles.removeBtn} onClick={() => removeSchedule(s.id)} type="button">Remover</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {remaining > 0 && (
              <div style={styles.addRow}>
                <input
                  style={{ ...styles.input, width: 110 }} type="number" step="any" placeholder="Qtd." max={remaining}
                  value={newSchedule[item.id]?.quantity ?? ""}
                  onChange={(e) => setNewSchedule((p) => ({ ...p, [item.id]: { ...p[item.id], quantity: e.target.value } }))}
                />
                <input
                  style={styles.input} type="date"
                  value={newSchedule[item.id]?.date ?? ""}
                  onChange={(e) => setNewSchedule((p) => ({ ...p, [item.id]: { ...p[item.id], date: e.target.value } }))}
                />
                <button style={styles.addBtn} onClick={() => addSchedule(item.id)} type="button">+ Parcela</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const styles = {
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0" },
  dim: { color: "var(--text-dim)", fontSize: 12.5 },
  input: { flex: 1, background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: "9px 10px", color: "var(--text)", fontSize: 13 },
  itemCard: { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 18, marginBottom: 16, maxWidth: 780 },
  itemHeader: { display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 },
  addRow: { display: "flex", gap: 8, marginTop: 12 },
  addBtn: { background: "var(--amber)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)", padding: "9px 16px", fontWeight: 700, fontSize: 12.5, cursor: "pointer", whiteSpace: "nowrap" },
  tableWrap: { border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden", overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-dim)", padding: "8px 12px", background: "var(--panel-2)", borderBottom: "1px solid var(--line)" },
  td: { padding: "8px 12px", fontSize: 13, borderBottom: "1px solid var(--line)" },
  removeBtn: { background: "transparent", border: "1px solid var(--red)", color: "var(--red)", borderRadius: "var(--radius)", padding: "4px 10px", fontSize: 11.5, cursor: "pointer" },
  error: { background: "rgba(217,105,95,0.12)", border: "1px solid var(--red)", color: "var(--red)", borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 13, marginBottom: 16, maxWidth: 780 },
};
