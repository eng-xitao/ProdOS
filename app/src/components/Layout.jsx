import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import logoFull from "../assets/logo-full.png";
import { hasAccess, ROLE_LABEL, PLAN_UNRESTRICTED_ROLES } from "../lib/permissions";

const NAV_SECTIONS = [
  {
    label: "Cadastro",
    items: [
      { to: "/clientes", label: "Clientes", icon: "◎" },
      { to: "/fornecedores", label: "Fornecedores", icon: "◇" },
      { to: "/contatos", label: "Contatos", icon: "◈" },
      { to: "/produtos", label: "Produtos", icon: "◆" },
      { to: "/estrutura-produto", label: "Estrutura do Produto (BOM)", icon: "▤" },
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
      { to: "/imprimir-ordem-producao", label: "Imprimir Ordem de Produção", icon: "🖨" },
      { to: "/apontamento-producao", label: "Apontamento de Produção", icon: "◷" },
      { to: "/paradas-producao", label: "Paradas de Produção", icon: "⏸" },
      { to: "/tipos-ordem", label: "Tipos de Ordem", icon: "▦" },
      { to: "/mrp/materiais", label: "Necessidade de Materiais", icon: "▼" },
      { to: "/mrp/capacidade", label: "Plano Mestre de Produção", icon: "▲" },
      { to: "/qualidade/checklist", label: "Checklist de Qualidade", icon: "☑" },
      { to: "/qualidade/inspecao", label: "Inspeção de Qualidade", icon: "☑" },
      { to: "/qualidade/nao-conformidades", label: "Não Conformidades", icon: "⚠" },
    ],
  },
  {
    label: "Comercial",
    items: [
      { to: "/oportunidades", label: "Oportunidades", icon: "◈" },
      { to: "/etapas-comercial", label: "Etapas", icon: "→" },
      { to: "/orcamentos", label: "Orçamentos", icon: "▤" },
      { to: "/pedidos-venda", label: "Pedidos de Venda", icon: "◆" },
      { to: "/notas-fiscais", label: "Notas Fiscais", icon: "🧾", planFeature: "Fiscal" },
      { to: "/sac", label: "SAC — Atendimento", icon: "◈", planFeature: "CRM" },
    ],
  },
  {
    label: "Compras",
    items: [
      { to: "/cotacoes", label: "Cotações", icon: "◐" },
      { to: "/pedidos-compra", label: "Pedidos de Compra", icon: "▼" },
      { to: "/almoxarifado", label: "Almoxarifado", icon: "▥" },
      { to: "/importar-xml-nfe", label: "Importar XML NF-e", icon: "📄" },
    ],
  },
  {
    label: "Logística",
    items: [
      { to: "/recebimento-producao", label: "Recebimento de Produção", icon: "◆" },
      { to: "/expedicao", label: "Expedição", icon: "▶" },
      { to: "/transferencias", label: "Transferências", icon: "⇄" },
      { to: "/historico-movimentacoes", label: "Histórico de Movimentações", icon: "◷" },
      { to: "/estoque", label: "Estoque (Produto Acabado)", icon: "▤" },
    ],
  },
  {
    label: "Custos",
    items: [
      { to: "/custos-margem", label: "Custo Padrão & Margem", icon: "%" },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { to: "/contas-receber", label: "Contas a Receber", icon: "◈" },
      { to: "/contas-pagar", label: "Contas a Pagar", icon: "◑" },
      { to: "/lancamentos", label: "Lançamentos Avulsos", icon: "$" },
      { to: "/fluxo-caixa", label: "Fluxo de Caixa", icon: "≈" },
      { to: "/tesouraria", label: "Tesouraria", icon: "▣" },
      { to: "/credito-cobranca", label: "Crédito e Cobrança", icon: "◐" },
      { to: "/analise-centro-custo", label: "Análise por Centro de Custo", icon: "◑" },
      { to: "/dre", label: "DRE Gerencial", icon: "▦" },
      { to: "/plano-contas", label: "Plano de Contas", icon: "☰" },
    ],
  },
  {
    label: "RH",
    items: [
      { to: "/colaboradores", label: "Colaboradores", icon: "◎" },
      { to: "/jornadas-trabalho", label: "Jornadas de Trabalho", icon: "◷" },
      { to: "/ferias", label: "Férias", icon: "◐" },
      { to: "/folha-pagamento", label: "Folha de Pagamento", icon: "$" },
      { to: "/decimo-terceiro", label: "13º Salário", icon: "◑" },
      { to: "/rescisao", label: "Rescisão", icon: "✕" },
      { to: "/beneficios", label: "Benefícios", icon: "◈" },
    ],
  },
  {
    label: "Frotas",
    items: [
      { to: "/frotas", label: "Frotas e Equipamentos", icon: "▶" },
    ],
  },
  {
    label: "Relatórios",
    items: [
      { to: "/relatorio-vendas", label: "Vendas", icon: "▲" },
      { to: "/relatorio-compras", label: "Compras", icon: "▼" },
      { to: "/relatorio-estoque-acabado", label: "Estoque — Produto Acabado", icon: "▤" },
      { to: "/relatorio-estoque-materiais", label: "Estoque — Materiais em Geral", icon: "▥" },
      { to: "/relatorio-almoxarifado", label: "Almoxarifado", icon: "▥" },
      { to: "/relatorio-producao", label: "Produção", icon: "⚙" },
      { to: "/curva-abc", label: "Curva ABC", icon: "%" },
      { to: "/relatorio-qualidade", label: "Qualidade e Refugo", icon: "☑", planFeature: "PCP" },
      { to: "/relatorio-financeiro", label: "Financeiro — Inadimplência", icon: "◑", planFeature: "Financeiro" },
      { to: "/relatorio-rh", label: "RH — Custo de Folha", icon: "$", planFeature: "RH" },
      { to: "/relatorio-fiscal", label: "Fiscal — Notas Emitidas", icon: "🧾", planFeature: "Fiscal" },
    ],
  },
  {
    label: "Configurações",
    items: [
      { to: "/empresa", label: "Dados da Empresa", icon: "▣" },
      { to: "/fiscal", label: "Fiscal", icon: "🧾" },
      { to: "/usuarios", label: "Usuários", icon: "◎" },
      { to: "/assinatura", label: "Assinatura", icon: "◈" },
      { to: "/suporte", label: "Suporte", icon: "?" },
      { to: "/meus-dados-lgpd", label: "Meus Dados (LGPD)", icon: "🔒" },
    ],
  },
  {
    label: "Administração",
    platformAdminOnly: true,
    items: [
      { to: "/admin/empresas", label: "Empresas", icon: "🏢", platformRoles: ["super_admin", "comercial", "financeiro"] },
      { to: "/admin/aprovacoes", label: "Aprovações", icon: "✓", platformRoles: ["super_admin", "comercial"] },
      { to: "/admin/planos", label: "Planos", icon: "⚙", platformRoles: ["super_admin"] },
      { to: "/admin/administradores", label: "Administradores", icon: "👤", platformRoles: ["super_admin"] },
      { to: "/admin/suporte", label: "Suporte", icon: "?", platformRoles: ["super_admin", "suporte"] },
      { to: "/admin/lgpd", label: "Solicitações LGPD", icon: "🔒", platformRoles: ["super_admin", "comercial"] },
    ],
  },
];

