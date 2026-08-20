import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { Link } from "react-router-dom";
import ModulePage from "../components/ModulePage";
import { openPrintWindow, brandHeader, formatDate } from "../lib/printDocument";

export default function ProducaoPage() {
  const { company } = useAuth();
  const [stages, setStages] = useState([]);
  const [products, setProducts] = useState([]);
  const [salesOrders, setSalesOrders] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!company?.id) return;
    Promise.all([
      supabase.from("production_stages").select("id, name").order("sort_order", { ascending: true }),
      supabase.from("products").select("id, sku, name").order("name"),
      supabase.from("sales_orders").select("id, code").order("code"),
    ]).then(([stagesRes, productsRes, salesOrdersRes]) => {
      setStages(stagesRes.data ?? []);
      setProducts(productsRes.data ?? []);
      setSalesOrders(salesOrdersRes.data ?? []);
      setLoaded(true);
    });
  }, [company?.id]);

  const stageOptions = stages.map((s) => ({ value: s.id, label: s.name }));
  const productOptions = products.map((p) => ({ value: p.id, label: `${p.sku} — ${p.name}` }));
  const salesOrderOptions = salesOrders.map((o) => ({ value: o.id, label: o.code }));

  if (loaded && stages.length === 0) {
    return (
      <div style={styles.notice}>
        Antes de cadastrar ordens de produção, configure ao menos uma etapa do seu processo em{" "}
        <Link to="/etapas" style={styles.link}>Cadastro → Etapas</Link>.
      </div>
    );
  }

  if (loaded && products.length === 0) {
    return (
      <div style={styles.notice}>
        Antes de cadastrar ordens de produção, cadastre ao menos um produto em{" "}
        <Link to="/produtos" style={styles.link}>Cadastro → Produtos</Link>.
      </div>
    );
  }

  return (
    <div>
      <ModulePage
        key={refreshKey}
        table="production_orders"
        title="Produção"
        subtitle="Ordens de produção e etapa atual"
        emptyLabel="Nenhuma ordem de produção cadastrada ainda."
        autoGenerateCode={{ field: "code", rpc: "next_production_order_code" }}
        fields={[
          { key: "code", label: "Código", placeholder: "Gerado automaticamente", required: true },
          { key: "product_id", label: "Produto", type: "select", required: true, options: productOptions },
          { key: "quantity", label: "Quantidade", type: "number", required: true },
          { key: "stage_id", label: "Etapa", type: "select", required: true, options: stageOptions, quickEdit: true },
          { key: "sales_order_id", label: "Pedido de Venda relacionado", type: "select", options: salesOrderOptions },
          { key: "due_date", label: "Prazo", type: "date" },
        ]}
      />
      <PrintOrderSection stages={stages} />
    </div>
  );
}

/**
 * Seção separada só pra escolher uma Ordem e imprimir o
 * documento formal (com a lista de materiais/BOM incluída).
 */
