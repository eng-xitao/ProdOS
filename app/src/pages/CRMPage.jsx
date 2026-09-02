import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { currency, formatDate } from "../lib/printDocument";

const STATUS_FILTERS = [
  { key: "aberta", label: "Em andamento" },
  { key: "ganha", label: "Ganhas" },
  { key: "perdida", label: "Perdidas" },
];
const CHANNELS = [
  ["ligacao", "Ligação"],
  ["whatsapp", "WhatsApp"],
  ["email", "E-mail"],
  ["reuniao", "Reunião"],
  ["visita", "Visita"],
  ["nota", "Anotação"],
];
const QUALIFICATION_RESULTS = {
  qualificada: "Qualificada",
  em_analise: "Em análise",
  desqualificada: "Desqualificada",
};
const PRIORITIES = { baixa: "Baixa", media: "Média", alta: "Alta", urgente: "Urgente" };

export default function CRMPage() {
  const { company, profile } = useAuth();
  const navigate = useNavigate();
  const [stages, setStages] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("aberta");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showNew, setShowNew] = useState(false);

  async function load() {
    if (!company?.id) return;
    setLoading(true);
    const [s, o, c, p] = await Promise.all([
      supabase.from("opportunity_stages").select("id,name,sort_order").order("sort_order"),
      supabase.from("opportunities").select("id,opportunity_number,title,customer_id,stage_id,estimated_value,expected_close_date,status,created_at,owner_profile_id,source,priority,qualification_need,qualification_delivery_date,qualification_payment_terms,qualification_observations,qualification_next_action,qualification_next_action_date,qualification_result,customers:customer_id(name,condicao_pagamento),profiles:owner_profile_id(full_name)").order("created_at", { ascending: false }),
      supabase.from("customers").select("id,name,condicao_pagamento").order("name"),
      supabase.from("products").select("id,sku,name,unit,sale_price").order("name"),
    ]);
    if (s.error || o.error) setError((s.error || o.error).message);
    setStages(s.data || []);
    setOpportunities(o.data || []);
    setCustomers(c.data || []);
    setProducts(p.data || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [company?.id]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return opportunities.filter((o) => o.status === filter && (!q || `${o.title} ${o.customers?.name || ""} ${o.opportunity_number || ""}`.toLowerCase().includes(q)));
  }, [opportunities, filter, search]);

  const metrics = useMemo(() => ({
    abertas: opportunities.filter(o => o.status === "aberta"),
    ganhas: opportunities.filter(o => o.status === "ganha"),
    perdidas: opportunities.filter(o => o.status === "perdida"),
  }), [opportunities]);

  async function createOpportunity(data) {
    const { data: row, error: e } = await supabase.from("opportunities").insert({
      company_id: company.id,
      title: data.title.trim(),
      customer_id: data.customer_id,
      stage_id: stages[0]?.id,
      estimated_value: Number(data.estimated_value || 0),
      expected_close_date: data.expected_close_date || null,
      owner_profile_id: profile?.id || null,
      source: data.source,
      priority: data.priority,
      status: "aberta",
    }).select("id").single();
    if (e) throw e;
    await load();
    setShowNew(false);
    const fresh = opportunities.find(o => o.id === row?.id);
    if (fresh) setSelected(fresh);
  }

  return (
    <div style={S.page}>
      <header style={S.header}>
        <div>
          <div style={S.eyebrow}>COMERCIAL</div>
          <h1 style={S.title}>CRM — Oportunidades</h1>
          <p style={S.subtitle}>Acompanhe cada venda do primeiro contato até o fechamento. A tela mostra sempre o que precisa ser feito agora.</p>
        </div>
        <button style={S.primary} onClick={() => setShowNew(true)}>+ Nova oportunidade</button>
      </header>

      <div style={S.guide}>
        <strong>Como usar:</strong><span>1. Crie a oportunidade</span><span>→</span><span>2. Qualifique o cliente</span><span>→</span><span>3. Registre o próximo contato</span><span>→</span><span>4. Avance a etapa</span><span>→</span><span>5. Marque como ganha ou perdida</span>
      </div>

      <div style={S.metrics}>
        <Metric label="Em andamento" value={metrics.abertas.length} detail={currency(metrics.abertas.reduce((a,o)=>a+Number(o.estimated_value||0),0))}/>
        <Metric label="Ganhas" value={metrics.ganhas.length} detail={currency(metrics.ganhas.reduce((a,o)=>a+Number(o.estimated_value||0),0))}/>
        <Metric label="Perdidas" value={metrics.perdidas.length} detail="acompanhe os motivos"/>
        <Metric label="Conversão" value={`${metrics.ganhas.length + metrics.perdidas.length ? Math.round(metrics.ganhas.length / (metrics.ganhas.length + metrics.perdidas.length) * 100) : 0}%`} detail="ganhas ÷ encerradas"/>
      </div>

      {error && <div style={S.error}>{error}</div>}

      <div style={S.toolbar}>
        <div style={S.filters}>{STATUS_FILTERS.map(f => <button key={f.key} style={{...S.filter, ...(filter === f.key ? S.filterActive : {})}} onClick={() => setFilter(f.key)}>{f.label}<b>{f.key === "aberta" ? metrics.abertas.length : f.key === "ganha" ? metrics.ganhas.length : metrics.perdidas.length}</b></button>)}</div>
        <input style={S.search} value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔎 Procurar cliente ou oportunidade..." />
      </div>

      {loading ? <div style={S.empty}>Carregando CRM...</div> : filter === "aberta" ? (
        <Pipeline stages={stages} opportunities={visible} onOpen={setSelected} />
      ) : (
        <ClosedList opportunities={visible} status={filter} onOpen={setSelected} />
      )}

      {showNew && <NewOpportunity customers={customers} onClose={()=>setShowNew(false)} onCreate={createOpportunity} />}
      {selected && <CRMDrawer opportunity={selected} stages={stages} customers={customers} products={products} company={company} profile={profile} onClose={()=>setSelected(null)} onRefresh={async()=>{await load();}} onChange={(updated)=>setSelected(updated)} navigate={navigate} />}
    </div>
  );
}

