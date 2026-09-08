import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
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
  const { company } = useAuth();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => { if (company?.id) load(); }, [company?.id]);

  async function load() {
    setLoading(true); setError("");
    const { data, error: e } = await supabase
      .from("products")
      .select("id, sku, name, unit, stock_quantity, min_stock, reorder_point, max_stock, sale_price, active")
      .eq("company_id", company.id).eq("type", "acabado").eq("active", true).order("name");
    if (e) setError(e.message); else setProducts(data ?? []);
    setLoading(false);
  }

  const totalValue = products.reduce((sum, p) => sum + Number(p.stock_quantity ?? 0) * Number(p.sale_price ?? 0), 0);

  return (
    <div className="stock-page">
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 12mm 12mm 15mm; }
          body { background:#fff !important; color:#111 !important; font-family:Arial, Helvetica, sans-serif !important; }
          .app-sidebar, nav, aside, header button, .no-print { display:none !important; }
          .stock-page { padding:0 !important; width:100% !important; }
          .print-only { display:block !important; }
          .print-report-header { display:grid !important; grid-template-columns:150px 1fr 210px; align-items:center; gap:18px; border-bottom:2px solid #222; padding-bottom:10px; margin-bottom:12px; }
          .print-logo { width:135px; max-height:52px; object-fit:contain; object-position:left center; }
          .print-title { margin:0; text-align:center; font-size:16px; font-weight:700; letter-spacing:.2px; text-transform:uppercase; }
          .print-subtitle { margin:4px 0 0; text-align:center; font-size:9px; color:#444; }
          .print-meta { text-align:right; font-size:9px; line-height:1.5; }
          .print-identification { display:grid !important; grid-template-columns:1.4fr 1fr 1fr; gap:8px; margin-bottom:12px; }
          .print-field { border:1px solid #999; padding:6px 8px; min-height:28px; }
          .print-label { display:block; font-size:7px; font-weight:700; text-transform:uppercase; color:#555; margin-bottom:2px; }
          .print-value { font-size:9px; font-weight:600; }
          .stock-table { border:1px solid #777 !important; overflow:visible !important; border-radius:0 !important; }
          .stock-table table { table-layout:fixed; width:100%; }
          .stock-table th, .stock-table td { color:#111 !important; background:#fff !important; border:1px solid #aaa !important; }
          .stock-table th { background:#eee !important; font-size:8px !important; padding:6px 5px !important; text-transform:uppercase; }
          .stock-table td { font-size:9px !important; padding:6px 5px !important; }
          .stock-table th:nth-child(1),.stock-table td:nth-child(1){width:9%}.stock-table th:nth-child(2),.stock-table td:nth-child(2){width:24%}.stock-table th:nth-child(3),.stock-table td:nth-child(3){width:8%}.stock-table th:nth-child(4),.stock-table td:nth-child(4){width:12%}.stock-table th:nth-child(5),.stock-table td:nth-child(5){width:12%}.stock-table th:nth-child(6),.stock-table td:nth-child(6){width:12%}.stock-table th:nth-child(7),.stock-table td:nth-child(7){width:8%;text-align:center}.stock-table th:nth-child(8),.stock-table td:nth-child(8){width:15%}
          .print-footer { display:flex !important; justify-content:space-between; border-top:1px solid #999; margin-top:10px; padding-top:5px; font-size:7.5px; color:#555; }
        }
        .print-only { display:none; }
      `}</style>

      <header style={styles.header} className="no-print">
        <div><h1 style={styles.title}>Estoque — Produto Acabado</h1><p style={styles.subtitle}>Controle de produto acabado com estoque mínimo, ponto de pedido, estoque máximo e classificação ABC.</p></div>
        <button type="button" onClick={() => window.print()} style={styles.printBtn}>Imprimir relatório</button>
      </header>

      <div className="print-only print-report-header">
        <img className="print-logo" src={logoFull} alt="Logomarca ProdOS" />
        <div><h1 className="print-title">Relatório de Estoque de Produto Acabado</h1><p className="print-subtitle">Controle de disponibilidade, parâmetros de reposição e classificação ABC</p></div>
        <div className="print-meta"><strong>{company?.name || "Empresa"}</strong><br />Emissão: {new Date().toLocaleString("pt-BR")}</div>
      </div>

      <div className="print-only print-identification">
        <div className="print-field"><span className="print-label">Empresa</span><span className="print-value">{company?.name || "Não informado"}</span></div>
        <div className="print-field"><span className="print-label">Quantidade de itens</span><span className="print-value">{products.length} produto(s) ativo(s)</span></div>
        <div className="print-field"><span className="print-label">Valor estimado em estoque</span><span className="print-value">R$ {totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
      </div>

      <div className="no-print" style={styles.summary}><span><strong>{products.length}</strong> produtos ativos</span><span>Valor em estoque: <strong>R$ {totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></span></div>
      {error && <div style={styles.error}>{error}</div>}
      {loading ? <p style={styles.dim}>Carregando...</p> : products.length === 0 ? <p style={styles.dim}>Nenhum produto acabado ativo cadastrado.</p> : (
        <div className="stock-table" style={styles.tableWrap}>
          <table style={styles.table}><thead><tr>
            <th style={styles.th}>SKU</th><th style={styles.th}>Produto</th><th style={styles.th}>Unid.</th><th style={styles.th}>Disponível</th>
            <th style={styles.th}>Estoque mínimo</th><th style={styles.th}>Ponto de pedido</th><th style={styles.th}>Estoque máximo</th><th style={styles.th}>Curva ABC</th><th style={styles.th}>Situação</th>
          </tr></thead><tbody>{products.map((p) => {
            const qty=Number(p.stock_quantity??0), min=Number(p.min_stock??0), reorder=Number(p.reorder_point??0), max=Number(p.max_stock??0);
            const abc=abcClass(products,p); const situation=qty===0?"zerado":min>0&&qty<min?"baixo":"ok";
            return <tr key={p.id}><td style={styles.td}>{p.sku}</td><td style={styles.td}><strong>{p.name}</strong></td><td style={styles.td}>{p.unit||"—"}</td><td style={styles.td}>{qty.toLocaleString("pt-BR")}</td><td style={styles.td}>{min>0?min.toLocaleString("pt-BR"):"—"}</td><td style={styles.td}>{reorder>0?reorder.toLocaleString("pt-BR"):"—"}</td><td style={styles.td}>{max>0?max.toLocaleString("pt-BR"):"—"}</td><td style={styles.td}><strong>{abc}</strong></td><td style={styles.td}><span style={{...styles.badge,...situationStyle(situation)}}>{situation==="zerado"?"Zerado":situation==="baixo"?"Abaixo do mínimo":"OK"}</span></td></tr>;
          })}</tbody></table>
        </div>
      )}
      <div className="print-only print-footer"><span>ProdOS — Relatório de Estoque de Produto Acabado</span><span>Documento emitido pelo sistema</span></div>
      <p className="no-print" style={styles.note}>A classificação ABC é calculada pelo valor atualmente mantido em estoque (quantidade × preço de venda).</p>
    </div>
  );
}

function situationStyle(s) { if(s==="zerado") return {background:"rgba(217,105,95,.15)",color:"var(--red)"}; if(s==="baixo") return {background:"rgba(232,163,61,.15)",color:"var(--amber)"}; return {background:"rgba(79,174,126,.15)",color:"var(--green)"}; }

const styles={header:{marginBottom:20,display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16},title:{fontFamily:"var(--font-display)",fontSize:22,margin:0},subtitle:{color:"var(--text-dim)",fontSize:13,margin:"6px 0 0",maxWidth:820,lineHeight:1.5},printBtn:{minHeight:42,padding:"0 18px",border:0,borderRadius:8,background:"#2563EB",color:"#fff",fontWeight:800,cursor:"pointer",whiteSpace:"nowrap",boxShadow:"0 2px 5px rgba(37,99,235,.22)"},summary:{display:"flex",gap:24,marginBottom:16,padding:"12px 14px",background:"var(--panel)",border:"1px solid var(--line)",borderRadius:"var(--radius)",fontSize:13},dim:{color:"var(--text-dim)",fontSize:14},error:{background:"rgba(217,105,95,.12)",border:"1px solid var(--red)",color:"var(--red)",borderRadius:"var(--radius)",padding:"10px 12px",fontSize:13,marginBottom:12},tableWrap:{border:"1px solid var(--line)",borderRadius:"var(--radius)",overflow:"hidden",overflowX:"auto"},table:{width:"100%",borderCollapse:"collapse"},th:{textAlign:"left",fontSize:11,textTransform:"uppercase",letterSpacing:".04em",color:"var(--text-dim)",padding:"10px 12px",background:"var(--panel)",borderBottom:"1px solid var(--line)"},td:{padding:"10px 12px",fontSize:13,background:"var(--panel)",borderBottom:"1px solid var(--line)"},badge:{padding:"3px 10px",borderRadius:20,fontSize:11.5,fontWeight:700},note:{marginTop:10,color:"var(--text-dim)",fontSize:11.5}};
