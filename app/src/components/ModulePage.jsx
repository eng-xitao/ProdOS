import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import PrintHeader from "./PrintHeader";

/**
 * Página genérica de módulo: lista + formulário de criação + exclusão.
 * table: nome da tabela no Supabase
 * title / subtitle: cabeçalho da página
 * fields: [{ key, label, type: 'text'|'number'|'date'|'select', options?, placeholder? }]
 * columns: quais fields aparecem na tabela (por padrão, todos)
 */
export default function ModulePage({ table, title, subtitle, fields, emptyLabel, filterRows, extraValues, statusField, autoGenerateCode }) {
  const { company } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({});

  // Ao abrir o formulário de criação, pré-preenche o código
  // sequencial automático (ex: OP-0001), se configurado.
  useEffect(() => {
    if (formOpen && autoGenerateCode && company?.id) {
      supabase.rpc(autoGenerateCode.rpc, { p_company_id: company.id }).then(({ data }) => {
        if (data) setForm((f) => ({ ...f, [autoGenerateCode.field]: data }));
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formOpen]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setRows(filterRows ? filterRows(data ?? []) : (data ?? []));
    setLoading(false);
  }

  useEffect(() => {
    if (company?.id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  function updateField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true);
    setError("");

    if (!company?.id) {
      setError("Não foi possível identificar sua empresa. Saia e entre novamente; se persistir, contate o suporte.");
      setSaving(false);
      return;
    }

    const payload = { ...form, ...(extraValues ?? {}), company_id: company.id };
    const { error } = await supabase.from(table).insert(payload);
    if (error) {
      setError(error.message);
    } else {
      setForm({});
      setFormOpen(false);
      await load();
    }
    setSaving(false);
  }

  async function handleDelete(id) {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) setError(error.message);
    else setRows((r) => r.filter((row) => row.id !== id));
  }

  async function handleToggleStatus(id, current) {
    const { error } = await supabase.from(table).update({ [statusField.key]: !current }).eq("id", id);
    if (error) setError(error.message);
    else setRows((r) => r.map((row) => (row.id === id ? { ...row, [statusField.key]: !current } : row)));
  }

  async function handleQuickEdit(id, key, value) {
    const { error } = await supabase.from(table).update({ [key]: value }).eq("id", id);
    if (error) setError(error.message);
    else setRows((r) => r.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
  }

  return (
    <div>
      <PrintHeader title={title} />

      <header style={styles.header} className="no-print">
        <div>
          <h1 style={styles.title}>{title}</h1>
          <p style={styles.subtitle}>{subtitle}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={styles.printBtn} onClick={() => window.print()} type="button">
            Imprimir
          </button>
          <button style={styles.addBtn} onClick={() => setFormOpen((v) => !v)} type="button">
            {formOpen ? "Cancelar" : "+ Novo"}
          </button>
        </div>
      </header>

      {error && <div style={styles.error}>{error}</div>}

      {formOpen && (
        <form onSubmit={handleCreate} style={styles.form} className="no-print">
          {fields.map((f) => (
            <label key={f.key} style={styles.field}>
              <span style={styles.fieldLabel}>{f.label}</span>
              {f.type === "select" ? (
                <select
                  style={styles.input}
                  value={form[f.key] ?? ""}
                  onChange={(e) => updateField(f.key, e.target.value)}
                  required={f.required}
                >
                  <option value="" disabled>Selecione...</option>
                  {f.options.map((opt) => {
                    const value = typeof opt === "string" ? opt : opt.value;
                    const label = typeof opt === "string" ? opt : opt.label;
                    return <option key={value} value={value}>{label}</option>;
                  })}
                </select>
              ) : (
                <input
                  style={styles.input}
                  type={f.type ?? "text"}
                  placeholder={f.placeholder}
                  value={form[f.key] ?? ""}
                  onChange={(e) => updateField(f.key, e.target.value)}
                  required={f.required}
                  step={f.type === "number" ? "any" : undefined}
                />
              )}
            </label>
          ))}
          <button style={styles.submitBtn} type="submit" disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </form>
      )}

      {loading ? (
        <p style={styles.dim}>Carregando...</p>
      ) : rows.length === 0 ? (
        <p style={styles.dim}>{emptyLabel ?? "Nenhum registro ainda."}</p>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                {fields.map((f) => (
                  <th key={f.key} style={styles.th}>{f.label}</th>
                ))}
                {statusField && <th style={styles.th}>{statusField.label ?? "Status"}</th>}
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} style={styles.tr}>
                  {fields.map((f) => (
                    <td key={f.key} style={styles.td}>
                      {f.quickEdit && f.type === "select" ? (
                        <select
                          style={styles.inlineSelect}
                          value={row[f.key] ?? ""}
                          onChange={(e) => handleQuickEdit(row.id, f.key, e.target.value)}
                        >
                          {f.options.map((opt) => {
                            const value = typeof opt === "string" ? opt : opt.value;
                            const label = typeof opt === "string" ? opt : opt.label;
                            return <option key={value} value={value}>{label}</option>;
                          })}
                        </select>
                      ) : (
                        formatValue(row[f.key], f)
                      )}
                    </td>
                  ))}
                  {statusField && (
                    <td style={styles.td}>
                      <button
                        style={{ ...styles.statusBtn, ...(row[statusField.key] ? styles.statusTrue : styles.statusFalse) }}
                        onClick={() => handleToggleStatus(row.id, row[statusField.key])}
                        type="button"
                      >
                        {row[statusField.key] ? (statusField.trueLabel ?? "Concluído") : (statusField.falseLabel ?? "Pendente")}
                      </button>
                    </td>
                  )}
                  <td style={{ ...styles.td, textAlign: "right" }}>
                    <button style={styles.deleteBtn} onClick={() => handleDelete(row.id)} type="button">
                      Excluir
                    </button>
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

function formatValue(value, field) {
  if (value == null || value === "") return "—";
  if (field.type === "number") return Number(value).toLocaleString("pt-BR");
  if (field.type === "select" && Array.isArray(field.options)) {
    const match = field.options.find((opt) => (typeof opt === "string" ? opt : opt.value) === value);
    if (match) return typeof match === "string" ? match : match.label;
  }
  return String(value);
}

const styles = {
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0, letterSpacing: "0.02em" },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0" },
  printBtn: {
    background: "transparent",
    color: "var(--text-dim)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius)",
    padding: "9px 16px",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
    flexShrink: 0,
  },
  addBtn: {
    background: "var(--amber)",
    color: "#1A1400",
    border: "none",
    borderRadius: "var(--radius)",
    padding: "9px 16px",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
    flexShrink: 0,
  },
  form: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 12,
    background: "var(--panel)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius)",
    padding: 18,
    marginBottom: 22,
    alignItems: "end",
  },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  fieldLabel: { fontSize: 11, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" },
  input: {
    background: "var(--panel-2)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius)",
    padding: "9px 10px",
    color: "var(--text)",
    fontSize: 13,
  },
  submitBtn: {
    background: "var(--green)",
    color: "#052014",
    border: "none",
    borderRadius: "var(--radius)",
    padding: "10px 0",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
    gridColumn: "span 1",
  },
  dim: { color: "var(--text-dim)", fontSize: 14 },
  tableWrap: {
    border: "1px solid var(--line)",
    borderRadius: "var(--radius)",
    overflow: "hidden",
  },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: "var(--text-dim)",
    padding: "10px 14px",
    background: "var(--panel)",
    borderBottom: "1px solid var(--line)",
  },
  tr: { borderBottom: "1px solid var(--line)" },
  td: { padding: "10px 14px", fontSize: 13.5, background: "var(--panel)" },
  statusBtn: {
    border: "none",
    borderRadius: "var(--radius)",
    padding: "5px 12px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  statusTrue: { background: "rgba(79,174,126,0.15)", color: "var(--green)" },
  statusFalse: { background: "rgba(232,163,61,0.15)", color: "var(--amber)" },
  inlineSelect: {
    background: "var(--panel-2)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius)",
    padding: "5px 8px",
    color: "var(--text)",
    fontSize: 12.5,
  },
  deleteBtn: {
    background: "transparent",
    border: "1px solid var(--line)",
    color: "var(--red)",
    borderRadius: "var(--radius)",
    padding: "5px 10px",
    fontSize: 12,
    cursor: "pointer",
  },
  error: {
    background: "rgba(217,105,95,0.12)",
    border: "1px solid var(--red)",
    color: "var(--red)",
    borderRadius: "var(--radius)",
    padding: "10px 12px",
    fontSize: 13,
    marginBottom: 16,
  },
};