function Pipeline({ stages, opportunities, onOpen }) {
  return <div style={S.pipeline}>{stages.map(stage => {
    const list = opportunities.filter(o => o.stage_id === stage.id);
    const total = list.reduce((a,o)=>a+Number(o.estimated_value||0),0);
    return <section key={stage.id} style={S.stage}>
      <div style={S.stageHeader}><div><strong>{stage.name}</strong><span>{list.length} oportunidade(s)</span></div><b>{currency(total)}</b></div>
      <div style={S.stageBody}>{list.map(o => <OpportunityCard key={o.id} opportunity={o} onClick={()=>onOpen(o)} />)}{!list.length && <div style={S.stageEmpty}>Nenhuma oportunidade aqui.<br/><span>Arraste? Não precisa — abra a oportunidade e use os botões de etapa.</span></div>}</div>
    </section>;
  })}</div>;
}

function OpportunityCard({ opportunity:o, onClick }) {
  return <button style={S.card} onClick={onClick}>
    <div style={S.cardTop}><span style={S.code}>OPP-{String(o.opportunity_number ?? 0).padStart(6,"0")}</span><span style={S.priority}>{PRIORITIES[o.priority] || "Média"}</span></div>
    <strong style={S.cardTitle}>{o.title}</strong>
    <span style={S.cardCustomer}>{o.customers?.name || "Cliente não informado"}</span>
    <div style={S.cardBottom}><b>{currency(o.estimated_value)}</b><span>{o.expected_close_date ? `Fech.: ${formatDate(o.expected_close_date)}` : "Sem data de fechamento"}</span></div>
    <span style={S.openAction}>Abrir oportunidade →</span>
  </button>;
}

function ClosedList({ opportunities, status, onOpen }) {
  return <div style={S.closedList}>{opportunities.map(o => <OpportunityCard key={o.id} opportunity={o} onClick={()=>onOpen(o)} />)}{!opportunities.length && <div style={S.empty}>Nenhuma oportunidade encontrada.</div>}</div>;
}

