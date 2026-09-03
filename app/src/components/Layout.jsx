import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import logoFull from "../assets/logo-full.png";
import { hasAccess, ROLE_LABEL, PLAN_UNRESTRICTED_ROLES } from "../lib/permissions";

const NAV_SECTIONS = [
  { label:"CRM", icon:"◎", items:[
    {to:"/oportunidades",label:"Oportunidades",icon:"◈"},{to:"/etapas-comercial",label:"Etapas do Funil",icon:"→"},{to:"/clientes",label:"Clientes",icon:"◎"},{to:"/contatos",label:"Contatos",icon:"◈"}
  ]},
  { label:"Comercial", icon:"◆", items:[
    {to:"/orcamentos",label:"Orçamentos",icon:"▤"},{to:"/pedidos-venda",label:"Pedidos de Venda",icon:"◆"},{to:"/cronograma-entregas",label:"Cronograma de Entregas",icon:"📅"},{to:"/sac",label:"SAC — Atendimento",icon:"◈",planFeature:"CRM"}
  ]},
  { label:"Estoque", icon:"▥", items:[
    {to:"/estoque",label:"Estoque de Produtos",icon:"▤"},{to:"/almoxarifado",label:"Estoque de Materiais",icon:"▥"},{to:"/transferencias",label:"Transferências",icon:"⇄"},{to:"/historico-movimentacoes",label:"Movimentações",icon:"◷"},{to:"/recebimento-producao",label:"Recebimento da Produção",icon:"◆"},{to:"/localizacoes-almoxarifado",label:"Localizações",icon:"▦"}
  ]},
  { label:"Compras", icon:"◇", items:[
    {to:"/sugestoes-compra",label:"Sugestões de Compra",icon:"💡"},{to:"/requisicao-material",label:"Solicitações de Material",icon:"📋"},{to:"/cotacoes",label:"Cotações",icon:"◐"},{to:"/pedidos-compra",label:"Pedidos de Compra",icon:"▼"},{to:"/importar-xml-nfe",label:"Recebimento / XML NF-e",icon:"📄"}
  ]},
  /* PCP somente planeja. Não duplica apontamentos, paradas ou fila operacional. */
  { label:"PCP", icon:"▲", items:[
    {to:"/mrp/materiais",label:"MRP — Necessidade de Materiais",icon:"▼"},{to:"/mrp/capacidade",label:"Plano Mestre / Capacidade",icon:"▲"},{to:"/producao",label:"Ordens de Produção / Planejamento",icon:"⚙"}
  ]},
  /* Produção executa as OPs planejadas pelo PCP. */
  { label:"Producao", icon:"⚙", items:[
    {to:"/producao",label:"Fila de Produção",icon:"⚙"},{to:"/apontamento-producao",label:"Apontamentos de Produção",icon:"◷"},{to:"/paradas-producao",label:"Paradas de Produção",icon:"⏸"},{to:"/imprimir-ordem-producao",label:"Imprimir OP",icon:"🖨"},{to:"/qualidade/checklist",label:"Checklists de Qualidade",icon:"☑"},{to:"/qualidade/inspecao",label:"Inspeções",icon:"☑"},{to:"/qualidade/nao-conformidades",label:"Não Conformidades",icon:"⚠"}
  ]},
  { label:"Logistica", icon:"▶", items:[
    {to:"/expedicao",label:"Expedição",icon:"▶"},{to:"/cronograma-entregas",label:"Entregas",icon:"📅"}
  ]},
  { label:"Frotas", icon:"🚛", items:[{to:"/frotas",label:"Bens e Ativos / Frotas",icon:"▶"}]},
  { label:"Fiscal", icon:"🧾", items:[
    {to:"/notas-fiscais",label:"Notas Fiscais",icon:"🧾"},{to:"/fiscal",label:"Configuração Fiscal",icon:"⚙"},{to:"/importar-xml-nfe",label:"Importar XML NF-e",icon:"📄"}
  ]},
  { label:"Financeiro", icon:"$", items:[
    {to:"/contas-receber",label:"Contas a Receber",icon:"◈"},{to:"/contas-pagar",label:"Contas a Pagar",icon:"◑"},{to:"/fluxo-caixa",label:"Fluxo de Caixa",icon:"≈"},{to:"/tesouraria",label:"Tesouraria",icon:"▣"},{to:"/credito-cobranca",label:"Crédito e Cobrança",icon:"◐"},{to:"/lancamentos",label:"Lançamentos",icon:"$"},{to:"/plano-contas",label:"Plano de Contas",icon:"☰"}
  ]},
  { label:"Gestao", icon:"📊", items:[
    {to:"/relatorio-vendas",label:"Comercial / Vendas",icon:"▲"},{to:"/relatorio-compras",label:"Compras",icon:"▼"},{to:"/relatorio-estoque-acabado",label:"Estoque de Produtos",icon:"▤"},{to:"/relatorio-estoque-materiais",label:"Materiais",icon:"▥"},{to:"/relatorio-producao",label:"Produção",icon:"⚙"},{to:"/relatorio-qualidade",label:"Qualidade e Refugo",icon:"☑"},{to:"/relatorio-financeiro",label:"Financeiro",icon:"◑"},{to:"/analise-centro-custo",label:"Centros de Custo",icon:"◑"},{to:"/dre",label:"DRE Gerencial",icon:"▦"},{to:"/curva-abc",label:"Curva ABC",icon:"%"},{to:"/relatorio-fiscal",label:"Fiscal",icon:"🧾"}
  ]},
  { label:"Cadastros", icon:"▣", items:[
    {to:"/empresa",label:"Empresa",icon:"▣"},{to:"/clientes",label:"Clientes",icon:"◎"},{to:"/fornecedores",label:"Fornecedores",icon:"◇"},{to:"/produtos",label:"Produtos",icon:"◆"},{to:"/estrutura-produto",label:"Estrutura do Produto (BOM)",icon:"▤"},{to:"/etapas",label:"Etapas de Produção",icon:"→"},{to:"/centros-trabalho",label:"Centros de Trabalho",icon:"▣"},{to:"/almoxarifados",label:"Almoxarifados",icon:"▥"},{to:"/unidades-medida",label:"Unidades de Medida",icon:"%"},{to:"/condicoes-pagamento",label:"Condições de Pagamento",icon:"◐"},{to:"/centros-custo",label:"Centros de Custo",icon:"◑"},{to:"/transportadoras",label:"Transportadoras",icon:"▶"},{to:"/tipos-ordem",label:"Tipos de Ordem",icon:"▦"}
  ]},
];

