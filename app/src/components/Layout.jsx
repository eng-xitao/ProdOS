import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import logoFull from "../assets/logo-full.png";
import { hasAccess, ROLE_LABEL, PLAN_UNRESTRICTED_ROLES } from "../lib/permissions";

const NAV_SECTIONS = [
  { label: "Cadastro", items: [{to:"/clientes",label:"Clientes",icon:"◎"},{to:"/fornecedores",label:"Fornecedores",icon:"◇"},{to:"/contatos",label:"Contatos",icon:"◈"},{to:"/produtos",label:"Produtos",icon:"◆"},{to:"/estrutura-produto",label:"Estrutura do Produto (BOM)",icon:"▤"},{to:"/tipos-ordem",label:"Tipos de Ordem",icon:"▦"},{to:"/etapas",label:"Etapas de Produção",icon:"→"},{to:"/etapas-comercial",label:"Etapas do Funil Comercial",icon:"→"},{to:"/centros-trabalho",label:"Centros de Trabalho",icon:"▣"},{to:"/almoxarifados",label:"Almoxarifados",icon:"▥"},{to:"/unidades-medida",label:"Unidades de Medida",icon:"%"},{to:"/condicoes-pagamento",label:"Cond. de Pagamento",icon:"◐"},{to:"/centros-custo",label:"Centros de Custo",icon:"◑"},{to:"/transportadoras",label:"Transportadoras",icon:"▶"}] },
  { label: "PCP", items: [{to:"/producao",label:"Ordens de Produção",icon:"⚙"},{to:"/imprimir-ordem-producao",label:"Imprimir Ordem de Produção",icon:"🖨"},{to:"/apontamento-producao",label:"Apontamento de Produção",icon:"◷"},{to:"/paradas-producao",label:"Paradas de Produção",icon:"⏸"},{to:"/mrp/materiais",label:"Necessidade de Materiais",icon:"▼"},{to:"/mrp/capacidade",label:"Plano Mestre de Produção",icon:"▲"},{to:"/requisicao-material",label:"Requisição de Material",icon:"📋"}] },
  { label: "Qualidade", items: [{to:"/qualidade/checklist",label:"Checklist de Qualidade",icon:"☑"},{to:"/qualidade/inspecao",label:"Inspeção de Qualidade",icon:"☑"},{to:"/qualidade/nao-conformidades",label:"Não Conformidades",icon:"⚠"}] },
  { label: "Comercial", items: [{to:"/oportunidades",label:"Oportunidades",icon:"◈"},{to:"/orcamentos",label:"Orçamentos",icon:"▤"},{to:"/pedidos-venda",label:"Pedidos de Venda",icon:"◆"},{to:"/cronograma-entregas",label:"Cronograma de Entregas",icon:"📅"},{to:"/notas-fiscais",label:"Notas Fiscais",icon:"🧾",planFeature:"Fiscal"},{to:"/sac",label:"SAC — Atendimento",icon:"◈",planFeature:"CRM"}] },
  { label: "Compras", items: [{to:"/sugestoes-compra",label:"Sugestões de Compra",icon:"💡"},{to:"/cotacoes",label:"Cotações",icon:"◐"},{to:"/pedidos-compra",label:"Pedidos de Compra",icon:"▼"},{to:"/importar-xml-nfe",label:"Importar XML NF-e",icon:"📄"}] },
  { label: "Almoxarifado", items: [{to:"/almoxarifado",label:"Estoque de Materiais",icon:"▥"},{to:"/requisicao-material",label:"Requisição de Material",icon:"📋"},{to:"/localizacoes-almoxarifado",label:"Localizações",icon:"▦"}] },
  { label: "Logística", items: [{to:"/recebimento-producao",label:"Recebimento de Produção",icon:"◆"},{to:"/expedicao",label:"Expedição",icon:"▶"},{to:"/transferencias",label:"Transferências",icon:"⇄"},{to:"/historico-movimentacoes",label:"Histórico de Movimentações",icon:"◷"},{to:"/estoque",label:"Estoque (Produto Acabado)",icon:"▤"}] },
  { label: "Custos", items: [{to:"/custos-margem",label:"Custo Padrão & Margem",icon:"%"}] },
  { label: "Financeiro", items: [{to:"/contas-receber",label:"Contas a Receber",icon:"◈"},{to:"/contas-pagar",label:"Contas a Pagar",icon:"◑"},{to:"/lancamentos",label:"Lançamentos Avulsos",icon:"$"},{to:"/fluxo-caixa",label:"Fluxo de Caixa",icon:"≈"},{to:"/tesouraria",label:"Tesouraria",icon:"▣"},{to:"/credito-cobranca",label:"Crédito e Cobrança",icon:"◐"},{to:"/analise-centro-custo",label:"Análise por Centro de Custo",icon:"◑"},{to:"/dre",label:"DRE Gerencial",icon:"▦"},{to:"/plano-contas",label:"Plano de Contas",icon:"☰"}] },
  { label: "RH", items: [{to:"/colaboradores",label:"Colaboradores",icon:"◎"},{to:"/jornadas-trabalho",label:"Jornadas de Trabalho",icon:"◷"},{to:"/ferias",label:"Férias",icon:"◐"},{to:"/folha-pagamento",label:"Folha de Pagamento",icon:"$"},{to:"/decimo-terceiro",label:"13º Salário",icon:"◑"},{to:"/rescisao",label:"Rescisão",icon:"✕"},{to:"/beneficios",label:"Benefícios",icon:"◈"}] },
  { label: "Bens/Ativos", items: [{to:"/frotas",label:"Bens e Ativos",icon:"▶"}] },
  { label: "Relatórios", items: [{to:"/relatorio-vendas",label:"Vendas",icon:"▲"},{to:"/relatorio-compras",label:"Compras",icon:"▼"},{to:"/relatorio-estoque-acabado",label:"Estoque — Produto Acabado",icon:"▤"},{to:"/relatorio-estoque-materiais",label:"Estoque — Materiais em Geral",icon:"▥"},{to:"/relatorio-almoxarifado",label:"Almoxarifado",icon:"▥"},{to:"/relatorio-producao",label:"Produção",icon:"⚙"},{to:"/curva-abc",label:"Curva ABC",icon:"%"},{to:"/relatorio-qualidade",label:"Qualidade e Refugo",icon:"☑",planFeature:"PCP"},{to:"/relatorio-financeiro",label:"Financeiro — Inadimplência",icon:"◑",planFeature:"Financeiro"},{to:"/relatorio-rh",label:"RH — Custo de Folha",icon:"$",planFeature:"RH"},{to:"/relatorio-fiscal",label:"Fiscal — Notas Emitidas",icon:"🧾",planFeature:"Fiscal"}] },
  { label: "Configurações", items: [{to:"/empresa",label:"Dados da Empresa",icon:"▣"},{to:"/fiscal",label:"Fiscal",icon:"🧾"},{to:"/usuarios",label:"Usuários",icon:"◎"},{to:"/assinatura",label:"Assinatura",icon:"◈"},{to:"/suporte",label:"Suporte",icon:"?"},{to:"/meus-dados-lgpd",label:"Meus Dados (LGPD)",icon:"🔒"}] }
];

