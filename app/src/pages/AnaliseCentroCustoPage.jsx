import { useEffect, useMemo, useState } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

const COLORS = ["#E8A33D", "#4FAE7E", "#5C8FD9", "#D9695F", "#9A6FD9", "#3DBFE8", "#D9A65C", "#7EC9AE"];

export default function AnaliseCentroCustoPage() {
  const { company } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [filterType, setFilterType] = useState("todos"); // todos | setor | projeto

  useEffect(() => {
    if (company?.id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("financial_entries")
      .select("amount, cost_centers:cost_center_id (id, name, type)")
      .eq("entry_type", "despesa");

    const grouped = {};
    (data ?? []).forEach((e) => {
      const cc = e.cost_centers;
      const key = cc?.id ?? "sem-centro";
      if (!grouped[key]) grouped[key] = { name: cc?.name ?? "Sem centro de custo", type: cc?.type ?? null, value: 0 };
      grouped[key].value += Number(e.amount);
    });

    setRows(Object.values(grouped).sort((a, b) => b.value - a.value));
    setLoading(false);
  }

  const filteredRows = useMemo(() => {
    if (filterType === "todos") return rows;
    return rows.filter((r) => r.type === filterType);
  }, [rows, filterType]);

  const total = filteredRows.reduce((sum, r) => sum + r.value, 0);
  const chartData = filteredRows.map((r) => ({ ...r, percent: total > 0 ? (r.value / total) * 100 : 0 }));

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={styles.title}>Análise por Centro de Custo</h1>
        <p style={styles.subtitle}>
          Todas as despesas lançadas no sistema, agrupadas pelo centro de custo (setor ou projeto)
          escolhido em cada lançamento. Cadastre novos centros em Cadastro → Centros de Custo.
        </p>
      </header>

      <div style={styles.filterRow}>
        {["todos", "setor", "projeto"].map((f) => (
          <button
            key={f}
            style={{ ...styles.filterBtn, ...(filterType === f ? styles.filterBtnActive : {}) }}
            onClick={() => setFilterType(f)}
            type="button"
          >
            {f === "todos" ? "Todos" : f === "setor" ? "Por Setor" : "Por Projeto"}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={styles.dim}>Calculando...</p>
      ) : chartData.length === 0 ? (
        <p style={styles.dim}>Nenhuma despesa lançada ainda com esse filtro.</p>
      ) : (
        <>
          <div style={styles.chartsRow}>
            <div style={styles.chartBox}>
              <span style={styles.chartLabel}>Distribuição</span>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}>
                    {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value) => `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={styles.chartBox}>
              <span style={styles.chartLabel}>Ranking (R$)</span>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 24 }}>
                  <XAxis type="number" tickFormatter={(v) => `R$ ${Number(v).toLocaleString("pt-BR")}`} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Centro de Custo</th>
                  <th style={styles.th}>Tipo</th>
                  <th style={styles.th}>Total gasto</th>
                  <th style={styles.th}>% do total</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((r, i) => (
                  <tr key={r.name}>
                    <td style={styles.td}>
                      <span style={{ ...styles.dot, background: COLORS[i % COLORS.length] }} />
                      {r.name}
                    </td>
                    <td style={styles.td}>{r.type ? (r.type === "setor" ? "Setor" : "Projeto") : "—"}</td>
                    <td style={styles.td}>R$ {r.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                    <td style={styles.td}>{r.percent.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td style={{ ...styles.td, fontWeight: 700 }} colSpan={2}>Total</td>
                  <td style={{ ...styles.td, fontWeight: 700 }}>R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                  <td style={{ ...styles.td, fontWeight: 700 }}>100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

const styles = {
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0", maxWidth: 680, lineHeight: 1.5 },
  dim: { color: "var(--text-dim)", fontSize: 14 },
  filterRow: { display: "flex", gap: 8, marginBottom: 20 },
  filterBtn: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "7px 14px", fontSize: 12.5, fontWeight: 600, color: "var(--text-dim)", cursor: "pointer",
  },
  filterBtnActive: { background: "var(--amber)", color: "#FFFFFF", borderColor: "var(--amber)" },
  chartsRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, marginBottom: 24 },
  chartBox: { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 16 },
  chartLabel: { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-dim)", fontWeight: 700 },
  tableWrap: { border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden", maxWidth: 760 },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em",
    color: "var(--text-dim)", padding: "10px 14px", background: "var(--panel)", borderBottom: "1px solid var(--line)",
  },
  td: { padding: "10px 14px", fontSize: 13.5, background: "var(--panel)", borderBottom: "1px solid var(--line)" },
  dot: { display: "inline-block", width: 8, height: 8, borderRadius: "50%", marginRight: 8 },
};
