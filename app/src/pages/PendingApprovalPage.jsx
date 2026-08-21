import { useAuth } from "../lib/AuthContext";
import logoFull from "../assets/logo-full.png";

/**
 * Tela exibida no lugar do sistema pra empresas com approval_status
 * != 'approved'. Ninguém acessa nenhuma tela do ProdOS antes do
 * time comercial aprovar o cadastro (ver App.jsx).
 */
export default function PendingApprovalPage({ status }) {
  const { signOut } = useAuth();

  const isRejected = status === "rejected";

  return (
    <div style={styles.wrap}>
      <div style={styles.panel}>
        <img src={logoFull} alt="ProdOS" style={styles.logo} />
        <h1 style={styles.title}>{isRejected ? "Cadastro não aprovado" : "Cadastro em análise"}</h1>
        <p style={styles.text}>
          {isRejected
            ? "Seu cadastro não foi aprovado pelo nosso time comercial. Se você acredita que isso é um engano, entre em contato com a gente."
            : "Recebemos seu cadastro! Nosso time comercial precisa aprovar o acesso antes de você entrar no sistema — isso costuma ser rápido. Você recebe um aviso assim que estiver liberado."}
        </p>
        <button style={styles.signOutBtn} onClick={signOut} type="button">Sair</button>
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
    background: "var(--bg)", padding: 20,
  },
  panel: {
    background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
    padding: "40px 36px", maxWidth: 440, textAlign: "center",
  },
  logo: { height: 40, marginBottom: 24 },
  title: { fontFamily: "var(--font-display)", fontSize: 20, margin: "0 0 12px" },
  text: { color: "var(--text-dim)", fontSize: 14, lineHeight: 1.6, margin: "0 0 24px" },
  signOutBtn: {
    background: "transparent", border: "1px solid var(--line)", color: "var(--text)",
    borderRadius: "var(--radius)", padding: "10px 20px", fontWeight: 600, fontSize: 13, cursor: "pointer",
  },
};
