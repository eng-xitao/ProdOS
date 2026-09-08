import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

function abcClass(products, product) {
  const values = products.map((p) => Number(p.stock_quantity ?? 0) * Number(p.sale_price ?? 0));
  const total = values.reduce((s, v) => s + v, 0);
  const value = Number(product.stock_quantity ?? 0) * Number(product.sale_price ?? 0);
  if (total <= 0 || value <= 0) return "—";
  const sorted = products.map((p, i) => ({ id: p.id, value: values[i] })).sort((a, b) => b.value - a.value);
  let accumulated = 0;
  for (const item of sorted) {
    accumulated += item.value;
    if (item.id === product.id) {
      const pct = accumulated / total;
      return pct <= 0.8 ? "A" : pct <= 0.95 ? "B" : "C";
    }
  }
  return "—";
}

export default function EstoquePage() {
  const { company } = useAuthSafe();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState("");
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (company?.id) load();
  }, [company?.id]);

  async function load() {
    setLoading(true);
    setError("");
    const { data, error: e } = await supabase
      .from("products")
      .select("id, sku, name, unit, stock_quantity, min_stock, reorder_point, max_stock, sale_price, active")
      .eq("company_id", company.id)
      .eq("type", "acabado")
      .eq("active", true)
      .order("name");
    if (e) setError(e.message);
    else setProducts(data ?? []);
    setLoading(false);
  }

  const totalValue = products.reduce((sum, p) => sum + Number(p.stock_quantity ?? 0) * Number(p.sale_price ?? 0), 0);

  function printReport() {
    setPrinting(true);
    setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 50);
  }

  return (
    <div className="stock-page">
      <style>{`
        @media print {
          body { background: #fff !important; }
          .app-sidebar, nav, aside, header button, .no-print { display: none !important; }
          .stock-page { padding: 0 !important; }
          .print-only { display: block !important; }
          .stock-table { border: 1px solid #bbb !important; }
          .stock-table th, .stock-table td { color: #111 !important; background: #fff !important; border-color: #ccc !important; }
        }
        .print-only { display: none; }
      `}</style>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Estoque — Produto Acabado</h1>
          <p style={styles.subtitle}>
            Controle de produto acabado com estoque mínimo, ponto de pedido, estoque máximo e classificação ABC.
          </p>
        </div>
        <button type="button" onClick={printReport} style={styles.printBtn} className="no-print">🖨 Imprimir</button>
      </header>

      <div className="print-only" style={styles.printHeader}>
        <strong>ProdOS</strong>
        <span>Relatório de Estoque — Produto Acabado</span>
        <span>Emitido em {new Date().toLocaleString("pt-BR")}</span>
      </div>

      <div className="no-print" style={styles.summary}>
        <span><strong>{products.length}</strong> produtos ativos</span>
        <span>Valor em estoque: <strong>R$ {totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></span>
      </div>

      {error && <div style={styles.error}>{error}</div>}
      {loading ? (
        <p style={styles.dim}>Carregando...</p>
      ) : products.length === 0 ? (
        <p style={styles.dim}>Nenhum produto acabado ativo cadastrado.</p>
      ) : (
        <div className="stock-table" style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>SKU</th>
                <th style={styles.th}>Produto</th>
                <th style={styles.th}>Disponível</th>
                <th style={styles.th}>Estoque mínimo</th>
                <th style={styles.th}>Ponto de pedido</th>
                <th style={styles.th}>Estoque máximo</th>
                <th style={styles.th}>Curva ABC</th>
                <th style={styles.th}>Situação</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const qty = Number(p.stock_quantity ?? 0);
                const min = Number(p.min_stock ?? 0);
                const reorder = Number(p.reorder_point ?? 0);
                const max = Number(p.max_stock ?? 0);
                const abc = abcClass(products, p);
                const situation = qty === 0 ? "zerado" : min > 0 && qty < min ? "baixo" : "ok";
                return (
                  <tr key={p.id}>
                    <td style={styles.td}>{p.sku}</td>
                    <td style={styles.td}>{p.name}</td>
                    <td style={styles.td}>{qty.toLocaleString("pt-BR")} {p.unit}</td>
                    <td style={styles.td}>{min > 0 ? `${min.toLocaleString("pt-BR")} ${p.unit}` : "—"}</td>
                    <td style={styles.td}>{reorder > 0 ? `${reorder.toLocaleString("pt-BR")} ${p.unit}` : "—"}</td>
                    <td style={styles.td}>{max > 0 ? `${max.toLocaleString("pt-BR")} ${p.unit}` : "—"}</td>
                    <td style={styles.td}><strong>{abc}</strong></td>
                    <td style={styles.td}>
                      <span style={{ ...styles.badge, ...situationStyle(situation) }}>
                        {situation === "zerado" ? "Zerado" : situation === "baixo" ? "Abaixo do mínimo" : "OK"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="no-print" style={styles.note}>A classificação ABC exibida é calculada pelo valor atualmente mantido em estoque (quantidade × preço de venda).</p>
    </div>
  );
}

function useAuthSafe() {
  const { useAuth } = require("../lib/AuthContext");
  return useAuth();
}

function situationStyle(s) {
  if (s === "zerado") return { background: "rgba(217,105,95,0.15)", color: "var(--red)" };
  if (s === "baixo") return { background: "rgba(232,163,61,0.15)", color: "var(--amber)" };
  return { background: "rgba(79,174,126,0.15)", color: "var(--green)" };
}

const styles = {
  header: { marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 },
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0", maxWidth: 820, lineHeight: 1.5 },
  printBtn: { minHeight: 40, padding: "0 16px", border: 0, borderRadius: 8, background: "var(--blue)", color: "#fff", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" },
  summary: { display: "flex", gap: 24, marginBottom: 16, padding: "12px 14px", background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)", fontSize: 13 },
  printHeader: { paddingBottom: 16, marginBottom: 16, borderBottom: "2px solid #222", fontSize: 12, lineHeight: 1.6 },
  dim: { color: "var(--text-dim)", fontSize: 14 },
  error: { background: "rgba(217,105,95,0.12)", border: "1px solid var(--red)", color: "var(--red)", borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 13, marginBottom: 12 },
  tableWrap: { border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden", overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-dim)", padding: "10px 12px", background: "var(--panel)", borderBottom: "1px solid var(--line)" },
  td: { padding: "10px 12px", fontSize: 13, background: "var(--panel)", borderBottom: "1px solid var(--line)" },
  badge: { padding: "3px 10px", borderRadius: 20, fontSize: 11.5, fontWeight: 700 },
  note: { marginTop: 10, color: "var(--text-dim)", fontSize: 11.5 },
};
