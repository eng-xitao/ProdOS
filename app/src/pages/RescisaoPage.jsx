import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

const TYPE_LABEL = {
  sem_justa_causa: "Sem justa causa",
  justa_causa: "Justa causa",
  pedido_demissao: "Pedido de demissão",
  acordo: "Acordo (distrato)",
  termino_contrato: "Término de contrato",
};

/**
 * Rescisão simplificada — os valores das verbas rescisórias são
 * informados manualmente (o sistema não calcula as fórmulas da
 * CLT). Ao gerar, cria a despesa no Financeiro e marca o
 * colaborador como inativo automaticamente.
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
  const [balanceSalary, setBalanceSalary] = useState("0");
  const [proportionalVacation, setProportionalVacation] = useState("0");
  const [proportional13th, setProportional13th] = useState("0");
  const [noticeAmount, setNoticeAmount] = useState("0");
  const [fgtsFine, setFgtsFine] = useState("0");
  const [otherAmounts, setOtherAmounts] = useState("0");

  async function loadEmployees() {
    const { data } = await supabase.from("employees").select("id, full_name").eq("status", "ativo").order("full_name");
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

  const totalAmount =
    Number(balanceSalary || 0) + Number(proportionalVacation || 0) + Number(proportional13th || 0)
    + Number(noticeAmount || 0) + Number(fgtsFine || 0) + Number(otherAmounts || 0);

  async function generateTermination() {
    if (!company?.id || !employeeId || !terminationDate || !terminationType) return;
    setSaving(true);
    setError("");

    const employee = employees.find((e) => e.id === employeeId);

    const { data: financialEntry, error: financialError } = await supabase
      .from("financial_entries")
      .insert({
        company_id: company.id,
        description: `Rescisão — ${employee?.full_name} (${TYPE_LABEL[terminationType]})`,
        entry_type: "despesa",
        amount: totalAmount,
        due_date: terminationDate,
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
      balance_salary: Number(balanceSalary || 0),
      proportional_vacation: Number(proportionalVacation || 0),
      proportional_13th: Number(proportional13th || 0),
      notice_amount: Number(noticeAmount || 0),
      fgts_fine: Number(fgtsFine || 0),
      other_amounts: Number(otherAmounts || 0),
      total_amount: totalAmount,
      financial_entry_id: financialEntry.id,
    });

    if (terminationError) { setError(terminationError.message); setSaving(false); return; }

    await supabase.from("employees").update({ status: "inativo", termination_date: terminationDate }).eq("id", employeeId);

    setEmployeeId(""); setTerminationDate(""); setTerminationType(""); setNoticeType("");
    setBalanceSalary("0"); setProportionalVacation("0"); setProportional13th("0");
    setNoticeAmount("0"); setFgtsFine("0"); setOtherAmounts("0");
    setSaving(false);
    loadEmployees();
    loadTerminations();
  }

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={styles.title}>Rescisão / Desligamento</h1>
        <p style={styles.subtitle}>
          Informe as verbas rescisórias manualmente. Ao gerar, cria a despesa em Financeiro →
          Contas a Pagar e marca o colaborador como inativo automaticamente.
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
        <label style={styles.field}>
          <span style={styles.fieldLabel}>Saldo de salário (R$)</span>
          <input style={styles.input} type="number" step="any" value={balanceSalary} onChange={(e) => setBalanceSalary(e.target.value)} />
        </label>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>Férias proporcionais + 1/3 (R$)</span>
          <input style={styles.input} type="number" step="any" value={proportionalVacation} onChange={(e) => setProportionalVacation(e.target.value)} />
        </label>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>13º proporcional (R$)</span>
          <input style={styles.input} type="number" step="any" value={proportional13th} onChange={(e) => setProportional13th(e.target.value)} />
        </label>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>Aviso prévio indenizado (R$)</span>
          <input style={styles.input} type="number" step="any" value={noticeAmount} onChange={(e) => setNoticeAmount(e.target.value)} />
        </label>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>Multa 40% FGTS (R$)</span>
          <input style={styles.input} type="number" step="any" value={fgtsFine} onChange={(e) => setFgtsFine(e.target.value)} />
        </label>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>Outros valores (R$)</span>
          <input style={styles.input} type="number" step="any" value={otherAmounts} onChange={(e) => setOtherAmounts(e.target.value)} />
        </label>
      </div>

      <div style={styles.totalBox}>
        <span style={styles.totalLabel}>Total das verbas rescisórias</span>
        <span style={styles.totalValue}>R$ {totalAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
      </div>

      <button style={styles.generateBtn} onClick={generateTermination} disabled={saving || !employeeId || !terminationDate || !terminationType} type="button">
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
  totalBox: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    background: "var(--panel-2)", border: "1px solid var(--amber)", borderRadius: "var(--radius)",
    padding: "14px 20px", marginTop: 16, maxWidth: 900,
  },
  totalLabel: { fontSize: 13, color: "var(--text-dim)", fontWeight: 600 },
  totalValue: { fontFamily: "var(--font-display)", fontSize: 20, color: "var(--amber)" },
  generateBtn: {
    marginTop: 16, background: "var(--amber)", color: "#1A1400", border: "none",
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
