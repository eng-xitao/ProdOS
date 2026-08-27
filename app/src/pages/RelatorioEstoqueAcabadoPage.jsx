import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ChartCard, Empty, currency, tooltipStyle } from "./RelatorioVendasPage";
import PrintHeader from "../components/PrintHeader";
import PrintButton from "../components/PrintButton";

/**
 * Relatório de Estoque — Produto Acabado. Usa stock_levels (estoque
 * por produto E por almoxarifado) em vez de um número único do
 * produto — permite filtrar por local e mostra corretamente quando
 * o mesmo item está espalhado em mais de um almoxarifado.
 */
export default function RelatorioEstoqueAcabadoPage() {
  const { company } = useAuth();
  const [loading, setLoading] = useState(true);
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [totalValue, setTotalValue] = useState(0);
  const [topByValue, setTopByValue] = useState([]);
  const [zeroStock, setZeroStock] = useState([]);
  const [lowStock, setLowStock] = useState([]);

  useEffect(() => {
    if (company?.id) {
      supabase.from("warehouses").select("id, name").order("name").then(({ data }) => setWarehouses(data ?? []));
      calculate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id, warehouseId]);

  async function calculate() {
    setLoading(true);
    const { data: products } = await supabase
      .from("products")
      .select("id, sku, name, min_stock, sale_price, unit")
      .eq("type", "acabado");

    let levelsQuery = supabase.from("stock_levels").select("product_id, warehouse_id, quantity");
    if (warehouseId) levelsQuery = levelsQuery.eq("warehouse_id", warehouseId);
    const { data: levels } = await levelsQuery;

    const qtyByProduct = {};
    (levels ?? []).forEach((l) => {
      qtyByProduct[l.product_id] = (qtyByProduct[l.product_id] ?? 0) + Number(l.quantity);
    });

    let total = 0;
    const zeros = [];
    const lows = [];

    const rows = (products ?? []).map((p) => {
      const qty = qtyByProduct[p.id] ?? 0;
      const value = qty * Number(p.sale_price);
      total += value;
      if (qty === 0) zeros.push({ ...p, stock_quantity: qty });
      else if (Number(p.min_stock) > 0 && qty < Number(p.min_stock)) lows.push({ ...p, stock_quantity: qty });
      return { name: `${p.sku} — ${p.name}`, value };
    }).sort((a, b) => b.value - a.value).slice(0, 8);

    setTotalValue(total);
    setTopByValue(rows);
    setZeroStock(zeros);
    setLowStock(lows);
    setLoading(false);
  }

  const warehouseLabel = warehouseId ? warehouses.find((w) => w.id === warehouseId)?.name ?? "" : "Todos os almoxarifados";

  return (
    <div>
      <header style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }} className="no-print">
        <div>
          <h1 style={styles.title}>Relatório de Estoque — Produto Acabado</h1>
          <p style={styles.subtitle}>
            Valor em estoque (a preço de venda):{" "}
            <strong style={{ color: "var(--amber)" }}>{currency(totalValue)}</strong>
          </p>
        </div>
        <PrintButton />
      </header>
      <PrintHeader title="Relatório de Estoque — Produto Acabado" subtitle={`Local: ${warehouseLabel} · Valor: R$ ${currency(totalValue)}`} />

      <div style={styles.filterRow} className="no-print">
        <label style={styles.fieldLabel}>Almoxarifado</label>
        <select style={styles.select} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
          <option value="">Todos os almoxarifados</option>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>

      {loading ? (
        <p style={styles.dim}>Calculando...</p>
      ) : (
        <>
          <ChartCard title="Top produtos acabados por valor em estoque">
            {topByValue.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={topByValue} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E3E0D8" />
                  <XAxis type="number" stroke="#8A8780" fontSize={11} />
                  <YAxis type="category" dataKey="name" stroke="#8A8780" fontSize={11} width={160} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => currency(v)} />
                  <Bar dataKey="value" fill="#2563EB" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <div style={styles.grid2}>
            <div style={styles.card}>
              <h2 style={styles.cardTitle}>Zerados</h2>
              {zeroStock.length === 0 ? (
                <p style={styles.dim}>Nenhum produto acabado zerado — bom sinal.</p>
              ) : (
                <SimpleTable rows={zeroStock} />
              )}
            </div>
            <div style={styles.card}>
              <h2 style={styles.cardTitle}>Abaixo do estoque mínimo</h2>
              {lowStock.length === 0 ? (
                <p style={styles.dim}>Nenhum produto abaixo do mínimo.</p>
              ) : (
                <SimpleTable rows={lowStock} />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SimpleTable({ rows }) {
  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead><tr><th style={styles.th}>SKU</th><th style={styles.th}>Nome</th><th style={styles.th}>Estoque</th></tr></thead>
        <tbody>
          {rows.map((p, i) => (
            <tr key={i}>
              <td style={styles.td}>{p.sku}</td>
              <td style={styles.td}>{p.name}</td>
              <td style={styles.td}>{Number(p.stock_quantity).toLocaleString("pt-BR")} {p.unit}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const styles = {
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0" },
  dim: { color: "var(--text-dim)", fontSize: 13 },
  filterRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 20 },
  fieldLabel: { fontSize: 12, color: "var(--text-dim)", fontWeight: 600 },
  select: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "7px 10px", color: "var(--text)", fontSize: 13,
  },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 },
  card: { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 20 },
  cardTitle: { fontFamily: "var(--font-display)", fontSize: 15, margin: "0 0 14px" },
  tableWrap: { border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden", overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em",
    color: "var(--text-dim)", padding: "10px 14px", background: "var(--panel-2)", borderBottom: "1px solid var(--line)",
  },
  td: { padding: "10px 14px", fontSize: 13.5, borderBottom: "1px solid var(--line)" },
};
