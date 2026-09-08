import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import logoFull from "../assets/logo-full.png";

function abcClass(products, product) {
  const values = products.map((p) => Number(p.stock_quantity ?? 0) * Number(p.sale_price ?? 0));
  const total = values.reduce((s, v) => s + v, 0);
  const value = Number(product.stock_quantity ?? 0) * Number(product.sale_price ?? 0);
  if (total <= 0 || value <= 0) return "—";
  const sorted = products.map((p, i) => ({ id: p.id, value: values[i] })).sort((a, b) => b.value - a.value);
  let accumulated = 0;
  for (const item of sorted) {
    accumulated += item.value;
    if (item.id === product.id) {
      const pct = accumulated / total;
      return pct <= 0.8 ? "A" : pct <= 0.95 ? "B" : "C";
    }
  }
  return "—";
}

export default function EstoquePage() {
  const { company } = useAuthSafe();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [situationFilter, setSituationFilter] = useState("");
  const [abcFilter, setAbcFilter] = useState("");
  const [unitFilter, setUnitFilter] = useState("");
  const [stockFilter, setStockFilter] = useState("");

  useEffect(() => { if (company?.id) load(); }, [company?.id]);

  async function load() {
    setLoading(true); setError("");
    const { data, error: e } = await supabase.from("products")
      .select("id, sku, name, unit, stock_quantity, min_stock, reorder_point, max_stock, sale_price, active")
      .eq("company_id", company.id).eq("type", "acabado").eq("active", true).order("name");
    if (e) setError(e.message); else setProducts(data ?? []);
    setLoading(false);
  }

  const units = useMemo(() => [...new Set(products.map(p => p.unit).filter(Boolean))].sort(), [products]);
  const rows = useMemo(() => products.filter((p) => {
    const q = search.trim().toLowerCase();
    const qty = Number(p.stock_quantity ?? 0), min = Number(p.min_stock ?? 0);
    const situation = qty === 0 ? "zerado" : min > 0 && qty < min ? "baixo" : "normal";
    const abc = abcClass(products, p);
    if (q && !`${p.sku ?? ""} ${p.name ?? ""}`.toLowerCase().includes(q)) return false;
    if (situationFilter && situation !== situationFilter) return false;
    if (abcFilter && abc !== abcFilter) return false;
    if (unitFilter && p.unit !== unitFilter) return false;
    if (stockFilter === "com" && qty <= 0) return false;
    if (stockFilter === "sem" && qty > 0) return false;
    if (stockFilter === "abaixo" && !(min > 0 && qty < min)) return false;
    return true;
  }), [products, search, situationFilter, abcFilter, unitFilter, stockFilter]);

  const totalValue = rows.reduce((sum, p) => sum + Number(p.stock_quantity ?? 0) * Number(p.sale_price ?? 0), 0);
  const zeroCount = rows.filter(p => Number(p.stock_quantity ?? 0) === 0).length;
  const lowCount = rows.filter(p => Number(p.min_stock ?? 0) > 0 && Number(p.stock_quantity ?? 0) < Number(p.min_stock ?? 0)).length;
  const activeFilters = [search, situationFilter, abcFilter, unitFilter, stockFilter].filter(Boolean).length;

  return (
    <div className="stock-page">
      <style>{`@media print {
        @page { size:A4 landscape; margin:10mm 9mm 13mm; }
        body { background:#fff!important; color:#111!important; font-family:Arial,Helvetica,sans-serif!important; }
        .app-sidebar,nav,aside,.no-print { display:none!important; }
        .stock-page { padding:0!important; width:100%!important; }
        .print-only { display:block!important; }
        .print-report-header { display:grid!important; grid-template-columns:155px 1fr 225px; align-items:center; gap:16px; border-bottom:2px solid #222; padding-bottom:9px; margin-bottom:10px; }
        .print-logo { width:140px; max-height:52px; object-fit:contain; object-position:left center; }
        .print-title { margin:0; text-align:center; font-size:16px; font-weight:700; text-transform:uppercase; }
        .print-subtitle { margin:4px 0 0; text-align:center; font-size:8.5px; color:#444; }
        .print-meta { text-align:right; font-size:8.5px; line-height:1.45; }
        .print-identification { display:grid!important; grid-template-columns:1.45fr .75fr .95fr .85fr; gap:7px; margin-bottom:9px; }
        .print-field { border:1px solid #999; padding:5px 7px; min-height:27px; }
        .print-label { display:block; font-size:6.8px; font-weight:700; text-transform:uppercase; color:#555; margin-bottom:2px; }
        .print-value { font-size:8.5px; font-weight:600; }
        .stock-table { border:1px solid #777!important; overflow:visible!important; border-radius:0!important; }
        .stock-table table { table-layout:fixed!important; width:100%!important; }
        .stock-table th,.stock-table td { color:#111!important; background:#fff!important; border:1px solid #aaa!important; overflow:hidden; }
        .stock-table th { background:#eee!important; font-size:7.4px!important; padding:5px 4px!important; text-transform:uppercase; white-space:normal; line-height:1.15; }
        .stock-table td { font-size:8.2px!important; padding:5px 4px!important; line-height:1.2; }
        .stock-table th:nth-child(1),.stock-table td:nth-child(1){width:9%}.stock-table th:nth-child(2),.stock-table td:nth-child(2){width:21%}.stock-table th:nth-child(3),.stock-table td:nth-child(3){width:7%}.stock-table th:nth-child(4),.stock-table td:nth-child(4){width:10%}.stock-table th:nth-child(5),.stock-table td:nth-child(5){width:11%}.stock-table th:nth-child(6),.stock-table td:nth-child(6){width:11%}.stock-table th:nth-child(7),.stock-table td:nth-child(7){width:11%}.stock-table th:nth-child(8),.stock-table td:nth-child(8){width:7%}.stock-table th:nth-child(9),.stock-table td:nth-child(9){width:13%;white-space:nowrap;text-align:center}
        .print-footer { display:flex!important; justify-content:space-between; border-top:1px solid #999; margin-top:8px; padding-top:4px; font-size:7px; color:#555; }
        .print-note { margin-top:6px; font-size:7px; color:#555; }
        tr { page-break-inside:avoid; }
      } @media screen { .print-only{display:none;} }`}</style>

      <header style={styles.header} className="no-print">
        <div><h1 style={styles.title}>Estoque — Produto Acabado</h1><p style={styles.subtitle}>Relatório de posição de estoque, parâmetros de reposição e classificação ABC.</p></div>
        <button type="button" onClick={() => window.print()} style={styles.printBtn}>Imprimir relatório</button>
      </header>

      <div className="print-only print-report-header">
        <img className="print-logo" src={logoFull} alt="Logomarca ProdOS" />
        <div><h1 className="print-title">Relatório de Estoque de Produto Acabado</h1><p className="print-subtitle">Posição de estoque, parâmetros de reposição e classificação ABC</p></div>
        <div className="print-meta"><strong>{company?.name || "Empresa"}</strong><br />Emissão: {new Date().toLocaleString("pt-BR")}</div>
      </div>

      <div className="print-only print-identification">
        <div className="print-field"><span className="print-label">Empresa</span><span className="print-value">{company?.name || "Não informado"}</span></div>
        <div className="print-field"><span className="print-label">Itens apresentados</span><span className="print-value">{rows.length} produto(s)</span></div>
        <div className="print-field"><span className="print-label">Valor estimado em estoque</span><span className="print-value">R$ {totalValue.toLocaleString("pt-BR", { minimumFractionDigits:2 })}</span></div>
        <div className="print-field"><span className="print-label">Filtros aplicados</span><span className="print-value">{activeFilters ? `${activeFilters} critério(s)` : "Nenhum"}</span></div>
      </div>

      <div className="no-print" style={styles.filters}>
        <label style={styles.field}><span style={styles.fieldLabel}>Pesquisa</span><input style={styles.input} value={search} onChange={e=>setSearch(e.target.value)} placeholder="SKU ou nome do produto" /></label>
        <label style={styles.field}><span style={styles.fieldLabel}>Situação do estoque</span><select style={styles.input} value={situationFilter} onChange={e=>setSituationFilter(e.target.value)}><option value="">Todas</option><option value="normal">Dentro dos parâmetros</option><option value="baixo">Abaixo do estoque mínimo</option><option value="zerado">Sem estoque</option></select></label>
        <label style={styles.field}><span style={styles.fieldLabel}>Curva ABC</span><select style={styles.input} value={abcFilter} onChange={e=>setAbcFilter(e.target.value)}><option value="">Todas</option><option value="A">Classe A</option><option value="B">Classe B</option><option value="C">Classe C</option><option value="—">Sem classificação</option></select></label>
        <label style={styles.field}><span style={styles.fieldLabel}>Unidade de medida</span><select style={styles.input} value={unitFilter} onChange={e=>setUnitFilter(e.target.value)}><option value="">Todas</option>{units.map(u=><option key={u} value={u}>{u}</option>)}</select></label>
        <label style={styles.field}><span style={styles.fieldLabel}>Disponibilidade</span><select style={styles.input} value={stockFilter} onChange={e=>setStockFilter(e.target.value)}><option value="">Todas</option><option value="com">Com saldo</option><option value="sem">Sem saldo</option><option value="abaixo">Abaixo do mínimo</option></select></label>
        <div style={styles.filterActions}><button type="button" style={styles.clearBtn} onClick={()=>{setSearch("");setSituationFilter("");setAbcFilter("");setUnitFilter("");setStockFilter("")}}>Limpar filtros</button></div>
      </div>

      <div className="no-print" style={styles.summary}><span><strong>{rows.length}</strong> itens apresentados</span><span>Sem estoque: <strong>{zeroCount}</strong></span><span>Abaixo do mínimo: <strong>{lowCount}</strong></span><span>Valor estimado: <strong>R$ {totalValue.toLocaleString("pt-BR", { minimumFractionDigits:2 })}</strong></span></div>
      {error && <div style={styles.error}>{error}</div>}
      {loading ? <p style={styles.dim}>Carregando...</p> : rows.length === 0 ? <p style={styles.dim}>Nenhum produto acabado atende aos critérios informados.</p> : (
        <div className="stock-table" style={styles.tableWrap}>
          <table style={styles.table}><thead><tr><th style={styles.th}>SKU</th><th style={styles.th}>Produto</th><th style={styles.th}>Unidade</th><th style={styles.th}>Estoque atual</th><th style={styles.th}>Estoque mínimo</th><th style={styles.th}>Ponto de pedido</th><th style={styles.th}>Estoque máximo</th><th style={styles.th}>Curva ABC</th><th style={styles.th}>Situação</th></tr></thead><tbody>{rows.map((p) => { const qty=Number(p.stock_quantity??0),min=Number(p.min_stock??0),reorder=Number(p.reorder_point??0),max=Number(p.max_stock??0); const abc=abcClass(products,p); const situation=qty===0?"zerado":min>0&&qty<min?"baixo":"normal"; return <tr key={p.id}><td style={styles.td}>{p.sku}</td><td style={styles.td}><strong>{p.name}</strong></td><td style={styles.td}>{p.unit||"—"}</td><td style={styles.td}>{qty.toLocaleString("pt-BR")}</td><td style={styles.td}>{min>0?min.toLocaleString("pt-BR"):"—"}</td><td style={styles.td}>{reorder>0?reorder.toLocaleString("pt-BR"):"—"}</td><td style={styles.td}>{max>0?max.toLocaleString("pt-BR"):"—"}</td><td style={{...styles.td,textAlign:"center"}}><strong>{abc}</strong></td><td style={{...styles.td,textAlign:"center",fontWeight:700}}>{situation==="zerado"?"Sem estoque":situation==="baixo"?"Abaixo do mínimo":"Dentro dos parâmetros"}</td></tr>; })}</tbody></table>
        </div>
      )}
      <div className="print-only print-note">Critério da classificação ABC: valor estimado do estoque, obtido pela multiplicação da quantidade disponível pelo preço de venda cadastrado.</div>
      <div className="print-only print-footer"><span>ProdOS — Relatório de Estoque de Produto Acabado</span><span>Documento emitido pelo sistema</span></div>
    </div>
  );
}

