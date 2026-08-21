import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { calculateINSS, calculateIRRF } from "../lib/payrollCalc";
import CurrencyInput from "../components/CurrencyInput";

/**
 * Folha de Pagamento com cálculo automático de INSS e IRRF pelas
 * tabelas vigentes em 2026 (ver lib/payrollCalc.js). O usuário só
 * informa salário base (auto-preenchido), horas extras e descontos
 * específicos do colaborador (VT, outros) — os encargos fiscais não
 * são mais digitados manualmente. Ao gerar o pagamento, cria uma
 * despesa no Financeiro vinculada ao colaborador e ao mês de referência.
 */
export default function FolhaPagamentoPage() {
  const { company } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [employeeId, setEmployeeId] = useState("");
  const [referenceMonth, setReferenceMonth] = useState("");
  const [baseSalary, setBaseSalary] = useState(0);
  const [dependentsCount, setDependentsCount] = useState(0);
  const [overtimeAmount, setOvertimeAmount] = useState(0);
  const [vtDiscount, setVtDiscount] = useState(0);
  const [otherDiscounts, setOtherDiscounts] = useState(0);

  async function loadEmployees() {
    const { data } = await supabase
      .from("employees")
      .select("id, full_name, base_salary, dependents_count")
      .eq("status", "ativo")
      .order("full_name");
    setEmployees(data ?? []);
  }

  async function loadEntries() {
    const { data } = await supabase
      .from("payroll_entries")
      .select("id, reference_month, net_salary, status, employees:employee_id (full_name)")
      .order("reference_month", { ascending: false });
    setEntries(data ?? []);
  }

  useEffect(() => {
    if (company?.id) { loadEmployees(); loadEntries(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  function handleEmployeeChange(id) {
    setEmployeeId(id);
    const employee = employees.find((e) => e.id === id);
    if (employee) {
      setBaseSalary(Number(employee.base_salary ?? 0));
      setDependentsCount(employee.dependents_count ?? 0);
    }
  }

  // INSS e IRRF são recalculados automaticamente a cada mudança de
  // salário base, hora extra ou nº de dependentes — não são mais
  // campos digitáveis.
  const grossForTax = Number(baseSalary || 0) + Number(overtimeAmount || 0);
  const inssDiscount = useMemo(() => calculateINSS(grossForTax), [grossForTax]);
  const irrfDiscount = useMemo(
    () => calculateIRRF(grossForTax, inssDiscount, dependentsCount),
    [grossForTax, inssDiscount, dependentsCount]
  );

  const netSalary =
    grossForTax - inssDiscount - irrfDiscount - Number(vtDiscount || 0) - Number(otherDiscounts || 0);

  async function generatePayroll() {
    if (!company?.id || !employeeId || !referenceMonth) return;
    setSaving(true);
    setError("");

    const employee = employees.find((e) => e.id === employeeId);

    const { data: financialEntry, error: financialError } = await supabase
      .from("financial_entries")
      .insert({
        company_id: company.id,
        description: `Folha de pagamento — ${employee?.full_name} — ${formatMonth(referenceMonth)}`,
        entry_type: "despesa",
        amount: netSalary,
        due_date: referenceMonth,
        employee_id: employeeId,
        paid: false,
      })
      .select("id")
      .single();

    if (financialError) { setError(financialError.message); setSaving(false); return; }

    const { error: payrollError } = await supabase.from("payroll_entries").insert({
      company_id: company.id,
      employee_id: employeeId,
      reference_month: referenceMonth,
      base_salary: Number(baseSalary || 0),
      overtime_amount: Number(overtimeAmount || 0),
      inss_discount: inssDiscount,
      irrf_discount: irrfDiscount,
      vt_discount: Number(vtDiscount || 0),
      other_discounts: Number(otherDiscounts || 0),
      net_salary: netSalary,
      financial_entry_id: financialEntry.id,
    });

    if (payrollError) { setError(payrollError.message); setSaving(false); return; }

    setEmployeeId(""); setReferenceMonth(""); setBaseSalary(0); setDependentsCount(0);
    setOvertimeAmount(0); setVtDiscount(0); setOtherDiscounts(0);
    setSaving(false);
    loadEntries();
  }

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={styles.title}>Folha de Pagamento</h1>
        <p style={styles.subtitle}>
          INSS e IRRF são calculados automaticamente pelas tabelas vigentes em 2026 (com o redutor
          da Lei nº 15.270/2025). Você só informa horas extras, VT e outros descontos específicos do
          colaborador. Ao gerar, uma despesa é criada em Financeiro → Contas a Pagar.
        </p>
      </header>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.form}>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>Colaborador</span>
          <select style={styles.input} value={employeeId} onChange={(e) => handleEmployeeChange(e.target.value)}>
            <option value="">Selecione...</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
          </select>
        </label>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>Mês de referência</span>
          <input style={styles.input} type="date" value={referenceMonth} onChange={(e) => setReferenceMonth(e.target.value)} />
        </label>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>Salário base</span>
          <CurrencyInput value={baseSalary} onChange={setBaseSalary} />
        </label>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>Dependentes (IRRF)</span>
          <input style={styles.input} type="number" min="0" step="1" value={dependentsCount} onChange={(e) => setDependentsCount(Number(e.target.value || 0))} />
        </label>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>Horas extras</span>
          <CurrencyInput value={overtimeAmount} onChange={setOvertimeAmount} />
        </label>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>Desconto VT</span>
          <CurrencyInput value={vtDiscount} onChange={setVtDiscount} />
        </label>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>Outros descontos</span>
          <CurrencyInput value={otherDiscounts} onChange={setOtherDiscounts} />
        </label>
      </div>

      <div style={styles.autoBox}>
        <div style={styles.autoRow}>
          <span style={styles.autoLabel}>Desconto INSS (automático)</span>
          <span style={styles.autoValue}>R$ {inssDiscount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
        </div>
        <div style={styles.autoRow}>
          <span style={styles.autoLabel}>Desconto IRRF (automático)</span>
          <span style={styles.autoValue}>R$ {irrfDiscount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      <div style={styles.netSalaryBox}>
        <span style={styles.netSalaryLabel}>Salário líquido</span>
        <span style={styles.netSalaryValue}>R$ {netSalary.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
      </div>

      <button style={styles.generateBtn} onClick={generatePayroll} disabled={saving || !employeeId || !referenceMonth} type="button">
        {saving ? "Gerando..." : "Gerar Folha (cria despesa no Financeiro)"}
      </button>

      <div style={styles.wrap}>
        <h2 style={styles.title2}>Histórico</h2>
        {entries.length === 0 ? (
          <p style={styles.dim}>Nenhuma folha gerada ainda.</p>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr><th style={styles.th}>Colaborador</th><th style={styles.th}>Mês</th><th style={styles.th}>Líquido</th><th style={styles.th}>Status</th></tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td style={styles.td}>{e.employees?.full_name}</td>
                    <td style={styles.td}>{formatMonth(e.reference_month)}</td>
                    <td style={styles.td}>R$ {Number(e.net_salary).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                    <td style={styles.td}>{e.status === "paga" ? "Paga" : "Aberta"}</td>
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

function formatMonth(dateStr) {
  if (!dateStr) return "—";
  const [year, month] = dateStr.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
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
  netSalaryBox: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    background: "var(--panel-2)", border: "1px solid var(--amber)", borderRadius: "var(--radius)",
    padding: "14px 20px", marginTop: 16, maxWidth: 820,
  },
  netSalaryLabel: { fontSize: 13, color: "var(--text-dim)", fontWeight: 600 },
  netSalaryValue: { fontFamily: "var(--font-display)", fontSize: 20, color: "var(--amber)" },
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
    borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 13, marginBottom: 16, maxWidth: 640,
  },
};