export default function Layout() {
  const { profile, company, signOut } = useAuth();
  const location = useLocation();

  const planFeatures = company?.plans?.features ?? [];
  const isPlatformAdmin = !!profile?.is_platform_admin;
  // "master" é o perfil de QA/testes: enxerga tudo, em qualquer empresa,
  // sem respeitar a trava de plano — diferente do admin comum.
  const isPlanUnrestricted = PLAN_UNRESTRICTED_ROLES.includes(profile?.role);

  const visibleSections = NAV_SECTIONS.filter((s) => {
    if (s.platformAdminOnly) return isPlatformAdmin;
    if (!hasAccess(profile?.role, s.label)) return false;
    // Configurações nunca trava por plano — senão a empresa fica
    // presa sem conseguir nem acessar a tela de Assinatura pra corrigir
    if (s.label === "Configurações" || isPlanUnrestricted) return true;
    return planFeatures.includes(s.label);
  });

  // Descobre se a rota atual pertence a uma seção que o papel do
  // usuário não tem permissão de ver — bloqueia mesmo por URL direta.
  const currentSection = NAV_SECTIONS.find((s) => s.items.some((i) => i.to === location.pathname));
  const currentItem = currentSection?.items.find((i) => i.to === location.pathname);
  const isBlocked = currentSection
    ? currentSection.platformAdminOnly
      ? !profile?.is_platform_admin || (currentItem?.platformRoles && !currentItem.platformRoles.includes(profile?.platform_role))
      : !hasAccess(profile?.role, currentSection.label) ||
        (currentSection.label !== "Configurações" && !isPlanUnrestricted && !planFeatures.includes(currentSection.label)) ||
        (currentItem?.planFeature && !isPlanUnrestricted && !planFeatures.includes(currentItem.planFeature))
    : false;

  // O bloqueio por pagamento pendente/cancelado já acontece antes,
  // no App.jsx (PrivateArea) — aqui só sobra o bloqueio por papel/plano.

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
      <aside className="no-print" style={styles.sidebar}>
        <div style={styles.brand}>
          <img src={logoFull} alt="ProdOS" style={{ width: 150, height: "auto", display: "block" }} />
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

          {visibleSections.map((section) => {
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
                    {section.items
                      .filter((item) => {
                        if (item.platformRoles && !item.platformRoles.includes(profile?.platform_role)) return false;
                        if (!item.planFeature) return true;
                        if (isPlanUnrestricted) return true;
                        return planFeatures.includes(item.planFeature);
                      })
                      .map((item) => (
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
          <img src={logoFull} alt="ProdOS" style={styles.footerLogo} />
          <div style={styles.companyName}>{company?.name ?? "—"}</div>
          <div style={styles.userName}>
            {profile?.full_name ?? ""}{profile?.role && ` · ${ROLE_LABEL[profile.role] ?? profile.role}`}
          </div>
          <button style={styles.signOut} onClick={signOut} type="button">
            Sair
          </button>
        </div>
      </aside>

      <main style={styles.main}>
        {isBlocked ? (
          <div style={styles.blocked}>
            <h1 style={styles.blockedTitle}>Acesso não permitido</h1>
            <p style={styles.blockedText}>
              Seu perfil ({ROLE_LABEL[profile?.role] ?? profile?.role}) não tem acesso a esta área.
              Fale com o administrador da sua empresa se precisar de acesso.
            </p>
          </div>
        ) : (
          <Outlet />
        )}
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
  footerLogo: { width: 90, height: "auto", display: "block", marginBottom: 10, opacity: 0.85 },
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
  blocked: { maxWidth: 480, marginTop: 60 },
  blockedTitle: { fontFamily: "var(--font-display)", fontSize: 20, color: "var(--red)", margin: 0 },
  blockedText: { color: "var(--text-dim)", fontSize: 14, lineHeight: 1.6, marginTop: 12 },
  blockedBtn: {
    display: "inline-block", marginTop: 20, background: "var(--amber)", color: "#FFFFFF",
    borderRadius: "var(--radius)", padding: "12px 24px", fontWeight: 700, fontSize: 14, textDecoration: "none",
  },
};
