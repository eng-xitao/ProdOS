import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { Link } from "react-router-dom";
import CurrencyInput from "../components/CurrencyInput";

const STATUS_LABEL = { processando: "Processando", autorizado: "Autorizada", erro: "Erro", cancelado: "Cancelada" };

export default function NotasFiscaisPage() {
  const { company } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [emitting, setEmitting] = useState(false);

  const [customerId, setCustomerId] = useState("");
  const [sourceOrderId, setSourceOrderId] = useState("");
  const [items, setItems] = useState([]);
  const [reviewing, setReviewing] = useState(false);

  const [newProductId, setNewProductId] = useState("");
  const [newQty, setNewQty] = useState(1);

  async function loadBaseData() {
    const [{ data: c }, { data: p }, { data: o }] = await Promise.all([
      supabase.from("customers").select("id, name, document, logradouro, municipio, uf, cep").order("name"),
      supabase.from("products").select("id, name, sku, ncm, sale_price, unit").eq("type", "acabado").order("name"),
      supabase.from("sales_orders").select("id, code, customer_id").order("order_date", { ascending: false }),
    ]);
    setCustomers(c ?? []);
    setProducts(p ?? []);
    setOrders(o ?? []);
  }

  async function loadInvoices() {
    setLoading(true);
    const { data } = await supabase
      .from("invoices")
      .select("id, status, chave_nfe, numero, serie, valor_total, danfe_url, error_message, created_at, customers:customer_id (name)")
      .order("created_at", { ascending: false });
    setInvoices(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (company?.id) { loadBaseData(); loadInvoices(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  const customer = customers.find((c) => c.id === customerId);
  const customerAddressIncomplete = customer && (!customer.logradouro || !customer.municipio || !customer.uf || !customer.cep);
  const ordersForCustomer = orders.filter((o) => o.customer_id === customerId);
  const fiscalIncomplete = !company?.focus_nfe_token || !company?.logradouro;

  async function loadFromOrder(orderId) {
    setSourceOrderId(orderId);
    if (!orderId) return;
    const { data } = await supabase
      .from("sales_order_items")
      .select("product_id, quantity, unit_price")
      .eq("sales_order_id", orderId);
    setItems((data ?? []).map((it) => ({ productId: it.product_id, quantity: Number(it.quantity), unitPrice: Number(it.unit_price) })));
  }

  function addItem() {
    if (!newProductId || !newQty) return;
    const product = products.find((p) => p.id === newProductId);
    const existing = items.find((it) => it.productId === newProductId);
    if (existing) {
      setItems((prev) => prev.map((it) => (it.productId === newProductId ? { ...it, quantity: it.quantity + Number(newQty) } : it)));
    } else {
      setItems((prev) => [...prev, { productId: newProductId, quantity: Number(newQty), unitPrice: Number(product?.sale_price ?? 0) }]);
    }
    setNewProductId(""); setNewQty(1);
  }

  function updateItem(productId, field, value) {
    setItems((prev) => prev.map((it) => (it.productId === productId ? { ...it, [field]: value } : it)));
  }

  function removeItem(productId) {
    setItems((prev) => prev.filter((it) => it.productId !== productId));
  }

  const total = useMemo(() => items.reduce((sum, it) => sum + Number(it.quantity) * Number(it.unitPrice), 0), [items]);

  const missingNcm = items
    .map((it) => products.find((p) => p.id === it.productId))
    .filter((p) => p && !p.ncm);

  async function emit() {
    if (!company?.id || !customerId || items.length === 0) return;
    setEmitting(true);
    setError("");

    const { data, error } = await supabase.functions.invoke("emit-nfe", {
      body: {
        companyId: company.id,
        customerId,
        salesOrderId: sourceOrderId || null,
        items: items.map((it) => ({ productId: it.productId, quantity: it.quantity, unitPrice: it.unitPrice })),
      },
    });

    if (error || data?.error) {
      setError(data?.error ?? "Não foi possível emitir a NF-e. Tente novamente em instantes.");
    } else {
      setCustomerId(""); setSourceOrderId(""); setItems([]); setReviewing(false);
      await loadInvoices();
    }
    setEmitting(false);
  }

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={styles.title}>Notas Fiscais</h1>
        <p style={styles.subtitle}>Monte a nota escolhendo cliente e produtos — não precisa ser o pedido inteiro.</p>
      </header>

      {fiscalIncomplete && (
        <div style={styles.notice}>
          Antes de emitir, complete a <Link to="/fiscal" style={styles.link}>Configuração Fiscal</Link>.
        </div>
      )}
      {error && <div style={styles.error}>{error}</div>}

      {!reviewing ? (
        <div style={styles.builder}>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Cliente</span>
            <select style={styles.input} value={customerId} onChange={(e) => { setCustomerId(e.target.value); setSourceOrderId(""); }}>
              <option value="">Selecione...</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>

          {customer && customerAddressIncomplete && (
            <div style={styles.warning}>
              Endereço incompleto pra esse cliente. Complete em{" "}
              <Link to="/clientes" style={styles.link}>Cadastro → Clientes</Link> antes de emitir.
            </div>
          )}

          {customerId && ordersForCustomer.length > 0 && (
            <label style={styles.field}>
              <span style={styles.fieldLabel}>Carregar itens de um pedido (opcional)</span>
              <select style={styles.input} value={sourceOrderId} onChange={(e) => loadFromOrder(e.target.value)}>
                <option value="">Começar do zero</option>
                {ordersForCustomer.map((o) => <option key={o.id} value={o.id}>{o.code}</option>)}
              </select>
            </label>
          )}

          {customerId && (
            <>
              <div style={styles.addItemRow}>
                <select style={styles.input} value={newProductId} onChange={(e) => setNewProductId(e.target.value)}>
                  <option value="">Selecione um produto...</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
                </select>
                <input style={styles.qtyInput} type="number" min="0.01" step="any" value={newQty} onChange={(e) => setNewQty(e.target.value)} />
                <button style={styles.addBtn} onClick={addItem} type="button" disabled={!newProductId}>+ Adicionar</button>
              </div>

              {items.length > 0 && (
                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr><th style={styles.th}>Produto</th><th style={styles.th}>Qtd.</th><th style={styles.th}>Preço unit.</th><th style={styles.th}>Total</th><th style={styles.th}></th></tr>
                    </thead>
                    <tbody>
                      {items.map((it) => {
                        const product = products.find((p) => p.id === it.productId);
                        return (
                          <tr key={it.productId}>
                            <td style={styles.td}>
                              {product?.sku} — {product?.name}
                              {!product?.ncm && <div style={styles.ncmWarning}>Sem NCM cadastrado</div>}
                            </td>
                            <td style={styles.td}>
                              <input style={styles.smallInput} type="number" min="0.01" step="any" value={it.quantity} onChange={(e) => updateItem(it.productId, "quantity", Number(e.target.value))} />
                            </td>
                            <td style={styles.td}>
                              <CurrencyInput value={it.unitPrice} onChange={(v) => updateItem(it.productId, "unitPrice", v)} style={{ width: 120 }} />
                            </td>
                            <td style={styles.td}>R$ {(it.quantity * it.unitPrice).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                            <td style={styles.td}>
                              <button style={styles.removeBtn} onClick={() => removeItem(it.productId)} type="button">Remover</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {items.length > 0 && (
                <div style={styles.totalBox}>
                  <span>Total da nota</span>
                  <strong>R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong>
                </div>
              )}

              <button
                style={styles.reviewBtn}
                onClick={() => setReviewing(true)}
                disabled={items.length === 0 || customerAddressIncomplete || fiscalIncomplete}
                type="button"
              >
                Revisar e emitir
              </button>
            </>
          )}
        </div>
      ) : (
        <div style={styles.reviewBox}>
          <h2 style={styles.title2}>Confirme antes de emitir</h2>
          <p style={styles.reviewLine}><strong>Cliente:</strong> {customer?.name}</p>
          <div style={styles.reviewItems}>
            {items.map((it) => {
              const product = products.find((p) => p.id === it.productId);
              return (
                <div key={it.productId} style={styles.reviewItemRow}>
                  <span>{product?.sku} — {product?.name}</span>
                  <span>{it.quantity} × R$ {it.unitPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} = R$ {(it.quantity * it.unitPrice).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
              );
            })}
          </div>
          <div style={styles.totalBox}>
            <span>Total da nota</span>
            <strong>R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong>
          </div>

          {missingNcm.length > 0 && (
            <div style={styles.warning}>
              Produtos sem NCM: {missingNcm.map((p) => p.name).join(", ")}. Complete em Cadastro → Produtos antes de emitir.
            </div>
          )}

          <div style={styles.reviewActions}>
            <button style={styles.backBtn} onClick={() => setReviewing(false)} type="button">Voltar e ajustar</button>
            <button style={styles.emitBtn} onClick={emit} disabled={emitting || missingNcm.length > 0} type="button">
              {emitting ? "Emitindo..." : "Confirmar e emitir NF-e"}
            </button>
          </div>
        </div>
      )}

      <div style={styles.wrap}>
        <h2 style={styles.title2}>Histórico</h2>
        {loading ? (
          <p style={styles.dim}>Carregando...</p>
        ) : invoices.length === 0 ? (
          <p style={styles.dim}>Nenhuma nota emitida ainda.</p>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr><th style={styles.th}>Cliente</th><th style={styles.th}>Número</th><th style={styles.th}>Valor</th><th style={styles.th}>Status</th><th style={styles.th}>Data</th><th style={styles.th}></th></tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td style={styles.td}>{inv.customers?.name ?? "—"}</td>
                    <td style={styles.td}>{inv.numero ? `${inv.numero}/${inv.serie}` : "—"}</td>
                    <td style={styles.td}>R$ {Number(inv.valor_total ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                    <td style={styles.td}>
                      <span style={{ ...styles.badge, ...statusStyle(inv.status) }}>{STATUS_LABEL[inv.status]}</span>
                      {inv.status === "erro" && inv.error_message && <div style={styles.errorDetail}>{inv.error_message}</div>}
                    </td>
                    <td style={styles.td}>{new Date(inv.created_at).toLocaleString("pt-BR")}</td>
                    <td style={styles.td}>{inv.danfe_url && <a href={inv.danfe_url} target="_blank" rel="noreferrer" style={styles.danfeLink}>DANFE</a>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function statusStyle(status) {
  if (status === "autorizado") return { background: "rgba(79,174,126,0.15)", color: "var(--green)" };
  if (status === "erro") return { background: "rgba(217,105,95,0.15)", color: "var(--red)" };
  if (status === "cancelado") return { background: "rgba(138,135,128,0.15)", color: "var(--text-dim)" };
  return { background: "rgba(232,163,61,0.15)", color: "var(--amber)" };
}

const styles = {
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  title2: { fontFamily: "var(--font-display)", fontSize: 18, margin: "0 0 12px" },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0" },
  dim: { color: "var(--text-dim)", fontSize: 14 },
  wrap: { marginTop: 32, paddingTop: 24, borderTop: "1px solid var(--line)" },
  notice: {
    background: "rgba(232,163,61,0.1)", border: "1px solid var(--amber)", color: "var(--text)",
    borderRadius: "var(--radius)", padding: "12px 16px", fontSize: 13, lineHeight: 1.5, maxWidth: 720, marginBottom: 16,
  },
  warning: {
    background: "rgba(217,105,95,0.1)", border: "1px solid var(--red)", color: "var(--text)",
    borderRadius: "var(--radius)", padding: "10px 14px", fontSize: 12.5, lineHeight: 1.5, marginBottom: 12, maxWidth: 720,
  },
  link: { color: "var(--amber)", fontWeight: 600 },
  builder: {
    background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: 20, marginBottom: 24, maxWidth: 800, display: "flex", flexDirection: "column", gap: 14,
  },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  fieldLabel: { fontSize: 11, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" },
  input: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "9px 10px", color: "var(--text)", fontSize: 13,
  },
  addItemRow: { display: "flex", gap: 10, alignItems: "center" },
  qtyInput: {
    width: 90, background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "9px 10px", color: "var(--text)", fontSize: 13,
  },
  smallInput: {
    width: 70, background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "6px 8px", color: "var(--text)", fontSize: 12.5,
  },
  addBtn: {
    background: "var(--green)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)",
    padding: "9px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap",
  },
  removeBtn: {
    background: "transparent", border: "1px solid var(--line)", color: "var(--red)", borderRadius: "var(--radius)",
    padding: "4px 10px", fontSize: 11.5, cursor: "pointer",
  },
  totalBox: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    background: "var(--panel-2)", border: "1px solid var(--amber)", borderRadius: "var(--radius)",
    padding: "12px 16px", fontSize: 14,
  },
  reviewBtn: {
    background: "var(--amber)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)",
    padding: "11px 0", fontWeight: 700, fontSize: 13.5, cursor: "pointer",
  },
  reviewBox: {
    background: "var(--panel)", border: "1px solid var(--amber)", borderRadius: "var(--radius)",
    padding: 20, marginBottom: 24, maxWidth: 800,
  },
  reviewLine: { fontSize: 13.5, margin: "0 0 12px" },
  reviewItems: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 },
  reviewItemRow: { display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderBottom: "1px solid var(--line)" },
  reviewActions: { display: "flex", gap: 10, marginTop: 16 },
  backBtn: {
    flex: 1, background: "transparent", border: "1px solid var(--line)", color: "var(--text-dim)", borderRadius: "var(--radius)",
    padding: "11px 0", fontWeight: 600, fontSize: 13, cursor: "pointer",
  },
  emitBtn: {
    flex: 2, background: "var(--amber)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)",
    padding: "11px 0", fontWeight: 700, fontSize: 13.5, cursor: "pointer",
  },
  tableWrap: { border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden", overflowX: "auto", maxWidth: 900 },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em",
    color: "var(--text-dim)", padding: "10px 14px", background: "var(--panel)", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap",
  },
  td: { padding: "10px 14px", fontSize: 13.5, background: "var(--panel)", borderBottom: "1px solid var(--line)" },
  ncmWarning: { fontSize: 10.5, color: "var(--red)", marginTop: 2 },
  badge: { padding: "3px 10px", borderRadius: 20, fontSize: 11.5, fontWeight: 700 },
  errorDetail: { fontSize: 11, color: "var(--red)", marginTop: 4, whiteSpace: "normal", maxWidth: 260 },
  danfeLink: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "5px 10px", fontSize: 12, fontWeight: 700, color: "var(--amber)", textDecoration: "none",
  },
  error: {
    background: "rgba(217,105,95,0.12)", border: "1px solid var(--red)", color: "var(--red)",
    borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 13, marginBottom: 16, maxWidth: 720,
  },
};
