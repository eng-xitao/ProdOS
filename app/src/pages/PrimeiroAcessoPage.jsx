import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { supabase } from "../lib/supabaseClient";
import logoFull from "../assets/logo-full.png";

export default function PrimeiroAcessoPage() {
  const { session, loading, updatePassword, signOut } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!loading && !session) setError("Este convite é inválido ou expirou. Solicite um novo convite ao administrador da sua empresa.");
  }, [loading, session]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!session) return;
    if (password.length < 8) return setError("A senha deve ter pelo menos 8 caracteres.");
    if (password !== confirm) return setError("As senhas não coincidem.");
    setSaving(true);
    const { error: passwordError } = await updatePassword(password);
    if (passwordError) {
      setError("Não foi possível salvar a senha. O convite pode ter expirado. Solicite um novo convite.");
      setSaving(false);
      return;
    }
    const { error: profileError } = await supabase.from("profiles").update({ password_set_at: new Date().toISOString() }).eq("id", session.user.id);
    if (profileError) {
      setError("A senha foi criada, mas não conseguimos concluir o registro do primeiro acesso. Entre em contato com o administrador.");
      setSaving(false);
      return;
    }
    setDone(true);
    setSaving(false);
    await signOut();
    setTimeout(() => navigate("/login", { replace: true }), 1200);
  }

  if (loading) return <div style={styles.wrap}><div style={styles.panel}>Carregando convite...</div></div>;

  return (
    <div style={styles.wrap}>
      <div style={styles.panel}>
        <img src={logoFull} alt="ProdOS" style={styles.logo} />
        <div style={styles.badge}>PRIMEIRO ACESSO</div>
        <h1 style={styles.title}>Crie sua senha de acesso</h1>
        <p style={styles.text}>Por segurança, defina sua senha pessoal antes de entrar no sistema. Depois de salvar, será necessário informar e-mail e senha no login.</p>
        {!session && <div style={styles.error}>{error}</div>}
        {session && !done && (
          <form onSubmit={handleSubmit} style={styles.form}>
            <PasswordField label="Senha" value={password} onChange={setPassword} show={showPassword} setShow={setShowPassword} />
            <PasswordField label="Confirme a senha" value={confirm} onChange={setConfirm} show={showConfirm} setShow={setShowConfirm} />
            {error && <div style={styles.error}>{error}</div>}
            <button style={styles.submit} disabled={saving}>{saving ? "Salvando senha..." : "Salvar senha e continuar"}</button>
          </form>
        )}
        {done && <div style={styles.success}>Senha cadastrada com sucesso. Agora entre usando seu e-mail e a nova senha.</div>}
      </div>
    </div>
  );
}

function PasswordField({ label, value, onChange, show, setShow }) {
  return <label style={styles.field}><span style={styles.label}>{label}</span><div style={styles.passwordWrap}><input style={styles.input} type={show ? "text" : "password"} value={value} onChange={e=>onChange(e.target.value)} autoComplete="new-password" minLength={8} required/><button type="button" style={styles.eye} onClick={()=>setShow(v=>!v)} aria-label={show ? "Ocultar senha" : "Visualizar senha"}>{show ? "Ocultar" : "Visualizar"}</button></div></label>;
}

const styles={
  wrap:{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:24,background:"radial-gradient(circle at 20% 20%, #FFFFFF 0%, #F7F5F1 60%)"},
  panel:{width:"100%",maxWidth:440,background:"var(--panel)",border:"1px solid var(--line)",borderRadius:"var(--radius)",padding:"34px 30px",boxShadow:"0 14px 40px rgba(15,23,42,.08)"},
  logo:{width:210,height:"auto",display:"block",marginBottom:18},badge:{display:"inline-block",fontSize:10,fontWeight:900,letterSpacing:".08em",color:"var(--amber)",background:"rgba(232,163,61,.12)",padding:"6px 9px",borderRadius:20},
  title:{fontFamily:"var(--font-display)",fontSize:25,margin:"13px 0 8px"},text:{fontSize:13,color:"var(--text-dim)",lineHeight:1.6,margin:"0 0 22px"},form:{display:"flex",flexDirection:"column",gap:15},field:{display:"flex",flexDirection:"column",gap:6},label:{fontSize:11,color:"var(--text-dim)",fontWeight:800,textTransform:"uppercase",letterSpacing:".04em"},passwordWrap:{position:"relative"},input:{width:"100%",boxSizing:"border-box",background:"var(--panel-2)",border:"1px solid var(--line)",borderRadius:"var(--radius)",padding:"11px 82px 11px 12px",color:"var(--text)",fontSize:14},eye:{position:"absolute",right:7,top:7,border:0,background:"transparent",color:"var(--amber)",fontSize:11,fontWeight:800,padding:"7px 6px",cursor:"pointer"},submit:{background:"var(--amber)",color:"white",border:0,borderRadius:"var(--radius)",padding:"12px",fontWeight:800,cursor:"pointer"},error:{background:"rgba(217,105,95,.12)",border:"1px solid var(--red)",color:"var(--red)",borderRadius:"var(--radius)",padding:"10px 12px",fontSize:12,lineHeight:1.45},success:{background:"rgba(79,174,126,.12)",border:"1px solid var(--green)",color:"var(--green)",borderRadius:"var(--radius)",padding:"11px 12px",fontSize:12,lineHeight:1.5}
};
