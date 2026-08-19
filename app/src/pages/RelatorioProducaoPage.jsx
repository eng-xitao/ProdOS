import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ChartCard, Empty, formatMonth, tooltipStyle } from "./RelatorioVendasPage";

export default function RelatorioProducaoPage() {
  const { company } = useAuth();
  const [loading, setLoading] = useState(true);
  const [byStage, setByStage] = useState([]);
  const [byProduct, setByProduct] = useState([]);
  const [byMonth, setByMonth] = useState([]);

  useEffect(() => {
    if (company?.id) calculate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  async function calculate() {
    setLoading(true);
    const { data: orders } = await supabase
      .from("production_orders")
      .select("quantity, due_date, created_at, production_stages:stage_id (name), products:product_id (sku, name)");

    const stageMap = {};
    const productMap = {};
    const monthMap = {};

    (orders ?? []).forEach((o) => {
      const stageLabel = o.production_stages?.name ?? "Sem etapa";
      stageMap[stageLabel] = (stageMap[stageLabel] ?? 0) + 1;

      const productLabel = o.products ? `${o.products.sku} — ${o.products.name}` : "—";
      productMap[productLabel] = (productMap[productLabel] ?? 0) + Number(o.quantity);

      if (o.created_at) {
        const key = o.created_at.slice(0, 7);
        monthMap[key] = (monthMap[key] ?? 0) + 1;
      }
    });

    setByStage(Object.entries(stageMap).map(([name, value]) => ({ name, value })));
    setByProduct(Object.entries(productMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8));
    setByMonth(Object.entries(monthMap).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => ({ month: formatMonth(key), value })));
    setLoading(false);
  }

  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <h1 style={styles.title}>Relatório de Produção</h1>
        <p style={styles.subtitle}>Baseado nas Ordens de Produção cadastradas.</p>
      </header>

      {loading ? (
        <p style={styles.dim}>Calculando...</p>
      ) : (
        <>
          <ChartCard title="Ordens abertas por mês (criação)">
            {byMonth.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={byMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2E3540" />
                  <XAxis dataKey="month" stroke="#9AA4B2" fontSize={12} />
                  <YAxis stroke="#9AA4B2" fontSize={12} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" fill="#E8A33D" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <div style={styles.grid2}>
            <ChartCard title="Ordens por etapa atual">
              {byStage.length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={byStage} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2E3540" />
                    <XAxis type="number" stroke="#9AA4B2" fontSize={11} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" stroke="#9AA4B2" fontSize={11} width={130} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="value" fill="#4FAE7E" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Quantidade produzida por produto">
              {byProduct.length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={byProduct} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2E3540" />
                    <XAxis type="number" stroke="#9AA4B2" fontSize={11} />
                    <YAxis type="category" dataKey="name" stroke="#9AA4B2" fontSize={11} width={140} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="value" fill="#E8A33D" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>
        </>
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
