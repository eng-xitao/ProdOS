import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

/**
 * DRE simplificado: agrupa despesas pelos Centros de Custo já
 * cadastrados. Não substitui um DRE contábil completo (sem plano
 * de contas formal), mas dá uma visão real de receita x despesa.
 */
export default function DREPage() {
  const { company } = useAuth();
  const [loading, setLoading] = useState(true);
  const [totalReceita, setTotalReceita] = useState(0);
  const [despesasByCostCenter, setDespesasByCostCenter] = useState([]);
  const [totalDespesa, setTotalDespesa] = useState(0);

  useEffect(() => {
    if (company?.id) calculate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  async function calculate() {
    setLoading(true);
    const { data } = await supabase
      .from("financial_entries")
      .select("entry_type, amount, cost_centers:cost_center_id (name)");

    let receita = 0;
    const despesaMap = {};

    (data ?? []).forEach((e) => {
      if (e.entry_type === "receita") {
        receita += Number(e.amount);
      } else {
        const label = e.cost_centers?.name ?? "Sem centro de custo";
        despesaMap[label] = (despesaMap[label] ?? 0) + Number(e.amount);
      }
    });

    const despesaRows = Object.entries(despesaMap)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);

    setTotalReceita(receita);
    setDespesasByCostCenter(despesaRows);
    setTotalDespesa(despesaRows.reduce((sum, d) => sum + d.value, 0));
    setLoading(false);
  }

  const resultado = totalReceita - totalDespesa;

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={styles.title}>DRE (simplificado)</h1>
        <p style={styles.subtitle}>
          Receita total menos despesas agrupadas por Centro de Custo. Uma visão simplificada,
          baseada no que está lançado no sistema — não substitui um DRE contábil formal.
        </p>
      </header>

      {loading ? (
        <p style={styles.dim}>Calculando...</p>
      ) : (
        <div style={styles.report}>
          <div style={styles.line}>
            <span style={styles.lineLabel}>Receita Bruta</span>
            <span style={{ ...styles.lineValue, color: "var(--green)" }}>
              R$ {totalReceita.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div style={styles.sectionTitle}>Despesas por Centro de Custo</div>
          {despesasByCostCenter.length === 0 ? (
            <p style={styles.dim}>Nenhuma despesa lançada ainda.</p>
          ) : (
            despesasByCostCenter.map((d) => (
              <div key={d.label} style={styles.subLine}>
                <span style={styles.subLineLabel}>{d.label}</span>
                <span style={{ ...styles.subLineValue, color: "var(--red)" }}>
                  − R$ {d.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))
          )}

          <div style={styles.line}>
            <span style={styles.lineLabel}>Total de Despesas</span>
            <span style={{ ...styles.lineValue, color: "var(--red)" }}>
              − R$ {totalDespesa.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div style={styles.resultLine}>
            <span style={styles.resultLabel}>Resultado</span>
            <span style={{ ...styles.resultValue, color: resultado >= 0 ? "var(--green)" : "var(--red)" }}>
              R$ {resultado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0", maxWidth: 640, lineHeight: 1.5 },
  dim: { color: "var(--text-dim)", fontSize: 14 },
  report: {
    background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: 24, maxWidth: 560,
  },
  line: {
    display: "flex", justifyContent: "space-between", padding: "10px 0",
    borderBottom: "1px solid var(--line)", fontSize: 14, fontWeight: 700,
  },
  lineLabel: { color: "var(--text)" },
  lineValue: {},
  sectionTitle: {
    fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-dim)",
    marginTop: 18, marginBottom: 8, fontWeight: 700,
  },
  subLine: { display: "flex", justifyContent: "space-between", padding: "6px 0 6px 12px", fontSize: 13 },
  subLineLabel: { color: "var(--text-dim)" },
  subLineValue: {},
  resultLine: {
    display: "flex", justifyContent: "space-between", padding: "16px 0 0", marginTop: 12,
    borderTop: "2px solid var(--amber)", fontSize: 17, fontWeight: 700,
  },
  resultLabel: { fontFamily: "var(--font-display)" },
  resultValue: { fontFamily: "var(--font-display)" },
};
