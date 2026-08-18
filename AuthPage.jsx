import { useState } from "react";
import { useAuth } from "../lib/AuthContext";

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState("signup"); // "signup" | "login"
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [segment, setSegment] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);

    if (mode === "signup") {
      const { error } = await signUp({ email, password, fullName, companyName, segment });
      if (error) {
        setError(traduzErro(error.message));
      } else {
        setNotice("Conta criada. Verifique seu e-mail para confirmar o acesso, depois entre com login.");
        setMode("login");
      }
    } else {
      const { error } = await signIn({ email, password });
      if (error) setError(traduzErro(error.message));
    }

    setLoading(false);
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.panel}>
        <div style={styles.brand}>
          <span style={styles.brandMark}>■</span> PRODOS
        </div>
        <p style={styles.tagline}>Sistema operacional da produção — produção, estoque, vendas e financeiro num só lugar, para qualquer segmento.</p>

        <div style={styles.tabs}>
          <button
            style={{ ...styles.tab, ...(mode === "signup" ? styles.tabActive : {}) }}
            onClick={() => setMode("signup")}
            type="button"
          >
            Criar conta
          </button>
          <button
            style={{ ...styles.tab, ...(mode === "login" ? styles.tabActive : {}) }}
            onClick={() => setMode("login")}
            type="button"
          >
            Entrar
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          {mode === "signup" && (
            <>
              <Field label="Nome da empresa">
                <input
                  style={styles.input}
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Ex: Belmonte Serralheria"
                  required
                />
              </Field>
              <Field label="Segmento">
                <input
                  style={styles.input}
                  value={segment}
                  onChange={(e) => setSegment(e.target.value)}
                  placeholder="Ex: Metalurgia, varejo, serviços..."
                />
              </Field>
              <Field label="Seu nome">
                <input
                  style={styles.input}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nome completo"
                  required
                />
              </Field>
            </>
          )}

          <Field label="E-mail">
            <input
              style={styles.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@empresa.com"
              required
            />
          </Field>

          <Field label="Senha">
            <input
              style={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              minLength={6}
              required
            />
          </Field>

          {error && <div style={styles.error}>{error}</div>}
          {notice && <div style={styles.notice}>{notice}</div>}

          <button style={styles.submit} type="submit" disabled={loading}>
            {loading ? "Aguarde..." : mode === "signup" ? "Criar minha conta" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      {children}
    </label>
  );
}

function traduzErro(msg) {
  if (msg.includes("already registered")) return "Este e-mail já está cadastrado. Tente entrar.";
  if (msg.includes("Invalid login")) return "E-mail ou senha incorretos.";
  if (msg.includes("Password should be")) return "A senha deve ter pelo menos 6 caracteres.";
  return msg;
}

const styles = {
  wrap: {
    minHeight: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    background:
      "radial-gradient(circle at 20% 20%, #1C2128 0%, #14181C 60%)",
  },
  panel: {
    width: "100%",
    maxWidth: 420,
    background: "var(--panel)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius)",
    padding: "32px 28px",
  },
  brand: {
    fontFamily: "var(--font-display)",
    fontSize: 20,
    letterSpacing: "0.08em",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  brandMark: { color: "var(--amber)" },
  tagline: {
    color: "var(--text-dim)",
    fontSize: 14,
    lineHeight: 1.5,
    marginTop: 8,
    marginBottom: 24,
  },
  tabs: {
    display: "flex",
    gap: 4,
    marginBottom: 20,
    background: "var(--panel-2)",
    padding: 4,
    borderRadius: "var(--radius)",
  },
  tab: {
    flex: 1,
    padding: "8px 0",
    background: "transparent",
    border: "none",
    color: "var(--text-dim)",
    fontSize: 13,
    fontWeight: 600,
    borderRadius: 4,
    cursor: "pointer",
  },
  tabActive: {
    background: "var(--ink)",
    color: "var(--amber)",
  },
  form: { display: "flex", flexDirection: "column", gap: 14 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 12, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" },
  input: {
    background: "var(--panel-2)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius)",
    padding: "10px 12px",
    color: "var(--text)",
    fontSize: 14,
  },
  submit: {
    marginTop: 8,
    background: "var(--amber)",
    color: "#1A1400",
    border: "none",
    borderRadius: "var(--radius)",
    padding: "12px 0",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  },
  error: {
    background: "rgba(217,105,95,0.12)",
    border: "1px solid var(--red)",
    color: "var(--red)",
    borderRadius: "var(--radius)",
    padding: "8px 10px",
    fontSize: 13,
  },
  notice: {
    background: "rgba(79,174,126,0.12)",
    border: "1px solid var(--green)",
    color: "var(--green)",
    borderRadius: "var(--radius)",
    padding: "8px 10px",
    fontSize: 13,
  },
};
