import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import logoProdos from "../assets/logo-full.png";
import logoProdlog from "../assets/brands/prodlog-logo.svg";
import logoProdpersonal from "../assets/brands/prodpersonal-logo.svg";

const BRANDS = {
  prodos: { name: "ProdOS", logo: logoProdos, accent: "#2563EB", question: "Quer ver o ProdOS funcionando?" },
  prodlog: { name: "ProdLog", logo: logoProdlog, accent: "#2563EB", question: "Quer ver o ProdLog funcionando?" },
  prodpersonal: { name: "ProdPersonal", logo: logoProdpersonal, accent: "#4FAE7E", question: "Quer ver o ProdPersonal funcionando?" },
};

/**
 * Solicitar Demonstração: página pública (sem login), compartilhada
 * pelos 3 produtos. O parâmetro ?produto= define qual marca aparece e
 * é gravado junto com o pedido, pra saber de qual sistema é o interesse
 * sem precisar de e-mail ou formulário separado por produto.
 */
export default function SolicitarDemoPage() {
  const [searchParams] = useSearchParams();
  const produto = searchParams.get("produto");
  const brand = BRANDS[produto] ?? BRANDS.prodos;

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
      body: { name, companyName, email, phone, message, produto: brand.name },
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
        <img src={brand.logo} alt={brand.name} style={styles.logo} />

        {sent ? (
          <>
            <h1 style={styles.title}>Recebemos seu pedido!</h1>
            <p style={styles.text}>
              Nossa equipe vai entrar em contato em breve pra combinar a demonstração do {brand.name}.
              Enquanto isso, você já pode <a href="/login" style={{ ...styles.link, color: brand.accent }}>ver os planos e preços</a>.
            </p>
          </>
        ) : (
          <>
            <h1 style={styles.title}>{brand.question}</h1>
            <p style={styles.text}>
              Preenche seus dados que a gente marca uma demonstração do {brand.name} — sem compromisso,
              sem precisar criar conta agora.
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
              <button style={{ ...styles.submitBtn, background: brand.accent }} type="submit" disabled={sending}>
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
  link: { fontWeight: 600 },
  form: { display: "flex", flexDirection: "column", gap: 14 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  fieldLabel: { fontSize: 11, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" },
  input: { background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: "10px 12px", color: "var(--text)", fontSize: 14 },
  textarea: { background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: "10px 12px", color: "var(--text)", fontSize: 14, resize: "vertical" },
  submitBtn: { color: "#FFFFFF", border: "none", borderRadius: "var(--radius)", padding: "12px 0", fontWeight: 700, fontSize: 14, cursor: "pointer", marginTop: 4 },
  backLink: { display: "block", textAlign: "center", marginTop: 20, fontSize: 12.5, color: "var(--text-dim)", textDecoration: "none" },
  error: { background: "rgba(217,105,95,0.12)", border: "1px solid var(--red)", color: "var(--red)", borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 13, marginBottom: 16 },
};
