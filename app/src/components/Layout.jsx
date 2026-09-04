import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import logoFull from "../assets/logo-full.png";

const NAV_SECTIONS = [
  { label:"CRM", icon:"◎", items:[
    {to:"/oportunidades",label:"Oportunidades",icon:"◈"},
    {to:"/etapas-comercial",label:"Etapas do Funil",icon:"→"},
    {to:"/clientes",label:"Clientes",icon:"◎"},
    {to:"/contatos",label:"Contatos",icon:"◈"}
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
  { label:"PCP", icon:"▲", items:[{to:"/mrp/materiais",label:"MRP — Necessidade de Materiais",icon:"▼"},{to:"/mrp/capacidade",label:"Plano Mestre / Capacidade",icon:"▲"}]},
  { label:"Producao", icon:"⚙", items:[{to:"/producao",label:"Ordens de Produção / Fila",icon:"⚙"},{to:"/apontamento-producao",label:"Apontamentos de Produção",icon:"◷"},{to:"/paradas-producao",label:"Paradas de Produção",icon:"⏸"},{to:"/imprimir-ordem-producao",label:"Imprimir OP",icon:"🖨"},{to:"/qualidade/checklist",label:"Checklists de Qualidade",icon:"☑"},{to:"/qualidade/inspecao",label:"Inspeções",icon:"☑"},{to:"/qualidade/nao-conformidades",label:"Não Conformidades",icon:"⚠"}]},
  { label:"Logistica", icon:"▶", items:[{to:"/expedicao",label:"Expedição",icon:"▶"},{to:"/cronograma-entregas",label:"Entregas",icon:"📅"}]},
  { label:"Frotas", icon:"🚛", items:[{to:"/frotas",label:"Bens e Ativos / Frotas",icon:"▶"}]},
  { label:"Fiscal", icon:"🧾", items:[{to:"/notas-fiscais",label:"Notas Fiscais",icon:"🧾"},{to:"/fiscal",label:"Configuração Fiscal",icon:"⚙"}]},
  { label:"Financeiro", icon:"$", items:[{to:"/contas-receber",label:"Contas a Receber",icon:"◈"},{to:"/contas-pagar",label:"Contas a Pagar",icon:"◑"},{to:"/fluxo-caixa",label:"Fluxo de Caixa",icon:"≈"},{to:"/tesouraria",label:"Tesouraria",icon:"▣"},{to:"/credito-cobranca",label:"Crédito e Cobrança",icon:"◐"},{to:"/lancamentos",label:"Lançamentos",icon:"$"},{to:"/plano-contas",label:"Plano de Contas",icon:"☰"}]},
  { label:"Gestao", icon:"📊", items:[{to:"/relatorio-vendas",label:"Comercial / Vendas",icon:"▲"},{to:"/relatorio-compras",label:"Compras",icon:"▼"},{to:"/relatorio-estoque-acabado",label:"Estoque de Produtos",icon:"▤"},{to:"/relatorio-estoque-materiais",label:"Materiais",icon:"▥"},{to:"/relatorio-producao",label:"Produção",icon:"⚙"},{to:"/relatorio-qualidade",label:"Qualidade e Refugo",icon:"☑"},{to:"/relatorio-financeiro",label:"Financeiro",icon:"◑"},{to:"/analise-centro-custo",label:"Centros de Custo",icon:"◑"},{to:"/dre",label:"DRE Gerencial",icon:"▦"},{to:"/curva-abc",label:"Curva ABC",icon:"%"},{to:"/relatorio-fiscal",label:"Fiscal",icon:"🧾"}]},
  { label:"Cadastros", icon:"▣", items:[{to:"/empresa",label:"Empresa",icon:"▣"},{to:"/fornecedores",label:"Fornecedores",icon:"◇"},{to:"/produtos",label:"Produtos",icon:"◆"},{to:"/estrutura-produto",label:"Estrutura do Produto (BOM)",icon:"▤"},{to:"/etapas",label:"Etapas de Produção",icon:"→"},{to:"/centros-trabalho",label:"Centros de Trabalho",icon:"▣"},{to:"/almoxarifados",label:"Almoxarifados",icon:"▥"},{to:"/unidades-medida",label:"Unidades de Medida",icon:"%"},{to:"/condicoes-pagamento",label:"Condições de Pagamento",icon:"◐"},{to:"/centros-custo",label:"Centros de Custo",icon:"◑"},{to:"/transportadoras",label:"Transportadoras",icon:"▶"},{to:"/tipos-ordem",label:"Tipos de Ordem",icon:"▦"}]}
];

export default function Layout(){
  const {company}=useAuth();
  const [open,setOpen]=useState(true);
  const nav=useMemo(()=>NAV_SECTIONS.map(s=>({...s,items:s.items.filter(i=>i.to!=="/clientes" || s.label==="CRM")})),[]);
  return <div className="app-layout">{/* layout shell retained */}<aside className={open?"sidebar":"sidebar collapsed"}><img src={logoFull} alt="ProdOS"/><nav>{nav.map(s=><div key={s.label}><div>{s.icon} {s.label}</div>{open&&s.items.map(i=><a key={i.to} href={i.to}>{i.icon} {i.label}</a>)}</div>)}</nav></aside><main className="main-content"><header><button onClick={()=>setOpen(v=>!v)}>☰</button><span>{company?.name||""}</span></header></main></div>
}