import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import DateRangeFilter from "../components/DateRangeFilter";
import PrintHeader from "../components/PrintHeader";
import PrintButton, { rangeLabel } from "../components/PrintButton";

export default function RelatorioVendasPage() {
  const { company } = useAuth();
  const [loading, setLoading] = useState(true);
  const [byMonth, setByMonth] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [topCustomers, setTopCustomers] = useState([]);
  const [range, setRange] = useState({ from: "", to: "" });

  useEffect(() => {
    if (company?.id) calculate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id, range]);

  async function calculate() {
    setLoading(true);

    const [{ data: allOrders }, { data: items }] = await Promise.all([
      supabase.from("sales_orders").select("id, order_date, total_value, customer_id, customers:customer_id (name)"),
      supabase.from("sales_order_items").select("sales_order_id, product_id, quantity, unit_price, products:product_id (sku, name)"),
    ]);

    const orders = (allOrders ?? []).filter((o) => {
      if (!o.order_date) return true;
      if (range.from && o.order_date < range.from) return false;
      if (range.to && o.order_date > range.to) return false;
      return true;
    });
    const orderIds = new Set(orders.map((o) => o.id));
    const filteredItems = (items ?? []).filter((it) => orderIds.has(it.sales_order_id));

    // Vendas por mês
    const monthMap = {};
    orders.forEach((o) => {
      if (!o.order_date) return;
      const key = o.order_date.slice(0, 7);
      monthMap[key] = (monthMap[key] ?? 0) + Number(o.total_value);
    });
    const monthRows = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => ({ month: formatMonth(key), value }));

    // Top produtos por valor vendido
    const productMap = {};
    filteredItems.forEach((it) => {
      const label = it.products ? `${it.products.sku} — ${it.products.name}` : "—";
      const value = Number(it.quantity) * Number(it.unit_price);
      productMap[label] = (productMap[label] ?? 0) + value;
    });
    const productRows = Object.entries(productMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    // Top clientes por valor total
    const customerMap = {};
    orders.forEach((o) => {
      const label = o.customers?.name ?? "Sem cliente";
      customerMap[label] = (customerMap[label] ?? 0) + Number(o.total_value);
    });
    const customerRows = Object.entries(customerMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    setByMonth(monthRows);
    setTopProducts(productRows);
    setTopCustomers(customerRows);
    setLoading(false);
  }

  return (
    <div>
      <header style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }} className="no-print">
        <div>
          <h1 style={styles.title}>Relatório de Vendas</h1>
          <p style={styles.subtitle}>Baseado nos Pedidos de Venda cadastrados.</p>
        </div>
        <PrintButton />
      </header>
      <PrintHeader title="Relatório de Vendas" subtitle={rangeLabel(range)} />

      <DateRangeFilter onChange={setRange} />

      {loading ? (
        <p style={styles.dim}>Calculando...</p>
      ) : (
        <>
          <ChartCard title="Vendas por mês">
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

          <div style={styles.grid2}>
            <ChartCard title="Top produtos (por valor)">
              {topProducts.length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={topProducts} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E3E0D8" />
                    <XAxis type="number" stroke="#8A8780" fontSize={11} />
                    <YAxis type="category" dataKey="name" stroke="#8A8780" fontSize={11} width={140} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => currency(v)} />
                    <Bar dataKey="value" fill="#2F9E68" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Top clientes (por valor)">
              {topCustomers.length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={topCustomers} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E3E0D8" />
                    <XAxis type="number" stroke="#8A8780" fontSize={11} />
                    <YAxis type="category" dataKey="name" stroke="#8A8780" fontSize={11} width={140} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => currency(v)} />
                    <Bar dataKey="value" fill="#2563EB" radius={[0, 4, 4, 0]} />
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

export function ChartCard({ title, children }) {
  return (
    <div style={styles.card}>
      <h2 style={styles.cardTitle}>{title}</h2>
      {children}
    </div>
  );
}

export function Empty() {
  return <p style={styles.dim}>Sem dados suficientes ainda.</p>;
}

export function formatMonth(key) {
  const [year, month] = key.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

export function currency(v) {
  return `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

export const tooltipStyle = { background: "#FFFFFF", border: "1px solid #E3E0D8", borderRadius: 6, fontSize: 12.5 };

const styles = {
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0" },
  dim: { color: "var(--text-dim)", fontSize: 13 },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  card: {
    background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: 20, marginBottom: 16,
  },
  cardTitle: { fontFamily: "var(--font-display)", fontSize: 15, margin: "0 0 14px" },
};
