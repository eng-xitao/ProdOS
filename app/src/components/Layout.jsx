import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

const NAV_ITEMS = [
  { to: "/", label: "Painel", icon: "◧", end: true },
  { to: "/clientes", label: "Clientes", icon: "◎" },
  { to: "/fornecedores", label: "Fornecedores", icon: "◇" },
  { to: "/produtos", label: "Produtos", icon: "◆" },
  { to: "/producao", label: "Produção", icon: "⚙" },
  { to: "/estoque", label: "Estoque", icon: "▤" },
  { to: "/vendas", label: "Vendas", icon: "◈" },
  { to: "/financeiro", label: "Financeiro", icon: "$" },
];

export default function Layout() {
  const { profile, company, signOut } = useAuth();

  return (
    <div style={styles.shell}>
      <aside style={styles.sidebar}>
        <div style={styles.brand}>
          <span style={{ color: "var(--amber)" }}>■</span> PRODOS
        </div>

        <nav style={styles.nav}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              style={({ isActive }) => ({
                ...styles.navItem,
                ...(isActive ? styles.navItemActive : {}),
              })}
            >
              <span style={styles.navIcon}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div style={styles.sidebarFooter}>
          <div style={styles.companyName}>{company?.name ?? "—"}</div>
          <div style={styles.userName}>{profile?.full_name ?? ""}</div>
          <button style={styles.signOut} onClick={signOut} type="button">
            Sair
          </button>
        </div>
      </aside>

      <main style={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}

const styles = {
  shell: { display: "flex", minHeight: "100%" },
  sidebar: {
    width: 220,
    background: "var(--panel)",
    borderRight: "1px solid var(--line)",
    display: "flex",
    flexDirection: "column",
    padding: "20px 14px",
    flexShrink: 0,
  },
  brand: {
    fontFamily: "var(--font-display)",
    fontSize: 16,
    letterSpacing: "0.06em",
    padding: "0 10px",
    marginBottom: 28,
  },
  nav: { display: "flex", flexDirection: "column", gap: 2, flex: 1 },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: "var(--radius)",
    color: "var(--text-dim)",
    fontSize: 14,
    textDecoration: "none",
    fontWeight: 500,
  },
  navItemActive: {
    background: "var(--panel-2)",
    color: "var(--amber)",
  },
  navIcon: { width: 16, display: "inline-block", textAlign: "center" },
  sidebarFooter: {
    borderTop: "1px solid var(--line)",
    paddingTop: 14,
    marginTop: 14,
  },
  companyName: { fontSize: 13, fontWeight: 600, color: "var(--text)" },
  userName: { fontSize: 12, color: "var(--text-dim)", marginTop: 2, marginBottom: 10 },
  signOut: {
    background: "transparent",
    border: "1px solid var(--line)",
    color: "var(--text-dim)",
    borderRadius: "var(--radius)",
    padding: "6px 10px",
    fontSize: 12,
    cursor: "pointer",
    width: "100%",
  },
  main: {
    flex: 1,
    padding: "28px 36px",
    overflowY: "auto",
    minWidth: 0,
  },
};
