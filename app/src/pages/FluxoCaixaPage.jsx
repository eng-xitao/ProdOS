import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

export default function FluxoCaixaPage() {
  const { company } = useAuth();
  const [months, setMonths] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (company?.id) calculate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  async function calculate() {
    setLoading(true);
    const { data } = await supabase
      .from("financial_entries")
      .select("entry_type, amount, due_date")
      .not("due_date", "is", null);

    const byMonth = {};
    (data ?? []).forEach((e) => {
      const key = e.due_date.slice(0, 7); // YYYY-MM
      if (!byMonth[key]) byMonth[key] = { receitas: 0, despesas: 0 };
      if (e.entry_type === "receita") byMonth[key].receitas += Number(e.amount);
      else byMonth[key].despesas += Number(e.amount);
    });

    const sortedKeys = Object.keys(byMonth).sort();
    let accumulated = 0;
    const result = sortedKeys.map((key) => {
      const { receitas, despesas } = byMonth[key];
      const saldo = receitas - despesas;
      accumulated += saldo;
      return { key, receitas, despesas, saldo, accumulated };
    });

    setMonths(result);
    setLoading(false);
  }

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={styles.title}>Fluxo de Caixa</h1>
        <p style={styles.subtitle}>
          Todas as contas a receber, a pagar e lançamentos avulsos, agrupados por mês de vencimento.
        </p>
      </header>

      {loading ? (
        <p style={styles.dim}>Calculando...</p>
      ) : months.length === 0 ? (
        <p style={styles.dim}>Nenhum lançamento com data de vencimento ainda.</p>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Mês</th>
                <th style={styles.th}>Entradas</th>
                <th style={styles.th}>Saídas</th>
                <th style={styles.th}>Saldo do mês</th>
                <th style={styles.th}>Saldo acumulado</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => (
                <tr key={m.key}>
                  <td style={styles.td}>{formatMonth(m.key)}</td>
                  <td style={{ ...styles.td, color: "var(--green)" }}>
                    R$ {m.receitas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ ...styles.td, color: "var(--red)" }}>
                    R$ {m.despesas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ ...styles.td, fontWeight: 700, color: m.saldo >= 0 ? "var(--green)" : "var(--red)" }}>
                    R$ {m.saldo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ ...styles.td, fontWeight: 700, color: m.accumulated >= 0 ? "var(--amber)" : "var(--red)" }}>
                    R$ {m.accumulated.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatMonth(key) {
  const [year, month] = key.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

const styles = {
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0", maxWidth: 640, lineHeight: 1.5 },
  dim: { color: "var(--text-dim)", fontSize: 14 },
  tableWrap: { border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden", overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em",
    color: "var(--text-dim)", padding: "10px 14px", background: "var(--panel)", borderBottom: "1px solid var(--line)",
  },
  td: { padding: "10px 14px", fontSize: 13.5, background: "var(--panel)", borderBottom: "1px solid var(--line)" },
};
