import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

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
          @page { size: A4 landscape; margin: 12mm 10mm 15mm; }
          body { background:#fff !important; color:#17202a !important; }
          .app-sidebar, nav, aside, header button, .no-print { display:none !important; }
          .stock-page { padding:0 !important; }
          .print-only { display:block !important; }
          .print-report-header { display:flex !important; justify-content:space-between; align-items:center; border-bottom:2px solid #17202a; padding-bottom:12px; margin-bottom:14px; }
          .brand { display:flex; align-items:center; gap:10px; }
          .brand-mark { width:34px; height:34px; border-radius:9px; background:#17202a; color:#fff; display:flex; align-items:center; justify-content:center; font-size:20px; font-weight:900; }
          .brand-name { font-size:20px; font-weight:900; letter-spacing:-.7px; }
          .brand-sub { font-size:9px; color:#68717d; margin-top:2px; }
          .print-title { margin:0; font-size:18px; }
          .print-meta { text-align:right; font-size:9px; line-height:1.55; color:#59636f; }
          .print-summary { display:grid !important; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-bottom:12px; }
          .print-card { border:1px solid #c7cdd4; padding:8px 10px; border-radius:6px; }
          .print-card-label { display:block; font-size:8px; text-transform:uppercase; color:#68717d; }
          .print-card-value { display:block; font-size:13px; font-weight:800; margin-top:2px; }
          .stock-table { border:1px solid #8e969f !important; overflow:visible !important; }
          .stock-table table { font-size:9px !important; }
          .stock-table th { background:#eef1f4 !important; color:#17202a !important; border:1px solid #aeb5bc !important; padding:7px 8px !important; }
          .stock-table td { color:#17202a !important; background:#fff !important; border:1px solid #c6cbd1 !important; padding:7px 8px !important; }
          .print-footer { display:flex !important; justify-content:space-between; border-top:1px solid #aeb5bc; margin-top:12px; padding-top:6px; font-size:8px; color:#68717d; }
        }
        .print-only { display:none; }
      `}</style>

      <header style={styles.header} className="no-print">
        <div><h1 style={styles.title}>Estoque — Produto Acabado</h1><p style={styles.subtitle}>Controle de produto acabado com estoque mínimo, ponto de pedido, estoque máximo e classificação ABC.</p></div>
        <button type="button" onClick={() => window.print()} style={styles.printBtn}>🖨 Imprimir relatório</button>
      </header>

      <div className="print-only print-report-header">
        <div className="brand"><div className="brand-mark">P</div><div><div className="brand-name">ProdOS</div><div className="brand-sub">Gestão integrada da produção</div></div></div>
        <div><h1 className="print-title">Relatório de Estoque — Produto Acabado</h1><div className="print-meta"><strong>{company?.name || "Empresa"}</strong><br/>Emissão: {new Date().toLocaleString("pt-BR")}</div></div>
      </div>

      <div className="print-only print-summary">
        <div className="print-card"><span className="print-card-label">Produtos ativos</span><span className="print-card-value">{products.length}</span></div>
        <div className="print-card"><span className="print-card-label">Valor em estoque</span><span className="print-card-value">R$ {totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
        <div className="print-card"><span className="print-card-label">Critério ABC</span><span className="print-card-value">Valor do estoque</span></div>
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
      <div className="print-only print-footer"><span>ProdOS · Relatório de Estoque — Produto Acabado</span><span>Documento gerado pelo sistema · Página impressa</span></div>
      <p className="no-print" style={styles.note}>A classificação ABC é calculada pelo valor atualmente mantido em estoque (quantidade × preço de venda).</p>
    </div>
  );
}

function situationStyle(s) { if(s==="zerado") return {background:"rgba(217,105,95,.15)",color:"var(--red)"}; if(s==="baixo") return {background:"rgba(232,163,61,.15)",color:"var(--amber)"}; return {background:"rgba(79,174,126,.15)",color:"var(--green)"}; }

const styles={
  header:{marginBottom:20,display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16}, title:{fontFamily:"var(--font-display)",fontSize:22,margin:0}, subtitle:{color:"var(--text-dim)",fontSize:13,margin:"6px 0 0",maxWidth:820,lineHeight:1.5},
  printBtn:{minHeight:42,padding:"0 18px",border:0,borderRadius:8,background:"#2563EB",color:"#fff",fontWeight:800,cursor:"pointer",whiteSpace:"nowrap",boxShadow:"0 2px 5px rgba(37,99,235,.22)"},
  summary:{display:"flex",gap:24,marginBottom:16,padding:"12px 14px",background:"var(--panel)",border:"1px solid var(--line)",borderRadius:"var(--radius)",fontSize:13}, dim:{color:"var(--text-dim)",fontSize:14}, error:{background:"rgba(217,105,95,.12)",border:"1px solid var(--red)",color:"var(--red)",borderRadius:"var(--radius)",padding:"10px 12px",fontSize:13,marginBottom:12}, tableWrap:{border:"1px solid var(--line)",borderRadius:"var(--radius)",overflow:"hidden",overflowX:"auto"}, table:{width:"100%",borderCollapse:"collapse"}, th:{textAlign:"left",fontSize:11,textTransform:"uppercase",letterSpacing:".04em",color:"var(--text-dim)",padding:"10px 12px",background:"var(--panel)",borderBottom:"1px solid var(--line)"}, td:{padding:"10px 12px",fontSize:13,background:"var(--panel)",borderBottom:"1px solid var(--line)"}, badge:{padding:"3px 10px",borderRadius:20,fontSize:11.5,fontWeight:700}, note:{marginTop:10,color:"var(--text-dim)",fontSize:11.5}
};
