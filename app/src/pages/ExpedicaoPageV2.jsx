import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

const STATUS = {
  aguardando_abastecimento: "Aguardando abastecimento",
  aguardando_separacao: "Aguardando separação",
  em_separacao: "Em separação",
  conferindo: "Em conferência",
  aguardando_faturamento: "Aguardando faturamento",
  faturado: "Faturado",
  cancelado: "Cancelado",
};

export default function ExpedicaoPageV2() {
  const { company } = useAuth();
  const [orders, setOrders] = useState([]);
  const [requests, setRequests] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState(null);
  const [items, setItems] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    if (!company?.id) return;
    setLoading(true); setError("");
    const [{ data: o, error: oe }, { data: r, error: re }] = await Promise.all([
      supabase.from("sales_orders")
        .select("id, code, status, order_date, total_value, customer_id, customers:customer_id(name)")
        .in("status", ["aberto", "parcialmente_faturado"])
        .order("order_date", { ascending: false }),
      supabase.from("sales_order_fulfillment_requests")
        .select("id, sales_order_id, status, requested_at, separated_at, checked_at, billing_requested_at, sales_orders:sales_order_id(code, customers:customer_id(name))")
        .order("created_at", { ascending: false }),
    ]);
    if (oe || re) setError(oe?.message || re?.message || "Não foi possível carregar o atendimento.");
    setOrders(o ?? []); setRequests(r ?? []); setLoading(false);
  }

  async function loadDetail(id) {
    setSelectedId(id); setError(""); setMessage("");
    if (!id) { setDetail(null); setItems([]); setReservations([]); return; }
    const [{ data: r }, { data: it }, { data: rs }] = await Promise.all([
      supabase.from("sales_order_fulfillment_requests").select("id, sales_order_id, status, requested_at, separated_at, checked_at, billing_requested_at, notes, sales_orders:sales_order_id(code, customer_id, customers:customer_id(name))").eq("id", id).single(),
      supabase.from("sales_order_fulfillment_items").select("id, requested_quantity, reserved_quantity, separated_quantity, checked_quantity, product_id, products:product_id(sku,name,unit)").eq("fulfillment_request_id", id),
      supabase.from("stock_reservations").select("id, product_id, warehouse_id, location_id, quantity, status, warehouses:warehouse_id(name), warehouse_locations:location_id(code,location_type)").eq("fulfillment_request_id", id),
    ]);
    setDetail(r); setItems(it ?? []); setReservations(rs ?? []);
  }

  useEffect(() => { load(); }, [company?.id]);
  useEffect(() => { if (selectedId) loadDetail(selectedId); }, [selectedId]);

  const requestByOrder = useMemo(() => {
    const map = {};
    requests.forEach((r) => { map[r.sales_order_id] = r; });
    return map;
  }, [requests]);

  async function releaseOrder(orderId) {
    setWorking(true); setError(""); setMessage("");
    const { data, error: e } = await supabase.rpc("create_sales_order_fulfillment", { p_sales_order_id: orderId });
    if (e) setError(e.message);
    else { setMessage("Pedido liberado para atendimento. O sistema registrou a reserva e criou a solicitação de separação."); await load(); await loadDetail(data); }
    setWorking(false);
  }

  async function startSeparation() {
    if (!detail) return;
    setWorking(true); setError("");
    const { error: e } = await supabase.from("sales_order_fulfillment_requests").update({ status: "em_separacao", updated_at: new Date().toISOString() }).eq("id", detail.id).eq("status", "aguardando_separacao");
    if (e) setError(e.message); else await loadDetail(detail.id);
    setWorking(false);
  }

  async function confirmSeparation() {
    if (!detail) return;
    setWorking(true); setError(""); setMessage("");
    const { error: e } = await supabase.rpc("confirm_sales_order_fulfillment", { p_request_id: detail.id });
    if (e) setError(e.message);
    else { setMessage("Separação conferida. Os produtos foram transferidos para a Área de Faturamento e a solicitação foi enviada ao Faturamento."); await load(); await loadDetail(detail.id); }
    setWorking(false);
  }

  return (
    <div>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Expedição</h1>
          <p style={styles.subtitle}>Atendimento do pedido: reserva → separação → conferência → Área de Faturamento.</p>
        </div>
      </header>

      {error && <div style={styles.error}>{error}</div>}
      {message && <div style={styles.success}>{message}</div>}

      <section style={styles.panel}>
        <div style={styles.panelHead}>
          <div><h2 style={styles.title2}>Pedidos para atendimento</h2><p style={styles.dim}>O Comercial libera o pedido. O ProdOS verifica o saldo, reserva e cria a solicitação de separação.</p></div>
        </div>
        {loading ? <p style={styles.dim}>Carregando...</p> : orders.length === 0 ? <p style={styles.dim}>Nenhum pedido pendente de atendimento.</p> : (
          <div style={styles.tableWrap}><table style={styles.table}><thead><tr><th style={styles.th}>Pedido</th><th style={styles.th}>Cliente</th><th style={styles.th}>Valor</th><th style={styles.th}>Atendimento</th><th style={styles.th}></th></tr></thead><tbody>
            {orders.map((o) => {
              const req = requestByOrder[o.id];
              return <tr key={o.id}>
                <td style={styles.td}><strong>{o.code}</strong></td>
                <td style={styles.td}>{o.customers?.name ?? "—"}</td>
                <td style={styles.td}>R$ {Number(o.total_value ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                <td style={styles.td}>{req ? <span style={styles.badge}>{STATUS[req.status] ?? req.status}</span> : <span style={styles.dim}>Ainda não liberado</span>}</td>
                <td style={styles.td}>{req ? <button style={styles.secondaryBtn} type="button" onClick={() => loadDetail(req.id)}>Abrir</button> : <button style={styles.primaryBtn} type="button" disabled={working} onClick={() => releaseOrder(o.id)}>Liberar para separação</button>}</td>
              </tr>;
            })}
          </tbody></table></div>
        )}
      </section>

      <section style={styles.panel}>
        <div style={styles.panelHead}><div><h2 style={styles.title2}>Solicitações de separação</h2><p style={styles.dim}>A conferência concluída é o gatilho para o faturamento.</p></div></div>
        {requests.length === 0 ? <p style={styles.dim}>Nenhuma solicitação criada.</p> : <div style={styles.cards}>{requests.map((r) => <button key={r.id} type="button" style={{ ...styles.requestCard, ...(selectedId === r.id ? styles.requestCardActive : {}) }} onClick={() => loadDetail(r.id)}>
          <div><strong>{r.sales_orders?.code ?? "Pedido"}</strong><div style={styles.dim}>{r.sales_orders?.customers?.name ?? "—"}</div></div><span style={styles.badge}>{STATUS[r.status] ?? r.status}</span>
        </button>)}</div>}
      </section>

      {detail && <section style={styles.panel}>
        <div style={styles.detailHead}><div><span style={styles.code}>{detail.sales_orders?.code}</span><h2 style={styles.title2}>{detail.sales_orders?.customers?.name ?? "—"}</h2></div><span style={styles.badge}>{STATUS[detail.status] ?? detail.status}</span></div>
        <div style={styles.summary}><div><span>Itens</span><strong>{items.length}</strong></div><div><span>Reservado</span><strong>{items.reduce((s,i)=>s+Number(i.reserved_quantity),0)}</strong></div><div><span>Separado</span><strong>{items.reduce((s,i)=>s+Number(i.separated_quantity),0)}</strong></div><div><span>Conferido</span><strong>{items.reduce((s,i)=>s+Number(i.checked_quantity),0)}</strong></div></div>
        <div style={styles.tableWrap}><table style={styles.table}><thead><tr><th style={styles.th}>Produto</th><th style={styles.th}>Solicitado</th><th style={styles.th}>Reservado</th><th style={styles.th}>Origem reservada</th><th style={styles.th}>Situação</th></tr></thead><tbody>
          {items.map((it) => { const rs = reservations.filter(r => r.product_id === it.product_id); return <tr key={it.id}><td style={styles.td}><strong>{it.products?.sku}</strong> — {it.products?.name}</td><td style={styles.td}>{it.requested_quantity} {it.products?.unit ?? ""}</td><td style={styles.td}>{it.reserved_quantity}</td><td style={styles.td}>{rs.length ? rs.map(r => `${r.warehouses?.name ?? "Almox."} / ${r.warehouse_locations?.code ?? "saldo geral"} (${r.quantity})`).join(", ") : "Sem reserva"}</td><td style={styles.td}>{it.checked_quantity >= it.requested_quantity ? "Conferido" : it.separated_quantity >= it.requested_quantity ? "Separado" : it.reserved_quantity >= it.requested_quantity ? "Pronto para separar" : "Aguardando abastecimento"}</td></tr>; })}
        </tbody></table></div>

        {detail.status === "aguardando_separacao" && <button style={styles.primaryBtn} type="button" disabled={working} onClick={startSeparation}>{working ? "Processando..." : "Iniciar separação"}</button>}
        {(detail.status === "em_separacao" || detail.status === "conferindo") && <button style={styles.primaryBtn} type="button" disabled={working} onClick={confirmSeparation}>{working ? "Confirmando..." : "Confirmar separação e enviar ao faturamento"}</button>}
        {detail.status === "aguardando_faturamento" && <div style={styles.billingBox}><strong>Pedido pronto para faturamento.</strong><p style={styles.dim}>Os produtos estão na Área de Faturamento e não estão mais disponíveis para outro pedido.</p><Link to={`/notas-fiscais?solicitacao=${detail.id}`} style={styles.link}>Abrir Faturamento →</Link></div>}
      </section>}
    </div>
  );
}

const styles = {
  header:{marginBottom:20}, title:{fontFamily:"var(--font-display)",fontSize:22,margin:0}, title2:{fontFamily:"var(--font-display)",fontSize:18,margin:"0 0 4px"}, subtitle:{color:"var(--text-dim)",fontSize:13,margin:"6px 0 0",maxWidth:720,lineHeight:1.5}, dim:{color:"var(--text-dim)",fontSize:12.5,lineHeight:1.5}, panel:{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:"var(--radius)",padding:18,marginBottom:18}, panelHead:{display:"flex",justifyContent:"space-between",gap:16,marginBottom:14}, tableWrap:{overflowX:"auto",border:"1px solid var(--line)",borderRadius:"var(--radius)"}, table:{width:"100%",borderCollapse:"collapse",minWidth:760}, th:{textAlign:"left",fontSize:10.5,textTransform:"uppercase",letterSpacing:".04em",color:"var(--text-dim)",padding:"9px 12px",background:"var(--panel-2)",borderBottom:"1px solid var(--line)",whiteSpace:"nowrap"}, td:{padding:"10px 12px",fontSize:12.5,borderBottom:"1px solid var(--line)",verticalAlign:"top"}, primaryBtn:{background:"var(--amber)",color:"#fff",border:0,borderRadius:"var(--radius)",padding:"10px 14px",fontWeight:700,fontSize:12.5,cursor:"pointer",marginTop:12}, secondaryBtn:{background:"var(--field)",color:"var(--text)",border:"1px solid var(--line)",borderRadius:"var(--radius)",padding:"8px 12px",fontWeight:600,fontSize:12,cursor:"pointer"}, badge:{display:"inline-block",padding:"4px 9px",borderRadius:20,background:"var(--panel-2)",border:"1px solid var(--line)",fontSize:10.5,fontWeight:700,color:"var(--text)"}, cards:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:8}, requestCard:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,textAlign:"left",background:"var(--field)",border:"1px solid var(--line)",borderRadius:"var(--radius)",padding:"11px 13px",cursor:"pointer",color:"var(--text)"}, requestCardActive:{border:"1px solid var(--amber)",background:"var(--amber-dim)"}, detailHead:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16,marginBottom:14}, code:{fontSize:11,fontWeight:800,color:"var(--amber)",letterSpacing:".05em"}, summary:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}, billingBox:{marginTop:14,padding:14,border:"1px solid var(--amber)",borderRadius:"var(--radius)",background:"var(--panel-2)"}, link:{color:"var(--amber)",fontWeight:700,textDecoration:"none"}, error:{background:"rgba(192,57,43,.10)",border:"1px solid var(--red)",color:"var(--red)",padding:"10px 12px",borderRadius:"var(--radius)",fontSize:12.5,marginBottom:12}, success:{background:"rgba(22,131,90,.10)",border:"1px solid var(--green)",color:"var(--text)",padding:"10px 12px",borderRadius:"var(--radius)",fontSize:12.5,marginBottom:12}
};
