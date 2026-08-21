import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { useNavigate } from "react-router-dom";
import ModulePage from "../components/ModulePage";
import { openPrintWindow, brandHeader, currency, formatDate, openMailto } from "../lib/printDocument";

export default function CotacoesPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div>
      <ModulePage
        key={refreshKey}
        table="purchase_quotes"
        title="Cotações"
        subtitle="Compare preços de diferentes fornecedores antes de decidir a compra"
        emptyLabel="Nenhuma cotação cadastrada ainda."
        fields={[
          { key: "code", label: "Código", placeholder: "COT-0001", required: true },
          { key: "notes", label: "Observações", placeholder: "Opcional" },
        ]}
      />
      <QuoteWorkspace onClosed={() => setRefreshKey((k) => k + 1)} />
    </div>
  );
}

function QuoteWorkspace({ onClosed }) {
  const { company } = useAuth();
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [quoteId, setQuoteId] = useState("");
  const [items, setItems] = useState([]);
  const [prices, setPrices] = useState([]);
  const [error, setError] = useState("");
  const [closing, setClosing] = useState(false);

  const [newItemProduct, setNewItemProduct] = useState("");
  const [newItemQty, setNewItemQty] = useState("1");

  const [newPriceSupplier, setNewPriceSupplier] = useState("");
  const [newPriceProduct, setNewPriceProduct] = useState("");
  const [newPriceValue, setNewPriceValue] = useState("");

  const [winningSupplier, setWinningSupplier] = useState("");
  const [emailSupplierId, setEmailSupplierId] = useState("");
  const [supplierContacts, setSupplierContacts] = useState([]);
  const [selectedContactId, setSelectedContactId] = useState("");

  async function loadQuotes() {
    const { data } = await supabase.from("purchase_quotes").select("id, code, status, winning_supplier_id").order("created_at", { ascending: false });
    setQuotes(data ?? []);
  }

  async function loadBaseData() {
    const [s, p] = await Promise.all([
      supabase.from("suppliers").select("id, name").order("name"),
      supabase.from("products").select("id, sku, name").order("name"),
    ]);
    setSuppliers(s.data ?? []);
    setProducts(p.data ?? []);
  }

  async function loadItems(qid) {
    if (!qid) { setItems([]); return; }
    const { data } = await supabase
      .from("purchase_quote_items")
      .select("id, quantity, product_id, products:product_id (sku, name)")
      .eq("quote_id", qid);
    setItems(data ?? []);
  }

  async function loadPrices(qid) {
    if (!qid) { setPrices([]); return; }
    const { data } = await supabase
      .from("purchase_quote_prices")
      .select("id, unit_price, supplier_id, product_id, suppliers:supplier_id (name), products:product_id (sku, name)")
      .eq("quote_id", qid);
    setPrices(data ?? []);
  }

  useEffect(() => {
    if (company?.id) { loadQuotes(); loadBaseData(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  useEffect(() => {
    loadItems(quoteId);
    loadPrices(quoteId);
    setWinningSupplier("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteId]);

  const selectedQuote = quotes.find((q) => q.id === quoteId);

  // Totais por fornecedor, para comparação
  const totalsBySupplier = {};
  prices.forEach((p) => {
    if (!totalsBySupplier[p.supplier_id]) {
      totalsBySupplier[p.supplier_id] = { name: p.suppliers?.name, total: 0, itemsQuoted: 0 };
    }
    const item = items.find((it) => it.product_id === p.product_id);
    const qty = item ? Number(item.quantity) : 0;
    totalsBySupplier[p.supplier_id].total += qty * Number(p.unit_price);
    totalsBySupplier[p.supplier_id].itemsQuoted += 1;
  });

  async function addItem(e) {
    e.preventDefault();
    setError("");
    if (!company?.id || !quoteId || !newItemProduct) return;
    const { error } = await supabase.from("purchase_quote_items").insert({
      company_id: company.id,
      quote_id: quoteId,
      product_id: newItemProduct,
      quantity: Number(newItemQty),
    });
    if (error) setError(error.message);
    else {
      setNewItemProduct(""); setNewItemQty("1");
      loadItems(quoteId);
    }
  }

  async function removeItem(id) {
    await supabase.from("purchase_quote_items").delete().eq("id", id);
    loadItems(quoteId);
  }

  async function addPrice(e) {
    e.preventDefault();
    setError("");
    if (!company?.id || !quoteId || !newPriceSupplier || !newPriceProduct) return;
    const { error } = await supabase.from("purchase_quote_prices").insert({
      company_id: company.id,
      quote_id: quoteId,
      supplier_id: newPriceSupplier,
      product_id: newPriceProduct,
      unit_price: Number(newPriceValue),
    });
    if (error) setError(error.message);
    else {
      setNewPriceSupplier(""); setNewPriceProduct(""); setNewPriceValue("");
      loadPrices(quoteId);
    }
  }

  async function removePrice(id) {
    await supabase.from("purchase_quote_prices").delete().eq("id", id);
    loadPrices(quoteId);
  }

  async function closeQuote() {
    if (!winningSupplier || items.length === 0) return;
    setClosing(true);
    setError("");

    const matched = items
      .map((it) => {
        const priceEntry = prices.find((p) => p.supplier_id === winningSupplier && p.product_id === it.product_id);
        return priceEntry ? { product_id: it.product_id, quantity: it.quantity, unit_price: priceEntry.unit_price } : null;
      })
      .filter(Boolean);

    if (matched.length === 0) {
      setError("O fornecedor escolhido não tem preço informado para nenhum item desta cotação.");
      setClosing(false);
      return;
    }

    const total = matched.reduce((sum, it) => sum + Number(it.quantity) * Number(it.unit_price), 0);

    const { data: order, error: orderError } = await supabase
      .from("purchase_orders")
      .insert({
        company_id: company.id,
        code: `PC-${selectedQuote.code}`,
        supplier_id: winningSupplier,
        quote_id: quoteId,
        status: "aberto",
        order_date: new Date().toISOString().slice(0, 10),
        total_value: total,
      })
      .select("id")
      .single();

    if (orderError) { setError(orderError.message); setClosing(false); return; }

    const orderItems = matched.map((it) => ({
      company_id: company.id,
      purchase_order_id: order.id,
      product_id: it.product_id,
      quantity: it.quantity,
      unit_price: it.unit_price,
    }));
    const { error: itemsError } = await supabase.from("purchase_order_items").insert(orderItems);
    if (itemsError) { setError(itemsError.message); setClosing(false); return; }

    await supabase.from("purchase_quotes").update({ status: "fechada", winning_supplier_id: winningSupplier }).eq("id", quoteId);

    setClosing(false);
    onClosed();
    navigate("/pedidos-compra");
  }

  function printQuote() {
    if (!selectedQuote) return;

    const itemsRows = items.map((it) =>
      `<tr><td>${it.products?.sku ?? ""}</td><td>${it.products?.name ?? ""}</td><td>${it.quantity}</td></tr>`
    ).join("");

    const pricesRows = prices.map((p) =>
      `<tr><td>${p.suppliers?.name ?? ""}</td><td>${p.products?.sku ?? ""} — ${p.products?.name ?? ""}</td><td>${currency(p.unit_price)}</td></tr>`
    ).join("");

    const comparisonRows = Object.entries(totalsBySupplier).map(([supplierId, info]) => {
      const isWinner = supplierId === selectedQuote.winning_supplier_id;
      return `<tr ${isWinner ? 'style="background:#fdf1e0;font-weight:700;"' : ""}>
        <td>${info.name}${isWinner ? " ★ Vencedor" : ""}</td>
        <td>${info.itemsQuoted} de ${items.length}</td>
        <td>${currency(info.total)}</td>
      </tr>`;
    }).join("");

    const html = `
      ${brandHeader(company, "COTAÇÃO DE COMPRA", [
        ["Nº", selectedQuote.code],
        ["Status", selectedQuote.status === "aberta" ? "Aberta" : "Fechada"],
      ])}
      <div class="section-title">Itens Necessários</div>
      <table>
        <thead><tr><th>SKU</th><th>Produto</th><th>Quantidade</th></tr></thead>
        <tbody>${itemsRows}</tbody>
      </table>
      <div class="section-title">Preços Informados por Fornecedor</div>
      <table>
        <thead><tr><th>Fornecedor</th><th>Produto</th><th>Preço unit.</th></tr></thead>
        <tbody>${pricesRows}</tbody>
      </table>
      <div class="section-title">Comparação e Fechamento</div>
      <table>
        <thead><tr><th>Fornecedor</th><th>Itens cotados</th><th>Total estimado</th></tr></thead>
        <tbody>${comparisonRows}</tbody>
      </table>
      <div class="signatures">
        <div class="signature-line">Responsável pela Cotação</div>
        <div class="signature-line">Aprovação</div>
      </div>
    `;

    openPrintWindow(`Cotação ${selectedQuote.code}`, html);
  }

  async function loadSupplierContacts(supplierId) {
    if (!supplierId) { setSupplierContacts([]); return; }
    const { data } = await supabase
      .from("contacts")
      .select("id, name, department, email")
      .eq("supplier_id", supplierId);
    setSupplierContacts(data ?? []);
    setSelectedContactId("");
  }

  function sendEmail() {
    const contact = supplierContacts.find((c) => c.id === selectedContactId);
    const supplierName = Object.values(totalsBySupplier).find((_, i) => Object.keys(totalsBySupplier)[i] === emailSupplierId)?.name;
    if (!contact?.email || !selectedQuote) return;
    openMailto(
      contact.email,
      `Cotação ${selectedQuote.code} — ${company?.name ?? ""}`,
      `Olá ${contact.name},\n\nSegue em anexo a Cotação ${selectedQuote.code} para ${supplierName ?? "sua empresa"}.\n\n(Lembre-se de anexar o PDF gerado na impressão antes de enviar.)\n\nAtenciosamente,\n${company?.name ?? ""}`
    );
  }

  return (
    <div style={styles.wrap}>
      <h2 style={styles.title}>Itens e preços da cotação</h2>
      <p style={styles.subtitle}>
        Adicione os itens que você precisa comprar, registre o preço informado por cada
        fornecedor, e feche a cotação escolhendo o vencedor — isso gera o Pedido de Compra automaticamente.
      </p>

      <label style={styles.field}>
        <span style={styles.fieldLabel}>Cotação</span>
        <select style={styles.input} value={quoteId} onChange={(e) => setQuoteId(e.target.value)} onFocus={loadQuotes}>
          <option value="">Selecione uma cotação...</option>
          {quotes.map((q) => (
            <option key={q.id} value={q.id}>{q.code} — {q.status === "aberta" ? "Aberta" : "Fechada"}</option>
          ))}
        </select>
      </label>

      {quoteId && (
        <>
          <button style={styles.printBtn} onClick={printQuote} type="button" disabled={items.length === 0}>
            🖨 Imprimir Cotação
          </button>

          {error && <div style={styles.error}>{error}</div>}

          {selectedQuote?.status === "aberta" && (
            <>
              <h3 style={styles.subTitle}>1. Itens necessários</h3>
              <form onSubmit={addItem} style={styles.formItems}>
                <label style={styles.field}>
                  <span style={styles.fieldLabel}>Produto</span>
                  <select style={styles.input} value={newItemProduct} onChange={(e) => setNewItemProduct(e.target.value)} required>
                    <option value="">Selecione...</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
                  </select>
                </label>
                <label style={styles.field}>
                  <span style={styles.fieldLabel}>Quantidade</span>
                  <input style={styles.input} type="number" step="any" value={newItemQty} onChange={(e) => setNewItemQty(e.target.value)} required />
                </label>
                <button style={styles.addBtn} type="submit">+ Adicionar item</button>
              </form>
            </>
          )}

          {items.length > 0 && (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr><th style={styles.th}>Produto</th><th style={styles.th}>Quantidade</th><th style={styles.th}></th></tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id}>
                      <td style={styles.td}>{it.products?.sku} — {it.products?.name}</td>
                      <td style={styles.td}>{it.quantity}</td>
                      <td style={{ ...styles.td, textAlign: "right" }}>
                        {selectedQuote?.status === "aberta" && (
                          <button style={styles.deleteBtn} onClick={() => removeItem(it.id)} type="button">Remover</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {selectedQuote?.status === "aberta" && items.length > 0 && (
            <>
              <h3 style={styles.subTitle}>2. Preços por fornecedor</h3>
              <form onSubmit={addPrice} style={styles.formPrices}>
                <label style={styles.field}>
                  <span style={styles.fieldLabel}>Fornecedor</span>
                  <select style={styles.input} value={newPriceSupplier} onChange={(e) => setNewPriceSupplier(e.target.value)} required>
                    <option value="">Selecione...</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </label>
                <label style={styles.field}>
                  <span style={styles.fieldLabel}>Produto</span>
                  <select style={styles.input} value={newPriceProduct} onChange={(e) => setNewPriceProduct(e.target.value)} required>
                    <option value="">Selecione...</option>
                    {items.map((it) => (
                      <option key={it.product_id} value={it.product_id}>{it.products?.sku} — {it.products?.name}</option>
                    ))}
                  </select>
                </label>
                <label style={styles.field}>
                  <span style={styles.fieldLabel}>Preço unit. (R$)</span>
                  <input style={styles.input} type="number" step="any" value={newPriceValue} onChange={(e) => setNewPriceValue(e.target.value)} required />
                </label>
                <button style={styles.addBtn} type="submit">+ Adicionar preço</button>
              </form>
            </>
          )}

          {prices.length > 0 && (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr><th style={styles.th}>Fornecedor</th><th style={styles.th}>Produto</th><th style={styles.th}>Preço unit.</th><th style={styles.th}></th></tr>
                </thead>
                <tbody>
                  {prices.map((p) => (
                    <tr key={p.id}>
                      <td style={styles.td}>{p.suppliers?.name}</td>
                      <td style={styles.td}>{p.products?.sku} — {p.products?.name}</td>
                      <td style={styles.td}>R$ {Number(p.unit_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                      <td style={{ ...styles.td, textAlign: "right" }}>
                        {selectedQuote?.status === "aberta" && (
                          <button style={styles.deleteBtn} onClick={() => removePrice(p.id)} type="button">Remover</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {Object.keys(totalsBySupplier).length > 0 && (
            <>
              <h3 style={styles.subTitle}>3. Comparação e fechamento</h3>
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr><th style={styles.th}>Fornecedor</th><th style={styles.th}>Itens cotados</th><th style={styles.th}>Total estimado</th></tr>
                  </thead>
                  <tbody>
                    {Object.entries(totalsBySupplier).map(([supplierId, info]) => (
                      <tr key={supplierId}>
                        <td style={styles.td}>{info.name}</td>
                        <td style={styles.td}>{info.itemsQuoted} de {items.length}</td>
                        <td style={{ ...styles.td, fontWeight: 700, color: "var(--amber)" }}>
                          R$ {info.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={styles.emailRow}>
                <label style={styles.field}>
                  <span style={styles.fieldLabel}>Enviar cotação para</span>
                  <select
                    style={styles.input}
                    value={emailSupplierId}
                    onChange={(e) => { setEmailSupplierId(e.target.value); loadSupplierContacts(e.target.value); }}
                  >
                    <option value="">Selecione o fornecedor...</option>
                    {Object.entries(totalsBySupplier).map(([supplierId, info]) => (
                      <option key={supplierId} value={supplierId}>{info.name}</option>
                    ))}
                  </select>
                </label>
                {supplierContacts.length > 0 && (
                  <>
                    <label style={styles.field}>
                      <span style={styles.fieldLabel}>Contato</span>
                      <select style={styles.input} value={selectedContactId} onChange={(e) => setSelectedContactId(e.target.value)}>
                        <option value="">Escolha o contato...</option>
                        {supplierContacts.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}{c.department ? ` — ${c.department}` : ""}</option>
                        ))}
                      </select>
                    </label>
                    <button style={styles.printBtn} onClick={sendEmail} type="button" disabled={!selectedContactId}>
                      ✉ Enviar por E-mail
                    </button>
                  </>
                )}
                {emailSupplierId && supplierContacts.length === 0 && (
                  <p style={styles.dim}>Esse fornecedor ainda não tem contato cadastrado.</p>
                )}
              </div>

              {selectedQuote?.status === "aberta" && (
                <div style={{ marginTop: 16, display: "flex", gap: 12, alignItems: "end" }}>
                  <label style={styles.field}>
                    <span style={styles.fieldLabel}>Fornecedor vencedor</span>
                    <select style={styles.input} value={winningSupplier} onChange={(e) => setWinningSupplier(e.target.value)}>
                      <option value="">Selecione...</option>
                      {Object.entries(totalsBySupplier).map(([supplierId, info]) => (
                        <option key={supplierId} value={supplierId}>{info.name}</option>
                      ))}
                    </select>
                  </label>
                  <button style={styles.convertBtn} onClick={closeQuote} disabled={closing || !winningSupplier} type="button">
                    {closing ? "Fechando..." : "Fechar cotação e gerar Pedido de Compra"}
                  </button>
                </div>
              )}
            </>
          )}

          {selectedQuote?.status === "fechada" && (
            <p style={{ ...styles.dim, marginTop: 12 }}>Esta cotação já foi fechada e gerou um Pedido de Compra.</p>
          )}
        </>
      )}
    </div>
  );
}

const styles = {
  wrap: { marginTop: 36, paddingTop: 28, borderTop: "1px solid var(--line)" },
  title: { fontFamily: "var(--font-display)", fontSize: 18, margin: 0 },
  subTitle: { fontSize: 14, fontWeight: 700, color: "var(--amber)", margin: "24px 0 12px" },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 18px", maxWidth: 640, lineHeight: 1.5 },
  field: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 16, maxWidth: 320 },
  fieldLabel: { fontSize: 11, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" },
  input: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "9px 10px", color: "var(--text)", fontSize: 13,
  },
  formItems: { display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 12, alignItems: "end", maxWidth: 640, marginBottom: 12 },
  formPrices: { display: "grid", gridTemplateColumns: "1.5fr 1.5fr 1fr auto", gap: 12, alignItems: "end", maxWidth: 720, marginBottom: 12 },
  addBtn: {
    background: "var(--green)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)",
    padding: "9px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", height: 38, whiteSpace: "nowrap",
  },
  printBtn: {
    background: "transparent", color: "var(--text-dim)", border: "1px solid var(--line)",
    borderRadius: "var(--radius)", padding: "9px 16px", fontWeight: 600, fontSize: 13,
    cursor: "pointer", marginBottom: 16,
  },
  emailRow: { display: "flex", gap: 12, alignItems: "end", marginTop: 16, flexWrap: "wrap", maxWidth: 760 },
  convertBtn: {
    background: "var(--amber)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)",
    padding: "10px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer", height: 38, whiteSpace: "nowrap",
  },
  dim: { color: "var(--text-dim)", fontSize: 14 },
  tableWrap: { border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden", maxWidth: 760, marginBottom: 8 },
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
    borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 13, marginBottom: 16, maxWidth: 640,
  },
};
