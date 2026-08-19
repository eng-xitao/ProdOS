import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import ModulePage from "../components/ModulePage";

export default function PedidosVendaPage() {
  const { company } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!company?.id) return;
    supabase.from("customers").select("id, name").order("name").then(({ data }) => setCustomers(data ?? []));
  }, [company?.id]);

  const customerOptions = customers.map((c) => ({ value: c.id, label: c.name }));

  return (
    <div>
      <ModulePage
        key={refreshKey}
        table="sales_orders"
        title="Pedidos de Venda"
        subtitle="Pedidos definitivos — criados manualmente ou convertidos de um orçamento"
        emptyLabel="Nenhum pedido cadastrado ainda."
        fields={[
          { key: "code", label: "Código", placeholder: "PV-0001", required: true },
          { key: "customer_id", label: "Cliente", type: "select", options: customerOptions, required: true },
          { key: "total_value", label: "Valor total (R$)", type: "number", required: true },
          {
            key: "status",
            label: "Status",
            type: "select",
            required: true,
            options: ["aberto", "faturado", "entregue", "cancelado"],
          },
          { key: "order_date", label: "Data do pedido", type: "date" },
        ]}
      />
      <OrderItemsViewer onRefresh={() => setRefreshKey((k) => k + 1)} />
    </div>
  );
}

/**
 * Mostra os itens de um pedido (preenchidos automaticamente quando o
 * pedido nasce de um orçamento convertido, ou adicionados manualmente).
 */
