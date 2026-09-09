import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

const STATUS = { aguardando_faturamento: "Aguardando faturamento", faturado: "Faturado", processando: "Processando", autorizado: "Autorizada", erro: "Erro" };

export default function NotasFiscaisPageV2() {
  const { company } = useAuth();
  const [params] = useSearchParams();
  const [requests, setRequests] = useState([]);
  const [selectedId, setSelectedId] = useState(params.get("solicitacao") || "");
  const [detail, setDetail] = useState(null);
  const [items, setItems] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [simulate, setSimulate] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    if (!company?.id) return;
    setLoading(true); setError("");
    const [{ data: r, error: re }, { data: inv }] = await Promise.all([
      supabase.from("sales_order_fulfillment_requests").select("id, sales_order_id, status, requested_at, billing_requested_at, sales_orders:sales_order_id(code, customer_id, customers:customer_id(name, document))").in("status", ["aguardando_faturamento", "faturado"]).order("billing_requested_at", { ascending: false }),
      supabase.from("invoices").select("id, sales_order_id, status, numero, serie, chave_nfe, valor_total, simulated, created_at, error_message, customers:customer_id(name)").order("created_at", { ascending: false }),
    ]);
    if (re) setError(re.message);
    setRequests(r ?? []); setInvoices(inv ?? []); setLoading(false);
  }

  async function loadDetail(id) {
    setSelectedId(id); setError(""); setMessage("");
    if (!id) { setDetail(null); setItems([]); return; }
    const [{ data: r }, { data: it }] = await Promise.all([
      supabase.from("sales_order_fulfillment_requests").select("id, sales_order_id, status, billing_requested_at, sales_orders:sales_order_id(code, customer_id, customers:customer_id(name, document, logradouro, municipio, uf, cep))").eq("id", id).single(),
      supabase.from("sales_order_fulfillment_items").select("id, product_id, requested_quantity, checked_quantity, products:product_id(sku,name,unit,ncm,sale_price)").eq("fulfillment_request_id", id),
    ]);
    setDetail(r); setItems(it ?? []);
  }

  useEffect(() => { load(); }, [company?.id]);
  useEffect(() => { if (selectedId) loadDetail(selectedId); }, [selectedId]);

  const total = items.reduce((s, i) => s + Number(i.checked_quantity || 0) * Number(i.products?.sale_price || 0), 0);

  async function emit() {
    if (!detail || detail.status !== "aguardando_faturamento") return;
    setWorking(true); setError(""); setMessage("");
    const customerId = detail.sales_orders?.customer_id;
    const payloadItems = items.map(i => ({ productId: i.product_id, quantity: Number(i.checked_quantity), unitPrice: Number(i.products?.sale_price || 0) }));
    const { data, error: e } = await supabase.functions.invoke("emit-nfe", { body: { companyId: company.id, customerId, salesOrderId: detail.sales_order_id, items: payloadItems, simulate } });
    if (e || data?.error) { setError(data?.error || e?.message || "Não foi possível emitir a NF-e."); setWorking(false); return; }
    if (data?.invoice?.status === "autorizado") {
      const { error: ce } = await supabase.rpc("consume_fulfillment_after_billing", { p_request_id: detail.id });
      if (ce) setError(ce.message); else setMessage("NF-e autorizada e baixa definitiva do estoque concluída. O pedido foi faturado.");
    } else setMessage("NF-e enviada para processamento. A solicitação permanece controlada até a confirmação da autorização.");
    await load(); await loadDetail(detail.id); setWorking(false);
  }

  return <div>
    <header style={styles.header}><div><h1 style={styles.title}>Faturamento</h1><p style={styles.subtitle}>Somente pedidos separados e conferidos chegam aqui. O faturamento transforma a solicitação em NF-e.</p></div></header>
    {error && <div style={styles.error}>{error}</div>}{message && <div style={styles.success}>{message}</div>}
    <section style={styles.panel}><h2 style={styles.title2}>Solicitações prontas para faturar</h2><p style={styles.dim}>A mercadoria já foi conferida e transferida para a Área de Faturamento.</p>
      {loading ? <p style={styles.dim}>Carregando...</p> : requests.length === 0 ? <p style={styles.dim}>Nenhuma solicitação aguardando faturamento.</p> : <div style={styles.cards}>{requests.map(r => <button key={r.id} type="button" onClick={() => loadDetail(r.id)} style={{...styles.card,...(selectedId===r.id?styles.cardActive:{})}}><div><strong>{r.sales_orders?.code}</strong><div style={styles.dim}>{r.sales_orders?.customers?.name}</div></div><span style={styles.badge}>{STATUS[r.status]}</span></button>)}</div>}
    </section>
    {detail && <section style={styles.panel}><div style={styles.detailHead}><div><span style={styles.code}>{detail.sales_orders?.code}</span><h2 style={styles.title2}>{detail.sales_orders?.customers?.name}</h2><div style={styles.dim}>Cliente: {detail.sales_orders?.customers?.document || "—"}</div></div><span style={styles.badge}>{STATUS[detail.status] || detail.status}</span></div>
      <div style={styles.tableWrap}><table style={styles.table}><thead><tr><th style={styles.th}>SKU</th><th style={styles.th}>Produto</th><th style={styles.th}>Qtd. conferida</th><th style={styles.th}>Preço unit.</th><th style={styles.th}>NCM</th></tr></thead><tbody>{items.map(i=><tr key={i.id}><td style={styles.td}>{i.products?.sku}</td><td style={styles.td}>{i.products?.name}</td><td style={styles.td}>{i.checked_quantity} {i.products?.unit || ""}</td><td style={styles.td}>R$ {Number(i.products?.sale_price || 0).toLocaleString("pt-BR",{minimumFractionDigits:2})}</td><td style={styles.td}>{i.products?.ncm || <span style={styles.red}>Não informado</span>}</td></tr>)}</tbody></table></div>
      <div style={styles.total}><span>Total da operação</span><strong>R$ {total.toLocaleString("pt-BR",{minimumFractionDigits:2})}</strong></div>
      {detail.status === "aguardando_faturamento" && <div style={styles.actions}><label style={styles.check}><input type="checkbox" checked={simulate} onChange={e=>setSimulate(e.target.checked)} /> Modo simulação (teste)</label><button style={styles.emitBtn} type="button" disabled={working || items.length===0 || items.some(i=>Number(i.checked_quantity)<=0)} onClick={emit}>{working ? "Processando..." : simulate ? "Simular e faturar" : "Emitir NF-e"}</button></div>}
      {detail.status === "faturado" && <div style={styles.successBox}>Este atendimento já foi faturado. A baixa definitiva do estoque foi registrada após a autorização.</div>}
    </section>}
    <section style={styles.panel}><h2 style={styles.title2}>Histórico de NF-e</h2>{invoices.length===0?<p style={styles.dim}>Nenhuma nota registrada.</p>:<div style={styles.tableWrap}><table style={styles.table}><thead><tr><th style={styles.th}>Pedido</th><th style={styles.th}>Cliente</th><th style={styles.th}>Número</th><th style={styles.th}>Valor</th><th style={styles.th}>Status</th><th style={styles.th}>Data</th></tr></thead><tbody>{invoices.map(i=><tr key={i.id}><td style={styles.td}>{requests.find(r=>r.sales_order_id===i.sales_order_id)?.sales_orders?.code || "—"}</td><td style={styles.td}>{i.customers?.name || "—"}</td><td style={styles.td}>{i.numero ? `${i.numero}/${i.serie}` : "—"}</td><td style={styles.td}>R$ {Number(i.valor_total||0).toLocaleString("pt-BR",{minimumFractionDigits:2})}</td><td style={styles.td}>{STATUS[i.status] || i.status}{i.simulated && <small> · SIMULADA</small>}{i.error_message && <div style={styles.red}>{i.error_message}</div>}</td><td style={styles.td}>{new Date(i.created_at).toLocaleString("pt-BR")}</td></tr>)}</tbody></table></div>}</section>
    <p style={styles.footerHint}><Link to="/fiscal" style={styles.link}>Configuração Fiscal</Link> define a integração e os dados fiscais da empresa.</p>
  </div>;
}

