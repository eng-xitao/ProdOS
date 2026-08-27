import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from "recharts";
import { Empty, currency, tooltipStyle } from "./RelatorioVendasPage";
import DateRangeFilter from "../components/DateRangeFilter";
import PrintHeader from "../components/PrintHeader";
import PrintButton, { rangeLabel } from "../components/PrintButton";

const CLASS_COLOR = { A: "#2F9E68", B: "#2563EB", C: "#C9483D" };

export default function CurvaABCPage() {
  const { company } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({ A: 0, B: 0, C: 0 });
  const [range, setRange] = useState({ from: "", to: "" });

  useEffect(() => {
    if (company?.id) calculate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id, range]);

  async function calculate() {
    setLoading(true);
    const { data: allItems } = await supabase
      .from("sales_order_items")
      .select("quantity, unit_price, products:product_id (sku, name), sales_orders:sales_order_id (order_date)");

    const items = (allItems ?? []).filter((it) => {
      const date = it.sales_orders?.order_date;
      if (!date) return true;
      if (range.from && date < range.from) return false;
      if (range.to && date > range.to) return false;
      return true;
    });

    const productMap = {};
    items.forEach((it) => {
      const label = it.products ? `${it.products.sku} — ${it.products.name}` : "—";
      const value = Number(it.quantity) * Number(it.unit_price);
      productMap[label] = (productMap[label] ?? 0) + value;
    });

    const sorted = Object.entries(productMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const total = sorted.reduce((sum, r) => sum + r.value, 0);
    let cumulative = 0;
    const classified = sorted.map((r) => {
      cumulative += r.value;
      const cumulativePercent = total > 0 ? (cumulative / total) * 100 : 0;
      const cls = cumulativePercent <= 80 ? "A" : cumulativePercent <= 95 ? "B" : "C";
      return { ...r, percent: total > 0 ? (r.value / total) * 100 : 0, cumulativePercent, class: cls };
    });

    const counts = { A: 0, B: 0, C: 0 };
    classified.forEach((r) => { counts[r.class] += 1; });

    setRows(classified);
    setSummary(counts);
    setLoading(false);
  }

  return (
    <div>
      <header style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }} className="no-print">
        <div>
          <h1 style={styles.title}>Curva ABC de Produtos</h1>
          <p style={styles.subtitle}>
            Classificação por valor vendido (soma de quantidade × preço nos Pedidos de Venda).
            Classe A = até 80% do valor acumulado, B = até 95%, C = o restante.
          </p>
        </div>
        <PrintButton />
      </header>
      <PrintHeader title="Curva ABC de Produtos" subtitle={rangeLabel(range)} />

      <DateRangeFilter onChange={setRange} />

      {loading ? (
        <p style={styles.dim}>Calculando...</p>
      ) : rows.length === 0 ? (
        <Empty />
      ) : (
        <>
          <div style={styles.summaryRow}>
            {["A", "B", "C"].map((cls) => (
              <div key={cls} style={{ ...styles.summaryCard, borderColor: CLASS_COLOR[cls] }}>
                <div style={{ ...styles.summaryClass, color: CLASS_COLOR[cls] }}>Classe {cls}</div>
                <div style={styles.summaryCount}>{summary[cls]} produto{summary[cls] !== 1 ? "s" : ""}</div>
              </div>
            ))}
          </div>

          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Top 15 por valor vendido</h2>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={rows.slice(0, 15)} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E3E0D8" />
                <XAxis type="number" stroke="#8A8780" fontSize={11} />
                <YAxis type="category" dataKey="name" stroke="#8A8780" fontSize={10.5} width={150} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => currency(v)} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {rows.slice(0, 15).map((r, i) => <Cell key={i} fill={CLASS_COLOR[r.class]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Produto</th>
                  <th style={styles.th}>Valor vendido</th>
                  <th style={styles.th}>% do total</th>
                  <th style={styles.th}>% acumulado</th>
                  <th style={styles.th}>Classe</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.name}>
                    <td style={styles.td}>{r.name}</td>
                    <td style={styles.td}>{currency(r.value)}</td>
                    <td style={styles.td}>{r.percent.toFixed(1)}%</td>
                    <td style={styles.td}>{r.cumulativePercent.toFixed(1)}%</td>
                    <td style={styles.td}>
                      <span style={{ ...styles.badge, background: `${CLASS_COLOR[r.class]}26`, color: CLASS_COLOR[r.class] }}>
                        {r.class}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

const styles = {
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0", maxWidth: 660, lineHeight: 1.5 },
  dim: { color: "var(--text-dim)", fontSize: 13 },
  summaryRow: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 16, maxWidth: 640 },
  summaryCard: {
    background: "var(--panel)", border: "1px solid var(--line)", borderLeft: "3px solid",
    borderRadius: "var(--radius)", padding: "14px 16px",
  },
  summaryClass: { fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700 },
  summaryCount: { color: "var(--text-dim)", fontSize: 12.5, marginTop: 4 },
  card: { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 20, marginBottom: 16 },
  cardTitle: { fontFamily: "var(--font-display)", fontSize: 15, margin: "0 0 14px" },
  tableWrap: { border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden", overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em",
    color: "var(--text-dim)", padding: "10px 14px", background: "var(--panel)", borderBottom: "1px solid var(--line)",
  },
  td: { padding: "10px 14px", fontSize: 13.5, background: "var(--panel)", borderBottom: "1px solid var(--line)" },
  badge: { padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 },
};
