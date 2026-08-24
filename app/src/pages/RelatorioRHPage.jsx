import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ChartCard, Empty, formatMonth, currency, tooltipStyle } from "./RelatorioVendasPage";
import DateRangeFilter from "../components/DateRangeFilter";

/**
 * Relatório de RH: primeira visão consolidada do custo de folha —
 * até agora o RH tinha os módulos de cálculo (Folha, 13º, Rescisão)
 * mas nenhuma tela juntava tudo numa visão de tendência.
 */
export default function RelatorioRHPage() {
  const { company } = useAuth();
  const [loading, setLoading] = useState(true);
  const [byMonth, setByMonth] = useState([]);
  const [byEmployee, setByEmployee] = useState([]);
  const [activeCount, setActiveCount] = useState(0);
  const [lastMonthCost, setLastMonthCost] = useState(0);
  const [range, setRange] = useState({ from: "", to: "" });

  useEffect(() => {
    if (company?.id) calculate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id, range]);

  async function calculate() {
    setLoading(true);
    const [{ data: allPayroll }, { data: employees }] = await Promise.all([
      supabase.from("payroll_entries").select("reference_month, net_salary, employees:employee_id (full_name)"),
      supabase.from("employees").select("id, status"),
    ]);

    const payroll = (allPayroll ?? []).filter((p) => {
      if (!p.reference_month) return true;
      if (range.from && p.reference_month < range.from) return false;
      if (range.to && p.reference_month > range.to) return false;
      return true;
    });

    setActiveCount((employees ?? []).filter((e) => e.status === "ativo").length);

    const monthMap = {};
    payroll.forEach((p) => {
      if (!p.reference_month) return;
      const key = p.reference_month.slice(0, 7);
      monthMap[key] = (monthMap[key] ?? 0) + Number(p.net_salary);
    });
    const monthRows = Object.entries(monthMap).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => ({ month: formatMonth(key), value }));
    setByMonth(monthRows);
    setLastMonthCost(monthRows.length > 0 ? monthRows[monthRows.length - 1].value : 0);

    const employeeMap = {};
    payroll.forEach((p) => {
      const label = p.employees?.full_name ?? "—";
      employeeMap[label] = (employeeMap[label] ?? 0) + Number(p.net_salary);
    });
    setByEmployee(Object.entries(employeeMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10));

    setLoading(false);
  }

  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <h1 style={styles.title}>Relatório de RH — Custo de Folha</h1>
        <p style={styles.subtitle}>Baseado nas folhas de pagamento já lançadas.</p>
      </header>

      <DateRangeFilter onChange={setRange} />

      {loading ? (
        <p style={styles.dim}>Calculando...</p>
      ) : (
        <>
          <div style={styles.summaryRow}>
            <div style={styles.summaryCard}>
              <span style={styles.summaryLabel}>Colaboradores ativos</span>
              <span style={styles.summaryValue}>{activeCount}</span>
            </div>
            <div style={styles.summaryCard}>
              <span style={styles.summaryLabel}>Custo do último mês lançado</span>
              <span style={styles.summaryValue}>{currency(lastMonthCost)}</span>
            </div>
          </div>

          <ChartCard title="Custo total de folha por mês (salário líquido)">
            {byMonth.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={byMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E3E0D8" />
                  <XAxis dataKey="month" stroke="#8A8780" fontSize={12} />
                  <YAxis stroke="#8A8780" fontSize={12} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => currency(v)} />
                  <Bar dataKey="value" fill="#2563EB" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Custo acumulado por colaborador">
            {byEmployee.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={byEmployee} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E3E0D8" />
                  <XAxis type="number" stroke="#8A8780" fontSize={11} />
                  <YAxis type="category" dataKey="name" stroke="#8A8780" fontSize={11} width={150} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => currency(v)} />
                  <Bar dataKey="value" fill="#2F9E68" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </>
      )}
    </div>
  );
}

const styles = {
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0" },
  dim: { color: "var(--text-dim)", fontSize: 13 },
  summaryRow: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, marginBottom: 20, maxWidth: 480 },
  summaryCard: { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: "14px 16px" },
  summaryLabel: { display: "block", fontSize: 11, color: "var(--text-dim)", fontWeight: 700, textTransform: "uppercase" },
  summaryValue: { display: "block", fontFamily: "var(--font-display)", fontSize: 22, marginTop: 4 },
};
