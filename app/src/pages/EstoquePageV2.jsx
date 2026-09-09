import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import logoFull from "../assets/logo-full.png";

const fmt = (v) => Number(v || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const money = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const activeReservationStatuses = ["reservada", "separada"];

export default function EstoquePageV2() {
  const { company } = useAuth();
  const [products, setProducts] = useState([]);
  const [levels, setLevels] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  async function load() {
    if (!company?.id) return;
    setLoading(true); setError("");
    const [p, s, r, w, l] = await Promise.all([
      supabase.from("products").select("id,sku,name,unit,stock_quantity,min_stock,reorder_point,max_stock,sale_price,active,type").eq("company_id", company.id).eq("type", "acabado").eq("active", true).order("name"),
      supabase.from("stock_levels").select("id,product_id,warehouse_id,location_id,quantity,warehouses:warehouse_id(id,name),warehouse_locations:location_id(id,code,location_type,status)").eq("company_id", company.id),
      supabase.from("stock_reservations").select("id,product_id,warehouse_id,location_id,quantity,status,sales_order_id,fulfillment_request_id,warehouse_locations:location_id(code,location_type)").eq("company_id", company.id).in("status", activeReservationStatuses),
      supabase.from("warehouses").select("id,name,warehouse_type,active").eq("company_id", company.id).eq("active", true).order("name"),
      supabase.from("warehouse_locations").select("id,warehouse_id,code,location_type,status").eq("company_id", company.id).order("code")
    ]);
    const firstError = [p,s,r,w,l].find(x => x.error)?.error;
    if (firstError) setError(firstError.message);
    setProducts(p.data || []); setLevels(s.data || []); setReservations(r.data || []); setWarehouses(w.data || []); setLocations(l.data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [company?.id]);

  const warehouseOptions = useMemo(() => warehouses.filter(w => !/material|matéria|insumo/i.test(w.name || "")), [warehouses]);
  const locationOptions = useMemo(() => locations.filter(l => !warehouseFilter || l.warehouse_id === warehouseFilter), [locations, warehouseFilter]);

  const rows = useMemo(() => {
    const byProduct = new Map();
    products.forEach(p => byProduct.set(p.id, { product:p, physical:0, reserved:0, separated:0, billing:0, available:0, locations:[], warehouses:new Set() }));
    levels.forEach(l => {
      const row = byProduct.get(l.product_id); if (!row) return;
      if (warehouseFilter && l.warehouse_id !== warehouseFilter) return;
      if (locationFilter && l.location_id !== locationFilter) return;
      const qty = Number(l.quantity || 0); row.physical += qty;
      const loc = l.warehouse_locations;
      row.locations.push({ warehouseId:l.warehouse_id, warehouse: l.warehouses?.name || "Almoxarifado", locationId:l.location_id, location:loc?.code || "Sem localização", locationType:loc?.location_type || "normal", quantity:qty });
      row.warehouses.add(l.warehouses?.name || "Almoxarifado");
    });
    reservations.forEach(r => {
      const row = byProduct.get(r.product_id); if (!row) return;
      if (warehouseFilter && r.warehouse_id !== warehouseFilter) return;
      if (locationFilter && r.location_id !== locationFilter) return;
      const qty = Number(r.quantity || 0); row.reserved += qty;
      if (r.status === "separada") row.separated += qty;
      else row.reserved += 0;
    });
    byProduct.forEach(row => {
      row.billing = row.separated;
      row.available = Math.max(0, row.physical - row.reserved);
      row.locations = row.locations.filter(x => x.quantity !== 0);
    });
    let result = Array.from(byProduct.values()).filter(r => r.physical > 0 || r.reserved > 0 || r.product.stock_quantity > 0);
    const q = search.trim().toLowerCase();
    if (q) result = result.filter(r => `${r.product.sku} ${r.product.name}`.toLowerCase().includes(q));
    if (statusFilter) result = result.filter(r => {
      if (statusFilter === "disponivel") return r.available > 0;
      if (statusFilter === "reservado") return r.reserved > 0;
      if (statusFilter === "separacao") return r.reserved > 0 && r.separated < r.reserved;
      if (statusFilter === "faturamento") return r.billing > 0;
      if (statusFilter === "sem") return r.available <= 0;
      return true;
    });
    return result.sort((a,b) => String(a.product.name).localeCompare(String(b.product.name), "pt-BR"));
  }, [products,levels,reservations,warehouseFilter,locationFilter,search,statusFilter]);

  const totals = useMemo(() => rows.reduce((a,r) => ({ physical:a.physical+r.physical, reserved:a.reserved+r.reserved, available:a.available+r.available, separated:a.separated+r.separated, value:a.value+r.physical*Number(r.product.sale_price||0) }), {physical:0,reserved:0,available:0,separated:0,value:0}), [rows]);

  const situation = (r) => {
    if (r.billing > 0) return "Aguardando faturamento";
    if (r.separated > 0) return "Em separação / conferência";
    if (r.reserved > 0) return "Reservado";
    if (r.available <= 0) return "Sem disponível";
    if (Number(r.product.min_stock || 0) > 0 && r.available < Number(r.product.min_stock)) return "Abaixo do mínimo";
    return "Disponível";
  };

  return <div className="stock-page-v2">
    <style>{`@media print{@page{size:A4 landscape;margin:10mm 9mm 13mm}body{background:#fff!important;color:#111!important;font-family:Arial,Helvetica,sans-serif!important}.no-print,.app-sidebar,nav,aside{display:none!important}.print-only{display:block!important}.print-header{display:grid!important;grid-template-columns:155px 1fr 225px;align-items:center;gap:16px;border-bottom:2px solid #222;padding-bottom:9px;margin-bottom:10px}.print-logo{width:140px;max-height:52px;object-fit:contain}.print-title{text-align:center;font-size:16px;text-transform:uppercase;margin:0}.print-sub{text-align:center;font-size:8.5px;margin:4px 0 0}.print-meta{text-align:right;font-size:8.5px;line-height:1.45}.print-ident{display:grid!important;grid-template-columns:1.2fr .8fr .8fr .8fr;gap:7px;margin-bottom:9px}.print-field{border:1px solid #999;padding:5px 7px}.print-label{display:block;font-size:6.8px;font-weight:700;text-transform:uppercase;color:#555}.print-value{font-size:8.5px;font-weight:600}.stock-table{border:1px solid #777!important;overflow:visible!important}.stock-table table{width:100%!important;table-layout:fixed!important;border-collapse:collapse}.stock-table th,.stock-table td{border:1px solid #aaa!important;color:#111!important;background:#fff!important;font-size:7.6px!important;padding:5px 4px!important}.stock-table th{background:#eee!important;text-transform:uppercase}.stock-table th:nth-child(1){width:8%}.stock-table th:nth-child(2){width:20%}.stock-table th:nth-child(3){width:10%}.stock-table th:nth-child(4){width:10%}.stock-table th:nth-child(5){width:10%}.stock-table th:nth-child(6){width:10%}.stock-table th:nth-child(7){width:10%}.stock-table th:nth-child(8){width:22%}.print-footer{display:flex!important;justify-content:space-between;border-top:1px solid #999;margin-top:8px;padding-top:4px;font-size:7px;color:#555}tr{page-break-inside:avoid}}@media screen{.print-only{display:none}}`}</style>
    <header className="no-print" style={styles.header}><div><h1 style={styles.title}>Estoque — Produto Acabado</h1><p style={styles.subtitle}>Controle físico e comercial do estoque: disponível, reservado, em separação e aguardando faturamento.</p></div><button style={styles.printBtn} onClick={()=>window.print()}>Imprimir relatório</button></header>
    <div className="print-only print-header"><img className="print-logo" src={logoFull}/><div><h1 className="print-title">Relatório de Estoque de Produto Acabado</h1><p className="print-sub">Posição física, reservas, separação e faturamento</p></div><div className="print-meta"><strong>{company?.name || "Empresa"}</strong><br/>Emissão: {new Date().toLocaleString("pt-BR")}</div></div>
    <div className="print-only print-ident"><div className="print-field"><span className="print-label">Empresa</span><span className="print-value">{company?.name || "—"}</span></div><div className="print-field"><span className="print-label">Produtos</span><span className="print-value">{rows.length}</span></div><div className="print-field"><span className="print-label">Saldo físico</span><span className="print-value">{fmt(totals.physical)}</span></div><div className="print-field"><span className="print-label">Reservado</span><span className="print-value">{fmt(totals.reserved)}</span></div></div>
    <div className="no-print" style={styles.filters}><label style={styles.field}><span style={styles.label}>Pesquisar</span><input style={styles.input} value={search} onChange={e=>setSearch(e.target.value)} placeholder="SKU ou produto"/></label><label style={styles.field}><span style={styles.label}>Almoxarifado</span><select style={styles.input} value={warehouseFilter} onChange={e=>{setWarehouseFilter(e.target.value);setLocationFilter("")}}><option value="">Todos</option>{warehouseOptions.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label><label style={styles.field}><span style={styles.label}>Localização</span><select style={styles.input} value={locationFilter} onChange={e=>setLocationFilter(e.target.value)}><option value="">Todas</option>{locationOptions.map(l=><option key={l.id} value={l.id}>{l.code}</option>)}</select></label><label style={styles.field}><span style={styles.label}>Situação</span><select style={styles.input} value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="">Todas</option><option value="disponivel">Disponível</option><option value="reservado">Reservado</option><option value="separacao">Em separação</option><option value="faturamento">Aguardando faturamento</option><option value="sem">Sem disponível</option></select></label><button style={styles.clear} onClick={()=>{setSearch("");setWarehouseFilter("");setLocationFilter("");setStatusFilter("")}}>Limpar filtros</button></div>
    <div className="no-print" style={styles.cards}><Card label="Estoque físico" value={fmt(totals.physical)}/><Card label="Reservado" value={fmt(totals.reserved)}/><Card label="Disponível para venda" value={fmt(totals.available)}/><Card label="Aguardando faturamento" value={fmt(totals.separated)}/><Card label="Valor físico estimado" value={money(totals.value)}/></div>
    {error && <div style={styles.error}>{error}</div>}
    {loading ? <p style={styles.dim}>Carregando estoque...</p> : rows.length === 0 ? <div style={styles.empty}>Nenhum produto acabado encontrado para os filtros informados.</div> : <div className="stock-table" style={styles.tableWrap}><table style={styles.table}><thead><tr><th>SKU</th><th>Produto</th><th>Estoque físico</th><th>Reservado</th><th>Disponível</th><th>Em separação</th><th>Aguard. faturamento</th><th>Localizações / situação</th></tr></thead><tbody>{rows.map(r=><tr key={r.product.id}><td style={styles.td}>{r.product.sku}</td><td style={styles.td}><strong>{r.product.name}</strong><div style={styles.muted}>{r.product.unit || "—"}</div></td><td style={styles.td}>{fmt(r.physical)}</td><td style={styles.td}>{fmt(r.reserved)}</td><td style={{...styles.td,fontWeight:800}}>{fmt(r.available)}</td><td style={styles.td}>{fmt(r.separated)}</td><td style={styles.td}>{fmt(r.billing)}</td><td style={styles.td}>{r.locations.length ? r.locations.map((l,i)=><div key={i} style={styles.loc}><span>{l.location}</span><strong>{fmt(l.quantity)}</strong></div>) : <span style={styles.muted}>Sem saldo por localização</span>}<div style={styles.badge}>{situation(r)}</div></td></tr>)}</tbody></table></div>}
    <div className="print-only print-footer"><span>ProdOS — Estoque de Produto Acabado</span><span>Documento emitido pelo sistema</span></div>
  </div>;
}
function Card({label,value}){return <div style={styles.card}><span style={styles.cardLabel}>{label}</span><strong style={styles.cardValue}>{value}</strong></div>}
const styles={header:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16,marginBottom:18},title:{fontFamily:"var(--font-display)",fontSize:22,margin:0},subtitle:{color:"var(--text-dim)",fontSize:13,margin:"6px 0 0",maxWidth:850,lineHeight:1.5},printBtn:{minHeight:42,padding:"0 18px",border:0,borderRadius:8,background:"#2563EB",color:"#fff",fontWeight:800,cursor:"pointer"},filters:{display:"grid",gridTemplateColumns:"2fr 1.2fr 1.2fr 1.2fr auto",gap:10,padding:14,background:"var(--panel)",border:"1px solid var(--line)",borderRadius:"var(--radius)",marginBottom:12},field:{display:"flex",flexDirection:"column",gap:6},label:{fontSize:12,fontWeight:700,color:"var(--text-dim)"},input:{width:"100%",minHeight:40,boxSizing:"border-box",padding:"8px 10px",border:"1px solid var(--line)",borderRadius:8,background:"var(--field)",color:"var(--text)"},clear:{minHeight:40,alignSelf:"end",padding:"0 14px",border:"1px solid var(--line)",borderRadius:8,background:"var(--panel-2)",fontWeight:700,cursor:"pointer"},cards:{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:10,marginBottom:16},card:{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:"var(--radius)",padding:"13px 14px",minHeight:72,display:"flex",flexDirection:"column",justifyContent:"space-between"},cardLabel:{fontSize:11,color:"var(--text-dim)",fontWeight:700},cardValue:{fontSize:19},tableWrap:{border:"1px solid var(--line)",borderRadius:"var(--radius)",overflow:"auto"},table:{width:"100%",borderCollapse:"collapse",minWidth:980},td:{padding:"10px 12px",fontSize:13,background:"var(--panel)",borderBottom:"1px solid var(--line)",verticalAlign:"top"},muted:{fontSize:11,color:"var(--text-dim)",marginTop:3},loc:{display:"flex",justifyContent:"space-between",gap:12,padding:"2px 0"},badge:{display:"inline-block",marginTop:5,fontSize:10,fontWeight:800,padding:"3px 7px",borderRadius:99,background:"var(--panel-2)"},error:{padding:12,marginBottom:12,borderRadius:"var(--radius)",border:"1px solid var(--red)",color:"var(--red)"},dim:{color:"var(--text-dim)"},empty:{padding:24,textAlign:"center",background:"var(--panel)",border:"1px solid var(--line)",borderRadius:"var(--radius)"}};
