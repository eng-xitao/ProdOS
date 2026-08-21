import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ChartCard, Empty, currency, tooltipStyle } from "./RelatorioVendasPage";

const TYPE_LABEL = { componente: "Componente", materia_prima: "Matéria-prima", insumo: "Insumo", maquina: "Máquina" };
const COLORS = ["#2F9E68", "#2563EB", "#E8A33D", "#9A6FD9"];

/**
 * Relatório de estoque de tudo que NÃO é produto acabado — matéria-
 * prima, insumos, máquinas e componentes. Esses materiais existem
 * porque fazem parte da transformação do produto acabado (via BOM),
 * então ficam separados do relatório de Produto Acabado.
 */
export default function RelatorioEstoqueMateriaisPage() {
  const { company } = useAuth();
  const [loading, setLoading] = useState(true);
  const [totalValue, setTotalValue] = useState(0);
  const [byClass, setByClass] = useState([]);
  const [topByValue, setTopByValue] = useState([]);
  const [zeroStock, setZeroStock] = useState([]);

  useEffect(() => {
    if (company?.id) calculate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  async function calculate() {
    setLoading(true);
    const { data: products } = await supabase
      .from("products")
      .select("sku, name, type, stock_quantity, cost, unit")
      .neq("type", "acabado");

    let total = 0;
    const classMap = {};
    const zeros = [];

    const rows = (products ?? []).map((p) => {
      const value = Number(p.stock_quantity) * Number(p.cost);
      total += value;
      classMap[p.type] = (classMap[p.type] ?? 0) + value;
      if (Number(p.stock_quantity) === 0) zeros.push(p);
      return { name: `${p.sku} — ${p.name}`, value, type: p.type };
    }).sort((a, b) => b.value - a.value).slice(0, 8);

    setTotalValue(total);
    setTopByValue(rows);
    setByClass(Object.entries(classMap).map(([type, value]) => ({ name: TYPE_LABEL[type] ?? type, value })));
    setZeroStock(zeros);
    setLoading(false);
  }

  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <h1 style={styles.title}>Relatório de Estoque — Materiais em Geral</h1>
        <p style={styles.subtitle}>
          Matéria-prima, insumos, máquinas e componentes — entram na transformação do produto
          acabado (via estrutura/BOM). Valor total em estoque:{" "}
          <strong style={{ color: "var(--amber)" }}>{currency(totalValue)}</strong>
        </p>
      </header>

      {loading ? (
        <p style={styles.dim}>Calculando...</p>
      ) : (
        <>
          <div style={styles.grid2}>
            <ChartCard title="Top materiais por valor em estoque">
              {topByValue.length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={topByValue} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E3E0D8" />
                    <XAxis type="number" stroke="#8A8780" fontSize={11} />
                    <YAxis type="category" dataKey="name" stroke="#8A8780" fontSize={11} width={160} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => currency(v)} />
                    <Bar dataKey="value" fill="#2F9E68" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Distribuição por classe">
              {byClass.length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={byClass} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                      {byClass.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => currency(v)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Materiais com estoque zerado</h2>
            {zeroStock.length === 0 ? (
              <p style={styles.dim}>Nenhum material zerado — bom sinal.</p>
            ) : (
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead><tr><th style={styles.th}>SKU</th><th style={styles.th}>Nome</th><th style={styles.th}>Classe</th></tr></thead>
                  <tbody>
                    {zeroStock.map((p, i) => (
                      <tr key={i}>
                        <td style={styles.td}>{p.sku}</td>
                        <td style={styles.td}>{p.name}</td>
                        <td style={styles.td}>{TYPE_LABEL[p.type] ?? p.type}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const styles = {
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0", maxWidth: 680, lineHeight: 1.5 },
  dim: { color: "var(--text-dim)", fontSize: 13 },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 },
  card: { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 20 },
  cardTitle: { fontFamily: "var(--font-display)", fontSize: 15, margin: "0 0 14px" },
  tableWrap: { border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden", overflowX: "auto", maxWidth: 600 },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em",
    color: "var(--text-dim)", padding: "10px 14px", background: "var(--panel-2)", borderBottom: "1px solid var(--line)",
  },
  td: { padding: "10px 14px", fontSize: 13.5, borderBottom: "1px solid var(--line)" },
};
