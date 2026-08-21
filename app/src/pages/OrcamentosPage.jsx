import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { useNavigate } from "react-router-dom";
import ModulePage from "../components/ModulePage";
import { openPrintWindow, brandHeader, currency, formatDate, openMailto } from "../lib/printDocument";

const STATUS_LABEL = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
  convertido: "Convertido em pedido",
};

export default function OrcamentosPage() {
  const { company } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [paymentTerms, setPaymentTerms] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!company?.id) return;
    Promise.all([
      supabase.from("customers").select("id, name").order("name"),
      supabase.from("payment_terms").select("id, name").order("name"),
      supabase.from("opportunities").select("id, title").order("title"),
    ]).then(([c, p, o]) => {
      setCustomers(c.data ?? []);
      setPaymentTerms(p.data ?? []);
      setOpportunities(o.data ?? []);
    });
  }, [company?.id]);

  const customerOptions = customers.map((c) => ({ value: c.id, label: c.name }));
  const paymentTermOptions = paymentTerms.map((p) => ({ value: p.id, label: p.name }));
  const opportunityOptions = opportunities.map((o) => ({ value: o.id, label: o.title }));

  return (
    <div>
      <ModulePage
        key={refreshKey}
        table="quotes"
        title="Orçamentos"
        subtitle="Propostas comerciais — vinculadas a um cliente, com itens e validade"
        emptyLabel="Nenhum orçamento cadastrado ainda."
        fields={[
          { key: "code", label: "Código", placeholder: "ORC-0001", required: true },
          { key: "customer_id", label: "Cliente", type: "select", options: customerOptions, required: true },
          { key: "opportunity_id", label: "Oportunidade vinculada", type: "select", options: opportunityOptions },
          { key: "payment_term_id", label: "Cond. pagamento", type: "select", options: paymentTermOptions },
          { key: "valid_until", label: "Válido até", type: "date" },
          {
            key: "status",
            label: "Status",
            type: "select",
            options: ["rascunho", "enviado", "aprovado", "rejeitado"],
          },
        ]}
      />
      <QuoteItemsEditor onQuoteConverted={() => setRefreshKey((k) => k + 1)} />
    </div>
  );
}

/**
 * Gestão dos itens de um orçamento específico, cálculo do total,
 * e conversão em Pedido de Venda definitivo.
 */