function NewOpportunity({ customers, onClose, onCreate }) {
  const [form, setForm] = useState({ title:"", customer_id:"", estimated_value:"", expected_close_date:"", source:"Prospecção ativa", priority:"media" });
  const [saving, setSaving] = useState(false);
  async function submit(e) { e.preventDefault(); if(!form.title.trim() || !form.customer_id) return; setSaving(true); try { await onCreate(form); } finally { setSaving(false); } }
  return <Modal title="Nova oportunidade" onClose={onClose}>
    <p style={S.help}>Comece pelo básico. Depois que criar, o CRM vai mostrar os próximos passos.</p>
    <form onSubmit={submit} style={S.form}>
      <Field label="O que você está vendendo?" full><input autoFocus style={S.input} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Ex.: Fornecimento de 500 peças" required /></Field>
      <Field label="Cliente"><select style={S.input} value={form.customer_id} onChange={e=>setForm({...form,customer_id:e.target.value})} required><option value="">Selecione...</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      <Field label="Valor estimado"><input style={S.input} type="number" min="0" step="0.01" value={form.estimated_value} onChange={e=>setForm({...form,estimated_value:e.target.value})} placeholder="R$ 0,00" /></Field>
      <Field label="Previsão de fechamento"><input style={S.input} type="date" value={form.expected_close_date} onChange={e=>setForm({...form,expected_close_date:e.target.value})} /></Field>
      <Field label="Origem"><select style={S.input} value={form.source} onChange={e=>setForm({...form,source:e.target.value})}><option>Prospecção ativa</option><option>Indicação</option><option>Site</option><option>Cliente atual</option><option>Evento/Feira</option><option>Campanha</option><option>Outro</option></select></Field>
      <Field label="Prioridade"><select style={S.input} value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}>{Object.entries(PRIORITIES).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></Field>
      <div style={S.formActions}><button type="button" style={S.secondary} onClick={onClose}>Cancelar</button><button style={S.primary} disabled={saving}>{saving?"Criando...":"Criar oportunidade"}</button></div>
    </form>
  </Modal>;
}

