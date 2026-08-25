import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { confirmDelete } from "../lib/deleteGuard";
import ModulePage from "../components/ModulePage";

const WEEKDAYS = [
  { value: "segunda", label: "Seg" },
  { value: "terca", label: "Ter" },
  { value: "quarta", label: "Qua" },
  { value: "quinta", label: "Qui" },
  { value: "sexta", label: "Sex" },
  { value: "sabado", label: "Sáb" },
  { value: "domingo", label: "Dom" },
];

const TYPE_LABEL = { normal: "Normal", pausa: "Pausa/Café", almoco: "Almoço" };
const TYPE_COLOR = { normal: "var(--green)", pausa: "var(--amber)", almoco: "var(--text-dim)" };

export default function JornadasTrabalhoPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div>
      <ModulePage
        key={refreshKey}
        table="work_schedules"
        title="Jornadas de Trabalho"
        subtitle="Cada empresa define sua própria carga horária — configure abaixo os blocos de horário de cada jornada"
        emptyLabel="Nenhuma jornada cadastrada ainda."
        fields={[
          { key: "name", label: "Nome da jornada", placeholder: "Ex: Jornada Administrativa, Turno Produção", required: true },
        ]}
      />
      <BlockEditor onChange={() => setRefreshKey((k) => k + 1)} />
    </div>
  );
}

