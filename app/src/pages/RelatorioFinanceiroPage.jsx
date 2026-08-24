import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ChartCard, Empty, currency, tooltipStyle } from "./RelatorioVendasPage";
import DateRangeFilter from "../components/DateRangeFilter";

const BUCKETS = [
  { key: "0-30", label: "1 a 30 dias", min: 1, max: 30 },
  { key: "31-60", label: "31 a 60 dias", min: 31, max: 60 },
  { key: "61-90", label: "61 a 90 dias", min: 61, max: 90 },
  { key: "90+", label: "Mais de 90 dias", min: 91, max: Infinity },
];

/**
 * Relatório Financeiro (Inadimplência): visão de tendência que a
 * tela de Crédito e Cobrança não tinha — quanto está vencido, em
 * que faixa de atraso, e quem são os maiores devedores.
 */
export default function RelatorioFinanceiroPage() {
  const { company } = useAuth();
  const [loading, setLoading] = useState(true);
  const [totalOverdue, setTotalOverdue] = useState(0);
  const [byBucket, setByBucket] = useState([]);
  const [topDebtors, setTopDebtors] = useState([]);
  const [range, setRange] = useState({ from: "", to: "" });

  useEffect(() => {
    if (company?.id) calculate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id, range]);

  async function calculate() {
    setLoading(true);
    const { data: allEntries } = await supabase
      .from("financial_entries")
      .select("description, amount, due_date, customers:customer_id (name)")
      .eq("entry_type", "receita")
      .eq("paid", false);

    const entries = (allEntries ?? []).filter((e) => {
      if (!e.due_date) return true;
      if (range.from && e.due_date < range.from) return false;
      if (range.to && e.due_date > range.to) return false;
      return true;
    });

    const today = new Date();
    const overdue = entries
      .map((e) => {
        const due = new Date(e.due_date + "T00:00:00");
        const daysLate = Math.floor((today - due) / (1000 * 60 * 60 * 24));
        return { ...e, daysLate };
      })
      .filter((e) => e.daysLate > 0);

    const total = overdue.reduce((sum, e) => sum + Number(e.amount), 0);
    setTotalOverdue(total);

    const bucketMap = {};
    BUCKETS.forEach((b) => { bucketMap[b.label] = 0; });
    overdue.forEach((e) => {
      const bucket = BUCKETS.find((b) => e.daysLate >= b.min && e.daysLate <= b.max);
      if (bucket) bucketMap[bucket.label] += Number(e.amount);
    });
    setByBucket(BUCKETS.map((b) => ({ name: b.label, value: bucketMap[b.label] })));

    const debtorMap = {};
    overdue.forEach((e) => {
      const label = e.customers?.name ?? "Sem cliente";
      debtorMap[label] = (debtorMap[label] ?? 0) + Number(e.amount);
    });
    setTopDebtors(Object.entries(debtorMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8));

    setLoading(false);
  }

  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <h1 style={styles.title}>Relatório Financeiro — Inadimplência</h1>
        <p style={styles.subtitle}>
          Total vencido e não pago:{" "}
          <strong style={{ color: "var(--red)" }}>{currency(totalOverdue)}</strong>
        </p>
      </header>

      <DateRangeFilter onChange={setRange} />

      {loading ? (
        <p style={styles.dim}>Calculando...</p>
      ) : (
        <>
          <ChartCard title="Valor vencido por faixa de atraso">
            {byBucket.every((b) => b.value === 0) ? <Empty /> : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={byBucket}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E3E0D8" />
                  <XAxis dataKey="name" stroke="#8A8780" fontSize={12} />
                  <YAxis stroke="#8A8780" fontSize={12} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => currency(v)} />
                  <Bar dataKey="value" fill="#C9483D" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Maiores devedores">
            {topDebtors.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={topDebtors} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E3E0D8" />
                  <XAxis type="number" stroke="#8A8780" fontSize={11} />
                  <YAxis type="category" dataKey="name" stroke="#8A8780" fontSize={11} width={160} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => currency(v)} />
                  <Bar dataKey="value" fill="#C9483D" radius={[0, 4, 4, 0]} />
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
};
