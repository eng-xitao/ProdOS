import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { confirmDelete } from "../lib/deleteGuard";
import ModulePage from "../components/ModulePage";

export default function BeneficiosPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div>
      <ModulePage
        key={refreshKey}
        table="benefit_types"
        title="Benefícios"
        subtitle="Catálogo de benefícios oferecidos (Vale Transporte, Vale Refeição, Plano de Saúde...)"
        emptyLabel="Nenhum tipo de benefício cadastrado ainda."
        fields={[
          { key: "name", label: "Nome", placeholder: "Ex: Vale Refeição", required: true },
          { key: "default_monthly_cost", label: "Custo mensal padrão", type: "currency" },
        ]}
      />
      <EmployeeBenefitsEditor onChange={() => setRefreshKey((k) => k + 1)} />
    </div>
  );
}

function EmployeeBenefitsEditor() {
  const { company } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [benefitTypes, setBenefitTypes] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [error, setError] = useState("");

  const [employeeId, setEmployeeId] = useState("");
  const [benefitTypeId, setBenefitTypeId] = useState("");
  const [monthlyCost, setMonthlyCost] = useState("");
  const [employeeDiscount, setEmployeeDiscount] = useState("0");

  async function loadBaseData() {
    const [e, b] = await Promise.all([
      supabase.from("employees").select("id, full_name").eq("status", "ativo").order("full_name"),
      supabase.from("benefit_types").select("id, name, default_monthly_cost").order("name"),
    ]);
    setEmployees(e.data ?? []);
    setBenefitTypes(b.data ?? []);
  }

  async function loadAssignments() {
    const { data } = await supabase
      .from("employee_benefits")
      .select("id, monthly_cost, employee_discount, active, employees:employee_id (full_name), benefit_types:benefit_type_id (name)")
      .order("created_at", { ascending: false });
    setAssignments(data ?? []);
  }

  useEffect(() => {
    if (company?.id) { loadBaseData(); loadAssignments(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  function handleBenefitChange(id) {
    setBenefitTypeId(id);
    const type = benefitTypes.find((b) => b.id === id);
    if (type) setMonthlyCost(String(type.default_monthly_cost ?? 0));
  }

  async function addAssignment(e) {
    e.preventDefault();
    setError("");
    if (!company?.id || !employeeId || !benefitTypeId) return;
    const { error } = await supabase.from("employee_benefits").insert({
      company_id: company.id,
      employee_id: employeeId,
      benefit_type_id: benefitTypeId,
      monthly_cost: Number(monthlyCost || 0),
      employee_discount: Number(employeeDiscount || 0),
      start_date: new Date().toISOString().slice(0, 10),
    });
    if (error) setError(error.message);
    else {
      setEmployeeId(""); setBenefitTypeId(""); setMonthlyCost(""); setEmployeeDiscount("0");
      loadAssignments();
    }
  }

  async function removeAssignment(id) {
    if (!(await confirmDelete(company))) return;
    await supabase.from("employee_benefits").delete().eq("id", id);
    loadAssignments();
  }

  return (
    <div style={styles.wrap}>
      <h2 style={styles.title}>Benefícios por colaborador</h2>
      <p style={styles.subtitle}>Atribua um benefício do catálogo acima a cada colaborador.</p>

      {benefitTypes.length === 0 ? (
        <p style={styles.dim}>Cadastre ao menos um tipo de benefício acima primeiro.</p>
      ) : (
        <>
          {error && <div style={styles.error}>{error}</div>}

          <form onSubmit={addAssignment} style={styles.form}>
            <label style={styles.field}>
              <span style={styles.fieldLabel}>Colaborador</span>
              <select style={styles.input} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required>
                <option value="">Selecione...</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
              </select>
            </label>
            <label style={styles.field}>
              <span style={styles.fieldLabel}>Benefício</span>
              <select style={styles.input} value={benefitTypeId} onChange={(e) => handleBenefitChange(e.target.value)} required>
                <option value="">Selecione...</option>
                {benefitTypes.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
            <label style={styles.field}>
              <span style={styles.fieldLabel}>Custo mensal (R$)</span>
              <input style={styles.input} type="number" step="any" value={monthlyCost} onChange={(e) => setMonthlyCost(e.target.value)} />
            </label>
            <label style={styles.field}>
              <span style={styles.fieldLabel}>Desconto do colaborador (R$)</span>
              <input style={styles.input} type="number" step="any" value={employeeDiscount} onChange={(e) => setEmployeeDiscount(e.target.value)} />
            </label>
            <button style={styles.addBtn} type="submit">+ Atribuir</button>
          </form>

          {assignments.length === 0 ? (
            <p style={styles.dim}>Nenhum benefício atribuído ainda.</p>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr><th style={styles.th}>Colaborador</th><th style={styles.th}>Benefício</th><th style={styles.th}>Custo mensal</th><th style={styles.th}>Desconto</th><th style={styles.th}></th></tr>
                </thead>
                <tbody>
                  {assignments.map((a) => (
                    <tr key={a.id}>
                      <td style={styles.td}>{a.employees?.full_name}</td>
                      <td style={styles.td}>{a.benefit_types?.name}</td>
                      <td style={styles.td}>R$ {Number(a.monthly_cost).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                      <td style={styles.td}>R$ {Number(a.employee_discount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                      <td style={{ ...styles.td, textAlign: "right" }}>
                        <button style={styles.deleteBtn} onClick={() => removeAssignment(a.id)} type="button">Remover</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const styles = {
  wrap: { marginTop: 36, paddingTop: 28, borderTop: "1px solid var(--line)" },
  title: { fontFamily: "var(--font-display)", fontSize: 18, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 18px", maxWidth: 620, lineHeight: 1.5 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  fieldLabel: { fontSize: 11, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" },
  input: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "9px 10px", color: "var(--text)", fontSize: 13,
  },
  form: {
    display: "grid", gridTemplateColumns: "1.5fr 1.5fr 1fr 1fr auto", gap: 12, alignItems: "end",
    background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 16, marginBottom: 18,
  },
  addBtn: {
    background: "var(--green)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)",
    padding: "9px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", height: 38, whiteSpace: "nowrap",
  },
  dim: { color: "var(--text-dim)", fontSize: 14 },
  tableWrap: { border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden", maxWidth: 800 },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em",
    color: "var(--text-dim)", padding: "10px 14px", background: "var(--panel)", borderBottom: "1px solid var(--line)",
  },
  td: { padding: "10px 14px", fontSize: 13.5, background: "var(--panel)", borderBottom: "1px solid var(--line)" },
  deleteBtn: {
    background: "transparent", border: "1px solid var(--line)", color: "var(--red)",
    borderRadius: "var(--radius)", padding: "5px 10px", fontSize: 12, cursor: "pointer",
  },
  error: {
    background: "rgba(217,105,95,0.12)", border: "1px solid var(--red)", color: "var(--red)",
    borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 13, marginBottom: 16, maxWidth: 800,
  },
};