const styles={header:{marginBottom:20},title:{fontFamily:"var(--font-display)",fontSize:22,margin:0},title2:{fontFamily:"var(--font-display)",fontSize:18,margin:"0 0 5px"},subtitle:{color:"var(--text-dim)",fontSize:13,margin:"6px 0 0",maxWidth:760,lineHeight:1.5},panel:{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:"var(--radius)",padding:18,marginBottom:18},dim:{color:"var(--text-dim)",fontSize:12.5,lineHeight:1.5},cards:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:8,marginTop:12},card:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,textAlign:"left",background:"var(--field)",border:"1px solid var(--line)",borderRadius:"var(--radius)",padding:"12px 14px",cursor:"pointer",color:"var(--text)"},cardActive:{border:"1px solid var(--amber)",background:"var(--amber-dim)"},badge:{display:"inline-block",padding:"4px 9px",borderRadius:20,background:"var(--panel-2)",border:"1px solid var(--line)",fontSize:10.5,fontWeight:700,whiteSpace:"nowrap"},detailHead:{display:"flex",justifyContent:"space-between",gap:14,alignItems:"flex-start",marginBottom:14},code:{fontSize:11,fontWeight:800,color:"var(--amber)",letterSpacing:".05em"},tableWrap:{overflowX:"auto",border:"1px solid var(--line)",borderRadius:"var(--radius)"},table:{width:"100%",borderCollapse:"collapse",minWidth:680},th:{textAlign:"left",fontSize:10.5,textTransform:"uppercase",letterSpacing:".04em",color:"var(--text-dim)",padding:"9px 12px",background:"var(--panel-2)",borderBottom:"1px solid var(--line)"},td:{padding:"10px 12px",fontSize:12.5,borderBottom:"1px solid var(--line)",verticalAlign:"top"},total:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",marginTop:12,background:"var(--panel-2)",border:"1px solid var(--amber)",borderRadius:"var(--radius)"},actions:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:14,marginTop:14,flexWrap:"wrap"},check:{fontSize:12.5,color:"var(--text-dim)"},emitBtn:{background:"var(--amber)",color:"#fff",border:0,borderRadius:"var(--radius)",padding:"11px 18px",fontWeight:700,cursor:"pointer"},successBox:{marginTop:14,padding:12,border:"1px solid var(--green)",borderRadius:"var(--radius)",background:"var(--panel-2)",fontSize:12.5},error:{background:"rgba(192,57,43,.10)",border:"1px solid var(--red)",color:"var(--red)",padding:"10px 12px",borderRadius:"var(--radius)",fontSize:12.5,marginBottom:12},success:{background:"rgba(22,131,90,.10)",border:"1px solid var(--green)",color:"var(--text)",padding:"10px 12px",borderRadius:"var(--radius)",fontSize:12.5,marginBottom:12},red:{color:"var(--red)",fontSize:11},link:{color:"var(--amber)",fontWeight:700,textDecoration:"none"},footerHint:{fontSize:12,color:"var(--text-dim)"}};
