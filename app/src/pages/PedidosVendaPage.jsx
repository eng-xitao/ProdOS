import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import ModulePage from "../components/ModulePage";
import { openPrintWindow, brandHeader, currency, formatDate, openMailto } from "../lib/printDocument";

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
            quickEdit: true,
          },
          { key: "order_date", label: "Data do pedido", type: "date" },
        ]}
      />
      <OrderItemsViewer onRefresh={() => setRefreshKey((k) => k + 1)} />
      <GenerateReceivablesPanel onGenerated={() => setRefreshKey((k) => k + 1)} />
    </div>
  );
}

/**
 * Gera as parcelas de Contas a Receber a partir de um Pedido de
 * Venda faturado, conforme a Condição de Pagamento escolhida.
 */
function GenerateReceivablesPanel({ onGenerated }) {
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
      supabase.from("sales_orders").select("id, code, total_value, customer_id, order_date").eq("status", "faturado").eq("receivable_generated", false),
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
        entry_type: "receita",
        amount: amountPerInstallment,
        due_date: dueDate.toISOString().slice(0, 10),
        customer_id: order.customer_id,
        sales_order_id: order.id,
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

    await supabase.from("sales_orders").update({ receivable_generated: true }).eq("id", order.id);
    setGenerating(false);
    setSuccess(true);
    setOrderId(""); setPaymentTermId("");
    loadData();
    onGenerated();
  }

  if (orders.length === 0) return null;

  return (
    <div style={panelStyles.wrap}>
      <h2 style={panelStyles.title}>Gerar Contas a Receber</h2>
      <p style={panelStyles.subtitle}>
        Escolha um pedido faturado e a condição de pagamento — as parcelas são criadas automaticamente.
      </p>

      {error && <div style={panelStyles.error}>{error}</div>}
      {success && <div style={panelStyles.success}>Parcelas geradas com sucesso em Financeiro → Contas a Receber.</div>}

      <div style={panelStyles.form}>
        <label style={panelStyles.field}>
          <span style={panelStyles.fieldLabel}>Pedido faturado</span>
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
    background: "var(--amber)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)",
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
 * Mostra os itens de um pedido (preenchidos automaticamente quando o
 * pedido nasce de um orçamento convertido, ou adicionados manualmente).
 */
function OrderItemsViewer() {
  const { company } = useAuth();
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [orderId, setOrderId] = useState("");
  const [orderDetails, setOrderDetails] = useState(null);
  const [customerContacts, setCustomerContacts] = useState([]);
  const [selectedContactId, setSelectedContactId] = useState("");
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

  async function loadOrderDetails(oid) {
    if (!oid) { setOrderDetails(null); setCustomerContacts([]); return; }
    const { data } = await supabase
      .from("sales_orders")
      .select("code, order_date, status, total_value, customer_id, customers:customer_id (name, document, email, phone, address)")
      .eq("id", oid)
      .single();
    setOrderDetails(data);
    setSelectedContactId("");

    if (data?.customer_id) {
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, name, department, email")
        .eq("customer_id", data.customer_id);
      setCustomerContacts(contacts ?? []);
    } else {
      setCustomerContacts([]);
    }
  }

  useEffect(() => {
    if (company?.id) { loadOrders(); loadProducts(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  useEffect(() => {
    loadItems(orderId);
    loadOrderDetails(orderId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const total = items.reduce((sum, it) => {
    const line = Number(it.quantity) * Number(it.unit_price) * (1 - Number(it.discount_percent) / 100);
    return sum + line;
  }, 0);

  function printOrder() {
    if (!orderDetails) return;
    const customer = orderDetails.customers;

    const rows = items.map((it) => {
      const line = Number(it.quantity) * Number(it.unit_price) * (1 - Number(it.discount_percent) / 100);
      return `<tr>
        <td>${it.products?.sku ?? ""}</td>
        <td>${it.products?.name ?? ""}</td>
        <td>${it.quantity}</td>
        <td>${currency(it.unit_price)}</td>
        <td>${it.discount_percent}%</td>
        <td>${currency(line)}</td>
      </tr>`;
    }).join("");

    const html = `
      ${brandHeader(company, "CONFIRMAÇÃO DE PEDIDO", [
        ["Nº", orderDetails.code],
        ["Data", formatDate(orderDetails.order_date)],
        ["Status", orderDetails.status],
      ])}
      <div class="disclaimer">Este documento não é uma nota fiscal — apenas uma confirmação do pedido de venda</div>
      <div class="section-title">Dados do Cliente</div>
      <div class="info-grid">
        <div><strong>Cliente:</strong> ${customer?.name ?? "—"}</div>
        <div><strong>CPF/CNPJ:</strong> ${customer?.document ?? "—"}</div>
        <div><strong>E-mail:</strong> ${customer?.email ?? "—"}</div>
        <div><strong>Telefone:</strong> ${customer?.phone ?? "—"}</div>
        <div style="grid-column: 1 / -1;"><strong>Endereço:</strong> ${customer?.address ?? "—"}</div>
      </div>
      <div class="section-title">Itens</div>
      <table>
        <thead><tr><th>SKU</th><th>Produto</th><th>Qtd.</th><th>Preço unit.</th><th>Desc.</th><th>Subtotal</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="totals-box">
        <div class="totals-inner">
          <div class="total-row-final"><span>Total do Pedido</span><span>${currency(orderDetails.total_value)}</span></div>
        </div>
      </div>
      <div class="signatures">
        <div class="signature-line">${company?.name ?? "Empresa"}</div>
        <div class="signature-line">${customer?.name ?? "Cliente"}</div>
      </div>
    `;

    openPrintWindow(`Pedido ${orderDetails.code}`, html);
  }

  function sendEmail() {
    const contact = customerContacts.find((c) => c.id === selectedContactId);
    if (!contact?.email || !orderDetails) return;
    openMailto(
      contact.email,
      `Pedido de Venda ${orderDetails.code} — ${company?.name ?? ""}`,
      `Olá ${contact.name},\n\nSegue em anexo a confirmação do Pedido de Venda ${orderDetails.code}.\n\n(Lembre-se de anexar o PDF gerado na impressão antes de enviar.)\n\nAtenciosamente,\n${company?.name ?? ""}`
    );
  }

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
          <div style={styles.actionsRow}>
            <button style={styles.printBtn} onClick={printOrder} type="button" disabled={!orderDetails || items.length === 0}>
              🖨 Imprimir Confirmação de Pedido
            </button>
            {customerContacts.length > 0 && (
              <>
                <select style={styles.contactSelect} value={selectedContactId} onChange={(e) => setSelectedContactId(e.target.value)}>
                  <option value="">Escolha o contato...</option>
                  {customerContacts.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{c.department ? ` — ${c.department}` : ""}</option>
                  ))}
                </select>
                <button style={styles.printBtn} onClick={sendEmail} type="button" disabled={!selectedContactId}>
                  ✉ Enviar por E-mail
                </button>
              </>
            )}
          </div>

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
    background: "var(--green)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)",
    padding: "9px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", height: 38,
  },
  printBtn: {
    background: "transparent", color: "var(--text-dim)", border: "1px solid var(--line)",
    borderRadius: "var(--radius)", padding: "9px 16px", fontWeight: 600, fontSize: 13,
    cursor: "pointer", marginBottom: 16,
  },
  actionsRow: { display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" },
  contactSelect: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "9px 10px", color: "var(--text)", fontSize: 13,
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
