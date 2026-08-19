import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

export default function DecimoTerceiroPage() {
  const { company } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [employeeId, setEmployeeId] = useState("");
  const [referenceYear, setReferenceYear] = useState(String(new Date().getFullYear()));
  const [installment, setInstallment] = useState("1");
  const [grossAmount, setGrossAmount] = useState("");
  const [discounts, setDiscounts] = useState("0");

  async function loadEmployees() {
    const { data } = await supabase.from("employees").select("id, full_name").eq("status", "ativo").order("full_name");
    setEmployees(data ?? []);
  }

  async function loadEntries() {
    const { data } = await supabase
      .from("thirteenth_salary_entries")
      .select("id, reference_year, installment, net_amount, employees:employee_id (full_name)")
      .order("reference_year", { ascending: false });
    setEntries(data ?? []);
  }

  useEffect(() => {
    if (company?.id) { loadEmployees(); loadEntries(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  const netAmount = Number(grossAmount || 0) - Number(discounts || 0);

  async function generateEntry() {
    if (!company?.id || !employeeId || !referenceYear) return;
    setSaving(true);
    setError("");

    const employee = employees.find((e) => e.id === employeeId);

    const { data: financialEntry, error: financialError } = await supabase
      .from("financial_entries")
      .insert({
        company_id: company.id,
        description: `13º salário — ${employee?.full_name} — ${installment}ª parcela/${referenceYear}`,
        entry_type: "despesa",
        amount: netAmount,
        due_date: installment === "1" ? `${referenceYear}-11-30` : `${referenceYear}-12-20`,
        employee_id: employeeId,
        paid: false,
      })
      .select("id")
      .single();

    if (financialError) { setError(financialError.message); setSaving(false); return; }

    const { error: entryError } = await supabase.from("thirteenth_salary_entries").insert({
      company_id: company.id,
      employee_id: employeeId,
      reference_year: Number(referenceYear),
      installment: Number(installment),
      gross_amount: Number(grossAmount || 0),
      discounts: Number(discounts || 0),
      net_amount: netAmount,
      financial_entry_id: financialEntry.id,
    });

    if (entryError) { setError(entryError.message); setSaving(false); return; }

    setEmployeeId(""); setGrossAmount(""); setDiscounts("0");
    setSaving(false);
    loadEntries();
  }

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={styles.title}>13º Salário</h1>
        <p style={styles.subtitle}>
          A 1ª parcela costuma ser sem desconto (paga até 30/11) e a 2ª com INSS/IRRF (até 20/12).
          Ao gerar, cria a despesa em Financeiro → Contas a Pagar.
        </p>
      </header>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.form}>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>Colaborador</span>
          <select style={styles.input} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">Selecione...</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
          </select>
        </label>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>Ano de referência</span>
          <input style={styles.input} type="number" value={referenceYear} onChange={(e) => setReferenceYear(e.target.value)} />
        </label>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>Parcela</span>
          <select style={styles.input} value={installment} onChange={(e) => setInstallment(e.target.value)}>
            <option value="1">1ª parcela</option>
            <option value="2">2ª parcela</option>
          </select>
        </label>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>Valor bruto (R$)</span>
          <input style={styles.input} type="number" step="any" value={grossAmount} onChange={(e) => setGrossAmount(e.target.value)} />
        </label>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>Descontos (R$)</span>
          <input style={styles.input} type="number" step="any" value={discounts} onChange={(e) => setDiscounts(e.target.value)} />
        </label>
      </div>

      <div style={styles.netBox}>
        <span style={styles.netLabel}>Valor líquido</span>
        <span style={styles.netValue}>R$ {netAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
      </div>

      <button style={styles.generateBtn} onClick={generateEntry} disabled={saving || !employeeId || !grossAmount} type="button">
        {saving ? "Gerando..." : "Gerar Parcela (cria despesa no Financeiro)"}
      </button>

      <div style={styles.wrap}>
        <h2 style={styles.title2}>Histórico</h2>
        {entries.length === 0 ? (
          <p style={styles.dim}>Nenhuma parcela gerada ainda.</p>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr><th style={styles.th}>Colaborador</th><th style={styles.th}>Ano</th><th style={styles.th}>Parcela</th><th style={styles.th}>Líquido</th></tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td style={styles.td}>{e.employees?.full_name}</td>
                    <td style={styles.td}>{e.reference_year}</td>
                    <td style={styles.td}>{e.installment}ª</td>
                    <td style={styles.td}>R$ {Number(e.net_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  title2: { fontFamily: "var(--font-display)", fontSize: 18, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0", maxWidth: 640, lineHeight: 1.5 },
  wrap: { marginTop: 36, paddingTop: 28, borderTop: "1px solid var(--line)" },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  fieldLabel: { fontSize: 11, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" },
  input: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "9px 10px", color: "var(--text)", fontSize: 13,
  },
  form: {
    display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14,
    background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: 20, marginTop: 20, maxWidth: 820,
  },
  netBox: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    background: "var(--panel-2)", border: "1px solid var(--amber)", borderRadius: "var(--radius)",
    padding: "14px 20px", marginTop: 16, maxWidth: 820,
  },
  netLabel: { fontSize: 13, color: "var(--text-dim)", fontWeight: 600 },
  netValue: { fontFamily: "var(--font-display)", fontSize: 20, color: "var(--amber)" },
  generateBtn: {
    marginTop: 16, background: "var(--amber)", color: "#1A1400", border: "none",
    borderRadius: "var(--radius)", padding: "12px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer",
  },
  dim: { color: "var(--text-dim)", fontSize: 14 },
  tableWrap: { border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden", maxWidth: 640 },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em",
    color: "var(--text-dim)", padding: "10px 14px", background: "var(--panel)", borderBottom: "1px solid var(--line)",
  },
  td: { padding: "10px 14px", fontSize: 13.5, background: "var(--panel)", borderBottom: "1px solid var(--line)" },
  error: {
    background: "rgba(217,105,95,0.12)", border: "1px solid var(--red)", color: "var(--red)",
    borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 13, marginBottom: 16, maxWidth: 820,
  },
};
