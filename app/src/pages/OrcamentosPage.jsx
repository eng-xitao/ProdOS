import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { confirmDelete } from "../lib/deleteGuard";
import { openPrintWindow, brandHeader, currency, formatDate, sendDocumentEmail } from "../lib/printDocument";

const STATUS_LABEL = { rascunho: "Rascunho", enviado: "Enviado", aprovado: "Aprovado", rejeitado: "Rejeitado", convertido: "Convertido em pedido" };
const STATUS_COLOR = { rascunho: "var(--text-dim)", enviado: "#2563EB", aprovado: "var(--green)", rejeitado: "var(--danger)", convertido: "var(--amber)" };
const FLOW_STEPS = ["rascunho", "enviado", "aprovado", "convertido"];

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
    const text = `${q.code} ${q.customers?.name ?? ""}`.toLowerCase();
    return (!search || text.includes(search.toLowerCase())) && (statusFilter === "todos" || q.status === statusFilter);
  }), [quotes, search, statusFilter]);

  async function createQuote(form) {
    const code = form.code.trim() || `ORC-${String(quotes.length + 1).padStart(4, "0")}`;
    const { data, error } = await supabase.from("quotes").insert({
      company_id: company.id, code, customer_id: form.customer_id, opportunity_id: form.opportunity_id || null,
      payment_term_id: form.payment_term_id || null, valid_until: form.valid_until || null, status: "rascunho",
    }).select("id").single();
    if (error) throw error;
    await loadAll(); setShowNew(false); setSelectedId(data.id);
  }

  return <div>
    <header style={styles.header}>
      <div><h1 style={styles.title}>Orçamentos</h1><p style={styles.subtitle}>Propostas comerciais, produtos, condições e valores.</p></div>
      <button style={styles.addBtn} onClick={() => setShowNew(true)} type="button">+ Novo orçamento</button>
    </header>

    <div style={styles.toolbar}>
      <input style={styles.search} placeholder="Buscar por código ou cliente..." value={search} onChange={(e) => setSearch(e.target.value)} />
      <select style={styles.filterSelect} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
        <option value="todos">Todos os status</option>{Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>

    {loading ? <p style={styles.dim}>Carregando...</p> : filtered.length === 0 ? <p style={styles.dim}>Nenhum orçamento encontrado.</p> :
      <div style={styles.list}>{filtered.map((q) => <button key={q.id} style={styles.row} onClick={() => setSelectedId(q.id)} type="button">
        <div style={styles.rowMain}><strong>{q.code}</strong><span style={styles.dim}>{q.customers?.name ?? "Sem cliente"}</span></div>
        <div style={styles.rowRight}><span style={styles.dateHint}>{q.valid_until ? `Válido até ${formatDate(q.valid_until)}` : "Sem validade"}</span><span style={{ ...styles.badge, color: STATUS_COLOR[q.status] }}>{STATUS_LABEL[q.status] ?? q.status}</span></div>
      </button>)}</div>}

    {showNew && <NewQuoteModal customers={customers} opportunities={opportunities} paymentTerms={paymentTerms} onClose={() => setShowNew(false)} onCreate={createQuote} />}
    {selectedId && <QuoteDrawer quoteId={selectedId} company={company} navigate={navigate} customers={customers} opportunities={opportunities} paymentTerms={paymentTerms} onClose={() => setSelectedId("")} onRefresh={loadAll} />}
  </div>;
}

function NewQuoteModal({ customers, opportunities, paymentTerms, onClose, onCreate }) {
  const [form, setForm] = useState({ code: "", customer_id: "", opportunity_id: "", payment_term_id: "", valid_until: "" });
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault(); if (!form.customer_id) { setError("Escolha o cliente."); return; }
    setSaving(true); setError(""); try { await onCreate(form); } catch (err) { setError(err.message); } finally { setSaving(false); }
  }
  return <div style={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <div style={styles.modal}>
      <div style={styles.modalHead}><div><h2 style={styles.modalTitle}>Novo orçamento</h2><p style={styles.helper}>Primeiro selecione o cliente. Os produtos serão incluídos no orçamento logo após a criação.</p></div><button style={styles.closeBtn} onClick={onClose} type="button">✕</button></div>
      {error && <div style={styles.error}>{error}</div>}
      <form onSubmit={submit} style={styles.formGrid}>
        <Field label="Código"><input style={styles.input} placeholder="Gerado automaticamente" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
        <Field label="Cliente *"><select style={styles.input} value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} required><option value="">Selecione...</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Oportunidade vinculada"><select style={styles.input} value={form.opportunity_id} onChange={(e) => setForm({ ...form, opportunity_id: e.target.value })}><option value="">Nenhuma</option>{opportunities.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}</select></Field>
        <Field label="Condição de pagamento"><select style={styles.input} value={form.payment_term_id} onChange={(e) => setForm({ ...form, payment_term_id: e.target.value })}><option value="">Não definida</option>{paymentTerms.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        <Field label="Válido até"><input style={styles.input} type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} /></Field>
        <div style={styles.actions}><button type="button" style={styles.secondaryBtn} onClick={onClose}>Cancelar</button><button style={styles.primaryBtn} disabled={saving} type="submit">{saving ? "Criando..." : "Criar orçamento"}</button></div>
      </form>
    </div>
  </div>;
}

