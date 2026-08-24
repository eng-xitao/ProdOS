import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import logoFull from "../assets/logo-full.png";

/**
 * Solicitar Demonstração: página pública (sem login), pra quem quer
 * conhecer o ProdOS antes de decidir. Não cria conta nenhuma — só
 * registra o interesse, que cai automaticamente como uma oportunidade
 * no Kanban de vendas do ProdOS.
 */
export default function SolicitarDemoPage() {
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSending(true);

    const { data, error } = await supabase.functions.invoke("submit-demo-request", {
      body: { name, companyName, email, phone, message },
    });

    if (error || data?.error) {
      setError("Não foi possível enviar agora. Tente novamente em instantes.");
    } else {
      setSent(true);
    }
    setSending(false);
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.panel}>
        <img src={logoFull} alt="ProdOS" style={styles.logo} />

        {sent ? (
          <>
            <h1 style={styles.title}>Recebemos seu pedido!</h1>
            <p style={styles.text}>
              Nossa equipe vai entrar em contato em breve pra combinar a demonstração. Enquanto
              isso, você já pode <a href="/login" style={styles.link}>ver os planos e preços</a>.
            </p>
          </>
        ) : (
          <>
            <h1 style={styles.title}>Quer ver o ProdOS funcionando?</h1>
            <p style={styles.text}>
              Preenche seus dados que a gente marca uma demonstração — sem compromisso, sem
              precisar criar conta agora.
            </p>

            {error && <div style={styles.error}>{error}</div>}

            <form onSubmit={handleSubmit} style={styles.form}>
              <Field label="Seu nome">
                <input style={styles.input} value={name} onChange={(e) => setName(e.target.value)} required />
              </Field>
              <Field label="Empresa">
                <input style={styles.input} value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
              </Field>
              <Field label="E-mail">
                <input style={styles.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </Field>
              <Field label="Telefone / WhatsApp">
                <input style={styles.input} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 90000-0000" />
              </Field>
              <Field label="Mensagem (opcional)">
                <textarea style={styles.textarea} rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Conta um pouco sobre o que você precisa" />
              </Field>
              <button style={styles.submitBtn} type="submit" disabled={sending}>
                {sending ? "Enviando..." : "Solicitar demonstração"}
              </button>
            </form>
          </>
        )}

        <a href="/login" style={styles.backLink}>← Já tem conta? Entrar</a>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={styles.field}>
      <span style={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

const styles = {
  wrap: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: 20 },
  panel: { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: "40px 36px", maxWidth: 440, width: "100%" },
  logo: { height: 36, marginBottom: 20, display: "block" },
  title: { fontFamily: "var(--font-display)", fontSize: 20, margin: "0 0 8px" },
  text: { color: "var(--text-dim)", fontSize: 13.5, lineHeight: 1.6, margin: "0 0 20px" },
  link: { color: "var(--amber)", fontWeight: 600 },
  form: { display: "flex", flexDirection: "column", gap: 14 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  fieldLabel: { fontSize: 11, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" },
  input: { background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: "10px 12px", color: "var(--text)", fontSize: 14 },
  textarea: { background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: "10px 12px", color: "var(--text)", fontSize: 14, resize: "vertical" },
  submitBtn: { background: "var(--amber)", color: "#FFFFFF", border: "none", borderRadius: "var(--radius)", padding: "12px 0", fontWeight: 700, fontSize: 14, cursor: "pointer", marginTop: 4 },
  backLink: { display: "block", textAlign: "center", marginTop: 20, fontSize: 12.5, color: "var(--text-dim)", textDecoration: "none" },
  error: { background: "rgba(217,105,95,0.12)", border: "1px solid var(--red)", color: "var(--red)", borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 13, marginBottom: 16 },
};