function useAuthSafe(){
  const { company } = require("../lib/AuthContext").useAuth();
  return { company };
}

const styles={header:{marginBottom:18,display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16},title:{fontFamily:"var(--font-display)",fontSize:22,margin:0},subtitle:{color:"var(--text-dim)",fontSize:13,margin:"6px 0 0",maxWidth:820,lineHeight:1.5},printBtn:{minHeight:42,padding:"0 18px",border:0,borderRadius:8,background:"#2563EB",color:"#fff",fontWeight:800,cursor:"pointer",whiteSpace:"nowrap"},filters:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:10,padding:14,background:"var(--panel)",border:"1px solid var(--line)",borderRadius:"var(--radius)",marginBottom:12},field:{display:"flex",flexDirection:"column",gap:6},fieldLabel:{fontSize:12,fontWeight:700,color:"var(--text-dim)"},input:{width:"100%",minHeight:40,boxSizing:"border-box",padding:"8px 10px",border:"1px solid var(--line)",borderRadius:8,background:"var(--field)",color:"var(--text)"},filterActions:{display:"flex",alignItems:"flex-end"},clearBtn:{minHeight:40,padding:"0 14px",border:"1px solid var(--line)",borderRadius:8,background:"var(--panel-2)",color:"var(--text)",fontWeight:700,cursor:"pointer"},summary:{display:"flex",flexWrap:"wrap",gap:20,marginBottom:16,padding:"12px 14px",background:"var(--panel)",border:"1px solid var(--line)",borderRadius:"var(--radius)",fontSize:13},dim:{color:"var(--text-dim)",fontSize:14},error:{background:"rgba(217,105,95,.12)",border:"1px solid var(--red)",color:"var(--red)",borderRadius:"var(--radius)",padding:"10px 12px",fontSize:13,marginBottom:12},tableWrap:{border:"1px solid var(--line)",borderRadius:"var(--radius)",overflow:"hidden",overflowX:"auto"},table:{width:"100%",borderCollapse:"collapse"},th:{textAlign:"left",fontSize:11,textTransform:"uppercase",letterSpacing:".04em",color:"var(--text-dim)",padding:"10px 12px",background:"var(--panel)",borderBottom:"1px solid var(--line)"},td:{padding:"10px 12px",fontSize:13,background:"var(--panel)",borderBottom:"1px solid var(--line)"}};
