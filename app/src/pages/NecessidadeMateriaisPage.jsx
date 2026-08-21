import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { useNavigate } from "react-router-dom";

/**
 * MRP I — explode a estrutura (BOM) de cada ordem de produção aberta,
 * soma a necessidade por componente, e compara com o estoque atual
 * de cada componente para sugerir o que falta comprar/produzir.
 */
export default function NecessidadeMateriaisPage() {
  const { company } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [ordersWithoutBom, setOrdersWithoutBom] = useState(0);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (company?.id) calculate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  async function calculate() {
    setLoading(true);

    const { data: orders } = await supabase
      .from("production_orders")
      .select("id, product_id, quantity, due_date")
      .not("product_id", "is", null);

    const { data: components } = await supabase
      .from("product_components")
      .select("parent_product_id, component_id, quantity");

    const { data: products } = await supabase
      .from("products")
      .select("id, sku, name, unit, stock_quantity, lead_time_days");

    const productById = Object.fromEntries((products ?? []).map((p) => [p.id, p]));
    const bomByParent = {};
    (components ?? []).forEach((c) => {
      if (!bomByParent[c.parent_product_id]) bomByParent[c.parent_product_id] = [];
      bomByParent[c.parent_product_id].push(c);
    });

    let missingBom = 0;
    const need = {}; // component_id -> { quantity, earliestDue }

    (orders ?? []).forEach((order) => {
      const bom = bomByParent[order.product_id];
      if (!bom || bom.length === 0) {
        missingBom += 1;
        return;
      }
      bom.forEach((c) => {
        const qty = Number(c.quantity) * Number(order.quantity);
        if (!need[c.component_id]) need[c.component_id] = { quantity: 0, earliestDue: order.due_date };
        need[c.component_id].quantity += qty;
        if (order.due_date && (!need[c.component_id].earliestDue || order.due_date < need[c.component_id].earliestDue)) {
          need[c.component_id].earliestDue = order.due_date;
        }
      });
    });

    const result = Object.entries(need).map(([componentId, info]) => {
      const product = productById[componentId];
      const stock = Number(product?.stock_quantity ?? 0);
      const toBuy = Math.max(0, info.quantity - stock);
      return {
        id: componentId,
        sku: product?.sku ?? "—",
        name: product?.name ?? "Produto não encontrado",
        unit: product?.unit ?? "un",
        needed: info.quantity,
        stock,
        toBuy,
        leadTime: product?.lead_time_days ?? 0,
        dueDate: info.earliestDue,
      };
    }).sort((a, b) => b.toBuy - a.toBuy);

    setRows(result);
    setOrdersWithoutBom(missingBom);
    setLoading(false);
  }

  async function generateQuote() {
    const toBuyRows = rows.filter((r) => r.toBuy > 0);
    if (toBuyRows.length === 0 || !company?.id) return;
    setGenerating(true);

    const code = `COT-MRP-${new Date().toISOString().slice(0, 10)}`;
    const { data: quote, error: quoteError } = await supabase
      .from("purchase_quotes")
      .insert({ company_id: company.id, code, notes: "Gerada a partir da Necessidade de Materiais (MRP I)" })
      .select("id")
      .single();

    if (quoteError) {
      setGenerating(false);
      return;
    }

    const items = toBuyRows.map((r) => ({
      company_id: company.id,
      quote_id: quote.id,
      product_id: r.id,
      quantity: r.toBuy,
    }));
    await supabase.from("purchase_quote_items").insert(items);

    setGenerating(false);
    navigate("/cotacoes");
  }

  return (
    <div>
      <header style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={styles.title}>Necessidade de Materiais (MRP I)</h1>
          <p style={styles.subtitle}>
            Calculado a partir das ordens de produção abertas, da estrutura (BOM) de cada produto
            e do estoque atual. Mostra o que falta comprar ou produzir para atender a demanda.
          </p>
        </div>
        {rows.some((r) => r.toBuy > 0) && (
          <button style={styles.generateBtn} onClick={generateQuote} disabled={generating} type="button">
            {generating ? "Gerando..." : "Gerar Cotação com itens sugeridos"}
          </button>
        )}
      </header>

      {ordersWithoutBom > 0 && (
        <div style={styles.notice}>
          {ordersWithoutBom} ordem(ns) de produção não entraram no cálculo porque o produto
          vinculado ainda não tem estrutura (BOM) definida em Produtos.
        </div>
      )}

      {loading ? (
        <p style={styles.dim}>Calculando...</p>
      ) : rows.length === 0 ? (
        <p style={styles.dim}>
          Nenhuma necessidade calculada. Isso acontece se não há ordens de produção abertas,
          ou se os produtos das ordens ainda não têm estrutura (BOM) definida.
        </p>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>SKU</th>
                <th style={styles.th}>Componente</th>
                <th style={styles.th}>Necessário</th>
                <th style={styles.th}>Em estoque</th>
                <th style={styles.th}>A comprar/produzir</th>
                <th style={styles.th}>Lead time</th>
                <th style={styles.th}>Prazo mais próximo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={styles.td}>{r.sku}</td>
                  <td style={styles.td}>{r.name}</td>
                  <td style={styles.td}>{r.needed.toLocaleString("pt-BR")} {r.unit}</td>
                  <td style={styles.td}>{r.stock.toLocaleString("pt-BR")} {r.unit}</td>
                  <td style={{ ...styles.td, color: r.toBuy > 0 ? "var(--amber)" : "var(--green)", fontWeight: 700 }}>
                    {r.toBuy.toLocaleString("pt-BR")} {r.unit}
                  </td>
                  <td style={styles.td}>{r.leadTime} dias</td>
                  <td style={styles.td}>{r.dueDate ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const styles = {
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0", maxWidth: 640, lineHeight: 1.5 },
  generateBtn: {
    background: "var(--amber)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)",
    padding: "10px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
  },
  notice: {
    background: "rgba(232,163,61,0.1)",
    border: "1px solid var(--amber)",
    color: "var(--text)",
    borderRadius: "var(--radius)",
    padding: "12px 16px",
    fontSize: 13,
    lineHeight: 1.5,
    marginBottom: 20,
    maxWidth: 640,
  },
  dim: { color: "var(--text-dim)", fontSize: 14, maxWidth: 500 },
  tableWrap: { border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden", overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: "var(--text-dim)",
    padding: "10px 14px",
    background: "var(--panel)",
    borderBottom: "1px solid var(--line)",
    whiteSpace: "nowrap",
  },
  td: { padding: "10px 14px", fontSize: 13.5, background: "var(--panel)", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" },
};