function BlockEditor() {
  const { company } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [scheduleId, setScheduleId] = useState("");
  const [blocks, setBlocks] = useState([]);
  const [error, setError] = useState("");

  const [selectedDays, setSelectedDays] = useState([]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [blockType, setBlockType] = useState("normal");

  async function loadSchedules() {
    const { data } = await supabase.from("work_schedules").select("id, name").order("name");
    setSchedules(data ?? []);
  }

  async function loadBlocks(sid) {
    if (!sid) { setBlocks([]); return; }
    const { data } = await supabase
      .from("work_schedule_blocks")
      .select("id, weekday, start_time, end_time, block_type")
      .eq("work_schedule_id", sid)
      .order("start_time");
    setBlocks(data ?? []);
  }

  useEffect(() => {
    if (company?.id) loadSchedules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  useEffect(() => {
    loadBlocks(scheduleId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleId]);

  function toggleDay(day) {
    setSelectedDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]);
  }

  async function addBlocks(e) {
    e.preventDefault();
    setError("");
    if (!company?.id || !scheduleId || selectedDays.length === 0 || !startTime || !endTime) return;

    const rows = selectedDays.map((day) => ({
      company_id: company.id,
      work_schedule_id: scheduleId,
      weekday: day,
      start_time: startTime,
      end_time: endTime,
      block_type: blockType,
    }));

    const { error } = await supabase.from("work_schedule_blocks").insert(rows);
    if (error) setError(error.message);
    else {
      setSelectedDays([]); setStartTime(""); setEndTime(""); setBlockType("normal");
      loadBlocks(scheduleId);
    }
  }

  async function removeBlock(id) {
    if (!(await confirmDelete(company))) return;
    await supabase.from("work_schedule_blocks").delete().eq("id", id);
    loadBlocks(scheduleId);
  }

  // Soma as horas "normal" (trabalho) por dia da semana
  function hoursForDay(day) {
    return blocks
      .filter((b) => b.weekday === day && b.block_type === "normal")
      .reduce((sum, b) => {
        const [sh, sm] = b.start_time.split(":").map(Number);
        const [eh, em] = b.end_time.split(":").map(Number);
        return sum + (eh * 60 + em - (sh * 60 + sm)) / 60;
      }, 0);
  }

  return (
    <div style={styles.wrap}>
      <h2 style={styles.title}>Blocos de horário</h2>
      <p style={styles.subtitle}>
        Marque os dias em que esse bloco se aplica (ex: Segunda a Quinta juntos, se forem iguais)
        e adicione o horário e o tipo.
      </p>

      <label style={styles.field}>
        <span style={styles.fieldLabel}>Jornada</span>
        <select style={styles.input} value={scheduleId} onChange={(e) => setScheduleId(e.target.value)} onFocus={loadSchedules}>
          <option value="">Selecione...</option>
          {schedules.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>

      {scheduleId && (
        <>
          {error && <div style={styles.error}>{error}</div>}

          <form onSubmit={addBlocks} style={styles.form}>
            <div style={styles.dayCheckboxes}>
              {WEEKDAYS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDay(d.value)}
                  style={{ ...styles.dayBtn, ...(selectedDays.includes(d.value) ? styles.dayBtnActive : {}) }}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <div style={styles.formRow}>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Início</span>
                <input style={styles.input} type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Fim</span>
                <input style={styles.input} type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Tipo</span>
                <select style={styles.input} value={blockType} onChange={(e) => setBlockType(e.target.value)}>
                  <option value="normal">Normal</option>
                  <option value="pausa">Pausa/Café</option>
                  <option value="almoco">Almoço</option>
                </select>
              </label>
              <button style={styles.addBtn} type="submit">+ Adicionar</button>
            </div>
          </form>

          {WEEKDAYS.map((d) => {
            const dayBlocks = blocks.filter((b) => b.weekday === d.value);
            if (dayBlocks.length === 0) return null;
            return (
              <div key={d.value} style={styles.dayGroup}>
                <div style={styles.dayGroupTitle}>
                  {d.label === "Seg" ? "Segunda" : d.label === "Ter" ? "Terça" : d.label === "Qua" ? "Quarta" : d.label === "Qui" ? "Quinta" : d.label === "Sex" ? "Sexta" : d.label === "Sáb" ? "Sábado" : "Domingo"}
                  <span style={styles.dayTotal}> — {hoursForDay(d.value).toFixed(2)}h de trabalho</span>
                </div>
                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <tbody>
                      {dayBlocks.map((b) => (
                        <tr key={b.id}>
                          <td style={styles.td}>{b.start_time.slice(0, 5)} às {b.end_time.slice(0, 5)}</td>
                          <td style={{ ...styles.td, color: TYPE_COLOR[b.block_type], fontWeight: 700 }}>{TYPE_LABEL[b.block_type]}</td>
                          <td style={{ ...styles.td, textAlign: "right" }}>
                            <button style={styles.deleteBtn} onClick={() => removeBlock(b.id)} type="button">Remover</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

const styles = {
  wrap: { marginTop: 36, paddingTop: 28, borderTop: "1px solid var(--line)" },
  title: { fontFamily: "var(--font-display)", fontSize: 18, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 18px", maxWidth: 620, lineHeight: 1.5 },
  field: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 },
  fieldLabel: { fontSize: 11, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" },
  input: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "9px 10px", color: "var(--text)", fontSize: 13, maxWidth: 320,
  },
  form: {
    background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: 16, marginBottom: 20, maxWidth: 720,
  },
  dayCheckboxes: { display: "flex", gap: 6, marginBottom: 14 },
  dayBtn: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "8px 12px", color: "var(--text-dim)", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
  },
  dayBtnActive: { background: "var(--amber)", color: "#FFFFFF", borderColor: "var(--amber)" },
  formRow: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 12, alignItems: "end" },
  addBtn: {
    background: "var(--green)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)",
    padding: "9px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", height: 38, whiteSpace: "nowrap",
  },
  dayGroup: { marginBottom: 18 },
  dayGroupTitle: { fontSize: 13.5, fontWeight: 700, color: "var(--text)", marginBottom: 8 },
  dayTotal: { color: "var(--amber)", fontWeight: 600, fontSize: 12.5 },
  tableWrap: { border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden", maxWidth: 480 },
  table: { width: "100%", borderCollapse: "collapse" },
  td: { padding: "9px 14px", fontSize: 13, background: "var(--panel)", borderBottom: "1px solid var(--line)" },
  deleteBtn: {
    background: "transparent", border: "1px solid var(--line)", color: "var(--red)",
    borderRadius: "var(--radius)", padding: "4px 9px", fontSize: 11.5, cursor: "pointer",
  },
  error: {
    background: "rgba(217,105,95,0.12)", border: "1px solid var(--red)", color: "var(--red)",
    borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 13, marginBottom: 16, maxWidth: 720,
  },
};