function QuoteDrawer({ quoteId, company, navigate, customers, opportunities, paymentTerms, onClose, onRefresh }) {
  const [quote, setQuote] = useState(null); const [items, setItems] = useState([]); const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [converting, setConverting] = useState(false);
  const [editing, setEditing] = useState(false); const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ customer_id: "", opportunity_id: "", payment_term_id: "", valid_until: "", notes: "" });
  const [newProductId, setNewProductId] = useState(""); const [newQuantity, setNewQuantity] = useState("1"); const [newUnitPrice, setNewUnitPrice] = useState(""); const [newDiscount, setNewDiscount] = useState("0");
  const [customerContacts, setCustomerContacts] = useState([]); const [selectedContactId, setSelectedContactId] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false); const [showManualSend, setShowManualSend] = useState(false);
  const [linkedOrder, setLinkedOrder] = useState(null);

  async function load() {
    setLoading(true); setError("");
    const [{ data: q, error: qe }, { data: it, error: ie }, { data: p, error: pe }] = await Promise.all([
      supabase.from("quotes").select("id, code, status, valid_until, notes, created_at, customer_id, opportunity_id, payment_term_id, sent_at, sent_to, sent_channel, customers:customer_id (name, document, email, phone, address), payment_terms:payment_term_id (name)").eq("id", quoteId).single(),
      supabase.from("quote_items").select("id, quantity, unit_price, discount_percent, product_id, products:product_id (sku, name, unit)").eq("quote_id", quoteId),
      supabase.from("products").select("id, sku, name, unit, sale_price").eq("company_id", company.id).eq("active", true).eq("type", "acabado").order("name"),
    ]);
    if (qe) setError(qe.message); else if (ie || pe) setError((ie || pe).message); else {
      setQuote(q); setItems(it ?? []); setProducts(p ?? []);
      setForm({ customer_id: q.customer_id ?? "", opportunity_id: q.opportunity_id ?? "", payment_term_id: q.payment_term_id ?? "", valid_until: q.valid_until ?? "", notes: q.notes ?? "" });
      if (q.customer_id) { const { data: contacts } = await supabase.from("contacts").select("id, name, department, email").eq("customer_id", q.customer_id); setCustomerContacts(contacts ?? []); }
      if (q.status === "convertido") { const { data: ord } = await supabase.from("sales_orders").select("id, code").eq("quote_id", quoteId).maybeSingle(); setLinkedOrder(ord ?? null); }
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, [quoteId]);

  const total = items.reduce((sum, it) => sum + Number(it.quantity) * Number(it.unit_price) * (1 - Number(it.discount_percent || 0) / 100), 0);
  const isConverted = quote?.status === "convertido";

  function handleProductChange(id) { setNewProductId(id); const p = products.find((x) => x.id === id); if (p) setNewUnitPrice(String(p.sale_price ?? 0)); }
  async function addItem(e) {
    e.preventDefault(); setError(""); if (!newProductId || Number(newQuantity) <= 0) return;
    const { error: err } = await supabase.from("quote_items").insert({ company_id: company.id, quote_id: quoteId, product_id: newProductId, quantity: Number(newQuantity), unit_price: Number(newUnitPrice || 0), discount_percent: Number(newDiscount || 0) });
    if (err) setError(err.message); else { setNewProductId(""); setNewQuantity("1"); setNewUnitPrice(""); setNewDiscount("0"); await load(); await onRefresh(); }
  }
  async function removeItem(id) { if (!(await confirmDelete(company))) return; const { error: err } = await supabase.from("quote_items").delete().eq("id", id); if (err) setError(err.message); else { await load(); await onRefresh(); } }

  function startEditing() { if (!isConverted) setEditing(true); }
  function cancelEditing() { if (!quote) return; setForm({ customer_id: quote.customer_id ?? "", opportunity_id: quote.opportunity_id ?? "", payment_term_id: quote.payment_term_id ?? "", valid_until: quote.valid_until ?? "", notes: quote.notes ?? "" }); setEditing(false); setError(""); }
  async function saveChanges() {
    setSaving(true); setError("");
    const { error: err } = await supabase.from("quotes").update({ customer_id: form.customer_id, opportunity_id: form.opportunity_id || null, payment_term_id: form.payment_term_id || null, valid_until: form.valid_until || null, notes: form.notes || null }).eq("id", quoteId);
    if (err) setError(err.message); else { setEditing(false); await load(); await onRefresh(); }
    setSaving(false);
  }
  async function updateStatus(status) { const { error: err } = await supabase.from("quotes").update({ status }).eq("id", quoteId); if (err) setError(err.message); else { await load(); await onRefresh(); } }
  function buildQuoteHtml() {
    const rows = items.map((it) => `<tr><td>${it.products?.sku ?? ""}</td><td>${it.products?.name ?? ""}</td><td>${it.quantity}</td><td>${currency(it.unit_price)}</td><td>${it.discount_percent ?? 0}%</td><td>${currency(Number(it.quantity) * Number(it.unit_price) * (1 - Number(it.discount_percent || 0) / 100))}</td></tr>`).join("");
    return `${brandHeader(company, "ORÇAMENTO", [["Nº", quote.code], ["Emitido em", formatDate(quote.created_at)], ["Válido até", formatDate(quote.valid_until)]])}<div class="section-title">Dados do Cliente</div><div class="info-grid"><div><strong>Cliente:</strong> ${quote.customers?.name ?? "—"}</div><div><strong>CPF/CNPJ:</strong> ${quote.customers?.document ?? "—"}</div><div><strong>E-mail:</strong> ${quote.customers?.email ?? "—"}</div><div><strong>Telefone:</strong> ${quote.customers?.phone ?? "—"}</div><div style="grid-column:1/-1"><strong>Endereço:</strong> ${quote.customers?.address ?? "—"}</div></div><div class="section-title">Produtos e serviços</div><table><thead><tr><th>SKU</th><th>Produto</th><th>Qtd.</th><th>Preço unit.</th><th>Desc.</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table><div class="totals-box"><div class="totals-inner"><div class="total-row-final"><span>Total do orçamento</span><span>${currency(total)}</span></div></div></div>${quote.notes ? `<div class="section-title">Observações</div><p>${quote.notes}</p>` : ""}`;
  }
  function printQuote() { if (!quote) return; openPrintWindow(`Orçamento ${quote.code}`, buildQuoteHtml()); }
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
    else { await supabase.from("quotes").update({ status: "enviado", sent_at: new Date().toISOString(), sent_to: contact.email, sent_channel: "email" }).eq("id", quoteId); await load(); await onRefresh(); }
    setSendingEmail(false);
  }
  async function markSentManually(channel, destinatario) {
    const { error: err } = await supabase.from("quotes").update({ status: "enviado", sent_at: new Date().toISOString(), sent_to: destinatario || null, sent_channel: channel }).eq("id", quoteId);
    if (err) setError(err.message); else { setShowManualSend(false); await load(); await onRefresh(); }
  }
  async function deleteQuote() { if (isConverted || !(await confirmDelete(company))) return; await supabase.from("quote_items").delete().eq("quote_id", quoteId); const { error: err } = await supabase.from("quotes").delete().eq("id", quoteId); if (err) setError(err.message); else { await onRefresh(); onClose(); } }
  async function convertToOrder() {
    if (!items.length) { setError("Adicione pelo menos um produto ao orçamento antes de converter."); return; }
    setConverting(true); setError("");
    const { count } = await supabase.from("sales_orders").select("id", { count: "exact", head: true }).eq("company_id", company.id);
    const code = `PV-${String((count ?? 0) + 1).padStart(4, "0")}`;
    const { data: order, error: oe } = await supabase.from("sales_orders").insert({ company_id: company.id, code, customer_id: quote.customer_id, quote_id: quoteId, status: "aberto", order_date: new Date().toISOString().slice(0, 10), total_value: total }).select("id").single();
    if (oe) { setError(oe.message); setConverting(false); return; }
    const { error: ie } = await supabase.from("sales_order_items").insert(items.map((it) => ({ company_id: company.id, sales_order_id: order.id, product_id: it.product_id, quantity: it.quantity, unit_price: it.unit_price, discount_percent: it.discount_percent })));
    if (ie) { setError(ie.message); setConverting(false); return; }
    await supabase.from("quotes").update({ status: "convertido" }).eq("id", quoteId); setConverting(false); await onRefresh(); navigate(`/pedidos-venda?abrir=${order.id}`);
  }

  if (loading) return <div style={styles.drawerOverlay}><aside style={styles.drawer}><p style={styles.dim}>Carregando orçamento...</p></aside></div>;
  if (!quote) return <div style={styles.drawerOverlay}><aside style={styles.drawer}><p style={styles.error}>Orçamento não encontrado.</p><button style={styles.secondaryBtn} onClick={onClose}>Fechar</button></aside></div>;

  return <div style={styles.drawerOverlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <aside style={styles.drawer}>
      <div style={styles.drawerHead}><div><div style={styles.eyebrow}>ORÇAMENTO</div><h2 style={styles.drawerTitle}>{quote.code}</h2><span style={{ ...styles.badge, color: STATUS_COLOR[quote.status] }}>{STATUS_LABEL[quote.status] ?? quote.status}</span></div><button style={styles.closeBtn} onClick={onClose} type="button">✕</button></div>
      <div style={styles.stepper}>{FLOW_STEPS.map((s, i) => { const currentIdx = FLOW_STEPS.indexOf(quote.status === "rejeitado" ? "enviado" : quote.status); return <div key={s} style={{ ...styles.step, ...(s === quote.status ? styles.stepCurrent : {}), ...(i < currentIdx ? styles.stepDone : {}) }}>{i < currentIdx ? "✓" : i + 1} {STATUS_LABEL[s]}</div>; })}</div>
      {quote.sent_at && <div style={styles.sentInfo}>Enviado {quote.sent_channel === "email" ? "por e-mail" : quote.sent_channel ? `via ${quote.sent_channel}` : ""}{quote.sent_to ? ` para ${quote.sent_to}` : ""} em {formatDate(quote.sent_at)}</div>}
      {error && <div style={styles.error}>{error}</div>}

      <section style={styles.section}>
        <div style={styles.sectionHead}><div><h3 style={styles.sectionTitle}>Dados comerciais</h3><p style={styles.helper}>Cliente, validade e condição da proposta.</p></div>{!editing && !isConverted && <button type="button" style={styles.outlineBtn} onClick={startEditing}>Editar</button>}</div>
        {editing ? <div style={styles.formGrid}>
          <Field label="Cliente *"><select style={styles.input} value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}><option value="">Selecione...</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="Oportunidade"><select style={styles.input} value={form.opportunity_id} onChange={(e) => setForm({ ...form, opportunity_id: e.target.value })}><option value="">Nenhuma</option>{opportunities.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}</select></Field>
          <Field label="Condição de pagamento"><select style={styles.input} value={form.payment_term_id} onChange={(e) => setForm({ ...form, payment_term_id: e.target.value })}><option value="">Não definida</option>{paymentTerms.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          <Field label="Válido até"><input style={styles.input} type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} /></Field>
          <Field label="Observações"><textarea style={{ ...styles.input, minHeight: 80, resize: "vertical" }} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <div style={styles.actions}><button type="button" style={styles.secondaryBtn} onClick={cancelEditing}>Cancelar</button><button type="button" style={styles.primaryBtn} disabled={saving || !form.customer_id} onClick={saveChanges}>{saving ? "Salvando..." : "Salvar alterações"}</button></div>
        </div> : <div style={styles.infoGrid}><div><strong>Cliente</strong><span>{quote.customers?.name ?? "—"}</span></div><div><strong>Condição</strong><span>{quote.payment_terms?.name ?? "Não definida"}</span></div><div><strong>Válido até</strong><span>{quote.valid_until ? formatDate(quote.valid_until) : "Sem validade"}</span></div><div><strong>Oportunidade</strong><span>{opportunities.find((o) => o.id === quote.opportunity_id)?.title ?? "—"}</span></div></div>}
      </section>

      <section style={styles.section}>
        <div style={styles.sectionHead}><div><h3 style={styles.sectionTitle}>Produtos do orçamento</h3><p style={styles.helper}>Selecione produtos já cadastrados em Cadastros → Produtos.</p></div></div>
        {!isConverted && <form onSubmit={addItem} style={styles.productAdd}>
          <div style={styles.productPicker}><label style={styles.smallLabel}>Produto *</label><select style={styles.input} value={newProductId} onChange={(e) => handleProductChange(e.target.value)} required><option value="">Selecione o produto...</option>{products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}</select></div>
          <div><label style={styles.smallLabel}>Quantidade</label><input style={styles.input} type="number" min="0.001" step="0.001" value={newQuantity} onChange={(e) => setNewQuantity(e.target.value)} /></div>
          <div><label style={styles.smallLabel}>Preço unitário</label><input style={styles.input} type="number" min="0" step="0.01" value={newUnitPrice} onChange={(e) => setNewUnitPrice(e.target.value)} placeholder="Preço do cadastro" /></div>
          <div><label style={styles.smallLabel}>Desconto %</label><input style={styles.input} type="number" min="0" max="100" step="0.01" value={newDiscount} onChange={(e) => setNewDiscount(e.target.value)} /></div>
          <button type="submit" style={styles.addProductBtn}>+ Adicionar produto</button>
        </form>}

        {items.length === 0 ? <div style={styles.emptyProduct}>Nenhum produto adicionado. Use o campo acima para inserir os produtos da proposta.</div> : <div style={styles.itemsTable}>
          <div style={styles.itemHeader}><span>Produto</span><span>Qtd.</span><span>Preço</span><span>Total</span><span></span></div>
          {items.map((it) => <div key={it.id} style={styles.itemRow}><div><strong>{it.products?.name ?? "Produto"}</strong><small>{it.products?.sku ?? ""}</small></div><span>{it.quantity} {it.products?.unit ?? ""}</span><span>{currency(it.unit_price)}</span><strong>{currency(Number(it.quantity) * Number(it.unit_price) * (1 - Number(it.discount_percent || 0) / 100))}</strong>{!isConverted ? <button type="button" style={styles.removeBtn} onClick={() => removeItem(it.id)}>Remover</button> : <span />}</div>)}
          <div style={styles.totalRow}><span>Total</span><strong>{currency(total)}</strong></div>
        </div>}
      </section>

      <section style={styles.section}>
        <h3 style={styles.sectionTitle}>Enviar orçamento</h3>
        {quote.status !== "rascunho" ? null : (
          <div style={styles.sendBox}>
            {customerContacts.length > 0 ? <>
              <p style={styles.helper}>Escolha o contato do cliente para enviar o PDF do orçamento por e-mail.</p>
              <div style={styles.sendRow}>
                <select style={styles.input} value={selectedContactId} onChange={(e) => setSelectedContactId(e.target.value)}>
                  <option value="">Escolha o contato...</option>
                  {customerContacts.map((c) => <option key={c.id} value={c.id}>{c.name}{c.department ? ` — ${c.department}` : ""}{c.email ? ` (${c.email})` : " — sem e-mail"}</option>)}
                </select>
                <button style={styles.primaryBtn} onClick={sendEmail} type="button" disabled={!selectedContactId || sendingEmail || !customerContacts.find((c) => c.id === selectedContactId)?.email}>{sendingEmail ? "Enviando..." : "✉ Enviar por e-mail"}</button>
              </div>
            </> : <p style={styles.helper}>Este cliente não tem contatos com e-mail cadastrados. Cadastre um contato em Clientes, ou registre abaixo que o orçamento foi enviado por outro canal (WhatsApp, telefone etc.).</p>}
            <button type="button" style={styles.outlineBtn} onClick={() => setShowManualSend(true)}>Registrar envio manual (WhatsApp, telefone, presencial...)</button>
          </div>
        )}
        {showManualSend && <ManualSendModal onClose={() => setShowManualSend(false)} onConfirm={markSentManually} />}
      </section>

      <section style={styles.section}>
        <h3 style={styles.sectionTitle}>Ações</h3>
        <div style={styles.actionsWrap}>
          <button style={styles.outlineBtn} onClick={printQuote} type="button">🖨 Imprimir</button>
          {quote.status === "enviado" && <button style={styles.primaryBtn} onClick={() => updateStatus("aprovado")}>✓ Marcar como aprovado pelo cliente</button>}
          {quote.status === "aprovado" && !isConverted && <button style={styles.primaryBtn} disabled={converting} onClick={convertToOrder}>{converting ? "Convertendo..." : "Converter em pedido de venda"}</button>}
          {isConverted && <span style={styles.helper}>Este orçamento já foi convertido{linkedOrder ? <> no pedido <button type="button" style={styles.linkBtn} onClick={() => navigate(`/pedidos-venda?abrir=${linkedOrder.id}`)}>{linkedOrder.code}</button></> : " em pedido de venda"}.</span>}
          {!isConverted && <button style={styles.dangerBtn} onClick={deleteQuote}>Excluir</button>}
        </div>
      </section>
    </aside>
  </div>;
}

