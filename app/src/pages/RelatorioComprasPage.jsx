import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ChartCard, Empty, formatMonth, currency, tooltipStyle } from "./RelatorioVendasPage";

export default function RelatorioComprasPage() {
  const { company } = useAuth();
  const [loading, setLoading] = useState(true);
  const [byMonth, setByMonth] = useState([]);
  const [topSuppliers, setTopSuppliers] = useState([]);

  useEffect(() => {
    if (company?.id) calculate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  async function calculate() {
    setLoading(true);
    const { data: orders } = await supabase
      .from("purchase_orders")
      .select("order_date, total_value, suppliers:supplier_id (name)");

    const monthMap = {};
    const supplierMap = {};
    (orders ?? []).forEach((o) => {
      if (o.order_date) {
        const key = o.order_date.slice(0, 7);
        monthMap[key] = (monthMap[key] ?? 0) + Number(o.total_value);
      }
      const label = o.suppliers?.name ?? "Sem fornecedor";
      supplierMap[label] = (supplierMap[label] ?? 0) + Number(o.total_value);
    });

    setByMonth(Object.entries(monthMap).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => ({ month: formatMonth(key), value })));
    setTopSuppliers(Object.entries(supplierMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8));
    setLoading(false);
  }

  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <h1 style={styles.title}>Relatório de Compras</h1>
        <p style={styles.subtitle}>Baseado nos Pedidos de Compra cadastrados.</p>
      </header>

      {loading ? (
        <p style={styles.dim}>Calculando...</p>
      ) : (
        <>
          <ChartCard title="Compras por mês">
            {byMonth.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={byMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E3E0D8" />
                  <XAxis dataKey="month" stroke="#8A8780" fontSize={12} />
                  <YAxis stroke="#8A8780" fontSize={12} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => currency(v)} />
                  <Bar dataKey="value" fill="#C9483D" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Top fornecedores (por valor)">
            {topSuppliers.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={topSuppliers} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E3E0D8" />
                  <XAxis type="number" stroke="#8A8780" fontSize={11} />
                  <YAxis type="category" dataKey="name" stroke="#8A8780" fontSize={11} width={160} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => currency(v)} />
                  <Bar dataKey="value" fill="#2563EB" radius={[0, 4, 4, 0]} />
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