function CRMDrawer({ opportunity:o, stages, customers, products, company, profile, onClose, onRefresh, onChange, navigate }) {
  const [tab,setTab]=useState("resumo");
  const [qualification,setQualification]=useState({ need:o.qualification_need||"", delivery:o.qualification_delivery_date||"", payment:o.qualification_payment_terms||o.customers?.condicao_pagamento||"", result:o.qualification_result||"", next:o.qualification_next_action||"", nextDate:o.qualification_next_action_date||"", obs:o.qualification_observations||"" });
  const [channel,setChannel]=useState("whatsapp");
  const [activity,setActivity]=useState("");
  const [activities,setActivities]=useState([]);
  const [items,setItems]=useState([]);
  const [message,setMessage]=useState("");
  const [saving,setSaving]=useState(false);

  async function loadDetails() {
    const [a,it] = await Promise.all([
      supabase.from("opportunity_interactions").select("id,type,note,created_at,profiles:author_profile_id(full_name)").eq("opportunity_id",o.id).order("created_at",{ascending:false}),
      supabase.from("opportunity_items").select("id,quantity,unit_price,discount_percent,products:product_id(sku,name,unit)").eq("opportunity_id",o.id).order("created_at"),
    ]);
    setActivities(a.data||[]); setItems(it.data||[]);
  }
  useEffect(()=>{loadDetails();},[o.id]);

  async function saveQualification() {
    setSaving(true); setMessage("");
    const payload={ qualification_need:qualification.need.trim()||null, qualification_delivery_date:qualification.delivery||null, qualification_payment_terms:qualification.payment||null, qualification_result:qualification.result||null, qualification_next_action:qualification.next.trim()||null, qualification_next_action_date:qualification.nextDate||null, qualification_observations:qualification.obs.trim()||null };
    const {data,error}=await supabase.from("opportunities").update(payload).eq("id",o.id).eq("company_id",company.id).select("id").single();
    if(error || !data?.id){ setMessage(error?.message || "A qualificação não foi gravada."); setSaving(false); return; }
    setMessage("✓ Qualificação salva. Ela ficou registrada nesta oportunidade.");
    await onRefresh();
    setSaving(false);
  }

  async function addActivity(e) {
    e.preventDefault(); if(!activity.trim()) return;
    setSaving(true); setMessage("");
    const {error}=await supabase.from("opportunity_interactions").insert({company_id:company.id,opportunity_id:o.id,author_profile_id:profile?.id||null,type:channel,note:activity.trim()});
    if(error) setMessage(error.message); else { setActivity(""); setMessage("✓ Contato registrado."); await loadDetails(); }
    setSaving(false);
  }

  async function moveStage(stageId) {
    setSaving(true); setMessage("");
    const {error}=await supabase.from("opportunities").update({stage_id:stageId}).eq("id",o.id).eq("company_id",company.id).select("id").single();
    if(error) setMessage(error.message); else { setMessage("✓ Etapa atualizada."); await onRefresh(); }
    setSaving(false);
  }

  async function setStatus(status) {
    const note = status === "perdida" ? window.prompt("Por que esta oportunidade foi perdida?", "") : null;
    if(status === "perdida" && note === null) return;
    setSaving(true); setMessage("");
    const {data,error}=await supabase.from("opportunities").update({status, notes:status === "perdida" ? note : o.notes}).eq("id",o.id).eq("company_id",company.id).select("id").single();
    if(error || !data?.id) setMessage(error?.message || "Não foi possível atualizar o status.");
    else { setMessage(status === "ganha" ? "✓ Venda marcada como GANHA. Ela não desapareceu: use a aba Ganhas para encontrá-la." : "✓ Oportunidade marcada como perdida."); await onRefresh(); onChange({...o,status}); }
    setSaving(false);
  }

  const current=stages.findIndex(s=>s.id===o.stage_id);
  const total=items.reduce((a,it)=>a+Number(it.quantity||0)*Number(it.unit_price||0)*(1-Number(it.discount_percent||0)/100),0);

  return <div style={S.overlay}><aside style={S.drawer}>
    <div style={S.drawerHeader}><div><span style={S.code}>OPP-{String(o.opportunity_number??0).padStart(6,"0")}</span><h2 style={S.drawerTitle}>{o.title}</h2><span style={S.cardCustomer}>{o.customers?.name||"Cliente não informado"}</span></div><button style={S.close} onClick={onClose}>✕</button></div>
    <div style={S.stepper}>{stages.map((s,i)=><button key={s.id} disabled={saving} onClick={()=>moveStage(s.id)} style={{...S.step,...(i===current?S.stepCurrent:{}),...(i<current?S.stepDone:{})}}><span>{i<current?"✓":i+1}</span>{s.name}</button>)}</div>
    <div style={S.nextBox}><strong>Próximo passo</strong><span>{qualification.next || "Ainda não definido"}</span>{qualification.nextDate && <small>{formatDate(qualification.nextDate)}</small>}<button onClick={()=>setTab("qualificacao")} style={S.linkBtn}>Definir próximo passo →</button></div>
    <div style={S.tabs}>{[["resumo","Resumo"],["qualificacao","Qualificação"],["atividades","Atividades"]].map(([k,l])=><button key={k} onClick={()=>setTab(k)} style={{...S.tab,...(tab===k?S.tabActive:{})}}>{l}</button>)}</div>
    {message && <div style={S.message}>{message}</div>}

    {tab === "resumo" && <div style={S.body}>
      <div style={S.infoGrid}><Info label="Cliente" value={o.customers?.name||"—"}/><Info label="Responsável" value={o.profiles?.full_name||profile?.full_name||"—"}/><Info label="Valor" value={currency(total||o.estimated_value)}/><Info label="Fechamento" value={formatDate(o.expected_close_date)}/></div>
      <section style={S.section}><h3>O que fazer agora</h3><p style={S.help}>Use os botões abaixo. O CRM registra automaticamente a etapa e o histórico.</p><div style={S.bigActions}><button style={S.green} onClick={()=>setStatus("ganha")} disabled={saving || o.status!=="aberta"}>✓ Marcar como ganha</button><button style={S.danger} onClick={()=>setStatus("perdida")} disabled={saving || o.status!=="aberta"}>× Marcar como perdida</button></div></section>
      <section style={S.section}><h3>Produtos e valor</h3>{items.length ? items.map(it=><div key={it.id} style={S.itemRow}><span>{it.products?.name||"Produto"}<small>{it.quantity} {it.products?.unit||""}</small></span><b>{currency(Number(it.quantity)*Number(it.unit_price))}</b></div>) : <div style={S.empty}>Nenhum produto vinculado.</div>}</section>
      <button style={S.secondaryWide} onClick={()=>navigate(`/orcamentos?oportunidade=${o.id}`)}>Ir para Orçamentos →</button>
    </div>}

    {tab === "qualificacao" && <div style={S.body}><section style={S.section}><h3>Qualificação comercial</h3><p style={S.help}>Preencha o que você descobriu com o cliente. Depois clique em <strong>Salvar qualificação</strong>.</p><div style={S.form}>
      <Field label="Necessidade do cliente" full><textarea style={S.textarea} rows={4} value={qualification.need} onChange={e=>setQualification({...qualification,need:e.target.value})} placeholder="Qual problema o cliente quer resolver?"/></Field>
      <Field label="Prazo desejado"><input style={S.input} type="date" value={qualification.delivery} onChange={e=>setQualification({...qualification,delivery:e.target.value})}/></Field>
      <Field label="Condição de pagamento"><input style={S.input} value={qualification.payment||"Não cadastrada"} readOnly/></Field>
      <Field label="Resultado"><select style={S.input} value={qualification.result} onChange={e=>setQualification({...qualification,result:e.target.value})}><option value="">Selecione...</option>{Object.entries(QUALIFICATION_RESULTS).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></Field>
      <Field label="Próxima ação"><input style={S.input} value={qualification.next} onChange={e=>setQualification({...qualification,next:e.target.value})} placeholder="Ex.: Enviar proposta"/></Field>
      <Field label="Data da próxima ação"><input style={S.input} type="date" value={qualification.nextDate} onChange={e=>setQualification({...qualification,nextDate:e.target.value})}/></Field>
      <Field label="Observações" full><textarea style={S.textarea} rows={5} value={qualification.obs} onChange={e=>setQualification({...qualification,obs:e.target.value})} placeholder="Anote informações importantes da negociação..."/></Field>
      <button style={S.primaryWide} onClick={saveQualification} disabled={saving}>{saving?"Salvando...":"💾 Salvar qualificação"}</button>
    </div></section></div>}

    {tab === "atividades" && <div style={S.body}><section style={S.section}><h3>Registrar contato</h3><p style={S.help}>Escolha como falou com o cliente e escreva o que aconteceu.</p><form onSubmit={addActivity} style={S.activityBox}><label><span style={S.label}>Canal do contato</span><select style={S.input} value={channel} onChange={e=>setChannel(e.target.value)}>{CHANNELS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label style={{gridColumn:"1/-1"}}><span style={S.label}>O que foi tratado?</span><textarea style={S.textarea} rows={4} value={activity} onChange={e=>setActivity(e.target.value)} placeholder="Ex.: Cliente pediu proposta para 500 unidades e retorno até sexta-feira."/></label><button style={S.primaryWide} disabled={saving}>{saving?"Registrando...":"+ Registrar contato"}</button></form></section><section style={S.section}><h3>Histórico</h3><div style={S.history}>{activities.map(a=><div key={a.id} style={S.historyItem}><div><b>{CHANNELS.find(x=>x[0]===a.type)?.[1] || a.type}</b><small>{formatDate(a.created_at)} · {a.profiles?.full_name||"Usuário"}</small></div><p>{a.note}</p></div>)}{!activities.length&&<div style={S.empty}>Nenhum contato registrado ainda.</div>}</div></section></div>}
  </aside></div>;
}

function Modal({title,onClose,children}){return <div style={S.overlay}><div style={S.modal}><div style={S.modalHeader}><h2>{title}</h2><button style={S.close} onClick={onClose}>✕</button></div>{children}</div></div>}
function Field({label,children,full}){return <label style={{...S.field,...(full?{gridColumn:"1/-1"}:{})}}><span style={S.label}>{label}</span>{children}</label>}
function Info({label,value}){return <div style={S.info}><span style={S.label}>{label}</span><strong>{value}</strong></div>}
function Metric({label,value,detail}){return <div style={S.metric}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>}

const S={
 page:{width:"100%",boxSizing:"border-box",paddingBottom:32},header:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:18,marginBottom:16},eyebrow:{fontSize:10,fontWeight:800,letterSpacing:".12em",color:"var(--amber)",marginBottom:4},title:{fontFamily:"var(--font-display)",fontSize:24,margin:0},subtitle:{fontSize:13,color:"var(--text-dim)",margin:"6px 0",maxWidth:820,lineHeight:1.5},primary:{background:"var(--amber)",color:"#fff",border:0,borderRadius:9,padding:"11px 16px",fontWeight:800,cursor:"pointer",whiteSpace:"nowrap"},guide:{display:"flex",flexWrap:"wrap",gap:8,alignItems:"center",padding:"12px 14px",background:"var(--panel)",border:"1px solid var(--line)",borderRadius:10,fontSize:11.5,color:"var(--text-dim)",marginBottom:14},metrics:{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:10,marginBottom:14},metric:{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:10,padding:12,display:"grid",gap:3},metricSpan:{fontSize:11},metricValue:{fontSize:20},toolbar:{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap",marginBottom:12},filters:{display:"flex",gap:6,flexWrap:"wrap"},filter:{background:"var(--panel)",border:"1px solid var(--line)",color:"var(--text)",borderRadius:8,padding:"8px 11px",cursor:"pointer",fontWeight:700},filterActive:{background:"var(--text)",color:"var(--panel)",borderColor:"var(--text)"},search:{width:280,maxWidth:"100%",boxSizing:"border-box",background:"var(--panel)",color:"var(--text)",border:"1px solid var(--line)",borderRadius:8,padding:"9px 11px"},pipeline:{display:"grid",gridAutoFlow:"column",gridAutoColumns:"minmax(250px,1fr)",gap:12,overflowX:"auto",alignItems:"start",paddingBottom:10},stage:{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:11,minWidth:250,maxWidth:380,overflow:"hidden"},stageHeader:{display:"flex",justifyContent:"space-between",gap:8,padding:12,borderBottom:"1px solid var(--line)"},stageHeaderDiv:{},stageHeaderSpan:{},stageBody:{display:"grid",gap:8,padding:9,minHeight:110},stageEmpty:{padding:18,textAlign:"center",fontSize:11,color:"var(--text-dim)",lineHeight:1.5},card:{width:"100%",textAlign:"left",background:"var(--bg)",color:"var(--text)",border:"1px solid var(--line)",borderRadius:9,padding:11,cursor:"pointer",display:"grid",gap:6,boxSizing:"border-box"},cardTop:{display:"flex",justifyContent:"space-between",gap:8},code:{fontSize:10,fontWeight:800,color:"var(--text-dim)"},priority:{fontSize:9,padding:"3px 6px",borderRadius:99,background:"var(--panel-2)",color:"var(--text-dim)",fontWeight:800},cardTitle:{fontSize:13,lineHeight:1.35},cardCustomer:{fontSize:11.5,color:"var(--text-dim)"},cardBottom:{display:"flex",justifyContent:"space-between",gap:8,fontSize:11,marginTop:3},openAction:{fontSize:10,color:"var(--amber)",fontWeight:800},closedList:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:10},overlay:{position:"fixed",inset:0,zIndex:2000,background:"rgba(0,0,0,.5)",display:"flex",justifyContent:"flex-end"},drawer:{width:"min(780px,96vw)",height:"100vh",overflowY:"auto",boxSizing:"border-box",background:"var(--panel)",color:"var(--text)",padding:22,boxShadow:"-10px 0 35px rgba(0,0,0,.18)"},drawerHeader:{display:"flex",justifyContent:"space-between",gap:14,marginBottom:14},drawerTitle:{fontFamily:"var(--font-display)",fontSize:21,margin:"3px 0",overflowWrap:"anywhere"},close:{width:34,height:34,border:"1px solid var(--line)",background:"var(--bg)",color:"var(--text)",borderRadius:8,cursor:"pointer",flex:"0 0 auto"},stepper:{display:"flex",gap:6,overflowX:"auto",paddingBottom:12},step:{border:"1px solid var(--line)",background:"var(--bg)",color:"var(--text-dim)",borderRadius:8,padding:"7px 9px",fontSize:10,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"},stepCurrent:{background:"var(--amber)",color:"#fff",borderColor:"var(--amber)"},stepDone:{borderColor:"var(--green)",color:"var(--text)"},nextBox:{display:"grid",gap:4,padding:12,border:"1px solid var(--line)",borderRadius:10,background:"var(--bg)",marginBottom:14},linkBtn:{border:0,background:"transparent",padding:0,textAlign:"left",color:"var(--amber)",fontWeight:800,cursor:"pointer",fontSize:11},tabs:{display:"flex",borderBottom:"1px solid var(--line)",marginBottom:14},tab:{border:0,background:"transparent",color:"var(--text-dim)",padding:"10px 12px",fontWeight:800,cursor:"pointer",borderBottom:"2px solid transparent"},tabActive:{color:"var(--text)",borderBottomColor:"var(--amber)"},message:{background:"rgba(34,197,94,.1)",border:"1px solid rgba(34,197,94,.25)",borderRadius:8,padding:10,fontSize:12,marginBottom:12},body:{display:"grid",gap:14},infoGrid:{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:8},info:{background:"var(--bg)",border:"1px solid var(--line)",borderRadius:8,padding:10,display:"grid",gap:4,minWidth:0},section:{border:"1px solid var(--line)",borderRadius:10,padding:14,background:"var(--bg)"},sectionH3:{},help:{fontSize:11.5,color:"var(--text-dim)",lineHeight:1.5,margin:"5px 0 12px"},bigActions:{display:"flex",gap:8,flexWrap:"wrap"},green:{background:"var(--green)",color:"#fff",border:0,borderRadius:8,padding:"10px 14px",fontWeight:800,cursor:"pointer"},danger:{background:"transparent",color:"var(--danger)",border:"1px solid var(--danger)",borderRadius:8,padding:"10px 14px",fontWeight:800,cursor:"pointer"},itemRow:{display:"flex",justifyContent:"space-between",gap:10,padding:"9px 0",borderTop:"1px solid var(--line)",fontSize:12},secondaryWide:{width:"100%",background:"var(--bg)",color:"var(--text)",border:"1px solid var(--line)",borderRadius:8,padding:10,fontWeight:800,cursor:"pointer"},form:{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:11},field:{display:"grid",gap:5,minWidth:0},label:{fontSize:10.5,color:"var(--text-dim)",fontWeight:800},input:{width:"100%",boxSizing:"border-box",background:"var(--panel)",color:"var(--text)",border:"1px solid var(--line)",borderRadius:8,padding:"9px 10px",minWidth:0},textarea:{width:"100%",boxSizing:"border-box",background:"var(--panel)",color:"var(--text)",border:"1px solid var(--line)",borderRadius:8,padding:"9px 10px",resize:"vertical",fontFamily:"inherit"},formActions:{gridColumn:"1/-1",display:"flex",justifyContent:"flex-end",gap:8,marginTop:4},secondary:{background:"var(--bg)",color:"var(--text)",border:"1px solid var(--line)",borderRadius:8,padding:"10px 14px",fontWeight:700,cursor:"pointer"},primaryWide:{gridColumn:"1/-1",background:"var(--amber)",color:"#fff",border:0,borderRadius:8,padding:11,fontWeight:800,cursor:"pointer"},activityBox:{display:"grid",gridTemplateColumns:"180px minmax(0,1fr)",gap:10},history:{display:"grid",gap:8},historyItem:{padding:10,border:"1px solid var(--line)",borderRadius:8},empty:{padding:22,textAlign:"center",color:"var(--text-dim)",background:"var(--panel)",border:"1px dashed var(--line)",borderRadius:10},error:{padding:10,borderRadius:8,border:"1px solid var(--danger)",color:"var(--text)",marginBottom:12},modal:{width:"min(620px,94vw)",maxHeight:"90vh",overflowY:"auto",background:"var(--panel)",color:"var(--text)",borderRadius:12,padding:20,boxSizing:"border-box",alignSelf:"center",margin:"auto"},modalHeader:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}
};