function ManualSendModal({ onClose, onConfirm }) {
  const [channel, setChannel] = useState("whatsapp"); const [destinatario, setDestinatario] = useState("");
  return <div style={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <div style={{ ...styles.modal, width: "min(420px,100%)" }}>
      <div style={styles.modalHead}><h2 style={styles.modalTitle}>Registrar envio manual</h2><button style={styles.closeBtn} onClick={onClose} type="button">✕</button></div>
      <p style={styles.helper}>Use isso quando o orçamento foi enviado fora do sistema — por WhatsApp, telefone ou pessoalmente.</p>
      <div style={styles.formGrid}>
        <Field label="Canal usado"><select style={styles.input} value={channel} onChange={(e) => setChannel(e.target.value)}><option value="whatsapp">WhatsApp</option><option value="telefone">Telefone</option><option value="presencial">Presencial</option><option value="outro">Outro</option></select></Field>
        <Field label="Para quem (opcional)"><input style={styles.input} value={destinatario} onChange={(e) => setDestinatario(e.target.value)} placeholder="Nome ou número de contato" /></Field>
        <div style={styles.actions}><button type="button" style={styles.secondaryBtn} onClick={onClose}>Cancelar</button><button type="button" style={styles.primaryBtn} onClick={() => onConfirm(channel, destinatario)}>Confirmar envio</button></div>
      </div>
    </div>
  </div>;
}

function Field({ label, children }) { return <label style={styles.field}><span style={styles.fieldLabel}>{label}</span>{children}</label>; }

const styles = {
  header:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16,marginBottom:20}, title:{margin:0,fontSize:28}, subtitle:{margin:"6px 0 0",color:"var(--text-dim)"}, addBtn:{border:0,borderRadius:9,padding:"11px 16px",background:"var(--blue)",color:"white",fontWeight:700,cursor:"pointer"},
  toolbar:{display:"flex",gap:10,marginBottom:18}, search:{flex:1,minWidth:220}, filterSelect:{minWidth:180}, list:{display:"grid",gap:8}, row:{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,padding:"15px 16px",background:"var(--panel)",border:"1px solid var(--line)",borderRadius:10,textAlign:"left",cursor:"pointer"}, rowMain:{display:"flex",flexDirection:"column",gap:4}, rowRight:{display:"flex",alignItems:"center",gap:18}, dateHint:{color:"var(--text-dim)",fontSize:13}, badge:{fontWeight:700,fontSize:13}, dim:{color:"var(--text-dim)"},
  overlay:{position:"fixed",inset:0,background:"rgba(0,0,0,.38)",display:"grid",placeItems:"center",zIndex:1000,padding:20}, modal:{width:"min(680px,100%)",background:"var(--panel)",borderRadius:14,padding:22,boxShadow:"0 20px 60px rgba(0,0,0,.25)"}, modalHead:{display:"flex",justifyContent:"space-between",gap:15,marginBottom:16}, modalTitle:{margin:0}, helper:{margin:"4px 0 0",fontSize:12,color:"var(--text-dim)"}, closeBtn:{border:0,background:"transparent",fontSize:20,cursor:"pointer",height:36}, formGrid:{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:14}, field:{display:"flex",flexDirection:"column",gap:6}, fieldLabel:{fontWeight:600,fontSize:13}, input:{width:"100%",boxSizing:"border-box",padding:"10px 11px",border:"1px solid var(--line)",borderRadius:8,background:"var(--field)",color:"var(--text)"}, actions:{gridColumn:"1/-1",display:"flex",justifyContent:"flex-end",gap:10,marginTop:5}, primaryBtn:{border:0,borderRadius:8,padding:"10px 14px",background:"var(--blue)",color:"white",fontWeight:700,cursor:"pointer"}, secondaryBtn:{border:"1px solid var(--line)",borderRadius:8,padding:"10px 14px",background:"var(--panel)",color:"var(--text)",fontWeight:600,cursor:"pointer"}, outlineBtn:{border:"1px solid var(--line)",borderRadius:8,padding:"9px 13px",background:"var(--panel)",color:"var(--text)",fontWeight:600,cursor:"pointer"}, dangerBtn:{border:"1px solid var(--danger)",borderRadius:8,padding:"9px 13px",background:"transparent",color:"var(--danger)",fontWeight:700,cursor:"pointer"}, error:{padding:11,marginBottom:14,borderRadius:8,background:"rgba(192,57,43,.08)",color:"var(--danger)",fontSize:13},
  drawerOverlay:{position:"fixed",inset:0,background:"rgba(0,0,0,.38)",display:"flex",justifyContent:"flex-end",zIndex:1000}, drawer:{height:"100%",width:"min(920px,100%)",background:"var(--panel)",overflowY:"auto",padding:22,boxSizing:"border-box",boxShadow:"-10px 0 40px rgba(0,0,0,.2)"}, drawerHead:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16,borderBottom:"1px solid var(--line)",paddingBottom:16}, drawerTitle:{margin:"3px 0 7px",fontSize:25}, eyebrow:{fontSize:11,fontWeight:800,letterSpacing:1,color:"var(--text-dim)"}, section:{padding:"20px 0",borderBottom:"1px solid var(--line)"}, sectionHead:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:13}, sectionTitle:{margin:0,fontSize:17}, infoGrid:{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10}, infoGridItem:{}, productAdd:{display:"grid",gridTemplateColumns:"2fr .8fr 1fr .7fr auto",gap:8,alignItems:"end",padding:12,border:"1px solid var(--line)",borderRadius:10,background:"var(--field)",marginBottom:14}, productPicker:{minWidth:0}, smallLabel:{display:"block",fontSize:11,fontWeight:700,marginBottom:5}, addProductBtn:{height:40,border:0,borderRadius:8,padding:"0 13px",background:"var(--green)",color:"white",fontWeight:700,cursor:"pointer"}, emptyProduct:{padding:18,textAlign:"center",border:"1px dashed var(--line)",borderRadius:9,color:"var(--text-dim)"}, itemsTable:{border:"1px solid var(--line)",borderRadius:10,overflow:"hidden"}, itemHeader:{display:"grid",gridTemplateColumns:"2fr .7fr 1fr 1fr .7fr",gap:8,padding:"9px 11px",background:"var(--panel-2)",fontSize:11,fontWeight:800}, itemRow:{display:"grid",gridTemplateColumns:"2fr .7fr 1fr 1fr .7fr",gap:8,alignItems:"center",padding:"11px",borderTop:"1px solid var(--line)",fontSize:13}, itemRowSmall:{}, removeBtn:{border:0,background:"transparent",color:"var(--danger)",cursor:"pointer",fontSize:11,textAlign:"right"}, totalRow:{display:"flex",justifyContent:"flex-end",gap:35,padding:"13px 11px",background:"var(--panel-2)",fontSize:16}, actionsWrap:{display:"flex",flexWrap:"wrap",gap:8},
  stepper:{display:"flex",gap:6,flexWrap:"wrap",margin:"14px 0"}, step:{border:"1px solid var(--line)",background:"var(--field)",color:"var(--text-dim)",borderRadius:8,padding:"7px 11px",fontSize:11,fontWeight:700,whiteSpace:"nowrap"}, stepCurrent:{background:"var(--blue)",color:"#fff",borderColor:"var(--blue)"}, stepDone:{borderColor:"var(--green)",color:"var(--text)"},
  sentInfo:{fontSize:12,color:"var(--green)",background:"rgba(34,197,94,.1)",border:"1px solid rgba(34,197,94,.25)",borderRadius:8,padding:"9px 11px",marginBottom:14},
  sendBox:{display:"grid",gap:10}, sendRow:{display:"flex",gap:8,flexWrap:"wrap"},
  linkBtn:{border:0,background:"transparent",color:"var(--blue)",fontWeight:800,cursor:"pointer",padding:0,textDecoration:"underline"},
};