export default function Layout(){
  const {profile,company,signOut,impersonation,stopImpersonating}=useAuth();
  const location=useLocation();
  const [mobileOpen,setMobileOpen]=useState(false);
  const [openSection,setOpenSection]=useState(null);
  const planFeatures=company?.plans?.features??[];
  const isPlanUnrestricted=PLAN_UNRESTRICTED_ROLES.includes(profile?.role);
  const visibleSections=NAV_SECTIONS.filter(s=>hasAccess(profile?.role,s.label)&&(isPlanUnrestricted||planFeatures.includes(s.label)||s.label==="Cadastros"));
  const currentSection=NAV_SECTIONS.find(s=>s.items.some(i=>i.to===location.pathname));
  const currentItem=currentSection?.items.find(i=>i.to===location.pathname);
  const isBlocked=currentSection ? !hasAccess(profile?.role,currentSection.label) || (!isPlanUnrestricted && currentSection.label!=="Cadastros" && !planFeatures.includes(currentSection.label)) || (currentItem?.planFeature && !isPlanUnrestricted && !planFeatures.includes(currentItem.planFeature)) : false;
  useEffect(()=>{if(currentSection)setOpenSection(currentSection.label)},[currentSection?.label]);
  useEffect(()=>{setMobileOpen(false)},[location.pathname]);
  useEffect(()=>{document.body.style.overflow=mobileOpen?"hidden":"";return()=>{document.body.style.overflow=""}},[mobileOpen]);
  const navigation=<nav className="prodos-navigation" style={styles.nav}>
    <NavLink to="/" end className="prodos-nav-link" style={({isActive})=>({...styles.navItem,...(isActive?styles.navItemActive:{})})}><span style={styles.navIcon}>◧</span><span>Painel</span></NavLink>
    {visibleSections.map(section=>{const isOpen=openSection===section.label;return <div key={section.label} style={styles.section}>
      <button type="button" onClick={()=>setOpenSection(isOpen?null:section.label)} style={styles.sectionToggle} aria-expanded={isOpen}><span style={{...styles.chevron,transform:isOpen?"rotate(90deg)":"none"}}>›</span><span>{section.icon}</span><span>{section.label}</span></button>
      {isOpen&&<div style={styles.sectionItems}>{section.items.filter(item=>!item.planFeature||isPlanUnrestricted||planFeatures.includes(item.planFeature)).map(item=><NavLink key={item.to} to={item.to} className="prodos-nav-link" style={({isActive})=>({...styles.navItem,...styles.navItemSecondary,...(isActive?styles.navItemActive:{})})}><span style={styles.navIcon}>{item.icon}</span><span>{item.label}</span></NavLink>)}</div>}
    </div>})}
    <div style={{marginTop:"auto",paddingTop:12}}><NavLink to="/usuarios" className="prodos-nav-link" style={({isActive})=>({...styles.navItem,...(isActive?styles.navItemActive:{})})}><span style={styles.navIcon}>◎</span><span>Usuários</span></NavLink><NavLink to="/assinatura" className="prodos-nav-link" style={({isActive})=>({...styles.navItem,...(isActive?styles.navItemActive:{})})}><span style={styles.navIcon}>◈</span><span>Assinatura</span></NavLink><NavLink to="/suporte" className="prodos-nav-link" style={({isActive})=>({...styles.navItem,...(isActive?styles.navItemActive:{})})}><span style={styles.navIcon}>?</span><span>Suporte</span></NavLink></div>
  </nav>;
  return <div className="prodos-shell" style={styles.shell}>
    <button type="button" className="prodos-mobile-menu-btn no-print" onClick={()=>setMobileOpen(true)} aria-label="Abrir menu">☰ <span>Menu</span></button>
    {mobileOpen&&<button type="button" className="prodos-mobile-backdrop no-print" onClick={()=>setMobileOpen(false)} aria-label="Fechar menu"/>}
    <aside className={`prodos-sidebar no-print${mobileOpen?" is-mobile-open":""}`} style={styles.sidebar}>
      <div className="prodos-mobile-close-row"><button type="button" onClick={()=>setMobileOpen(false)} aria-label="Fechar menu">×</button></div>
      <div style={styles.brand}><img src={logoFull} alt="ProdOS" style={{width:150,height:"auto",display:"block"}}/></div>
      {navigation}
      <div style={styles.sidebarFooter}><img src={logoFull} alt="ProdOS" style={styles.footerLogo}/><div style={styles.companyName}>{company?.name??"—"}</div><div style={styles.userName}>{profile?.full_name??""}{profile?.role&&` · ${ROLE_LABEL[profile.role]??profile.role}`}</div><button style={styles.signOut} onClick={signOut} type="button">Sair</button></div>
    </aside>
    <main className="prodos-main" style={styles.main}>
      {impersonation&&<div style={styles.impersonationBanner}><span>👁 Você está vendo como <strong>{impersonation.companies?.name??"essa empresa"}</strong> — modo suporte.</span><button style={styles.impersonationBtn} onClick={stopImpersonating} type="button">Sair desse modo</button></div>}
      {isBlocked?<div style={styles.blocked}><h1 style={styles.blockedTitle}>Acesso não permitido</h1><p style={styles.blockedText}>Seu perfil ({ROLE_LABEL[profile?.role]??profile?.role}) não tem acesso a esta área.</p></div>:<Outlet/>}
    </main>
  </div>;
}