export default function Layout() {
  const {profile,company,signOut,impersonation,stopImpersonating}=useAuth();
  const location=useLocation();
  const [mobileOpen,setMobileOpen]=useState(false);
  const [openSection,setOpenSection]=useState(()=>{const active=NAV_SECTIONS.find(s=>s.items.some(i=>i.to===location.pathname));return active?active.label:null;});
  const planFeatures=company?.plans?.features??[];
  const isPlatformAdmin=!!profile?.is_platform_admin;
  const isPlanUnrestricted=PLAN_UNRESTRICTED_ROLES.includes(profile?.role);
  const visibleSections=NAV_SECTIONS.filter(s=>s.platformAdminOnly?isPlatformAdmin:hasAccess(profile?.role,s.label)&&(s.label==="Configurações"||isPlanUnrestricted||planFeatures.includes(s.label)));
  const currentSection=NAV_SECTIONS.find(s=>s.items.some(i=>i.to===location.pathname));
  const currentItem=currentSection?.items.find(i=>i.to===location.pathname);
  const isBlocked=currentSection?currentSection.platformAdminOnly?!profile?.is_platform_admin||(currentItem?.platformRoles&&!currentItem.platformRoles.includes(profile?.platform_role)):!hasAccess(profile?.role,currentSection.label)||(currentSection.label!=="Configurações"&&!isPlanUnrestricted&&!planFeatures.includes(currentSection.label))||(currentItem?.planFeature&&!isPlanUnrestricted&&!planFeatures.includes(currentItem.planFeature)):false;

  useEffect(()=>{const active=NAV_SECTIONS.find(s=>s.items.some(i=>i.to===location.pathname));if(active)setOpenSection(active.label)},[location.pathname]);
  useEffect(()=>{setMobileOpen(false)},[location.pathname]);
  useEffect(()=>{document.body.style.overflow=mobileOpen?"hidden":"";return()=>{document.body.style.overflow=""}},[mobileOpen]);
  function toggleSection(label){setOpenSection(prev=>prev===label?null:label);}

  const navigation=(<nav className="prodos-navigation" style={styles.nav}>
    <NavLink to="/" end className="prodos-nav-link" style={({isActive})=>({...styles.navItem,...(isActive?styles.navItemActive:{}),marginBottom:10})}>
      <span style={styles.navIcon}>◧</span><span>Painel</span>
    </NavLink>
    {visibleSections.map(section=>{const isOpen=openSection===section.label;return <div key={section.label} style={styles.section}>
      <button type="button" onClick={()=>toggleSection(section.label)} style={styles.sectionToggle} aria-expanded={isOpen}>
        <span style={{...styles.chevron,transform:isOpen?"rotate(90deg)":"rotate(0deg)"}}>›</span><span>{section.label}</span>
      </button>
      {isOpen&&<div style={styles.sectionItems}>{section.items.filter(item=>!item.platformRoles||item.platformRoles.includes(profile?.platform_role)).filter(item=>!item.planFeature||isPlanUnrestricted||planFeatures.includes(item.planFeature)).map(item=><NavLink key={item.to} to={item.to} className="prodos-nav-link" style={({isActive})=>({...styles.navItem,...styles.navItemSecondary,...(isActive?styles.navItemActive:{})})}>
        <span style={styles.navIcon}>{item.icon}</span><span>{item.label}</span>
      </NavLink>)}</div>}
    </div>})}
  </nav>);

  return <div className="prodos-shell" style={styles.shell}>
    <button type="button" className="prodos-mobile-menu-btn no-print" onClick={()=>setMobileOpen(true)} aria-label="Abrir menu">☰ <span>Menu</span></button>
    {mobileOpen&&<button type="button" className="prodos-mobile-backdrop no-print" onClick={()=>setMobileOpen(false)} aria-label="Fechar menu" />}
    <aside className={`prodos-sidebar no-print${mobileOpen?" is-mobile-open":""}`} style={styles.sidebar}>
      <div className="prodos-mobile-close-row"><button type="button" onClick={()=>setMobileOpen(false)} aria-label="Fechar menu">×</button></div>
      <div style={styles.brand}><img src={logoFull} alt="ProdOS" style={{width:150,height:"auto",display:"block"}}/></div>
      {navigation}
      <div style={styles.sidebarFooter}><img src={logoFull} alt="ProdOS" style={styles.footerLogo}/><div style={styles.companyName}>{company?.name??"—"}</div><div style={styles.userName}>{profile?.full_name??""}{profile?.role&&` · ${ROLE_LABEL[profile.role]??profile.role}`}</div><button style={styles.signOut} onClick={signOut} type="button">Sair</button></div>
    </aside>
    <main className="prodos-main" style={styles.main}>
      {impersonation&&<div style={styles.impersonationBanner}><span>👁 Você está vendo como <strong>{impersonation.companies?.name??"essa empresa"}</strong> — modo suporte, acesso temporário.</span><button style={styles.impersonationBtn} onClick={stopImpersonating} type="button">Sair desse modo</button></div>}
      {isBlocked?<div style={styles.blocked}><h1 style={styles.blockedTitle}>Acesso não permitido</h1><p style={styles.blockedText}>Seu perfil ({ROLE_LABEL[profile?.role]??profile?.role}) não tem acesso a esta área. Fale com o administrador da sua empresa se precisar de acesso.</p></div>:<Outlet/>}
    </main>
  </div>;
}

