import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

/**
 * Custo Padrão & Margem — calcula o custo de cada produto acabado
 * explodindo sua estrutura (BOM) recursivamente (componente que é
 * feito de outros componentes também entra na conta), e cruza com
 * o preço de venda para mostrar a margem real.
 */
export default function CustosPage() {
  const { company } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (company?.id) calculate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  async function calculate() {
    setLoading(true);

    const [{ data: products }, { data: components }] = await Promise.all([
      supabase.from("products").select("id, sku, name, type, cost, sale_price"),
      supabase.from("product_components").select("parent_product_id, component_id, quantity"),
    ]);

    const productById = Object.fromEntries((products ?? []).map((p) => [p.id, p]));
    const componentsByParent = {};
    (components ?? []).forEach((c) => {
      if (!componentsByParent[c.parent_product_id]) componentsByParent[c.parent_product_id] = [];
      componentsByParent[c.parent_product_id].push(c);
    });

    const cache = {};
    function computeStandardCost(productId, visited) {
      if (visited.has(productId)) return 0; // evita loop em BOM circular
      if (cache[productId] !== undefined) return cache[productId];

      const product = productById[productId];
      if (!product) return 0;

      const bom = componentsByParent[productId];
      let cost;
      if (!bom || bom.length === 0) {
        cost = Number(product.cost ?? 0); // sem estrutura: usa o custo informado
      } else {
        const nextVisited = new Set(visited).add(productId);
        cost = bom.reduce((sum, c) => sum + Number(c.quantity) * computeStandardCost(c.component_id, nextVisited), 0);
      }
      cache[productId] = cost;
      return cost;
    }

    const result = (products ?? [])
      .map((p) => {
        const standardCost = computeStandardCost(p.id, new Set());
        const salePrice = Number(p.sale_price ?? 0);
        const marginValue = salePrice - standardCost;
        const marginPercent = salePrice > 0 ? (marginValue / salePrice) * 100 : null;
        return { ...p, standardCost, salePrice, marginValue, marginPercent };
      })
      .sort((a, b) => (a.marginPercent ?? 999) - (b.marginPercent ?? 999));

    setRows(result);
    setLoading(false);
  }

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={styles.title}>Custo Padrão & Margem</h1>
        <p style={styles.subtitle}>
          Custo calculado a partir da estrutura (BOM) de cada produto, cruzado com o preço de
          venda cadastrado. Produtos com menor margem aparecem primeiro.
        </p>
      </header>

      {loading ? (
        <p style={styles.dim}>Calculando...</p>
      ) : rows.length === 0 ? (
        <p style={styles.dim}>Nenhum produto cadastrado ainda.</p>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>SKU</th>
                <th style={styles.th}>Produto</th>
                <th style={styles.th}>Custo padrão</th>
                <th style={styles.th}>Preço de venda</th>
                <th style={styles.th}>Margem (R$)</th>
                <th style={styles.th}>Margem (%)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={styles.td}>{r.sku}</td>
                  <td style={styles.td}>{r.name}</td>
                  <td style={styles.td}>R$ {r.standardCost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                  <td style={styles.td}>R$ {r.salePrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                  <td style={{ ...styles.td, color: r.marginValue >= 0 ? "var(--green)" : "var(--red)", fontWeight: 700 }}>
                    R$ {r.marginValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ ...styles.td, ...marginColor(r.marginPercent), fontWeight: 700 }}>
                    {r.marginPercent === null ? "—" : `${r.marginPercent.toFixed(1)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function marginColor(percent) {
  if (percent === null) return { color: "var(--text-dim)" };
  if (percent < 0) return { color: "var(--red)" };
  if (percent < 20) return { color: "var(--amber)" };
  return { color: "var(--green)" };
}

const styles = {
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0", maxWidth: 640, lineHeight: 1.5 },
  dim: { color: "var(--text-dim)", fontSize: 14 },
  tableWrap: { border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden", overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em",
    color: "var(--text-dim)", padding: "10px 14px", background: "var(--panel)", borderBottom: "1px solid var(--line)",
  },
  td: { padding: "10px 14px", fontSize: 13.5, background: "var(--panel)", borderBottom: "1px solid var(--line)" },
};
