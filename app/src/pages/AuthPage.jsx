import { useState } from "react";
import { useAuth } from "../lib/AuthContext";
import { supabase } from "../lib/supabaseClient";
import logoFull from "../assets/logo-full.png";

export default function AuthPage() {
  const { signIn, signUp, requestPasswordReset } = useAuth();
  const [mode, setMode] = useState("signup"); // "signup" | "login" | "forgot"
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [segment, setSegment] = useState("");

  const [cnpj, setCnpj] = useState("");
  const [cnpjChecking, setCnpjChecking] = useState(false);
  const [cnpjStatus, setCnpjStatus] = useState(""); // "" | "checking" | "taken" | "found" | "not_found" | "invalid"
  const [address, setAddress] = useState(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  function formatCnpj(value) {
    const digits = value.replace(/\D/g, "").slice(0, 14);
    return digits
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }

  async function handleCnpjBlur() {
    const digits = cnpj.replace(/\D/g, "");
    if (digits.length !== 14) {
      setCnpjStatus(digits.length > 0 ? "invalid" : "");
      return;
    }

    setCnpjChecking(true);
    setCnpjStatus("checking");
    setAddress(null);

    // 1. Confere se esse CNPJ já tem cadastro no ProdOS
    const { data: taken } = await supabase.rpc("check_cnpj_taken", { p_cnpj: digits });
    if (taken) {
      setCnpjStatus("taken");
      setCnpjChecking(false);
      return;
    }

    // 2. Consulta os dados oficiais da empresa (Receita Federal, via BrasilAPI)
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (res.ok) {
        const data = await res.json();
        setCompanyName(data.razao_social || data.nome_fantasia || companyName);
        setAddress({
          logradouro: [data.descricao_tipo_de_logradouro, data.logradouro].filter(Boolean).join(" ").trim(),
          numero: data.numero || "",
          bairro: data.bairro || "",
          municipio: data.municipio || "",
          uf: data.uf || "",
          cep: data.cep || "",
        });
        setCnpjStatus("found");
      } else {
        setCnpjStatus("not_found");
      }
    } catch {
      setCnpjStatus("not_found");
    }
    setCnpjChecking(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setNotice("");

    if (mode === "signup" && cnpjStatus === "taken") {
      setError("Já existe um cadastro no ProdOS com esse CNPJ. Se você faz parte dessa empresa, peça pra ser convidado por um administrador dela.");
      return;
    }
    if (mode === "signup" && !acceptedTerms) {
      setError("Você precisa aceitar os Termos de Uso e a Política de Privacidade pra continuar.");
      return;
    }

    setLoading(true);

    if (mode === "signup") {
      const { error } = await signUp({ email, password, fullName, companyName, segment, cnpj: cnpj.replace(/\D/g, ""), address });
      if (error) {
        setError(traduzErro(error.message));
      } else {
        setNotice("Conta criada. Verifique seu e-mail para confirmar o acesso. Depois de confirmar, escolha um plano e conclua o pagamento para liberar o sistema — não tem período de teste.");
        setMode("login");
      }
    } else if (mode === "login") {
      const { error } = await signIn({ email, password });
      if (error) setError(traduzErro(error.message));
    } else if (mode === "forgot") {
      const { error } = await requestPasswordReset(email);
      if (error) {
        setError(traduzErro(error.message));
      } else {
        setNotice("Se esse e-mail estiver cadastrado, você vai receber um link para redefinir a senha em instantes.");
      }
    }

    setLoading(false);
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.panel}>
        <div style={styles.brand}>
          <img src={logoFull} alt="ProdOS" style={styles.logoImg} />
        </div>
        <p style={styles.tagline}>Sistema operacional da produção — produção, estoque, vendas e financeiro num só lugar, para qualquer segmento.</p>

        {mode !== "forgot" && (
          <div style={styles.tabs}>
            <button
              style={{ ...styles.tab, ...(mode === "signup" ? styles.tabActive : {}) }}
              onClick={() => { setMode("signup"); setError(""); setNotice(""); }}
              type="button"
            >
              Criar conta
            </button>
            <button
              style={{ ...styles.tab, ...(mode === "login" ? styles.tabActive : {}) }}
              onClick={() => { setMode("login"); setError(""); setNotice(""); }}
              type="button"
            >
              Entrar
            </button>
          </div>
        )}

        {mode === "forgot" && (
          <div style={styles.forgotHeader}>
            <span style={styles.forgotTitle}>Redefinir senha</span>
            <p style={styles.forgotSubtitle}>Informe seu e-mail e enviaremos um link para você criar uma nova senha.</p>
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          {mode === "signup" && (
            <>
              <a href="https://prodos.app.br/#planos" style={styles.plansLink} target="_blank" rel="noreferrer">
                Ainda não conhece os planos? Veja preços e o que cada um libera →
              </a>
              <a href="/demo" style={styles.demoLink}>
                Prefere ver funcionando antes? Solicite uma demonstração →
              </a>
              <p style={styles.inviteHint}>
                Foi convidado por e-mail? Cadastre-se normalmente usando o mesmo e-mail do
                convite — o campo "Nome da empresa" abaixo será ignorado nesse caso.
              </p>
              <Field label="CNPJ">
                <input
                  style={styles.input}
                  value={cnpj}
                  onChange={(e) => { setCnpj(formatCnpj(e.target.value)); setCnpjStatus(""); }}
                  onBlur={handleCnpjBlur}
                  placeholder="00.000.000/0000-00"
                  required
                />
                {cnpjStatus === "checking" && <span style={styles.cnpjHintChecking}>Consultando...</span>}
                {cnpjStatus === "taken" && <span style={styles.cnpjHintError}>Já existe cadastro com esse CNPJ. Peça pra ser convidado pelo admin da empresa.</span>}
                {cnpjStatus === "found" && <span style={styles.cnpjHintOk}>Encontrado — nome e endereço preenchidos automaticamente.</span>}
                {cnpjStatus === "not_found" && <span style={styles.cnpjHintWarn}>Não encontramos esse CNPJ na Receita Federal — confira se digitou certo, ou preencha os dados manualmente mesmo assim.</span>}
                {cnpjStatus === "invalid" && <span style={styles.cnpjHintError}>CNPJ incompleto.</span>}
              </Field>
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

          {mode !== "forgot" && (
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
          )}

          {mode === "login" && (
            <button
              type="button"
              onClick={() => { setMode("forgot"); setError(""); setNotice(""); }}
              style={styles.forgotLink}
            >
              Esqueci minha senha
            </button>
          )}

          {error && <div style={styles.error}>{error}</div>}
          {notice && <div style={styles.notice}>{notice}</div>}

          {mode === "signup" && (
            <label style={styles.termsRow}>
              <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} />
              <span>
                Li e aceito os{" "}
                <a href="/termos" target="_blank" rel="noreferrer" style={styles.link}>Termos de Uso</a>{" "}
                e a{" "}
                <a href="/privacidade" target="_blank" rel="noreferrer" style={styles.link}>Política de Privacidade</a>.
              </span>
            </label>
          )}

          <button style={styles.submit} type="submit" disabled={loading || (mode === "signup" && (cnpjStatus === "taken" || cnpjChecking))}>
            {loading ? "Aguarde..." : mode === "signup" ? "Criar minha conta" : mode === "forgot" ? "Enviar link de redefinição" : "Entrar"}
          </button>

          {mode === "forgot" && (
            <button
              type="button"
              onClick={() => { setMode("login"); setError(""); setNotice(""); }}
              style={styles.backLink}
            >
              ← Voltar para o login
            </button>
          )}
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
      "radial-gradient(circle at 20% 20%, #FFFFFF 0%, #F7F5F1 60%)",
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
  logoImg: { width: 220, height: "auto", display: "block" },
  brandMark: { color: "var(--amber)" },
  tagline: {
    color: "var(--text-dim)",
    fontSize: 14,
    lineHeight: 1.5,
    marginTop: 8,
    marginBottom: 24,
  },
  plansLink: {
    display: "block",
    fontSize: 13,
    fontWeight: 700,
    color: "var(--amber)",
    background: "rgba(232,163,61,0.1)",
    border: "1px solid var(--amber)",
    borderRadius: "var(--radius)",
    padding: "10px 12px",
    marginBottom: 8,
    textAlign: "center",
    textDecoration: "none",
  },
  cnpjHintChecking: { fontSize: 11.5, color: "var(--text-dim)", marginTop: 4, display: "block" },
  demoLink: {
    display: "block", fontSize: 12.5, color: "var(--text-dim)", textAlign: "center",
    marginBottom: 12, textDecoration: "underline",
  },
  termsRow: {
    display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "var(--text-dim)",
    lineHeight: 1.5, margin: "4px 0 12px",
  },
  link: { color: "var(--amber)", fontWeight: 600 },
  cnpjHintOk: { fontSize: 11.5, color: "var(--green)", marginTop: 4, display: "block", fontWeight: 600 },
  cnpjHintWarn: { fontSize: 11.5, color: "var(--amber)", marginTop: 4, display: "block" },
  cnpjHintError: { fontSize: 11.5, color: "var(--red)", marginTop: 4, display: "block", fontWeight: 600 },
  inviteHint: {
    fontSize: 12,
    color: "var(--text-dim)",
    lineHeight: 1.5,
    background: "var(--panel-2)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius)",
    padding: "10px 12px",
    marginBottom: 4,
  },
  forgotHeader: { marginBottom: 20 },
  forgotTitle: { fontSize: 16, fontWeight: 700, color: "var(--text)" },
  forgotSubtitle: { fontSize: 13, color: "var(--text-dim)", lineHeight: 1.5, marginTop: 6 },
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
    background: "var(--panel)",
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
  forgotLink: {
    background: "none",
    border: "none",
    color: "var(--amber)",
    fontSize: 12.5,
    cursor: "pointer",
    textAlign: "right",
    padding: 0,
    marginTop: -6,
  },
  backLink: {
    background: "none",
    border: "none",
    color: "var(--text-dim)",
    fontSize: 12.5,
    cursor: "pointer",
    textAlign: "center",
    padding: 0,
  },
  submit: {
    marginTop: 8,
    background: "var(--amber)",
    color: "#FFFFFF",
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
