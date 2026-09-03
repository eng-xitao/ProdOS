import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { confirmDelete } from "../lib/deleteGuard";
import { openPrintWindow, brandHeader, currency, formatDate, sendDocumentEmail } from "../lib/printDocument";

const STATUS_LABEL = { aberto: "Aberto", faturado: "Faturado", entregue: "Entregue", cancelado: "Cancelado" };
const STATUS_COLOR = { aberto: "var(--text-dim)", faturado: "#2563EB", entregue: "var(--green)", cancelado: "var(--danger)" };

export default function PedidosVendaPage() {
  const { company } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");

  async function loadAll() {
    setLoading(true);
    const [o, c] = await Promise.all([
      supabase.from("sales_orders").select("id, code, status, customer_id, total_value, order_date, receivable_generated, customers:customer_id (name)").order("order_date", { ascending: false }),
      supabase.from("customers").select("id, name").order("name"),
    ]);
    setOrders(o.data ?? []); setCustomers(c.data ?? []);
    setLoading(false);
  }

  useEffect(() => { if (company?.id) loadAll(); }, [company?.id]);

  useEffect(() => {
    const abrir = searchParams.get("abrir");
    if (abrir) { setSelectedId(abrir); searchParams.delete("abrir"); setSearchParams(searchParams, { replace: true }); }
  }, [searchParams]);

  const filtered = useMemo(() => orders.filter((o) => {
    const matchesSearch = !search || `${o.code} ${o.customers?.name ?? ""}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "todos" || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  }), [orders, search, statusFilter]);

  async function createOrder(form) {
    const code = form.code.trim() || `PV-${String(orders.length + 1).padStart(4, "0")}`;
    const { data, error } = await supabase.from("sales_orders").insert({
      company_id: company.id, code, customer_id: form.customer_id, total_value: 0,
      status: "aberto", order_date: form.order_date || new Date().toISOString().slice(0, 10),
    }).select("id").single();
    if (error) throw error;
    await loadAll();
    setShowNew(false);
    setSelectedId(data.id);
  }

  return (
    <div>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Pedidos de Venda</h1>
          <p style={styles.subtitle}>Pedidos definitivos — criados manualmente ou convertidos de um orçamento. Clique num pedido pra gerenciar tudo.</p>
        </div>
        <button style={styles.addBtn} onClick={() => setShowNew(true)} type="button">+ Novo pedido</button>
      </header>

      <div style={styles.toolbar}>
        <input style={styles.search} placeholder="Buscar por código ou cliente..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select style={styles.filterSelect} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="todos">Todos os status</option>
          {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {loading ? (
        <p style={styles.dim}>Carregando...</p>
      ) : filtered.length === 0 ? (
        <p style={styles.dim}>Nenhum pedido encontrado.</p>
      ) : (
        <div style={styles.list}>
          {filtered.map((o) => (
            <button key={o.id} style={styles.row} onClick={() => setSelectedId(o.id)} type="button">
              <div style={styles.rowMain}>
                <strong>{o.code}</strong>
                <span style={styles.dim}>{o.customers?.name ?? "Sem cliente"}</span>
              </div>
              <div style={styles.rowRight}>
                <span style={styles.dateHint}>{formatDate(o.order_date)} · {currency(o.total_value)}</span>
                <span style={{ ...styles.badge, color: STATUS_COLOR[o.status] }}>{STATUS_LABEL[o.status] ?? o.status}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {showNew && <NewOrderModal customers={customers} onClose={() => setShowNew(false)} onCreate={createOrder} />}

      {selectedId && (
        <OrderDrawer orderId={selectedId} company={company} onClose={() => setSelectedId("")} onRefresh={loadAll} />
      )}
    </div>
  );
}

function NewOrderModal({ customers, onClose, onCreate }) {
  const [form, setForm] = useState({ code: "", customer_id: "", order_date: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (!form.customer_id) { setError("Escolha o cliente."); return; }
    setSaving(true); setError("");
    try { await onCreate(form); } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  return (
    <div style={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>
        <div style={styles.modalHead}><h2 style={styles.modalTitle}>Novo pedido de venda</h2><button style={styles.closeBtn} onClick={onClose} type="button">✕</button></div>
        {error && <div style={styles.error}>{error}</div>}
        <form onSubmit={submit} style={styles.modalForm}>
          <label style={styles.field}><span style={styles.fieldLabel}>Código (opcional)</span><input style={styles.input} placeholder="Gerado automaticamente se vazio" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label>
          <label style={styles.field}><span style={styles.fieldLabel}>Cliente *</span><select style={styles.input} value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} required><option value="">Selecione...</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label style={styles.field}><span style={styles.fieldLabel}>Data do pedido</span><input style={styles.input} type="date" value={form.order_date} onChange={(e) => setForm({ ...form, order_date: e.target.value })} /></label>
          <p style={styles.dim}>Você adiciona os produtos e o valor total é calculado logo em seguida, no próprio pedido.</p>
          <div style={styles.modalActions}><button type="button" style={styles.secondaryBtn} onClick={onClose}>Cancelar</button><button style={styles.primaryBtn} disabled={saving} type="submit">{saving ? "Criando..." : "Criar pedido"}</button></div>
        </form>
      </div>
    </div>
  );
}

function OrderDrawer({ orderId, company, onClose, onRefresh }) {
  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [customerContacts, setCustomerContacts] = useState([]);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSentTo, setEmailSentTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [paymentTerms, setPaymentTerms] = useState([]);
  const [paymentTermId, setPaymentTermId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [receivablesMsg, setReceivablesMsg] = useState("");

  const [newProductId, setNewProductId] = useState("");
  const [newQuantity, setNewQuantity] = useState("1");
  const [newUnitPrice, setNewUnitPrice] = useState("");
  const [newDiscount, setNewDiscount] = useState("0");

  async function load() {
    setLoading(true); setError("");
    const [{ data: o, error: oe }, { data: it }, { data: p }, { data: terms }] = await Promise.all([
      supabase.from("sales_orders").select("id, code, status, order_date, total_value, customer_id, receivable_generated, customers:customer_id (name, document, email, phone, address)").eq("id", orderId).single(),
      supabase.from("sales_order_items").select("id, quantity, unit_price, discount_percent, product_id, products:product_id (sku, name)").eq("sales_order_id", orderId),
      supabase.from("products").select("id, sku, name, sale_price").order("name"),
      supabase.from("payment_terms").select("id, name, installments, days_between").order("name"),
    ]);
    if (oe) { setError(oe.message); setLoading(false); return; }
    setOrder(o); setItems(it ?? []); setProducts(p ?? []); setPaymentTerms(terms ?? []);
    if (o?.customer_id) {
      const { data: contacts } = await supabase.from("contacts").select("id, name, department, email").eq("customer_id", o.customer_id);
      setCustomerContacts(contacts ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [orderId]);

  const total = items.reduce((sum, it) => sum + Number(it.quantity) * Number(it.unit_price) * (1 - Number(it.discount_percent) / 100), 0);

  async function syncTotal(newTotal) {
    await supabase.from("sales_orders").update({ total_value: newTotal }).eq("id", orderId);
  }

  function handleProductChange(id) {
    setNewProductId(id);
    const product = products.find((p) => p.id === id);
    if (product) setNewUnitPrice(String(product.sale_price ?? 0));
  }

  async function addItem(e) {
    e.preventDefault();
    if (!newProductId) return;
    const { error: err } = await supabase.from("sales_order_items").insert({
      company_id: company.id, sales_order_id: orderId, product_id: newProductId,
      quantity: Number(newQuantity), unit_price: Number(newUnitPrice), discount_percent: Number(newDiscount),
    });
    if (err) { setError(err.message); return; }
    setNewProductId(""); setNewQuantity("1"); setNewUnitPrice(""); setNewDiscount("0");
    await load();
    await syncTotal(total + Number(newQuantity) * Number(newUnitPrice) * (1 - Number(newDiscount) / 100));
  }

  async function removeItem(id) {
    if (!(await confirmDelete(company))) return;
    await supabase.from("sales_order_items").delete().eq("id", id);
    await load();
  }

  async function updateStatus(newStatus) {
    await supabase.from("sales_orders").update({ status: newStatus }).eq("id", orderId);
    await load();
    await onRefresh();
  }

  async function deleteOrder() {
    if (!(await confirmDelete(company))) return;
    await supabase.from("sales_order_items").delete().eq("sales_order_id", orderId);
    await supabase.from("sales_orders").delete().eq("id", orderId);
    await onRefresh();
    onClose();
  }

  function buildOrderHtml() {
    const customer = order.customers;
    const rows = items.map((it) => `<tr><td>${it.products?.sku ?? ""}</td><td>${it.products?.name ?? ""}</td><td>${it.quantity}</td><td>${currency(it.unit_price)}</td><td>${it.discount_percent}%</td><td>${currency(Number(it.quantity) * Number(it.unit_price) * (1 - Number(it.discount_percent) / 100))}</td></tr>`).join("");
    return `
      ${brandHeader(company, "CONFIRMAÇÃO DE PEDIDO", [["Nº", order.code], ["Data", formatDate(order.order_date)], ["Status", STATUS_LABEL[order.status]]])}
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
      <table><thead><tr><th>SKU</th><th>Produto</th><th>Qtd.</th><th>Preço unit.</th><th>Desc.</th><th>Subtotal</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="totals-box"><div class="totals-inner"><div class="total-row-final"><span>Total do Pedido</span><span>${currency(total)}</span></div></div></div>
      <div class="signatures"><div class="signature-line">${company?.name ?? "Empresa"}</div><div class="signature-line">${customer?.name ?? "Cliente"}</div></div>
    `;
  }

  function printOrder() {
    if (!order) return;
    openPrintWindow(`Pedido ${order.code}`, buildOrderHtml());
  }

  async function sendEmail() {
    const contact = customerContacts.find((c) => c.id === selectedContactId);
    if (!contact?.email || !order) return;
    setSendingEmail(true); setError("");
    const { error: sendError } = await sendDocumentEmail({
      to: contact.email, subject: `Pedido de Venda ${order.code} — ${company?.name ?? ""}`,
      message: `<p>Olá ${contact.name},</p><p>Segue em anexo a confirmação do Pedido de Venda ${order.code}.</p><p>Atenciosamente,<br/>${company?.name ?? ""}</p>`,
      bodyHtml: buildOrderHtml(), filename: `pedido-${order.code}.pdf`,
    });
    if (sendError) setError("Não foi possível enviar o e-mail agora. Tente novamente em instantes.");
    else setEmailSentTo(contact.email);
    setSendingEmail(false);
  }

  async function generateReceivables() {
    const term = paymentTerms.find((t) => t.id === paymentTermId);
    if (!term || !order) return;
    setGenerating(true); setReceivablesMsg("");

    const installments = Math.max(1, term.installments);
    const amountPerInstallment = total / installments;
    const baseDate = new Date(order.order_date + "T00:00:00");

    const entries = Array.from({ length: installments }, (_, i) => {
      const dueDate = new Date(baseDate);
      dueDate.setDate(dueDate.getDate() + term.days_between * (i + 1));
      return {
        company_id: company.id, description: `Pedido ${order.code} — parcela ${i + 1}/${installments}`,
        entry_type: "receita", amount: amountPerInstallment, due_date: dueDate.toISOString().slice(0, 10),
        customer_id: order.customer_id, sales_order_id: order.id, installment_number: i + 1,
        total_installments: installments, paid: false,
      };
    });

    const { error: insertError } = await supabase.from("financial_entries").insert(entries);
    if (insertError) { setError(insertError.message); setGenerating(false); return; }

    await supabase.from("sales_orders").update({ receivable_generated: true }).eq("id", order.id);
    setGenerating(false);
    setReceivablesMsg("Parcelas geradas com sucesso em Financeiro → Contas a Receber.");
    setPaymentTermId("");
    await load();
    await onRefresh();
  }

  return (
    <div style={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside style={styles.drawer}>
        {loading ? <p style={styles.dim}>Carregando...</p> : !order ? <p style={styles.dim}>Pedido não encontrado.</p> : (
          <>
            <div style={styles.drawerHead}>
              <div>
                <span style={styles.codeLarge}>{order.code}</span>
                <h2 style={styles.drawerTitle}>{order.customers?.name ?? "Sem cliente"}</h2>
              </div>
              <button style={styles.closeBtn} onClick={onClose} type="button">✕</button>
            </div>

            {error && <div style={styles.error}>{error}</div>}

            <div style={styles.statusRow}>
              <span style={styles.fieldLabel}>Status</span>
              <select style={{ ...styles.input, maxWidth: 220, color: STATUS_COLOR[order.status] }} value={order.status} onChange={(e) => updateStatus(e.target.value)}>
                {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>

            <div style={styles.actionsRow}>
              <button style={styles.printBtn} onClick={printOrder} type="button" disabled={items.length === 0}>🖨 Imprimir</button>
              {customerContacts.length > 0 && (
                <>
                  <select style={styles.contactSelect} value={selectedContactId} onChange={(e) => setSelectedContactId(e.target.value)}>
                    <option value="">Escolha o contato...</option>
                    {customerContacts.map((c) => <option key={c.id} value={c.id}>{c.name}{c.department ? ` — ${c.department}` : ""}</option>)}
                  </select>
                  <button style={styles.printBtn} onClick={sendEmail} type="button" disabled={!selectedContactId || sendingEmail}>{sendingEmail ? "Enviando..." : "✉ Enviar por e-mail"}</button>
                  {emailSentTo && <span style={styles.emailSentTag}>Enviado para {emailSentTo}</span>}
                </>
              )}
              <button style={styles.deleteBtn} onClick={deleteOrder} type="button">🗑 Excluir</button>
            </div>

            <form onSubmit={addItem} style={styles.itemForm}>
              <select style={styles.input} value={newProductId} onChange={(e) => handleProductChange(e.target.value)} required>
                <option value="">Adicionar produto...</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
              </select>
              <input style={styles.smallInput} type="number" step="any" value={newQuantity} onChange={(e) => setNewQuantity(e.target.value)} placeholder="Qtd." required />
              <input style={styles.smallInput} type="number" step="any" value={newUnitPrice} onChange={(e) => setNewUnitPrice(e.target.value)} placeholder="Preço" required />
              <input style={styles.smallInput} type="number" step="any" value={newDiscount} onChange={(e) => setNewDiscount(e.target.value)} placeholder="Desc. %" />
              <button style={styles.addBtn} type="submit">+</button>
            </form>

            {items.length === 0 ? <p style={styles.dim}>Nenhum item neste pedido ainda.</p> : (
              <div style={styles.itemList}>
                {items.map((it) => {
                  const line = Number(it.quantity) * Number(it.unit_price) * (1 - Number(it.discount_percent) / 100);
                  return (
                    <div key={it.id} style={styles.itemRow}>
                      <span>{it.products?.sku} — {it.products?.name}</span>
                      <span>{it.quantity} × {currency(it.unit_price)} ({it.discount_percent}%)</span>
                      <b>{currency(line)}</b>
                      <button style={styles.removeMini} onClick={() => removeItem(it.id)} type="button">✕</button>
                    </div>
                  );
                })}
                <div style={styles.totalLine}><span>Total</span><strong>{currency(total)}</strong></div>
              </div>
            )}

            {order.status === "faturado" && !order.receivable_generated && (
              <div style={styles.receivablesBox}>
                <p style={styles.receivablesTitle}>Gerar Contas a Receber</p>
                <p style={styles.dim}>Escolha a condição de pagamento — as parcelas são criadas automaticamente.</p>
                {receivablesMsg && <div style={styles.success}>{receivablesMsg}</div>}
                <div style={styles.receivablesRow}>
                  <select style={styles.input} value={paymentTermId} onChange={(e) => setPaymentTermId(e.target.value)}>
                    <option value="">Selecione a condição...</option>
                    {paymentTerms.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.installments}x)</option>)}
                  </select>
                  <button style={styles.addBtn} onClick={generateReceivables} disabled={generating || !paymentTermId} type="button">{generating ? "Gerando..." : "Gerar Parcelas"}</button>
                </div>
              </div>
            )}
            {order.receivable_generated && <p style={{ ...styles.dim, marginTop: 12 }}>Contas a receber já geradas pra esse pedido.</p>}
          </>
        )}
      </aside>
    </div>
  );
}

const styles = {
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 20, flexWrap: "wrap" },
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0", maxWidth: 600 },
  addBtn: { background: "var(--amber)", color: "#fff", border: "none", borderRadius: "var(--radius)", padding: "10px 16px", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" },
  toolbar: { display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" },
  search: { flex: 1, minWidth: 220, background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: "10px 12px", color: "var(--text)", fontSize: 13 },
  filterSelect: { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: "10px 12px", color: "var(--text)", fontSize: 13, minWidth: 180 },
  dim: { color: "var(--text-dim)", fontSize: 13 },
  list: { display: "flex", flexDirection: "column", gap: 8, maxWidth: 820 },
  row: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: "14px 16px", cursor: "pointer", textAlign: "left", width: "100%", flexWrap: "wrap" },
  rowMain: { display: "flex", flexDirection: "column", gap: 3 },
  rowRight: { display: "flex", alignItems: "center", gap: 14 },
  dateHint: { fontSize: 11.5, color: "var(--text-dim)" },
  badge: { fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap" },
  overlay: { position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,.48)", display: "flex", justifyContent: "flex-end" },
  drawer: { width: "min(680px,96vw)", height: "100vh", boxSizing: "border-box", background: "var(--panel)", color: "var(--text)", boxShadow: "-10px 0 30px rgba(0,0,0,.18)", padding: "22px 24px", overflowY: "auto" },
  drawerHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 12 },
  codeLarge: { display: "block", fontSize: 11, fontWeight: 800, color: "var(--text-dim)" },
  drawerTitle: { fontFamily: "var(--font-display)", fontSize: 20, margin: "2px 0" },
  closeBtn: { width: 34, height: 34, flex: "0 0 34px", border: "1px solid var(--line)", background: "var(--bg)", color: "var(--text)", borderRadius: 8, cursor: "pointer", fontSize: 16 },
  statusRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" },
  fieldLabel: { fontSize: 11, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" },
  input: { width: "100%", boxSizing: "border-box", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 8, padding: "9px 10px", color: "var(--text)", fontSize: 13 },
  smallInput: { width: 90, boxSizing: "border-box", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 8, padding: "9px 10px", color: "var(--text)", fontSize: 13 },
  actionsRow: { display: "flex", gap: 8, alignItems: "center", marginBottom: 16, flexWrap: "wrap" },
  printBtn: { background: "var(--bg)", color: "var(--text)", border: "1px solid var(--line)", borderRadius: 8, padding: "9px 12px", fontWeight: 700, cursor: "pointer", fontSize: 12.5 },
  contactSelect: { background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 8, padding: "9px 10px", color: "var(--text)", fontSize: 12.5 },
  emailSentTag: { fontSize: 12, color: "var(--green)", fontWeight: 600 },
  deleteBtn: { background: "transparent", color: "var(--danger)", border: "1px solid var(--danger)", borderRadius: 8, padding: "9px 12px", fontWeight: 700, cursor: "pointer", fontSize: 12.5 },
  itemForm: { display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: 8, marginBottom: 14, alignItems: "center" },
  addBtn: { background: "var(--green)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" },
  itemList: { display: "flex", flexDirection: "column", gap: 6 },
  itemRow: { display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 10, alignItems: "center", padding: "9px 0", borderTop: "1px solid var(--line)", fontSize: 12.5 },
  removeMini: { background: "transparent", border: 0, color: "var(--danger)", cursor: "pointer", fontSize: 13 },
  totalLine: { display: "flex", justifyContent: "space-between", marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--line)", fontSize: 15 },
  receivablesBox: { marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--line)" },
  receivablesTitle: { fontWeight: 700, fontSize: 14, margin: "0 0 4px" },
  receivablesRow: { display: "flex", gap: 8, marginTop: 10 },
  success: { background: "rgba(34,197,94,.1)", border: "1px solid rgba(34,197,94,.25)", borderRadius: 8, padding: 10, fontSize: 12.5, marginTop: 10 },
  modal: { width: "min(520px,94vw)", maxHeight: "90vh", overflowY: "auto", background: "var(--panel)", color: "var(--text)", borderRadius: 12, padding: 20, boxSizing: "border-box", alignSelf: "center", margin: "auto" },
  modalHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  modalTitle: { fontFamily: "var(--font-display)", fontSize: 18, margin: 0 },
  modalForm: { display: "flex", flexDirection: "column", gap: 12 },
  field: { display: "flex", flexDirection: "column", gap: 5 },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 },
  primaryBtn: { background: "var(--amber)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontWeight: 700, cursor: "pointer" },
  secondaryBtn: { background: "var(--bg)", color: "var(--text)", border: "1px solid var(--line)", borderRadius: 8, padding: "9px 16px", fontWeight: 700, cursor: "pointer" },
  error: { background: "rgba(217,105,95,0.12)", border: "1px solid var(--red)", color: "var(--red)", borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 13, marginBottom: 14 },
};
