import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import ModulePage from "../components/ModulePage";

export default function PedidosCompraPage() {
  const { company } = useAuth();
  const [suppliers, setSuppliers] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!company?.id) return;
    supabase.from("suppliers").select("id, name").order("name").then(({ data }) => setSuppliers(data ?? []));
  }, [company?.id]);

  const supplierOptions = suppliers.map((s) => ({ value: s.id, label: s.name }));

  return (
    <div>
      <ModulePage
        key={refreshKey}
        table="purchase_orders"
        title="Pedidos de Compra"
        subtitle="Pedidos definitivos — criados manualmente ou gerados ao fechar uma cotação"
        emptyLabel="Nenhum pedido de compra cadastrado ainda."
        fields={[
          { key: "code", label: "Código", placeholder: "PC-0001", required: true },
          { key: "supplier_id", label: "Fornecedor", type: "select", options: supplierOptions, required: true },
          { key: "total_value", label: "Valor total (R$)", type: "number" },
          { key: "status", label: "Status", type: "select", options: ["aberto", "recebido", "cancelado"], quickEdit: true },
          { key: "order_date", label: "Data do pedido", type: "date" },
        ]}
      />
      <ReceivingWorkspace onReceived={() => setRefreshKey((k) => k + 1)} />
      <GeneratePayablesPanel onGenerated={() => setRefreshKey((k) => k + 1)} />
    </div>
  );
}

/**
 * Gera as parcelas de Contas a Pagar a partir de um Pedido de
 * Compra recebido, conforme a Condição de Pagamento escolhida.
 */