function OrderItemsViewer() {
  const { company } = useAuth();
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [orderId, setOrderId] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [newProductId, setNewProductId] = useState("");
  const [newQuantity, setNewQuantity] = useState("1");
  const [newUnitPrice, setNewUnitPrice] = useState("");
  const [newDiscount, setNewDiscount] = useState("0");

  async function loadOrders() {
    const { data } = await supabase.from("sales_orders").select("id, code").order("created_at", { ascending: false });
    setOrders(data ?? []);
  }

  async function loadProducts() {
    const { data } = await supabase.from("products").select("id, sku, name, sale_price").order("name");
    setProducts(data ?? []);
  }

  async function loadItems(oid) {
    if (!oid) { setItems([]); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("sales_order_items")
      .select("id, quantity, unit_price, discount_percent, product_id, products:product_id (sku, name)")
      .eq("sales_order_id", oid);
    if (error) setError(error.message);
    setItems(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (company?.id) { loadOrders(); loadProducts(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  useEffect(() => {
    loadItems(orderId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const total = items.reduce((sum, it) => {
    const line = Number(it.quantity) * Number(it.unit_price) * (1 - Number(it.discount_percent) / 100);
    return sum + line;
  }, 0);

  function handleProductChange(id) {
    setNewProductId(id);
    const product = products.find((p) => p.id === id);
    if (product) setNewUnitPrice(String(product.sale_price ?? 0));
  }

  async function addItem(e) {
    e.preventDefault();
    setError("");
    if (!company?.id || !orderId || !newProductId) return;
    const { error } = await supabase.from("sales_order_items").insert({
      company_id: company.id,
      sales_order_id: orderId,
      product_id: newProductId,
      quantity: Number(newQuantity),
      unit_price: Number(newUnitPrice),
      discount_percent: Number(newDiscount),
    });
    if (error) setError(error.message);
    else {
      setNewProductId(""); setNewQuantity("1"); setNewUnitPrice(""); setNewDiscount("0");
      loadItems(orderId);
    }
  }

  async function removeItem(id) {
    await supabase.from("sales_order_items").delete().eq("id", id);
    loadItems(orderId);
  }

  return (
    <div style={styles.wrap}>
      <h2 style={styles.title}>Itens do pedido</h2>
      <p style={styles.subtitle}>
        Pedidos vindos de um orçamento aprovado já chegam com os itens preenchidos.
        Você também pode adicionar itens manualmente aqui.
      </p>

      <label style={styles.field}>
        <span style={styles.fieldLabel}>Pedido</span>
        <select style={styles.input} value={orderId} onChange={(e) => setOrderId(e.target.value)} onFocus={loadOrders}>
          <option value="">Selecione um pedido...</option>
          {orders.map((o) => <option key={o.id} value={o.id}>{o.code}</option>)}
        </select>
      </label>

      {orderId && (
        <>
          {error && <div style={styles.error}>{error}</div>}

          <form onSubmit={addItem} style={styles.form}>
            <label style={styles.field}>
              <span style={styles.fieldLabel}>Produto</span>
              <select style={styles.input} value={newProductId} onChange={(e) => handleProductChange(e.target.value)} required>
                <option value="">Selecione...</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
              </select>
            </label>
            <label style={styles.field}>
              <span style={styles.fieldLabel}>Qtd.</span>
              <input style={styles.input} type="number" step="any" value={newQuantity} onChange={(e) => setNewQuantity(e.target.value)} required />
            </label>
            <label style={styles.field}>
              <span style={styles.fieldLabel}>Preço unit. (R$)</span>
              <input style={styles.input} type="number" step="any" value={newUnitPrice} onChange={(e) => setNewUnitPrice(e.target.value)} required />
            </label>
            <label style={styles.field}>
              <span style={styles.fieldLabel}>Desconto (%)</span>
              <input style={styles.input} type="number" step="any" value={newDiscount} onChange={(e) => setNewDiscount(e.target.value)} />
            </label>
            <button style={styles.addBtn} type="submit">+ Adicionar</button>
          </form>

          {loading ? (
            <p style={styles.dim}>Carregando...</p>
          ) : items.length === 0 ? (
            <p style={styles.dim}>Nenhum item neste pedido ainda.</p>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Produto</th>
                    <th style={styles.th}>Qtd.</th>
                    <th style={styles.th}>Preço unit.</th>
                    <th style={styles.th}>Desconto</th>
                    <th style={styles.th}>Total</th>
                    <th style={styles.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => {
                    const line = Number(it.quantity) * Number(it.unit_price) * (1 - Number(it.discount_percent) / 100);
                    return (
                      <tr key={it.id}>
                        <td style={styles.td}>{it.products?.sku} — {it.products?.name}</td>
                        <td style={styles.td}>{it.quantity}</td>
                        <td style={styles.td}>R$ {Number(it.unit_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                        <td style={styles.td}>{it.discount_percent}%</td>
                        <td style={styles.td}>R$ {line.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                        <td style={{ ...styles.td, textAlign: "right" }}>
                          <button style={styles.deleteBtn} onClick={() => removeItem(it.id)} type="button">Remover</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4} style={{ ...styles.td, textAlign: "right", fontWeight: 700 }}>Total dos itens</td>
                    <td style={{ ...styles.td, fontWeight: 700, color: "var(--amber)" }}>
                      R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                    <td style={styles.td}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const styles = {
  wrap: { marginTop: 36, paddingTop: 28, borderTop: "1px solid var(--line)" },
  title: { fontFamily: "var(--font-display)", fontSize: 18, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 18px", maxWidth: 620, lineHeight: 1.5 },
  field: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 16, maxWidth: 420 },
  fieldLabel: { fontSize: 11, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" },
  input: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "9px 10px", color: "var(--text)", fontSize: 13,
  },
  form: {
    display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: 12, alignItems: "end",
    background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: 16, marginBottom: 18,
  },
  addBtn: {
    background: "var(--green)", color: "#052014", border: "none", borderRadius: "var(--radius)",
    padding: "9px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", height: 38,
  },
  dim: { color: "var(--text-dim)", fontSize: 14 },
  tableWrap: { border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden", maxWidth: 800 },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em",
    color: "var(--text-dim)", padding: "10px 14px", background: "var(--panel)", borderBottom: "1px solid var(--line)",
  },
  td: { padding: "10px 14px", fontSize: 13.5, background: "var(--panel)", borderBottom: "1px solid var(--line)" },
  deleteBtn: {
    background: "transparent", border: "1px solid var(--line)", color: "var(--red)",
    borderRadius: "var(--radius)", padding: "5px 10px", fontSize: 12, cursor: "pointer",
  },
  error: {
    background: "rgba(217,105,95,0.12)", border: "1px solid var(--red)", color: "var(--red)",
    borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 13, marginBottom: 16, maxWidth: 620,
  },
};
