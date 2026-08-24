import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ChartCard, Empty, formatMonth, currency, tooltipStyle } from "./RelatorioVendasPage";
import DateRangeFilter from "../components/DateRangeFilter";

const STATUS_LABEL = { processando: "Processando", autorizado: "Autorizada", erro: "Erro", cancelado: "Cancelada" };

/**
 * Relatório Fiscal: visão consolidada das Notas Fiscais emitidas —
 * até agora só existia a lista em Notas Fiscais, sem nenhuma visão
 * de faturamento fiscal por mês ou de notas com erro.
 */
export default function RelatorioFiscalPage() {
  const { company } = useAuth();
  const [loading, setLoading] = useState(true);
  const [byMonth, setByMonth] = useState([]);
  const [byStatus, setByStatus] = useState([]);
  const [totalAuthorized, setTotalAuthorized] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [range, setRange] = useState({ from: "", to: "" });

  useEffect(() => {
    if (company?.id) calculate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id, range]);

  async function calculate() {
    setLoading(true);
    const { data: allInvoices } = await supabase
      .from("invoices")
      .select("status, valor_total, created_at");

    const invoices = (allInvoices ?? []).filter((i) => {
      if (!i.created_at) return true;
      const day = i.created_at.slice(0, 10);
      if (range.from && day < range.from) return false;
      if (range.to && day > range.to) return false;
      return true;
    });

    const authorized = invoices.filter((i) => i.status === "autorizado");
    setTotalAuthorized(authorized.reduce((sum, i) => sum + Number(i.valor_total ?? 0), 0));
    setErrorCount(invoices.filter((i) => i.status === "erro").length);

    const monthMap = {};
    authorized.forEach((i) => {
      if (!i.created_at) return;
      const key = i.created_at.slice(0, 7);
      monthMap[key] = (monthMap[key] ?? 0) + Number(i.valor_total ?? 0);
    });
    setByMonth(Object.entries(monthMap).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => ({ month: formatMonth(key), value })));

    const statusMap = {};
    invoices.forEach((i) => {
      const label = STATUS_LABEL[i.status] ?? i.status;
      statusMap[label] = (statusMap[label] ?? 0) + 1;
    });
    setByStatus(Object.entries(statusMap).map(([name, value]) => ({ name, value })));

    setLoading(false);
  }

  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <h1 style={styles.title}>Relatório Fiscal — Notas Emitidas</h1>
        <p style={styles.subtitle}>
          Total faturado com nota autorizada:{" "}
          <strong style={{ color: "var(--green)" }}>{currency(totalAuthorized)}</strong>
          {errorCount > 0 && (
            <> · <strong style={{ color: "var(--red)" }}>{errorCount} nota(s) com erro</strong></>
          )}
        </p>
      </header>

      <DateRangeFilter onChange={setRange} />

      {loading ? (
        <p style={styles.dim}>Calculando...</p>
      ) : (
        <>
          <ChartCard title="Valor faturado com NF-e por mês (só notas autorizadas)">
            {byMonth.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={byMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E3E0D8" />
                  <XAxis dataKey="month" stroke="#8A8780" fontSize={12} />
                  <YAxis stroke="#8A8780" fontSize={12} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => currency(v)} />
                  <Bar dataKey="value" fill="#2F9E68" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Notas por status">
            {byStatus.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={byStatus}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E3E0D8" />
                  <XAxis dataKey="name" stroke="#8A8780" fontSize={12} />
                  <YAxis stroke="#8A8780" fontSize={12} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" fill="#2563EB" radius={[4, 4, 0, 0]} />
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
