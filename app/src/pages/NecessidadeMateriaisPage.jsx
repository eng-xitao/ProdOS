import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

/**
 * MRP I — explode a estrutura (BOM) de cada ordem de produção aberta,
 * soma a necessidade por componente, e compara com o estoque atual
 * de cada componente para sugerir o que falta comprar/produzir.
 */
export default function NecessidadeMateriaisPage() {
  const { company } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [ordersWithoutBom, setOrdersWithoutBom] = useState(0);

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

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={styles.title}>Necessidade de Materiais (MRP I)</h1>
        <p style={styles.subtitle}>
          Calculado a partir das ordens de produção abertas, da estrutura (BOM) de cada produto
          e do estoque atual. Mostra o que falta comprar ou produzir para atender a demanda.
        </p>
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
