import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { confirmDelete } from "../lib/deleteGuard";
import { openPrintWindow, brandHeader, currency, formatDate, sendDocumentEmail } from "../lib/printDocument";

const STATUS_LABEL = { rascunho: "Rascunho", enviado: "Enviado", aprovado: "Aprovado", rejeitado: "Rejeitado", convertido: "Convertido em pedido" };
const STATUS_COLOR = { rascunho: "var(--text-dim)", enviado: "#2563EB", aprovado: "var(--green)", rejeitado: "var(--danger)", convertido: "var(--amber)" };

export default function OrcamentosPage() {
  const { company } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [quotes, setQuotes] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [paymentTerms, setPaymentTerms] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");

  async function loadAll() {
    setLoading(true);
    const [q, c, p, o] = await Promise.all([
      supabase.from("quotes").select("id, code, status, customer_id, opportunity_id, valid_until, created_at, customers:customer_id (name)").order("created_at", { ascending: false }),
      supabase.from("customers").select("id, name").order("name"),
      supabase.from("payment_terms").select("id, name").order("name"),
      supabase.from("opportunities").select("id, title").order("title"),
    ]);
    setQuotes(q.data ?? []); setCustomers(c.data ?? []); setPaymentTerms(p.data ?? []); setOpportunities(o.data ?? []);
    setLoading(false);
  }

  useEffect(() => { if (company?.id) loadAll(); }, [company?.id]);

  useEffect(() => {
    const abrir = searchParams.get("abrir");
    if (abrir) { setSelectedId(abrir); searchParams.delete("abrir"); setSearchParams(searchParams, { replace: true }); }
  }, [searchParams]);

  const filtered = useMemo(() => quotes.filter((q) => {
    const matchesSearch = !search || `${q.code} ${q.customers?.name ?? ""}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "todos" || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  }), [quotes, search, statusFilter]);

  async function createQuote(form) {
    const code = form.code.trim() || `ORC-${String(quotes.length + 1).padStart(4, "0")}`;
    const { data, error } = await supabase.from("quotes").insert({
      company_id: company.id, code, customer_id: form.customer_id, opportunity_id: form.opportunity_id || null,
      payment_term_id: form.payment_term_id || null, valid_until: form.valid_until || null, status: "rascunho",
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
          <h1 style={styles.title}>Orçamentos</h1>
          <p style={styles.subtitle}>Propostas comerciais — clique num orçamento pra ver itens, status e imprimir.</p>
        </div>
        <button style={styles.addBtn} onClick={() => setShowNew(true)} type="button">+ Novo orçamento</button>
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
        <p style={styles.dim}>Nenhum orçamento encontrado.</p>
      ) : (
        <div style={styles.list}>
          {filtered.map((q) => (
            <button key={q.id} style={styles.row} onClick={() => setSelectedId(q.id)} type="button">
              <div style={styles.rowMain}>
                <strong>{q.code}</strong>
                <span style={styles.dim}>{q.customers?.name ?? "Sem cliente"}</span>
              </div>
              <div style={styles.rowRight}>
                <span style={styles.dateHint}>{q.valid_until ? `Válido até ${formatDate(q.valid_until)}` : "Sem validade"}</span>
                <span style={{ ...styles.badge, color: STATUS_COLOR[q.status] }}>{STATUS_LABEL[q.status] ?? q.status}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {showNew && (
        <NewQuoteModal customers={customers} opportunities={opportunities} paymentTerms={paymentTerms} onClose={() => setShowNew(false)} onCreate={createQuote} />
      )}

      {selectedId && (
        <QuoteDrawer
          quoteId={selectedId} company={company} navigate={navigate} paymentTerms={paymentTerms}
          onClose={() => setSelectedId("")} onRefresh={loadAll}
        />
      )}
    </div>
  );
}

function NewQuoteModal({ customers, opportunities, paymentTerms, onClose, onCreate }) {
  const [form, setForm] = useState({ code: "", customer_id: "", opportunity_id: "", payment_term_id: "", valid_until: "" });
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
        <div style={styles.modalHead}><h2 style={styles.modalTitle}>Novo orçamento</h2><button style={styles.closeBtn} onClick={onClose} type="button">✕</button></div>
        {error && <div style={styles.error}>{error}</div>}
        <form onSubmit={submit} style={styles.modalForm}>
          <label style={styles.field}><span style={styles.fieldLabel}>Código (opcional)</span><input style={styles.input} placeholder="Gerado automaticamente se vazio" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label>
          <label style={styles.field}><span style={styles.fieldLabel}>Cliente *</span><select style={styles.input} value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} required><option value="">Selecione...</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label style={styles.field}><span style={styles.fieldLabel}>Oportunidade vinculada (opcional)</span><select style={styles.input} value={form.opportunity_id} onChange={(e) => setForm({ ...form, opportunity_id: e.target.value })}><option value="">Nenhuma</option>{opportunities.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}</select></label>
          <label style={styles.field}><span style={styles.fieldLabel}>Condição de pagamento</span><select style={styles.input} value={form.payment_term_id} onChange={(e) => setForm({ ...form, payment_term_id: e.target.value })}><option value="">Não definida</option>{paymentTerms.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label style={styles.field}><span style={styles.fieldLabel}>Válido até</span><input style={styles.input} type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} /></label>
          <div style={styles.modalActions}><button type="button" style={styles.secondaryBtn} onClick={onClose}>Cancelar</button><button style={styles.primaryBtn} disabled={saving} type="submit">{saving ? "Criando..." : "Criar orçamento"}</button></div>
        </form>
      </div>
    </div>
  );
}

function QuoteDrawer({ quoteId, company, navigate, onClose, onRefresh }) {
  const [quote, setQuote] = useState(null);
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [customerContacts, setCustomerContacts] = useState([]);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSentTo, setEmailSentTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message] = useState("");
  const [converting, setConverting] = useState(false);

  const [newProductId, setNewProductId] = useState("");
  const [newQuantity, setNewQuantity] = useState("1");
  const [newUnitPrice, setNewUnitPrice] = useState("");
  const [newDiscount, setNewDiscount] = useState("0");

  async function load() {
    setLoading(true); setError("");
    const [{ data: q, error: qe }, { data: it }, { data: p }] = await Promise.all([
      supabase.from("quotes").select("id, code, status, valid_until, notes, created_at, customer_id, payment_term_id, customers:customer_id (name, document, email, phone, address), payment_terms:payment_term_id (name)").eq("id", quoteId).single(),
      supabase.from("quote_items").select("id, quantity, unit_price, discount_percent, product_id, products:product_id (sku, name)").eq("quote_id", quoteId),
      supabase.from("products").select("id, sku, name, sale_price").order("name"),
    ]);
    if (qe) { setError(qe.message); setLoading(false); return; }
    setQuote(q); setItems(it ?? []); setProducts(p ?? []);
    if (q?.customer_id) {
      const { data: contacts } = await supabase.from("contacts").select("id, name, department, email").eq("customer_id", q.customer_id);
      setCustomerContacts(contacts ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [quoteId]);

  const total = items.reduce((sum, it) => sum + Number(it.quantity) * Number(it.unit_price) * (1 - Number(it.discount_percent) / 100), 0);
  const isConverted = quote?.status === "convertido";

  function handleProductChange(id) {
    setNewProductId(id);
    const product = products.find((p) => p.id === id);
    if (product) setNewUnitPrice(String(product.sale_price ?? 0));
  }

  async function addItem(e) {
    e.preventDefault();
    if (!newProductId) return;
    const { error: err } = await supabase.from("quote_items").insert({
      company_id: company.id, quote_id: quoteId, product_id: newProductId,
      quantity: Number(newQuantity), unit_price: Number(newUnitPrice), discount_percent: Number(newDiscount),
    });
    if (err) setError(err.message);
    else { setNewProductId(""); setNewQuantity("1"); setNewUnitPrice(""); setNewDiscount("0"); await load(); }
  }

  async function removeItem(id) {
    if (!(await confirmDelete(company))) return;
    await supabase.from("quote_items").delete().eq("id", id);
    await load();
  }

  async function updateStatus(newStatus) {
    await supabase.from("quotes").update({ status: newStatus }).eq("id", quoteId);
    await load();
    await onRefresh();
  }

  async function deleteQuote() {
    if (isConverted) return;
    if (!(await confirmDelete(company))) return;
    await supabase.from("quote_items").delete().eq("quote_id", quoteId);
    await supabase.from("quotes").delete().eq("id", quoteId);
    await onRefresh();
    onClose();
  }

  async function convertToOrder() {
    if (!items.length) return;
    setConverting(true); setError("");
    const { data: order, error: orderError } = await supabase.from("sales_orders").insert({
      company_id: company.id, code: `PV-${quote.code}`, customer_id: quote.customer_id, quote_id: quoteId,
      status: "aberto", order_date: new Date().toISOString().slice(0, 10), total_value: total,
    }).select("id").single();
    if (orderError) { setError(orderError.message); setConverting(false); return; }

    const { error: itemsError } = await supabase.from("sales_order_items").insert(items.map((it) => ({
      company_id: company.id, sales_order_id: order.id, product_id: it.product_id,
      quantity: it.quantity, unit_price: it.unit_price, discount_percent: it.discount_percent,
    })));
    if (itemsError) { setError(itemsError.message); setConverting(false); return; }

    await supabase.from("quotes").update({ status: "convertido" }).eq("id", quoteId);
    setConverting(false);
    await onRefresh();
    navigate(`/pedidos-venda?abrir=${order.id}`);
  }

  function buildQuoteHtml() {
    const customer = quote.customers;
    const rows = items.map((it) => `<tr><td>${it.products?.sku ?? ""}</td><td>${it.products?.name ?? ""}</td><td>${it.quantity}</td><td>${currency(it.unit_price)}</td><td>${it.discount_percent}%</td><td>${currency(Number(it.quantity) * Number(it.unit_price) * (1 - Number(it.discount_percent) / 100))}</td></tr>`).join("");
    return `
      ${brandHeader(company, "ORÇAMENTO", [["Nº", quote.code], ["Emitido em", formatDate(quote.created_at)], ["Válido até", formatDate(quote.valid_until)]])}
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
      <div class="totals-box"><div class="totals-inner"><div class="total-row-final"><span>Total Geral</span><span>${currency(total)}</span></div></div></div>
      <div class="section-title">Condições</div>
      <div class="info-grid"><div><strong>Forma de pagamento:</strong> ${quote.payment_terms?.name ?? "A combinar"}</div></div>
      ${quote.notes ? `<div class="notes-box"><strong>Observações:</strong><br/>${quote.notes}</div>` : ""}
      <div class="signatures"><div class="signature-line">${company?.name ?? "Empresa"}</div><div class="signature-line">${customer?.name ?? "Cliente"}</div></div>
    `;
  }

  function printQuote() {
    if (!quote) return;
    openPrintWindow(`Orçamento ${quote.code}`, buildQuoteHtml());
  }

  async function sendEmail() {
    const contact = customerContacts.find((c) => c.id === selectedContactId);
    if (!contact?.email || !quote) return;
    setSendingEmail(true); setError("");
    const { error: sendError } = await sendDocumentEmail({
      to: contact.email, subject: `Orçamento ${quote.code} — ${company?.name ?? ""}`,
      message: `<p>Olá ${contact.name},</p><p>Segue em anexo o Orçamento ${quote.code}.</p><p>Atenciosamente,<br/>${company?.name ?? ""}</p>`,
      bodyHtml: buildQuoteHtml(), filename: `orcamento-${quote.code}.pdf`,
    });
    if (sendError) setError("Não foi possível enviar o e-mail agora. Tente novamente em instantes.");
    else setEmailSentTo(contact.email);
    setSendingEmail(false);
  }

  return (
    <div style={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside style={styles.drawer}>
        {loading ? <p style={styles.dim}>Carregando...</p> : !quote ? <p style={styles.dim}>Orçamento não encontrado.</p> : (
          <>
            <div style={styles.drawerHead}>
              <div>
                <span style={styles.codeLarge}>{quote.code}</span>
                <h2 style={styles.drawerTitle}>{quote.customers?.name ?? "Sem cliente"}</h2>
              </div>
              <button style={styles.closeBtn} onClick={onClose} type="button">✕</button>
            </div>

            {message && <div style={styles.success}>{message}</div>}
            {error && <div style={styles.error}>{error}</div>}

            <div style={styles.statusRow}>
              <span style={styles.fieldLabel}>Status</span>
              <select style={{ ...styles.input, maxWidth: 220, color: STATUS_COLOR[quote.status] }} value={quote.status} onChange={(e) => updateStatus(e.target.value)} disabled={isConverted}>
                {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v} disabled={v === "convertido"}>{l}</option>)}
              </select>
              {isConverted && <span style={styles.dim}>Orçamento já convertido — status travado.</span>}
            </div>

            <div style={styles.actionsRow}>
              <button style={styles.printBtn} onClick={printQuote} type="button" disabled={items.length === 0}>🖨 Imprimir</button>
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
              {!isConverted && <button style={styles.deleteBtn} onClick={deleteQuote} type="button">🗑 Excluir</button>}
            </div>

            {!isConverted && (
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
            )}

            {items.length === 0 ? <p style={styles.dim}>Nenhum item adicionado ainda.</p> : (
              <div style={styles.itemList}>
                {items.map((it) => {
                  const line = Number(it.quantity) * Number(it.unit_price) * (1 - Number(it.discount_percent) / 100);
                  return (
                    <div key={it.id} style={styles.itemRow}>
                      <span>{it.products?.sku} — {it.products?.name}</span>
                      <span>{it.quantity} × {currency(it.unit_price)} ({it.discount_percent}%)</span>
                      <b>{currency(line)}</b>
                      {!isConverted && <button style={styles.removeMini} onClick={() => removeItem(it.id)} type="button">✕</button>}
                    </div>
                  );
                })}
                <div style={styles.totalLine}><span>Total</span><strong>{currency(total)}</strong></div>
              </div>
            )}

            {quote.status === "aprovado" && (
              <button style={styles.convertBtn} onClick={convertToOrder} disabled={converting || items.length === 0} type="button">
                {converting ? "Convertendo..." : "Converter em Pedido de Venda →"}
              </button>
            )}
            {isConverted && <p style={{ ...styles.dim, marginTop: 12 }}>Este orçamento já foi convertido em pedido de venda.</p>}
          </>
        )}
      </aside>
    </div>
  );
}

const styles = {
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 20, flexWrap: "wrap" },
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0" },
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
  addBtn: { background: "var(--green)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontWeight: 700, cursor: "pointer" },
  itemList: { display: "flex", flexDirection: "column", gap: 6 },
  itemRow: { display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 10, alignItems: "center", padding: "9px 0", borderTop: "1px solid var(--line)", fontSize: 12.5 },
  removeMini: { background: "transparent", border: 0, color: "var(--danger)", cursor: "pointer", fontSize: 13 },
  totalLine: { display: "flex", justifyContent: "space-between", marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--line)", fontSize: 15 },
  convertBtn: { marginTop: 18, width: "100%", background: "var(--amber)", color: "#fff", border: "none", borderRadius: 8, padding: "12px 0", fontWeight: 700, fontSize: 14, cursor: "pointer" },
  modal: { width: "min(520px,94vw)", maxHeight: "90vh", overflowY: "auto", background: "var(--panel)", color: "var(--text)", borderRadius: 12, padding: 20, boxSizing: "border-box", alignSelf: "center", margin: "auto" },
  modalHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  modalTitle: { fontFamily: "var(--font-display)", fontSize: 18, margin: 0 },
  modalForm: { display: "flex", flexDirection: "column", gap: 12 },
  field: { display: "flex", flexDirection: "column", gap: 5 },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 },
  primaryBtn: { background: "var(--amber)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontWeight: 700, cursor: "pointer" },
  secondaryBtn: { background: "var(--bg)", color: "var(--text)", border: "1px solid var(--line)", borderRadius: 8, padding: "9px 16px", fontWeight: 700, cursor: "pointer" },
  success: { background: "rgba(34,197,94,.1)", border: "1px solid rgba(34,197,94,.25)", borderRadius: 8, padding: 10, fontSize: 12.5, marginBottom: 14 },
  error: { background: "rgba(217,105,95,0.12)", border: "1px solid var(--red)", color: "var(--red)", borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 13, marginBottom: 14 },
};