function GeneratePayablesPanel({ onGenerated }) {
  const { company } = useAuth();
  const [orders, setOrders] = useState([]);
  const [paymentTerms, setPaymentTerms] = useState([]);
  const [orderId, setOrderId] = useState("");
  const [paymentTermId, setPaymentTermId] = useState("");
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [success, setSuccess] = useState(false);

  async function loadData() {
    const [ordersRes, termsRes] = await Promise.all([
      supabase.from("purchase_orders").select("id, code, total_value, supplier_id, order_date").eq("status", "recebido").eq("payable_generated", false),
      supabase.from("payment_terms").select("id, name, installments, days_between").order("name"),
    ]);
    setOrders(ordersRes.data ?? []);
    setPaymentTerms(termsRes.data ?? []);
  }

  useEffect(() => {
    if (company?.id) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  async function generate() {
    const order = orders.find((o) => o.id === orderId);
    const term = paymentTerms.find((t) => t.id === paymentTermId);
    if (!order || !term || !company?.id) return;
    setGenerating(true);
    setError("");
    setSuccess(false);

    const installments = Math.max(1, term.installments);
    const amountPerInstallment = Number(order.total_value) / installments;
    const baseDate = new Date(order.order_date + "T00:00:00");

    const entries = Array.from({ length: installments }, (_, i) => {
      const dueDate = new Date(baseDate);
      dueDate.setDate(dueDate.getDate() + term.days_between * (i + 1));
      return {
        company_id: company.id,
        description: `Pedido ${order.code} — parcela ${i + 1}/${installments}`,
        entry_type: "despesa",
        amount: amountPerInstallment,
        due_date: dueDate.toISOString().slice(0, 10),
        supplier_id: order.supplier_id,
        purchase_order_id: order.id,
        installment_number: i + 1,
        total_installments: installments,
        paid: false,
      };
    });

    const { error: insertError } = await supabase.from("financial_entries").insert(entries);
    if (insertError) {
      setError(insertError.message);
      setGenerating(false);
      return;
    }

    await supabase.from("purchase_orders").update({ payable_generated: true }).eq("id", order.id);
    setGenerating(false);
    setSuccess(true);
    setOrderId(""); setPaymentTermId("");
    loadData();
    onGenerated();
  }

  if (orders.length === 0) return null;

  return (
    <div style={panelStyles.wrap}>
      <h2 style={panelStyles.title}>Gerar Contas a Pagar</h2>
      <p style={panelStyles.subtitle}>
        Escolha um pedido recebido e a condição de pagamento — as parcelas são criadas automaticamente.
      </p>

      {error && <div style={panelStyles.error}>{error}</div>}
      {success && <div style={panelStyles.success}>Parcelas geradas com sucesso em Financeiro → Contas a Pagar.</div>}

      <div style={panelStyles.form}>
        <label style={panelStyles.field}>
          <span style={panelStyles.fieldLabel}>Pedido recebido</span>
          <select style={panelStyles.input} value={orderId} onChange={(e) => setOrderId(e.target.value)}>
            <option value="">Selecione...</option>
            {orders.map((o) => <option key={o.id} value={o.id}>{o.code} — R$ {Number(o.total_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</option>)}
          </select>
        </label>
        <label style={panelStyles.field}>
          <span style={panelStyles.fieldLabel}>Condição de pagamento</span>
          <select style={panelStyles.input} value={paymentTermId} onChange={(e) => setPaymentTermId(e.target.value)}>
            <option value="">Selecione...</option>
            {paymentTerms.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.installments}x)</option>)}
          </select>
        </label>
        <button style={panelStyles.btn} onClick={generate} disabled={generating || !orderId || !paymentTermId} type="button">
          {generating ? "Gerando..." : "Gerar Parcelas"}
        </button>
      </div>
    </div>
  );
}

const panelStyles = {
  wrap: { marginTop: 36, paddingTop: 28, borderTop: "1px solid var(--line)" },
  title: { fontFamily: "var(--font-display)", fontSize: 18, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 18px", maxWidth: 620, lineHeight: 1.5 },
  form: { display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 12, alignItems: "end", maxWidth: 640 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  fieldLabel: { fontSize: 11, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" },
  input: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "9px 10px", color: "var(--text)", fontSize: 13,
  },
  btn: {
    background: "var(--amber)", color: "#1A1400", border: "none", borderRadius: "var(--radius)",
    padding: "10px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", height: 38, whiteSpace: "nowrap",
  },
  error: {
    background: "rgba(217,105,95,0.12)", border: "1px solid var(--red)", color: "var(--red)",
    borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 13, marginBottom: 16, maxWidth: 620,
  },
  success: {
    background: "rgba(79,174,126,0.12)", border: "1px solid var(--green)", color: "var(--green)",
    borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 13, marginBottom: 16, maxWidth: 620,
  },
};

/**
 * Gerencia os itens de um pedido de compra e o recebimento —
 * ao marcar como recebido, soma a quantidade recebida ao
 * estoque de cada produto automaticamente.
 */
function ReceivingWorkspace({ onReceived }) {
  const { company } = useAuth();
  const [orders, setOrders] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [receivingWarehouseId, setReceivingWarehouseId] = useState("");
  const [products, setProducts] = useState([]);
  const [orderId, setOrderId] = useState("");
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [receiving, setReceiving] = useState(false);

  const [newProductId, setNewProductId] = useState("");
  const [newQuantity, setNewQuantity] = useState("1");
  const [newUnitPrice, setNewUnitPrice] = useState("");

  async function loadOrders() {
    const { data } = await supabase.from("purchase_orders").select("id, code, status").order("created_at", { ascending: false });
    setOrders(data ?? []);
  }

  async function loadProducts() {
    const { data } = await supabase.from("products").select("id, sku, name").order("name");
    setProducts(data ?? []);
  }

  async function loadItems(oid) {
    if (!oid) { setItems([]); return; }
    const { data } = await supabase
      .from("purchase_order_items")
      .select("id, quantity, unit_price, received_quantity, product_id, products:product_id (sku, name, unit)")
      .eq("purchase_order_id", oid);
    setItems(data ?? []);
  }

  useEffect(() => {
    if (company?.id) {
      loadOrders();
      loadProducts();
      supabase.from("warehouses").select("id, name").order("name").then(({ data }) => setWarehouses(data ?? []));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  useEffect(() => {
    loadItems(orderId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const selectedOrder = orders.find((o) => o.id === orderId);

  async function addItem(e) {
    e.preventDefault();
    setError("");
    if (!company?.id || !orderId || !newProductId) return;
    const { error } = await supabase.from("purchase_order_items").insert({
      company_id: company.id,
      purchase_order_id: orderId,
      product_id: newProductId,
      quantity: Number(newQuantity),
      unit_price: Number(newUnitPrice || 0),
    });
    if (error) setError(error.message);
    else {
      setNewProductId(""); setNewQuantity("1"); setNewUnitPrice("");
      loadItems(orderId);
    }
  }

  async function removeItem(id) {
    await supabase.from("purchase_order_items").delete().eq("id", id);
    loadItems(orderId);
  }

  async function markAsReceived() {
    if (items.length === 0 || !receivingWarehouseId) return;
    setReceiving(true);
    setError("");

    for (const item of items) {
      const pending = Number(item.quantity) - Number(item.received_quantity);
      if (pending <= 0) continue;

      await supabase.from("purchase_order_items").update({ received_quantity: item.quantity }).eq("id", item.id);

      const { data: product } = await supabase.from("products").select("stock_quantity").eq("id", item.product_id).single();
      const newStock = Number(product?.stock_quantity ?? 0) + pending;
      await supabase.from("products").update({ stock_quantity: newStock }).eq("id", item.product_id);

      const { data: existingLevel } = await supabase
        .from("stock_levels")
        .select("id, quantity")
        .eq("product_id", item.product_id)
        .eq("warehouse_id", receivingWarehouseId)
        .maybeSingle();

      if (existingLevel) {
        await supabase.from("stock_levels").update({
          quantity: Number(existingLevel.quantity) + pending,
          updated_at: new Date().toISOString(),
        }).eq("id", existingLevel.id);
      } else {
        await supabase.from("stock_levels").insert({
          company_id: company.id,
          product_id: item.product_id,
          warehouse_id: receivingWarehouseId,
          quantity: pending,
        });
      }
    }

    await supabase.from("purchase_orders").update({ status: "recebido" }).eq("id", orderId);

    setReceiving(false);
    loadItems(orderId);
    loadOrders();
    onReceived();
  }

  return (
    <div style={styles.wrap}>
      <h2 style={styles.title}>Itens e recebimento</h2>
      <p style={styles.subtitle}>
        Ao marcar o pedido como recebido, a quantidade de cada item é somada automaticamente
        ao estoque do respectivo produto.
      </p>

      <label style={styles.field}>
        <span style={styles.fieldLabel}>Pedido de Compra</span>
        <select style={styles.input} value={orderId} onChange={(e) => setOrderId(e.target.value)} onFocus={loadOrders}>
          <option value="">Selecione um pedido...</option>
          {orders.map((o) => (
            <option key={o.id} value={o.id}>{o.code} — {o.status === "aberto" ? "Aberto" : o.status === "recebido" ? "Recebido" : "Cancelado"}</option>
          ))}
        </select>
      </label>

      {orderId && (
        <>
          {error && <div style={styles.error}>{error}</div>}

          {selectedOrder?.status === "aberto" && (
            <form onSubmit={addItem} style={styles.form}>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Produto</span>
                <select style={styles.input} value={newProductId} onChange={(e) => setNewProductId(e.target.value)} required>
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
                <input style={styles.input} type="number" step="any" value={newUnitPrice} onChange={(e) => setNewUnitPrice(e.target.value)} />
              </label>
              <button style={styles.addBtn} type="submit">+ Adicionar</button>
            </form>
          )}

          {items.length === 0 ? (
            <p style={styles.dim}>Nenhum item neste pedido ainda.</p>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Produto</th>
                    <th style={styles.th}>Qtd. pedida</th>
                    <th style={styles.th}>Preço unit.</th>
                    <th style={styles.th}>Recebido</th>
                    <th style={styles.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id}>
                      <td style={styles.td}>{it.products?.sku} — {it.products?.name}</td>
                      <td style={styles.td}>{it.quantity} {it.products?.unit}</td>
                      <td style={styles.td}>R$ {Number(it.unit_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                      <td style={{ ...styles.td, color: Number(it.received_quantity) >= Number(it.quantity) ? "var(--green)" : "var(--text-dim)" }}>
                        {it.received_quantity} {it.products?.unit}
                      </td>
                      <td style={{ ...styles.td, textAlign: "right" }}>
                        {selectedOrder?.status === "aberto" && (
                          <button style={styles.deleteBtn} onClick={() => removeItem(it.id)} type="button">Remover</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {selectedOrder?.status === "aberto" && items.length > 0 && (
            <>
              {warehouses.length === 0 ? (
                <div style={styles.error}>
                  Nenhum almoxarifado cadastrado. Cadastre em Cadastro → Almoxarifados antes de receber este pedido.
                </div>
              ) : (
                <label style={styles.field}>
                  <span style={styles.fieldLabel}>Receber em qual almoxarifado?</span>
                  <select style={styles.input} value={receivingWarehouseId} onChange={(e) => setReceivingWarehouseId(e.target.value)}>
                    <option value="">Selecione...</option>
                    {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </label>
              )}
              <button style={styles.receiveBtn} onClick={markAsReceived} disabled={receiving || !receivingWarehouseId} type="button">
                {receiving ? "Registrando..." : "Marcar pedido como recebido (atualiza estoque)"}
              </button>
            </>
          )}
          {selectedOrder?.status === "recebido" && (
            <p style={{ ...styles.dim, marginTop: 12 }}>Pedido já recebido — o estoque foi atualizado.</p>
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
    display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 12, alignItems: "end",
    background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: 16, marginBottom: 18, maxWidth: 720,
  },
  addBtn: {
    background: "var(--green)", color: "#052014", border: "none", borderRadius: "var(--radius)",
    padding: "9px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", height: 38,
  },
  receiveBtn: {
    marginTop: 16, background: "var(--amber)", color: "#1A1400", border: "none",
    borderRadius: "var(--radius)", padding: "12px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer",
  },
  dim: { color: "var(--text-dim)", fontSize: 14 },
  tableWrap: { border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden", maxWidth: 760 },
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
