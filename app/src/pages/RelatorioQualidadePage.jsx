import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ChartCard, Empty, tooltipStyle } from "./RelatorioVendasPage";
import DateRangeFilter from "../components/DateRangeFilter";
import PrintHeader from "../components/PrintHeader";
import PrintButton, { rangeLabel } from "../components/PrintButton";

/**
 * Relatório de Qualidade/Refugo: reúne os dados que os módulos de
 * Qualidade já coletam (inspeções, não conformidades, refugo
 * apontado na produção) numa visão gerencial — hoje esses dados
 * existiam, mas não tinham nenhum relatório consolidado.
 */
export default function RelatorioQualidadePage() {
  const { company } = useAuth();
  const [loading, setLoading] = useState(true);
  const [approvalRate, setApprovalRate] = useState(null);
  const [inspectionsCount, setInspectionsCount] = useState(0);
  const [ncByStage, setNcByStage] = useState([]);
  const [ncBySeverity, setNcBySeverity] = useState([]);
  const [scrapByProduct, setScrapByProduct] = useState([]);
  const [range, setRange] = useState({ from: "", to: "" });

  useEffect(() => {
    if (company?.id) calculate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id, range]);

  function inRange(dateStr) {
    if (!dateStr) return true;
    const day = dateStr.slice(0, 10);
    if (range.from && day < range.from) return false;
    if (range.to && day > range.to) return false;
    return true;
  }

  async function calculate() {
    setLoading(true);

    const [{ data: allInspections }, { data: allNc }, { data: allLogs }] = await Promise.all([
      supabase.from("quality_inspections").select("overall_status, created_at"),
      supabase.from("quality_nonconformities").select("severity, created_at, production_stages:stage_id (name)"),
      supabase.from("production_time_logs").select("quantity_scrapped, log_date, production_orders:production_order_id (products:product_id (sku, name))"),
    ]);

    const inspections = (allInspections ?? []).filter((i) => inRange(i.created_at));
    const ncs = (allNc ?? []).filter((n) => inRange(n.created_at));
    const logs = (allLogs ?? []).filter((l) => inRange(l.log_date));

    const approved = inspections.filter((i) => i.overall_status === "aprovado").length;
    setApprovalRate(inspections.length > 0 ? Math.round((approved / inspections.length) * 100) : null);
    setInspectionsCount(inspections.length);

    const stageMap = {};
    ncs.forEach((n) => {
      const label = n.production_stages?.name ?? "Sem etapa";
      stageMap[label] = (stageMap[label] ?? 0) + 1;
    });
    setNcByStage(Object.entries(stageMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value));

    const severityMap = { baixa: 0, media: 0, alta: 0 };
    ncs.forEach((n) => { severityMap[n.severity] = (severityMap[n.severity] ?? 0) + 1; });
    setNcBySeverity([
      { name: "Baixa", value: severityMap.baixa },
      { name: "Média", value: severityMap.media },
      { name: "Alta", value: severityMap.alta },
    ]);

    const productMap = {};
    logs.forEach((l) => {
      const qty = Number(l.quantity_scrapped ?? 0);
      if (qty <= 0) return;
      const p = l.production_orders?.products;
      const label = p ? `${p.sku} — ${p.name}` : "—";
      productMap[label] = (productMap[label] ?? 0) + qty;
    });
    setScrapByProduct(Object.entries(productMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8));

    setLoading(false);
  }

  return (
    <div>
      <header style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }} className="no-print">
        <div>
          <h1 style={styles.title}>Relatório de Qualidade e Refugo</h1>
          <p style={styles.subtitle}>Baseado nas Inspeções de Qualidade, Não Conformidades e refugo apontado na produção.</p>
        </div>
        <PrintButton />
      </header>
      <PrintHeader title="Relatório de Qualidade e Refugo" subtitle={rangeLabel(range)} />

      <DateRangeFilter onChange={setRange} />

      {loading ? (
        <p style={styles.dim}>Calculando...</p>
      ) : (
        <>
          <div style={styles.summaryRow}>
            <div style={styles.summaryCard}>
              <span style={styles.summaryLabel}>Taxa de aprovação nas inspeções</span>
              <span style={styles.summaryValue}>{approvalRate !== null ? `${approvalRate}%` : "—"}</span>
            </div>
            <div style={styles.summaryCard}>
              <span style={styles.summaryLabel}>Inspeções realizadas</span>
              <span style={styles.summaryValue}>{inspectionsCount}</span>
            </div>
            <div style={styles.summaryCard}>
              <span style={styles.summaryLabel}>Não conformidades registradas</span>
              <span style={styles.summaryValue}>{ncByStage.reduce((s, r) => s + r.value, 0)}</span>
            </div>
          </div>

          <div style={styles.grid2}>
            <ChartCard title="Não conformidades por etapa">
              {ncByStage.length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={ncByStage} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E3E0D8" />
                    <XAxis type="number" stroke="#8A8780" fontSize={11} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" stroke="#8A8780" fontSize={11} width={130} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="value" fill="#C9483D" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Não conformidades por gravidade">
              {ncByStage.length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={ncBySeverity}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E3E0D8" />
                    <XAxis dataKey="name" stroke="#8A8780" fontSize={12} />
                    <YAxis stroke="#8A8780" fontSize={12} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="value" fill="#E8A33D" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          <ChartCard title="Top produtos com mais refugo (quantidade)">
            {scrapByProduct.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={scrapByProduct} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E3E0D8" />
                  <XAxis type="number" stroke="#8A8780" fontSize={11} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" stroke="#8A8780" fontSize={11} width={160} />
                  <Tooltip contentStyle={tooltipStyle} />
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
  summaryRow: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20, maxWidth: 640 },
  summaryCard: { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: "14px 16px" },
  summaryLabel: { display: "block", fontSize: 11, color: "var(--text-dim)", fontWeight: 700, textTransform: "uppercase" },
  summaryValue: { display: "block", fontFamily: "var(--font-display)", fontSize: 22, marginTop: 4 },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
};
