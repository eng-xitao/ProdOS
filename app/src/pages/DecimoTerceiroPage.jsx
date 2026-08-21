import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { calculateThirteenthSalary } from "../lib/payrollCalc";

/**
 * 13º Salário com cálculo automático: os avos (meses trabalhados no
 * ano) vêm da data de admissão do colaborador, o valor bruto de
 * salário/12 × avos, e a 2ª parcela já desconta INSS/IRRF sobre o
 * valor integral do 13º (ver lib/payrollCalc.js). Nada é digitado
 * manualmente. Ao gerar, cria a despesa em Financeiro → Contas a Pagar.
 */
export default function DecimoTerceiroPage() {
  const { company } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [employeeId, setEmployeeId] = useState("");
  const [referenceYear, setReferenceYear] = useState(String(new Date().getFullYear()));
  const [installment, setInstallment] = useState("1");

  async function loadEmployees() {
    const { data } = await supabase
      .from("employees")
      .select("id, full_name, hire_date, base_salary, dependents_count")
      .eq("status", "ativo")
      .order("full_name");
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

  const employee = employees.find((e) => e.id === employeeId);

  const calc = useMemo(() => {
    if (!employee || !referenceYear || !installment) return null;
    return calculateThirteenthSalary({
      baseSalary: employee.base_salary,
      hireDate: employee.hire_date,
      referenceYear,
      installment,
      dependentsCount: employee.dependents_count ?? 0,
    });
  }, [employee, referenceYear, installment]);

  async function generateEntry() {
    if (!company?.id || !employeeId || !referenceYear || !calc) return;
    setSaving(true);
    setError("");

    const { data: financialEntry, error: financialError } = await supabase
      .from("financial_entries")
      .insert({
        company_id: company.id,
        description: `13º salário — ${employee?.full_name} — ${installment}ª parcela/${referenceYear}`,
        entry_type: "despesa",
        amount: calc.netAmount,
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
      gross_amount: calc.installmentGross,
      discounts: calc.inss + calc.irrf,
      net_amount: calc.netAmount,
      financial_entry_id: financialEntry.id,
    });

    if (entryError) { setError(entryError.message); setSaving(false); return; }

    setEmployeeId("");
    setSaving(false);
    loadEntries();
  }

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={styles.title}>13º Salário</h1>
        <p style={styles.subtitle}>
          Os avos e o valor de cada parcela são calculados automaticamente a partir da admissão e do
          salário do colaborador. A 1ª parcela (até 30/11) é 50% do 13º, sem desconto; a 2ª (até 20/12)
          é o restante, com INSS/IRRF sobre o valor integral do 13º. Ao gerar, cria a despesa em
          Financeiro → Contas a Pagar.
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
      </div>

      {employee && !employee.hire_date && (
        <div style={styles.error}>
          Este colaborador não tem data de admissão cadastrada em Cadastro → Colaboradores — sem ela
          não é possível calcular os avos do 13º automaticamente. Complete o cadastro antes de continuar.
        </div>
      )}

      {calc && (
        <div style={styles.autoBox}>
          <div style={styles.autoRow}>
            <span style={styles.autoLabel}>Avos do ano ({calc.avos}/12)</span>
            <span style={styles.autoValue}>—</span>
          </div>
          <div style={styles.autoRow}>
            <span style={styles.autoLabel}>13º integral do ano</span>
            <span style={styles.autoValue}>R$ {calc.grossFull.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
          </div>
          <div style={styles.autoRow}>
            <span style={styles.autoLabel}>Valor bruto da {installment}ª parcela</span>
            <span style={styles.autoValue}>R$ {calc.installmentGross.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
          </div>
          {installment === "2" && (
            <>
              <div style={styles.autoRow}>
                <span style={styles.autoLabel}>(–) INSS sobre o 13º integral</span>
                <span style={styles.autoValue}>R$ {calc.inss.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={styles.autoRow}>
                <span style={styles.autoLabel}>(–) IRRF sobre o 13º integral</span>
                <span style={styles.autoValue}>R$ {calc.irrf.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
              </div>
            </>
          )}
        </div>
      )}

      <div style={styles.netBox}>
        <span style={styles.netLabel}>Valor líquido da parcela</span>
        <span style={styles.netValue}>R$ {(calc?.netAmount ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
      </div>

      <button style={styles.generateBtn} onClick={generateEntry} disabled={saving || !employeeId || !calc} type="button">
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
  autoBox: {
    display: "flex", flexDirection: "column", gap: 8,
    background: "var(--panel-2)", border: "1px dashed var(--line)", borderRadius: "var(--radius)",
    padding: "12px 20px", marginTop: 16, maxWidth: 820,
  },
  autoRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  autoLabel: { fontSize: 12.5, color: "var(--text-dim)" },
  autoValue: { fontSize: 13.5, fontWeight: 600 },
  netBox: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    background: "var(--panel-2)", border: "1px solid var(--amber)", borderRadius: "var(--radius)",
    padding: "14px 20px", marginTop: 16, maxWidth: 820,
  },
  netLabel: { fontSize: 13, color: "var(--text-dim)", fontWeight: 600 },
  netValue: { fontFamily: "var(--font-display)", fontSize: 20, color: "var(--amber)" },
  generateBtn: {
    marginTop: 16, background: "var(--amber)", color: "#FFFFFF", border: "none",
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
