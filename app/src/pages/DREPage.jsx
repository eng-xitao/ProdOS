import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

const COLORS = ["#E8A33D", "#4FAE7E", "#5C8FD9", "#D9695F", "#9A6FD9", "#3DBFE8", "#D9A65C", "#7EC9AE"];

/**
 * DRE simplificado: agrupa despesas pelos Centros de Custo /
 * Plano de Contas já cadastrados, e mostra a evolução mensal de
 * receita x despesa. Não substitui um DRE contábil completo (sem
 * regime de competência formal), mas dá uma visão real do negócio,
 * com gráficos pra apoiar decisão.
 */
export default function DREPage() {
  const { company } = useAuth();
  const [loading, setLoading] = useState(true);
  const [totalReceita, setTotalReceita] = useState(0);
  const [despesasByCategory, setDespesasByCategory] = useState([]);
  const [totalDespesa, setTotalDespesa] = useState(0);
  const [monthlyTrend, setMonthlyTrend] = useState([]);

  useEffect(() => {
    if (company?.id) calculate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  async function calculate() {
    setLoading(true);
    const { data } = await supabase
      .from("financial_entries")
      .select("entry_type, amount, due_date, purchase_order_id, employee_id, cost_centers:cost_center_id (name), chart_of_accounts:account_id (code, name)");

    let receita = 0;
    const despesaMap = {};
    const monthMap = {};

    (data ?? []).forEach((e) => {
      const amount = Number(e.amount);
      if (e.due_date) {
        const key = e.due_date.slice(0, 7);
        if (!monthMap[key]) monthMap[key] = { receita: 0, despesa: 0 };
        if (e.entry_type === "receita") monthMap[key].receita += amount;
        else monthMap[key].despesa += amount;
      }

      if (e.entry_type === "receita") {
        receita += amount;
      } else {
        const accountLabel = e.chart_of_accounts ? `${e.chart_of_accounts.code ? e.chart_of_accounts.code + " — " : ""}${e.chart_of_accounts.name}` : null;
        const label = accountLabel
          ?? e.cost_centers?.name
          ?? (e.purchase_order_id ? "Compras / Materiais (sem classificação)"
            : e.employee_id ? "Pessoal — Folha, 13º e Rescisões (sem classificação)"
            : "Outras despesas (sem classificação)");
        despesaMap[label] = (despesaMap[label] ?? 0) + amount;
      }
    });

    const despesaRows = Object.entries(despesaMap)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);

    const trendKeys = Object.keys(monthMap).sort();
    const trend = trendKeys.map((key) => ({ key, label: formatMonthShort(key), ...monthMap[key] }));

    setTotalReceita(receita);
    setDespesasByCategory(despesaRows);
    setTotalDespesa(despesaRows.reduce((sum, d) => sum + d.value, 0));
    setMonthlyTrend(trend);
    setLoading(false);
  }

  const resultado = totalReceita - totalDespesa;
  const pieData = despesasByCategory.map((d) => ({ name: d.label, value: d.value }));

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={styles.title}>DRE Gerencial</h1>
        <p style={styles.subtitle}>
          Receita total menos despesas agrupadas por Centro de Custo / Plano de Contas, com a
          evolução mês a mês. Uma visão simplificada, baseada no que está lançado no sistema —
          não substitui um DRE contábil formal.
        </p>
      </header>

      {loading ? (
        <p style={styles.dim}>Calculando...</p>
      ) : (
        <>
          <div style={styles.chartsRow}>
            {monthlyTrend.length > 0 && (
              <div style={styles.chartBox}>
                <span style={styles.chartLabel}>Receita x Despesa por mês</span>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `R$${Number(v).toLocaleString("pt-BR")}`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value) => `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="receita" name="Receita" fill="var(--green)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="despesa" name="Despesa" fill="var(--red)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {pieData.length > 0 && (
              <div style={styles.chartBox}>
                <span style={styles.chartLabel}>Despesas por categoria</span>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}>
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value) => `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div style={styles.report}>
            <div style={styles.line}>
              <span style={styles.lineLabel}>Receita Bruta</span>
              <span style={{ ...styles.lineValue, color: "var(--green)" }}>
                R$ {totalReceita.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div style={styles.sectionTitle}>Despesas por Conta / Centro de Custo</div>
            {despesasByCategory.length === 0 ? (
              <p style={styles.dim}>Nenhuma despesa lançada ainda.</p>
            ) : (
              despesasByCategory.map((d) => (
                <div key={d.label} style={styles.subLine}>
                  <span style={styles.subLineLabel}>{d.label}</span>
                  <span style={{ ...styles.subLineValue, color: "var(--red)" }}>
                    − R$ {d.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))
            )}

            <div style={styles.line}>
              <span style={styles.lineLabel}>Total de Despesas</span>
              <span style={{ ...styles.lineValue, color: "var(--red)" }}>
                − R$ {totalDespesa.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div style={styles.resultLine}>
              <span style={styles.resultLabel}>Resultado</span>
              <span style={{ ...styles.resultValue, color: resultado >= 0 ? "var(--green)" : "var(--red)" }}>
                R$ {resultado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function formatMonthShort(key) {
  const [year, month] = key.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

const styles = {
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0", maxWidth: 680, lineHeight: 1.5 },
  dim: { color: "var(--text-dim)", fontSize: 14 },
  chartsRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, marginBottom: 24 },
  chartBox: { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 16 },
  chartLabel: { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-dim)", fontWeight: 700 },
  report: {
    background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: 24, maxWidth: 560,
  },
  line: {
    display: "flex", justifyContent: "space-between", padding: "10px 0",
    borderBottom: "1px solid var(--line)", fontSize: 14, fontWeight: 700,
  },
  lineLabel: { color: "var(--text)" },
  lineValue: {},
  sectionTitle: {
    fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-dim)",
    marginTop: 18, marginBottom: 8, fontWeight: 700,
  },
  subLine: { display: "flex", justifyContent: "space-between", padding: "6px 0 6px 12px", fontSize: 13 },
  subLineLabel: { color: "var(--text-dim)" },
  subLineValue: {},
  resultLine: {
    display: "flex", justifyContent: "space-between", padding: "16px 0 0", marginTop: 12,
    borderTop: "2px solid var(--amber)", fontSize: 17, fontWeight: 700,
  },
  resultLabel: { fontFamily: "var(--font-display)" },
  resultValue: { fontFamily: "var(--font-display)" },
};