function QuoteItemsEditor({ onQuoteConverted }) {
  const { company } = useAuth();
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState([]);
  const [products, setProducts] = useState([]);
  const [quoteId, setQuoteId] = useState("");
  const [quoteDetails, setQuoteDetails] = useState(null);
  const [customerContacts, setCustomerContacts] = useState([]);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [converting, setConverting] = useState(false);

  const [newProductId, setNewProductId] = useState("");
  const [newQuantity, setNewQuantity] = useState("1");
  const [newUnitPrice, setNewUnitPrice] = useState("");
  const [newDiscount, setNewDiscount] = useState("0");

  async function loadQuotes() {
    const { data } = await supabase.from("quotes").select("id, code, status").order("created_at", { ascending: false });
    setQuotes(data ?? []);
  }

  async function loadProducts() {
    const { data } = await supabase.from("products").select("id, sku, name, sale_price").order("name");
    setProducts(data ?? []);
  }

  async function loadItems(qid) {
    if (!qid) { setItems([]); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("quote_items")
      .select("id, quantity, unit_price, discount_percent, product_id, products:product_id (sku, name)")
      .eq("quote_id", qid);
    if (error) setError(error.message);
    setItems(data ?? []);
    setLoading(false);
  }

  async function loadQuoteDetails(qid) {
    if (!qid) { setQuoteDetails(null); setCustomerContacts([]); return; }
    const { data } = await supabase
      .from("quotes")
      .select("code, valid_until, notes, created_at, customer_id, customers:customer_id (name, document, email, phone, address), payment_terms:payment_term_id (name)")
      .eq("id", qid)
      .single();
    setQuoteDetails(data);
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
    if (company?.id) { loadQuotes(); loadProducts(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  useEffect(() => {
    loadItems(quoteId);
    loadQuoteDetails(quoteId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteId]);

  const selectedQuote = quotes.find((q) => q.id === quoteId);

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
    if (!company?.id || !quoteId || !newProductId) return;
    const { error } = await supabase.from("quote_items").insert({
      company_id: company.id,
      quote_id: quoteId,
      product_id: newProductId,
      quantity: Number(newQuantity),
      unit_price: Number(newUnitPrice),
      discount_percent: Number(newDiscount),
    });
    if (error) setError(error.message);
    else {
      setNewProductId(""); setNewQuantity("1"); setNewUnitPrice(""); setNewDiscount("0");
      loadItems(quoteId);
    }
  }

  async function removeItem(id) {
    await supabase.from("quote_items").delete().eq("id", id);
    loadItems(quoteId);
  }

  async function updateStatus(newStatus) {
    await supabase.from("quotes").update({ status: newStatus }).eq("id", quoteId);
    loadQuotes();
  }

  async function convertToOrder() {
    if (!selectedQuote || items.length === 0) return;
    setConverting(true);
    setError("");

    const { data: quoteFull } = await supabase.from("quotes").select("customer_id").eq("id", quoteId).single();

    const { data: order, error: orderError } = await supabase
      .from("sales_orders")
      .insert({
        company_id: company.id,
        code: `PV-${selectedQuote.code}`,
        customer_id: quoteFull?.customer_id ?? null,
        quote_id: quoteId,
        status: "aberto",
        order_date: new Date().toISOString().slice(0, 10),
        total_value: total,
      })
      .select("id")
      .single();

    if (orderError) {
      setError(orderError.message);
      setConverting(false);
      return;
    }

    const orderItems = items.map((it) => ({
      company_id: company.id,
      sales_order_id: order.id,
      product_id: it.product_id,
      quantity: it.quantity,
      unit_price: it.unit_price,
      discount_percent: it.discount_percent,
    }));
    const { error: itemsError } = await supabase.from("sales_order_items").insert(orderItems);
    if (itemsError) {
      setError(itemsError.message);
      setConverting(false);
      return;
    }

    await supabase.from("quotes").update({ status: "convertido" }).eq("id", quoteId);
    setConverting(false);
    onQuoteConverted();
    loadQuotes();
    navigate("/pedidos-venda");
  }

  function printQuote() {
    if (!selectedQuote || !quoteDetails) return;
    const customer = quoteDetails.customers;

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
      ${brandHeader(company, "ORÇAMENTO", [
        ["Nº", selectedQuote.code],
        ["Emitido em", formatDate(quoteDetails.created_at)],
        ["Válido até", formatDate(quoteDetails.valid_until)],
      ])}
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
          <div class="total-row-final"><span>Total Geral</span><span>${currency(total)}</span></div>
        </div>
      </div>
      <div class="section-title">Condições</div>
      <div class="info-grid">
        <div><strong>Forma de pagamento:</strong> ${quoteDetails.payment_terms?.name ?? "A combinar"}</div>
      </div>
      ${quoteDetails.notes ? `<div class="notes-box"><strong>Observações:</strong><br/>${quoteDetails.notes}</div>` : ""}
      <div class="signatures">
        <div class="signature-line">${company?.name ?? "Empresa"}</div>
        <div class="signature-line">${customer?.name ?? "Cliente"}</div>
      </div>
    `;

    openPrintWindow(`Orçamento ${selectedQuote.code}`, html);
  }

  function sendEmail() {
    const contact = customerContacts.find((c) => c.id === selectedContactId);
    if (!contact?.email || !selectedQuote) return;
    openMailto(
      contact.email,
      `Orçamento ${selectedQuote.code} — ${company?.name ?? ""}`,
      `Olá ${contact.name},\n\nSegue em anexo o Orçamento ${selectedQuote.code}.\n\n(Lembre-se de anexar o PDF gerado na impressão antes de enviar.)\n\nAtenciosamente,\n${company?.name ?? ""}`
    );
  }

  return (
    <div style={styles.wrap}>
      <h2 style={styles.title}>Itens do orçamento</h2>
      <p style={styles.subtitle}>
        Escolha um orçamento para gerenciar os itens, ver o total calculado, e convertê-lo
        em Pedido de Venda quando aprovado.
      </p>

      <label style={styles.field}>
        <span style={styles.fieldLabel}>Orçamento</span>
        <select style={styles.input} value={quoteId} onChange={(e) => setQuoteId(e.target.value)} onFocus={loadQuotes}>
          <option value="">Selecione um orçamento...</option>
          {quotes.map((q) => (
            <option key={q.id} value={q.id}>{q.code} — {STATUS_LABEL[q.status]}</option>
          ))}
        </select>
      </label>

      {quoteId && (
        <>
          <div style={styles.actionsRow}>
            <button style={styles.printBtn} onClick={printQuote} type="button" disabled={!quoteDetails || items.length === 0}>
              🖨 Imprimir Orçamento
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

          <div style={styles.statusRow}>
            <span style={styles.fieldLabel}>Status do orçamento</span>
            <select
              style={{ ...styles.input, maxWidth: 220 }}
              value={selectedQuote?.status ?? ""}
              onChange={(e) => updateStatus(e.target.value)}
              disabled={selectedQuote?.status === "convertido"}
            >
              {Object.entries(STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value} disabled={value === "convertido"}>{label}</option>
              ))}
            </select>
          </div>

          {selectedQuote?.status !== "convertido" && (
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
          )}

          {loading ? (
            <p style={styles.dim}>Carregando...</p>
          ) : items.length === 0 ? (
            <p style={styles.dim}>Nenhum item adicionado ainda.</p>
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
                          {selectedQuote?.status !== "convertido" && (
                            <button style={styles.deleteBtn} onClick={() => removeItem(it.id)} type="button">Remover</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4} style={{ ...styles.td, textAlign: "right", fontWeight: 700 }}>Total</td>
                    <td style={{ ...styles.td, fontWeight: 700, color: "var(--amber)" }}>
                      R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                    <td style={styles.td}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {selectedQuote?.status === "aprovado" && (
            <button style={styles.convertBtn} onClick={convertToOrder} disabled={converting || items.length === 0} type="button">
              {converting ? "Convertendo..." : "Converter em Pedido de Venda"}
            </button>
          )}
          {selectedQuote?.status === "convertido" && (
            <p style={{ ...styles.dim, marginTop: 12 }}>
              Este orçamento já foi convertido em pedido de venda.
            </p>
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
  statusRow: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 20, maxWidth: 220 },
  form: {
    display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: 12, alignItems: "end",
    background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: 16, marginBottom: 18,
  },
  addBtn: {
    background: "var(--green)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)",
    padding: "9px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", height: 38,
  },
  convertBtn: {
    marginTop: 16, background: "var(--amber)", color: "#FFFFFF", border: "none",
    borderRadius: "var(--radius)", padding: "12px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer",
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