const styles={shell:{display:"flex",minHeight:"100%"},sidebar:{width:236,background:"var(--panel)",borderRight:"1px solid var(--line)",display:"flex",flexDirection:"column",padding:"20px 14px",flexShrink:0,overflowY:"auto"},brand:{padding:"0 10px",marginBottom:20},nav:{display:"flex",flexDirection:"column",flex:1},section:{marginBottom:4},sectionToggle:{display:"flex",alignItems:"center",gap:7,width:"100%",background:"var(--panel-2)",border:"1px solid var(--line)",color:"var(--text)",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".05em",padding:"9px 10px",cursor:"pointer",textAlign:"left",borderRadius:"var(--radius)"},chevron:{display:"inline-block",fontSize:14,transition:"transform .15s ease",color:"var(--blue)"},sectionItems:{display:"flex",flexDirection:"column",gap:2,padding:"3px 0 7px"},navItem:{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:"var(--radius)",color:"var(--text-dim)",fontSize:13,textDecoration:"none",fontWeight:500},navItemSecondary:{paddingLeft:22,fontSize:12.5},navItemActive:{background:"var(--blue-dim)",color:"var(--blue)",border:"1px solid var(--line)"},navIcon:{width:17,display:"inline-block",textAlign:"center",flexShrink:0},sidebarFooter:{borderTop:"1px solid var(--line)",paddingTop:14,marginTop:14,flexShrink:0},footerLogo:{width:90,height:"auto",display:"block",marginBottom:10,opacity:.85},companyName:{fontSize:13,fontWeight:600,color:"var(--text)"},userName:{fontSize:12,color:"var(--text-dim)",marginTop:4,marginBottom:10},signOut:{width:"100%",border:"1px solid var(--line)",background:"var(--field)",color:"var(--text)",padding:"8px 10px",borderRadius:"var(--radius)",cursor:"pointer"},main:{flex:1,minWidth:0,padding:"20px 24px",background:"var(--bg)"},impersonationBanner:{display:"flex",justifyContent:"space-between",alignItems:"center",background:"var(--blue)",color:"#fff",padding:"10px 20px",fontSize:13,fontWeight:600,marginBottom:16,borderRadius:"var(--radius)"},impersonationBtn:{background:"rgba(255,255,255,.16)",border:"1px solid rgba(255,255,255,.4)",color:"#fff",borderRadius:"var(--radius)",padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer"},blocked:{padding:40},blockedTitle:{fontSize:24,color:"var(--text)",marginBottom:8},blockedText:{color:"var(--text-dim)"}};