const styles={
  impersonationBanner:{display:"flex",justifyContent:"space-between",alignItems:"center",background:"var(--amber)",color:"#FFFFFF",padding:"10px 20px",fontSize:13,fontWeight:600,marginBottom:16,borderRadius:"var(--radius)"},
  impersonationBtn:{background:"rgba(255,255,255,0.2)",border:"1px solid rgba(255,255,255,0.4)",color:"#FFFFFF",borderRadius:"var(--radius)",padding:"6px 14px",fontSize:12.5,fontWeight:700,cursor:"pointer"},
  shell:{display:"flex",minHeight:"100%"},
  sidebar:{width:236,background:"var(--panel)",borderRight:"1px solid var(--line)",display:"flex",flexDirection:"column",padding:"20px 14px",flexShrink:0,overflowY:"auto"},
  brand:{fontFamily:"var(--font-display)",fontSize:16,letterSpacing:"0.06em",padding:"0 10px",marginBottom:24},
  nav:{display:"flex",flexDirection:"column",flex:1},
  section:{marginBottom:4},
  sectionToggle:{display:"flex",alignItems:"center",gap:6,width:"100%",background:"var(--panel-2)",border:"1px solid var(--line)",color:"var(--text)",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",padding:"9px 12px",cursor:"pointer",textAlign:"left",borderRadius:"var(--radius)"},
  chevron:{display:"inline-block",fontSize:13,transition:"transform 0.15s ease",color:"var(--amber)"},
  sectionItems:{display:"flex",flexDirection:"column",gap:2,marginBottom:8,padding:"3px 0"},
  navItem:{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:"var(--radius)",color:"var(--text-dim)",fontSize:13.5,textDecoration:"none",fontWeight:500,background:"var(--panel)"},
  navItemSecondary:{paddingLeft:22,fontSize:13},
  navItemActive:{background:"var(--amber-dim)",color:"var(--amber)",border:"1px solid var(--line)"},
  navIcon:{width:16,display:"inline-block",textAlign:"center",flexShrink:0},
  sidebarFooter:{borderTop:"1px solid var(--line)",paddingTop:14,marginTop:14,flexShrink:0},
  footerLogo:{width:90,height:"auto",display:"block",marginBottom:10,opacity:.85},
  companyName:{fontSize:13,fontWeight:600,color:"var(--text)"},
  userName:{fontSize:12,color:"var(--text-dim)",marginTop:2,marginBottom:10},
  signOut:{background:"transparent",border:"1px solid var(--line)",color:"var(--text-dim)",borderRadius:"var(--radius)",padding:"6px 10px",fontSize:12,cursor:"pointer",width:"100%"},
  main:{flex:1,padding:"28px 36px",overflowY:"auto",minWidth:0},
  blocked:{maxWidth:480,marginTop:60},blockedTitle:{fontFamily:"var(--font-display)",fontSize:20,color:"var(--red)",margin:0},blockedText:{color:"var(--text-dim)",fontSize:14,lineHeight:1.6,marginTop:12}
};