function PrintOrderSection({ stages }) {
  const { company } = useAuth();
  const [orders, setOrders] = useState([]);
  const [orderId, setOrderId] = useState("");
  const [error, setError] = useState("");

  async function loadOrders() {
    const { data } = await supabase
      .from("production_orders")
      .select("id, code, quantity, due_date, created_at, stage_id, product_id, products:product_id (sku, name, unit)")
      .order("created_at", { ascending: false });
    setOrders(data ?? []);
  }

  useEffect(() => {
    if (company?.id) loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  async function printOrder() {
    setError("");
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    const { data: components } = await supabase
      .from("product_components")
      .select("quantity, products:component_id (sku, name, unit)")
      .eq("parent_product_id", order.product_id);

    const stageName = stages.find((s) => s.id === order.stage_id)?.name ?? "—";

    const materialsRows = (components ?? []).map((c) => {
      const totalQty = Number(c.quantity) * Number(order.quantity);
      return `<tr>
        <td>${c.products?.sku ?? ""}</td>
        <td>${c.products?.name ?? ""}</td>
        <td>${c.quantity} ${c.products?.unit ?? ""} / unidade</td>
        <td>${totalQty.toLocaleString("pt-BR")} ${c.products?.unit ?? ""}</td>
      </tr>`;
    }).join("");

    const stagesSequence = stages.map((s, i) =>
      `<tr><td>${i + 1}</td><td>${s.name}</td><td style="width:120px;">☐ Concluído</td></tr>`
    ).join("");

    const html = `
      ${brandHeader(company, "ORDEM DE PRODUÇÃO", [
        ["O.P. Nº", order.code],
        ["Emitida em", formatDate(order.created_at)],
        ["Prazo", formatDate(order.due_date)],
      ])}
      <div class="section-title">Produto</div>
      <div class="info-grid">
        <div><strong>Produto:</strong> ${order.products?.sku ?? ""} — ${order.products?.name ?? ""}</div>
        <div><strong>Quantidade:</strong> ${order.quantity} ${order.products?.unit ?? ""}</div>
        <div><strong>Etapa atual:</strong> ${stageName}</div>
      </div>

      ${materialsRows ? `
        <div class="section-title">Lista de Materiais (Estrutura do Produto)</div>
        <table>
          <thead><tr><th>SKU</th><th>Componente</th><th>Qtd. por unidade</th><th>Qtd. total</th></tr></thead>
          <tbody>${materialsRows}</tbody>
        </table>
      ` : `<div class="notes-box">Este produto ainda não tem estrutura (BOM) cadastrada.</div>`}

      <div class="section-title">Fluxo de Etapas</div>
      <table>
        <thead><tr><th>Ordem</th><th>Etapa</th><th>Status</th></tr></thead>
        <tbody>${stagesSequence}</tbody>
      </table>

      <div class="notes-box"><strong>Observações:</strong></div>

      <div class="signatures">
        <div class="signature-line">Responsável pela Produção</div>
        <div class="signature-line">Supervisor</div>
      </div>
    `;

    openPrintWindow(`Ordem de Produção ${order.code}`, html);
  }

  return (
    <div style={styles.printWrap}>
      <h2 style={styles.printTitle}>Imprimir Ordem de Produção</h2>
      <p style={styles.printSubtitle}>Escolha uma ordem para gerar o documento formal, com a lista de materiais e o fluxo de etapas.</p>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.printRow}>
        <select style={styles.input} value={orderId} onChange={(e) => setOrderId(e.target.value)} onFocus={loadOrders}>
          <option value="">Selecione uma ordem...</option>
          {orders.map((o) => <option key={o.id} value={o.id}>{o.code} — {o.products?.sku}</option>)}
        </select>
        <button style={styles.printBtn} onClick={printOrder} disabled={!orderId} type="button">🖨 Imprimir</button>
      </div>
    </div>
  );
}

const styles = {
  notice: {
    background: "rgba(232,163,61,0.1)",
    border: "1px solid var(--amber)",
    color: "var(--text)",
    borderRadius: "var(--radius)",
    padding: "14px 16px",
    fontSize: 13.5,
    lineHeight: 1.5,
    maxWidth: 620,
  },
  link: { color: "var(--amber)", fontWeight: 600 },
  printWrap: { marginTop: 36, paddingTop: 28, borderTop: "1px solid var(--line)" },
  printTitle: { fontFamily: "var(--font-display)", fontSize: 18, margin: 0 },
  printSubtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 16px", maxWidth: 560, lineHeight: 1.5 },
  printRow: { display: "flex", gap: 10, maxWidth: 520 },
  input: {
    flex: 1, background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "9px 10px", color: "var(--text)", fontSize: 13,
  },
  printBtn: {
    background: "transparent", color: "var(--text-dim)", border: "1px solid var(--line)",
    borderRadius: "var(--radius)", padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap",
  },
  error: {
    background: "rgba(217,105,95,0.12)", border: "1px solid var(--red)", color: "var(--red)",
    borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 13, marginBottom: 12, maxWidth: 520,
  },
};
