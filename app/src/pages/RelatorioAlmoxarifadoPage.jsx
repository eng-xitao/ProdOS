import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ChartCard, Empty, currency, tooltipStyle } from "./RelatorioVendasPage";

export default function RelatorioAlmoxarifadoPage() {
  const { company } = useAuth();
  const [loading, setLoading] = useState(true);
  const [byWarehouseValue, setByWarehouseValue] = useState([]);
  const [byWarehouseCount, setByWarehouseCount] = useState([]);

  useEffect(() => {
    if (company?.id) calculate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  async function calculate() {
    setLoading(true);
    const { data: levels } = await supabase
      .from("stock_levels")
      .select("quantity, warehouses:warehouse_id (name), products:product_id (cost)");

    const valueMap = {};
    const countMap = {};
    (levels ?? []).forEach((l) => {
      const label = l.warehouses?.name ?? "Sem local";
      const value = Number(l.quantity) * Number(l.products?.cost ?? 0);
      valueMap[label] = (valueMap[label] ?? 0) + value;
      if (Number(l.quantity) > 0) countMap[label] = (countMap[label] ?? 0) + 1;
    });

    setByWarehouseValue(Object.entries(valueMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value));
    setByWarehouseCount(Object.entries(countMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value));
    setLoading(false);
  }

  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <h1 style={styles.title}>Relatório de Almoxarifado</h1>
        <p style={styles.subtitle}>Valor e distribuição de itens por local de estoque.</p>
      </header>

      {loading ? (
        <p style={styles.dim}>Calculando...</p>
      ) : (
        <div style={styles.grid2}>
          <ChartCard title="Valor em estoque por almoxarifado">
            {byWarehouseValue.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={byWarehouseValue} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E3E0D8" />
                  <XAxis type="number" stroke="#8A8780" fontSize={11} />
                  <YAxis type="category" dataKey="name" stroke="#8A8780" fontSize={11} width={150} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => currency(v)} />
                  <Bar dataKey="value" fill="#2F9E68" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Itens distintos por almoxarifado">
            {byWarehouseCount.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={byWarehouseCount} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E3E0D8" />
                  <XAxis type="number" stroke="#8A8780" fontSize={11} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" stroke="#8A8780" fontSize={11} width={150} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" fill="#2563EB" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      )}
    </div>
  );
}

const styles = {
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0" },
  dim: { color: "var(--text-dim)", fontSize: 13 },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
};
