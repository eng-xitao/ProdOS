import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

export default function EmpresaPage() {
  const { company, refreshCompany } = useAuth();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (company) {
      setForm({
        name: company.name ?? "",
        segment: company.segment ?? "",
        cnpj: company.cnpj ?? "",
        address: company.address ?? "",
        phone: company.phone ?? "",
        email: company.email ?? "",
        logo_url: company.logo_url ?? "",
        delete_pin: company.delete_pin ?? "",
      });
    }
  }, [company]);

  function updateField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    setSuccess(false);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess(false);

    const { error } = await supabase.from("companies").update(form).eq("id", company.id);
    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
      await refreshCompany();
    }
    setSaving(false);
  }

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={styles.title}>Dados da Empresa</h1>
        <p style={styles.subtitle}>
          Essas informações aparecem no cabeçalho do sistema e podem ser usadas em documentos
          como orçamentos e pedidos.
        </p>
      </header>

      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>Dados salvos com sucesso.</div>}

      <form onSubmit={handleSave} style={styles.form}>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>Nome da empresa</span>
          <input style={styles.input} value={form.name ?? ""} onChange={(e) => updateField("name", e.target.value)} required />
        </label>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>Segmento</span>
          <input style={styles.input} value={form.segment ?? ""} onChange={(e) => updateField("segment", e.target.value)} placeholder="Ex: Metalurgia, varejo, serviços..." />
        </label>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>CNPJ</span>
          <input style={styles.input} value={form.cnpj ?? ""} onChange={(e) => updateField("cnpj", e.target.value)} placeholder="00.000.000/0001-00" />
        </label>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>Endereço</span>
          <input style={styles.input} value={form.address ?? ""} onChange={(e) => updateField("address", e.target.value)} />
        </label>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>Telefone</span>
          <input style={styles.input} value={form.phone ?? ""} onChange={(e) => updateField("phone", e.target.value)} placeholder="(11) 90000-0000" />
        </label>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>E-mail</span>
          <input style={styles.input} type="email" value={form.email ?? ""} onChange={(e) => updateField("email", e.target.value)} />
        </label>
        <label style={styles.field}>
          <span style={styles.fieldLabel}>URL do logo</span>
          <input style={styles.input} value={form.logo_url ?? ""} onChange={(e) => updateField("logo_url", e.target.value)} placeholder="https://..." />
          <span style={styles.fieldHint}>Aparece nos documentos impressos (Orçamento, Pedido, Romaneio, Ordem de Produção).</span>
        </label>

        <div style={styles.pinBox}>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>PIN de exclusão (opcional)</span>
            <input
              style={styles.input}
              value={form.delete_pin ?? ""}
              onChange={(e) => updateField("delete_pin", e.target.value)}
              placeholder="Ex: 4821"
            />
            <span style={styles.fieldHint}>
              Se preenchido, o sistema passa a pedir esse PIN antes de excluir qualquer coisa (em qualquer
              tela). Compartilhe só com quem você confia pra apagar dados. Deixe em branco pra usar apenas
              a confirmação simples.
            </span>
          </label>
        </div>

        <button style={styles.saveBtn} type="submit" disabled={saving}>
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </form>
    </div>
  );
}

const styles = {
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0", maxWidth: 620, lineHeight: 1.5 },
  form: {
    display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16,
    background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: 24, marginTop: 20, maxWidth: 760,
  },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  fieldLabel: { fontSize: 11, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" },
  fieldHint: { fontSize: 11.5, color: "var(--text-dim)", lineHeight: 1.4 },
  pinBox: {
    marginTop: 8, padding: 14, background: "rgba(232,163,61,0.08)",
    border: "1px dashed var(--amber)", borderRadius: "var(--radius)",
  },
  input: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "9px 10px", color: "var(--text)", fontSize: 13,
  },
  saveBtn: {
    background: "var(--amber)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)",
    padding: "11px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer", height: 42, gridColumn: "1 / -1", justifySelf: "start",
  },
  error: {
    background: "rgba(217,105,95,0.12)", border: "1px solid var(--red)", color: "var(--red)",
    borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 13, marginBottom: 16, maxWidth: 620,
  },
  success: {
    background: "rgba(79,174,126,0.12)", border: "1px solid var(--green)", color: "var(--green)",
    borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 13, marginBottom: 16, maxWidth: 620,
  },
};
