import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

const NAV_SECTIONS = [
  {
    label: "Cadastro",
    items: [
      { to: "/clientes", label: "Clientes", icon: "◎" },
      { to: "/fornecedores", label: "Fornecedores", icon: "◇" },
      { to: "/produtos", label: "Produtos", icon: "◆" },
      { to: "/etapas", label: "Etapas", icon: "→" },
      { to: "/centros-trabalho", label: "Centros de Trabalho", icon: "▣" },
      { to: "/almoxarifados", label: "Almoxarifados", icon: "▥" },
      { to: "/unidades-medida", label: "Unidades de Medida", icon: "%" },
      { to: "/condicoes-pagamento", label: "Cond. de Pagamento", icon: "◐" },
      { to: "/centros-custo", label: "Centros de Custo", icon: "◑" },
      { to: "/transportadoras", label: "Transportadoras", icon: "▶" },
    ],
  },
  {
    label: "PCP",
    items: [
      { to: "/producao", label: "Ordens de Produção", icon: "⚙" },
      { to: "/mrp/materiais", label: "Necessidade de Materiais", icon: "▼" },
      { to: "/mrp/capacidade", label: "Capacidade", icon: "▲" },
    ],
  },
  {
    label: "Comercial",
    items: [
      { to: "/oportunidades", label: "Oportunidades", icon: "◈" },
      { to: "/etapas-comercial", label: "Etapas", icon: "→" },
      { to: "/orcamentos", label: "Orçamentos", icon: "▤" },
      { to: "/pedidos-venda", label: "Pedidos de Venda", icon: "◆" },
    ],
  },
  {
    label: "Compras",
    items: [
      { to: "/cotacoes", label: "Cotações", icon: "◐" },
      { to: "/pedidos-compra", label: "Pedidos de Compra", icon: "▼" },
      { to: "/almoxarifado", label: "Almoxarifado", icon: "▥" },
    ],
  },
  {
    label: "Logística",
    items: [
      { to: "/recebimento-producao", label: "Recebimento de Produção", icon: "◆" },
      { to: "/expedicao", label: "Expedição", icon: "▶" },
      { to: "/transferencias", label: "Transferências", icon: "⇄" },
      { to: "/estoque", label: "Estoque", icon: "▤" },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { to: "/contas-receber", label: "Contas a Receber", icon: "◈" },
      { to: "/contas-pagar", label: "Contas a Pagar", icon: "◑" },
      { to: "/lancamentos", label: "Lançamentos Avulsos", icon: "$" },
      { to: "/fluxo-caixa", label: "Fluxo de Caixa", icon: "≈" },
      { to: "/dre", label: "DRE", icon: "▦" },
    ],
  },
];

export default function Layout() {
  const { profile, company, signOut } = useAuth();
  const location = useLocation();

  const [openSections, setOpenSections] = useState(() => {
    const initial = {};
    NAV_SECTIONS.forEach((s) => {
      initial[s.label] = s.items.some((i) => location.pathname === i.to);
    });
    return initial;
  });

  // Se navegar (ex: clicando num link "Cadastro → Etapas" de outra tela),
  // garante que a seção correspondente já esteja aberta.
  useEffect(() => {
    setOpenSections((prev) => {
      const next = { ...prev };
      NAV_SECTIONS.forEach((s) => {
        if (s.items.some((i) => i.to === location.pathname)) next[s.label] = true;
      });
      return next;
    });
  }, [location.pathname]);

  function toggleSection(label) {
    setOpenSections((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  return (
    <div style={styles.shell}>
      <aside style={styles.sidebar}>
        <div style={styles.brand}>
          <span style={{ color: "var(--amber)" }}>■</span> PRODOS
        </div>

        <nav style={styles.nav}>
          <NavLink
            to="/"
            end
            style={({ isActive }) => ({
              ...styles.navItem,
              ...(isActive ? styles.navItemActive : {}),
              marginBottom: 10,
            })}
          >
            <span style={styles.navIcon}>◧</span>
            Painel
          </NavLink>

          {NAV_SECTIONS.map((section) => {
            const isOpen = !!openSections[section.label];
            return (
              <div key={section.label} style={styles.section}>
                <button
                  type="button"
                  onClick={() => toggleSection(section.label)}
                  style={styles.sectionToggle}
                >
                  <span style={{ ...styles.chevron, transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}>›</span>
                  {section.label}
                </button>

                {isOpen && (
                  <div style={styles.sectionItems}>
                    {section.items.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        style={({ isActive }) => ({
                          ...styles.navItem,
                          ...styles.navItemSecondary,
                          ...(isActive ? styles.navItemActive : {}),
                        })}
                      >
                        <span style={styles.navIcon}>{item.icon}</span>
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
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
    width: 236,
    background: "var(--panel)",
    borderRight: "1px solid var(--line)",
    display: "flex",
    flexDirection: "column",
    padding: "20px 14px",
    flexShrink: 0,
    overflowY: "auto",
  },
  brand: {
    fontFamily: "var(--font-display)",
    fontSize: 16,
    letterSpacing: "0.06em",
    padding: "0 10px",
    marginBottom: 24,
  },
  nav: { display: "flex", flexDirection: "column", flex: 1 },
  section: { marginBottom: 4 },
  sectionToggle: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    width: "100%",
    background: "transparent",
    border: "none",
    color: "var(--text-dim)",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    padding: "8px 12px",
    cursor: "pointer",
    textAlign: "left",
  },
  chevron: {
    display: "inline-block",
    fontSize: 13,
    transition: "transform 0.15s ease",
    color: "var(--amber)",
  },
  sectionItems: {
    display: "flex",
    flexDirection: "column",
    gap: 1,
    marginBottom: 8,
  },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 12px",
    borderRadius: "var(--radius)",
    color: "var(--text-dim)",
    fontSize: 13.5,
    textDecoration: "none",
    fontWeight: 500,
  },
  navItemSecondary: {
    paddingLeft: 22,
    fontSize: 13,
  },
  navItemActive: {
    background: "var(--panel-2)",
    color: "var(--amber)",
  },
  navIcon: { width: 16, display: "inline-block", textAlign: "center", flexShrink: 0 },
  sidebarFooter: {
    borderTop: "1px solid var(--line)",
    paddingTop: 14,
    marginTop: 14,
    flexShrink: 0,
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
