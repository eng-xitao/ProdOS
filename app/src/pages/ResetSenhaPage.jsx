import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import Logo from "../components/Logo";

/**
 * Página para onde o link de "esqueci minha senha" (enviado por
 * e-mail pelo Supabase) redireciona. O Supabase já autentica a
 * pessoa temporariamente ao clicar no link, então aqui só é
 * preciso pedir a nova senha e confirmar.
 */
export default function ResetSenhaPage() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    const { error } = await updatePassword(password);
    setLoading(false);

    if (error) {
      setError("Não foi possível redefinir a senha. O link pode ter expirado — solicite um novo.");
    } else {
      setSuccess(true);
      setTimeout(() => navigate("/"), 2000);
    }
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.panel}>
        <div style={styles.brand}>
          <Logo size={32} />
        </div>
        <p style={styles.title}>Defina sua nova senha</p>

        {success ? (
          <div style={styles.notice}>Senha redefinida com sucesso. Redirecionando...</div>
        ) : (
          <form onSubmit={handleSubmit} style={styles.form}>
            <label style={styles.field}>
              <span style={styles.label}>Nova senha</span>
              <input
                style={styles.input}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                minLength={6}
                required
              />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Confirme a nova senha</span>
              <input
                style={styles.input}
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </label>

            {error && <div style={styles.error}>{error}</div>}

            <button style={styles.submit} type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Redefinir senha"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    background: "radial-gradient(circle at 20% 20%, #FFFFFF 0%, #F7F5F1 60%)",
  },
  panel: {
    width: "100%", maxWidth: 420, background: "var(--panel)", border: "1px solid var(--line)",
    borderRadius: "var(--radius)", padding: "32px 28px",
  },
  brand: {
    fontFamily: "var(--font-display)", fontSize: 20, letterSpacing: "0.08em",
    display: "flex", alignItems: "center", gap: 8,
  },
  brandMark: { color: "var(--amber)" },
  title: { color: "var(--text-dim)", fontSize: 14, marginTop: 8, marginBottom: 24 },
  form: { display: "flex", flexDirection: "column", gap: 14 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 12, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" },
  input: {
    background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "10px 12px", color: "var(--text)", fontSize: 14,
  },
  submit: {
    marginTop: 8, background: "var(--amber)", color: "#FFFFFF", border: "none",
    borderRadius: "var(--radius)", padding: "12px 0", fontWeight: 700, fontSize: 14, cursor: "pointer",
  },
  error: {
    background: "rgba(217,105,95,0.12)", border: "1px solid var(--red)", color: "var(--red)",
    borderRadius: "var(--radius)", padding: "8px 10px", fontSize: 13,
  },
  notice: {
    background: "rgba(79,174,126,0.12)", border: "1px solid var(--green)", color: "var(--green)",
    borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 13, lineHeight: 1.5,
  },
};
