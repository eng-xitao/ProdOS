import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

/**
 * Configuração Fiscal: dados necessários pra emitir NF-e — endereço
 * estruturado da empresa, inscrição estadual, regime tributário, e o
 * token de API do Focus NFe (gerado no painel deles, depois que a
 * empresa cadastra o CNPJ e o certificado digital lá).
 */
export default function FiscalPage() {
  const { company, refreshCompany } = useAuth();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (company) {
      setForm({
        logradouro: company.logradouro ?? "",
        numero: company.numero ?? "",
        bairro: company.bairro ?? "",
        municipio: company.municipio ?? "",
        uf: company.uf ?? "",
        cep: company.cep ?? "",
        inscricao_estadual: company.inscricao_estadual ?? "",
        regime_tributario: company.regime_tributario ?? 1,
        focus_nfe_token: company.focus_nfe_token ?? "",
        focus_nfe_ambiente: company.focus_nfe_ambiente ?? "homologacao",
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
    await supabase.from("companies").update(form).eq("id", company.id);
    await refreshCompany();
    setSuccess(true);
    setSaving(false);
  }

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={styles.title}>Configuração Fiscal</h1>
        <p style={styles.subtitle}>
          Dados necessários pra emitir Nota Fiscal Eletrônica (NF-e). Antes de preencher o token,
          cadastre sua empresa e o certificado digital no painel do{" "}
          <a href="https://focusnfe.com.br" target="_blank" rel="noreferrer" style={styles.link}>Focus NFe</a>.
        </p>
      </header>

      {success && <div style={styles.success}>Salvo.</div>}

      <form onSubmit={handleSave} style={styles.form}>
        <h2 style={styles.sectionTitle}>Endereço fiscal da empresa</h2>
        <div style={styles.grid}>
          <Field label="Logradouro" value={form.logradouro} onChange={(v) => updateField("logradouro", v)} />
          <Field label="Número" value={form.numero} onChange={(v) => updateField("numero", v)} />
          <Field label="Bairro" value={form.bairro} onChange={(v) => updateField("bairro", v)} />
          <Field label="Município" value={form.municipio} onChange={(v) => updateField("municipio", v)} />
          <Field label="UF" value={form.uf} onChange={(v) => updateField("uf", v.toUpperCase().slice(0, 2))} placeholder="SP" />
          <Field label="CEP" value={form.cep} onChange={(v) => updateField("cep", v)} placeholder="00000-000" />
        </div>

        <h2 style={styles.sectionTitle}>Dados fiscais</h2>
        <div style={styles.grid}>
          <Field label="Inscrição Estadual" value={form.inscricao_estadual} onChange={(v) => updateField("inscricao_estadual", v)} />
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Regime Tributário</span>
            <select style={styles.input} value={form.regime_tributario} onChange={(e) => updateField("regime_tributario", Number(e.target.value))}>
              <option value={1}>Simples Nacional</option>
              <option value={2}>Simples Nacional — excesso de sublimite</option>
              <option value={3}>Regime Normal</option>
            </select>
          </label>
        </div>

        <h2 style={styles.sectionTitle}>Focus NFe</h2>
        <div style={styles.grid}>
          <Field label="Token de API" value={form.focus_nfe_token} onChange={(v) => updateField("focus_nfe_token", v)} placeholder="Colado do painel do Focus NFe" />
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Ambiente</span>
            <select style={styles.input} value={form.focus_nfe_ambiente} onChange={(e) => updateField("focus_nfe_ambiente", e.target.value)}>
              <option value="homologacao">Homologação (testes, sem valor fiscal)</option>
              <option value="producao">Produção (nota real)</option>
            </select>
          </label>
        </div>

        <button style={styles.saveBtn} type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</button>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <label style={styles.field}>
      <span style={styles.fieldLabel}>{label}</span>
      <input style={styles.input} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}

const styles = {
  title: { fontFamily: "var(--font-display)", fontSize: 22, margin: 0 },
  subtitle: { color: "var(--text-dim)", fontSize: 13, margin: "6px 0 0", maxWidth: 640, lineHeight: 1.5 },
  link: { color: "var(--amber)", fontWeight: 600 },
  success: {
    background: "rgba(79,174,126,0.1)", border: "1px solid var(--green)", color: "var(--green)",
    borderRadius: "var(--radius)", padding: "10px 14px", fontSize: 13, marginBottom: 16, maxWidth: 720,
  },
  form: {
    background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: 20, maxWidth: 720,
  },
  sectionTitle: { fontSize: 14, marginTop: 20, marginBottom: 10 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  fieldLabel: { fontSize: 11, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" },
  input: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "9px 10px", color: "var(--text)", fontSize: 13,
  },
  saveBtn: {
    marginTop: 24, background: "var(--amber)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)",
    padding: "10px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer",
  },
};
