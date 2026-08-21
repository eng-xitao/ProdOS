import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { calculateTermination } from "../lib/payrollCalc";

const TYPE_LABEL = {
  sem_justa_causa: "Sem justa causa",
  justa_causa: "Justa causa",
  pedido_demissao: "Pedido de demissão",
  acordo: "Acordo (distrato)",
  termino_contrato: "Término de contrato",
};

/**
 * Rescisão com cálculo automático das verbas rescisórias (saldo de
 * salário, férias proporcionais + 1/3, 13º proporcional, aviso
 * prévio e multa de 40% do FGTS), incluindo o INSS/IRRF retido sobre
 * a parcela tributável — ver lib/payrollCalc.js. Nada é mais
 * digitado manualmente: os valores nascem de admissão, salário base
 * e dependentes do colaborador, e do tipo de rescisão escolhido.
 * Ao gerar, cria a despesa no Financeiro e marca o colaborador como
 * inativo automaticamente.
 */
export default function RescisaoPage() {
  const { company } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [terminations, setTerminations] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [employeeId, setEmployeeId] = useState("");
  const [terminationDate, setTerminationDate] = useState("");
  const [terminationType, setTerminationType] = useState("");
  const [noticeType, setNoticeType] = useState("");

  async function loadEmployees() {
    const { data } = await supabase
      .from("employees")
      .select("id, full_name, hire_date, base_salary, dependents_count")
      .eq("status", "ativo")
      .order("full_name");
    setEmployees(data ?? []);
  }

  async function loadTerminations() {
    const { data } = await supabase
      .from("terminations")
      .select("id, termination_date, termination_type, total_amount, employees:employee_id (full_name)")
      .order("termination_date", { ascending: false });
    setTerminations(data ?? []);
  }

  useEffect(() => {
    if (company?.id) { loadEmployees(); loadTerminations(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  const employee = employees.find((e) => e.id === employeeId);

  // Todas as verbas nascem automaticamente da admissão + salário do
  // colaborador, da data de desligamento e do tipo de aviso prévio.
  const calc = useMemo(() => {
    if (!employee || !terminationDate || !terminationType) return null;
    return calculateTermination({
      baseSalary: employee.base_salary,
      hireDate: employee.hire_date,
      terminationDate,
      noticeType,
      dependentsCount: employee.dependents_count ?? 0,
    });
  }, [employee, terminationDate, terminationType, noticeType]);

  async function generateTermination() {
    if (!company?.id || !employeeId || !terminationDate || !terminationType || !calc) return;
    setSaving(true);
    setError("");

    const { data: financialEntry, error: financialError } = await supabase
      .from("financial_entries")
      .insert({
        company_id: company.id,
        description: `Rescisão — ${employee?.full_name} (${TYPE_LABEL[terminationType]})`,
        entry_type: "despesa",
        amount: calc.totalAmount,
        due_date: terminationDate,
        employee_id: employeeId,
        paid: false,
      })
      .select("id")
      .single();

    if (financialError) { setError(financialError.message); setSaving(false); return; }

    const { error: terminationError } = await supabase.from("terminations").insert({
      company_id: company.id,
      employee_id: employeeId,
      termination_date: terminationDate,
      termination_type: terminationType,
      notice_type: noticeType || null,
      balance_salary: calc.balanceSalary,
      proportional_vacation: calc.proportionalVacation,
      proportional_13th: calc.proportional13th,
      notice_amount: calc.noticeAmount,
      fgts_fine: calc.fgtsFine,
      other_amounts: -(calc.inssOnTaxable + calc.irrfOnTaxable), // registra o desconto de INSS/IRRF no total
      total_amount: calc.totalAmount,
      financial_entry_id: financialEntry.id,
    });

    if (terminationError) { setError(terminationError.message); setSaving(false); return; }

    await supabase.from("employees").update({ status: "inativo", termination_date: terminationDate }).eq("id", employeeId);

    setEmployeeId(""); setTerminationDate(""); setTerminationType(""); setNoticeType("");
    setSaving(false);
    loadEmployees();
    loadTerminations();
  }

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={styles.title}>Rescisão / Desligamento</h1>
        <p style={styles.subtitle}>
          As verbas rescisórias (saldo de salário, férias + 1/3, 13º proporcional, aviso prévio e
          multa de 40% do FGTS) e os descontos de INSS/IRRF são calculados automaticamente a partir
          da admissão e do salário do colaborador — nada é digitado manualmente. Ao gerar, cria a
          despesa em Financeiro → Contas a Pagar e marca o colaborador como inativo.
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
          <span style={styles.fieldLabel}>Data de desligamento</span>
          <input style={styles.input} type="date" value={terminationDate} onChange={(e) => setTerminationDate(e.target.value)} />
        </label>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>Tipo</span>
          <select style={styles.input} value={terminationType} onChange={(e) => setTerminationType(e.target.value)}>
            <option value="">Selecione...</option>
            {Object.entries(TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>Aviso prévio</span>
          <select style={styles.input} value={noticeType} onChange={(e) => setNoticeType(e.target.value)}>
            <option value="">Selecione...</option>
            <option value="trabalhado">Trabalhado</option>
            <option value="indenizado">Indenizado</option>
            <option value="dispensado">Dispensado</option>
          </select>
        </label>
      </div>

      {!employee && (employeeId || terminationDate) === "" && null}

      {employee && !employee.hire_date && (
        <div style={styles.error}>
          Este colaborador não tem data de admissão cadastrada em Cadastro → Colaboradores — sem ela
          não é possível calcular férias, 13º e aviso prévio automaticamente. Complete o cadastro antes de continuar.
        </div>
      )}

      {calc && (
        <div style={styles.autoBox}>
          <div style={styles.autoRow}>
            <span style={styles.autoLabel}>Saldo de salário</span>
            <span style={styles.autoValue}>R$ {calc.balanceSalary.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
          </div>
          <div style={styles.autoRow}>
            <span style={styles.autoLabel}>Férias proporcionais + 1/3 ({calc.vacationAvos}/12)</span>
            <span style={styles.autoValue}>R$ {calc.proportionalVacation.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
          </div>
          <div style={styles.autoRow}>
            <span style={styles.autoLabel}>13º proporcional ({calc.thirteenthAvos}/12)</span>
            <span style={styles.autoValue}>R$ {calc.proportional13th.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
          </div>
          <div style={styles.autoRow}>
            <span style={styles.autoLabel}>Aviso prévio {noticeType ? `(${calc.noticeDays} dias)` : ""}</span>
            <span style={styles.autoValue}>R$ {calc.noticeAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
          </div>
          <div style={styles.autoRow}>
            <span style={styles.autoLabel}>Multa 40% FGTS (estimada)</span>
            <span style={styles.autoValue}>R$ {calc.fgtsFine.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
          </div>
          <div style={{ ...styles.autoRow, borderTop: "1px solid var(--line)", paddingTop: 8, marginTop: 4 }}>
            <span style={styles.autoLabel}>(–) INSS sobre saldo + 13º</span>
            <span style={styles.autoValue}>R$ {calc.inssOnTaxable.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
          </div>
          <div style={styles.autoRow}>
            <span style={styles.autoLabel}>(–) IRRF sobre saldo + 13º</span>
            <span style={styles.autoValue}>R$ {calc.irrfOnTaxable.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
          </div>
          <p style={styles.disclaimer}>
            Estimativa pelas tabelas de INSS/IRRF vigentes em 2026 e pela regra de 8%/mês de FGTS.
            Confira o extrato de FGTS real e valide com o contador antes de pagar — este cálculo não
            substitui a apuração oficial da folha.
          </p>
        </div>
      )}

      <div style={styles.totalBox}>
        <span style={styles.totalLabel}>Total líquido das verbas rescisórias</span>
        <span style={styles.totalValue}>
          R$ {(calc?.totalAmount ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
        </span>
      </div>

      <button
        style={styles.generateBtn}
        onClick={generateTermination}
        disabled={saving || !employeeId || !terminationDate || !terminationType || !calc}
        type="button"
      >
        {saving ? "Gerando..." : "Gerar Rescisão (cria despesa e inativa colaborador)"}
      </button>

      <div style={styles.wrap}>
        <h2 style={styles.title2}>Histórico</h2>
        {terminations.length === 0 ? (
          <p style={styles.dim}>Nenhuma rescisão registrada ainda.</p>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr><th style={styles.th}>Colaborador</th><th style={styles.th}>Data</th><th style={styles.th}>Tipo</th><th style={styles.th}>Total</th></tr>
              </thead>
              <tbody>
                {terminations.map((t) => (
                  <tr key={t.id}>
                    <td style={styles.td}>{t.employees?.full_name}</td>
                    <td style={styles.td}>{new Date(t.termination_date + "T00:00:00").toLocaleDateString("pt-BR")}</td>
                    <td style={styles.td}>{TYPE_LABEL[t.termination_type]}</td>
                    <td style={styles.td}>R$ {Number(t.total_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
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
    display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14,
    background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: 20, marginTop: 20, maxWidth: 900,
  },
  autoBox: {
    display: "flex", flexDirection: "column", gap: 8,
    background: "var(--panel-2)", border: "1px dashed var(--line)", borderRadius: "var(--radius)",
    padding: "16px 20px", marginTop: 16, maxWidth: 900,
  },
  autoRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  autoLabel: { fontSize: 12.5, color: "var(--text-dim)" },
  autoValue: { fontSize: 13.5, fontWeight: 600 },
  disclaimer: { fontSize: 11.5, color: "var(--text-dim)", lineHeight: 1.5, marginTop: 8, marginBottom: 0 },
  totalBox: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    background: "var(--panel-2)", border: "1px solid var(--amber)", borderRadius: "var(--radius)",
    padding: "14px 20px", marginTop: 16, maxWidth: 900,
  },
  totalLabel: { fontSize: 13, color: "var(--text-dim)", fontWeight: 600 },
  totalValue: { fontFamily: "var(--font-display)", fontSize: 20, color: "var(--amber)" },
  generateBtn: {
    marginTop: 16, background: "var(--amber)", color: "#FFFFFF", border: "none",
    borderRadius: "var(--radius)", padding: "12px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer",
  },
  dim: { color: "var(--text-dim)", fontSize: 14 },
  tableWrap: { border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden", maxWidth: 700 },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em",
    color: "var(--text-dim)", padding: "10px 14px", background: "var(--panel)", borderBottom: "1px solid var(--line)",
  },
  td: { padding: "10px 14px", fontSize: 13.5, background: "var(--panel)", borderBottom: "1px solid var(--line)" },
  error: {
    background: "rgba(217,105,95,0.12)", border: "1px solid var(--red)", color: "var(--red)",
    borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 13, marginBottom: 16, maxWidth: 900,
  },
};
