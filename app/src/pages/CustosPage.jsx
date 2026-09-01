import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

const money = (value) => `R$ ${Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

/** Gestão de Custos — custo padrão por BOM + custo de processo por roteiro/centro de trabalho. */
export default function CustosPage() {
  const { company } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [operations, setOperations] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (company?.id) calculate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  async function calculate() {
    setLoading(true);
    setError("");
    const companyId = company.id;

    const [productsRes, componentsRes, operationsRes, centersRes] = await Promise.all([
      supabase.from("products").select("id, sku, name, type, cost, sale_price").eq("company_id", companyId),
      supabase.from("product_components").select("parent_product_id, component_id, quantity").eq("company_id", companyId),
      supabase.from("product_operations").select("id, product_id, stage_id, work_center_id, sequence, setup_hours, run_hours_per_unit, notes").eq("company_id", companyId).order("sequence"),
      supabase.from("work_centers").select("id, name, hourly_rate").eq("company_id", companyId),
    ]);

    if (productsRes.error || componentsRes.error || operationsRes.error || centersRes.error) {
      setError(operationsRes.error ? "Não foi possível carregar o roteiro de custos. Aplique a migração de custos industriais antes de usar o custo de processo." : "Não foi possível calcular os custos.");
      setRows([]); setOperations([]); setLoading(false); return;
    }

    const products = productsRes.data ?? [];
    const components = componentsRes.data ?? [];
    const ops = operationsRes.data ?? [];
    const centers = Object.fromEntries((centersRes.data ?? []).map((c) => [c.id, c]));
    const productById = Object.fromEntries(products.map((p) => [p.id, p]));
    const componentsByParent = {};
    components.forEach((c) => {
      if (!componentsByParent[c.parent_product_id]) componentsByParent[c.parent_product_id] = [];
      componentsByParent[c.parent_product_id].push(c);
    });

    const cache = {};
    function computeMaterialCost(productId, visited = new Set()) {
      if (visited.has(productId)) return 0;
      if (cache[productId] !== undefined) return cache[productId];
      const product = productById[productId];
      if (!product) return 0;
      const bom = componentsByParent[productId];
      let cost = Number(product.cost ?? 0);
      if (bom?.length) {
        const next = new Set(visited).add(productId);
        cost = bom.reduce((sum, c) => sum + Number(c.quantity || 0) * computeMaterialCost(c.component_id, next), 0);
      }
      cache[productId] = cost;
      return cost;
    }

    const processByProduct = {};
    ops.forEach((op) => {
      const center = centers[op.work_center_id];
      const hours = Number(op.setup_hours || 0) + Number(op.run_hours_per_unit || 0);
      const cost = hours * Number(center?.hourly_rate || 0);
      processByProduct[op.product_id] = (processByProduct[op.product_id] || 0) + cost;
    });

    const result = products.map((p) => {
      const materialCost = computeMaterialCost(p.id);
      const processCost = processByProduct[p.id] || 0;
      const standardCost = materialCost + processCost;
      const salePrice = Number(p.sale_price || 0);
      const marginValue = salePrice - standardCost;
      const marginPercent = salePrice > 0 ? (marginValue / salePrice) * 100 : null;
      return { ...p, materialCost, processCost, standardCost, salePrice, marginValue, marginPercent };
    }).sort((a, b) => (a.marginPercent ?? 999) - (b.marginPercent ?? 999));

    setRows(result);
    setOperations(ops.map((op) => ({ ...op, product: productById[op.product_id], center: centers[op.work_center_id] })));
    setLoading(false);
  }

  const summary = useMemo(() => {
    const priced = rows.filter((r) => r.salePrice > 0);
    const totalSales = priced.reduce((s, r) => s + r.salePrice, 0);
    const totalCosts = priced.reduce((s, r) => s + r.standardCost, 0);
    return {
      products: rows.length,
      avgMargin: priced.length ? priced.reduce((s, r) => s + (r.marginPercent || 0), 0) / priced.length : 0,
      totalCost: totalCosts,
      totalMargin: totalSales - totalCosts,
    };
  }, [rows]);

  return (
    <div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={styles.title}>Gestão de Custos</h1>
        <p style={styles.subtitle}>Custo de materiais pela BOM + custo de processo pelo roteiro produtivo. Compare custo padrão, preço de venda e margem.</p>
      </header>

      {error && <div style={styles.error}>{error}</div>}

      {!loading && rows.length > 0 && (
        <div style={styles.cards}>
          <div style={styles.card}><span>Produtos</span><strong>{summary.products}</strong></div>
          <div style={styles.card}><span>Margem média</span><strong>{summary.avgMargin.toFixed(1)}%</strong></div>
          <div style={styles.card}><span>Custo total cadastrado</span><strong>{money(summary.totalCost)}</strong></div>
          <div style={styles.card}><span>Margem potencial</span><strong>{money(summary.totalMargin)}</strong></div>
        </div>
      )}

      {loading ? <p style={styles.dim}>Calculando...</p> : rows.length === 0 ? <p style={styles.dim}>Nenhum produto cadastrado ainda.</p> : (
        <>
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Custo padrão, processo e margem</h2>
            <div style={styles.tableWrap}><table style={styles.table}><thead><tr>
              {['SKU','Produto','Materiais / BOM','Processo','Custo padrão','Venda','Margem R$','Margem %'].map((h) => <th key={h} style={styles.th}>{h}</th>)}
            </tr></thead><tbody>{rows.map((r) => <tr key={r.id}>
              <td style={styles.td}>{r.sku}</td><td style={styles.td}>{r.name}</td><td style={styles.td}>{money(r.materialCost)}</td><td style={styles.td}>{money(r.processCost)}</td><td style={styles.td}>{money(r.standardCost)}</td><td style={styles.td}>{money(r.salePrice)}</td>
              <td style={{ ...styles.td, color: r.marginValue >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>{money(r.marginValue)}</td>
              <td style={{ ...styles.td, ...marginColor(r.marginPercent), fontWeight: 700 }}>{r.marginPercent === null ? '—' : `${r.marginPercent.toFixed(1)}%`}</td>
            </tr>)}</tbody></table></div>
          </section>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Roteiro de custos por produto</h2>
            {operations.length === 0 ? <p style={styles.dim}>Nenhum roteiro de processo cadastrado. Configure as operações do produto para incluir o custo dos centros de trabalho.</p> : <div style={styles.tableWrap}><table style={styles.table}><thead><tr>
              {['Produto','Centro de trabalho','Seq.','Setup (h)','Execução (h/un)','Custo/h','Custo processo'].map((h) => <th key={h} style={styles.th}>{h}</th>)}
            </tr></thead><tbody>{operations.map((op) => { const hours = Number(op.setup_hours || 0) + Number(op.run_hours_per_unit || 0); const rate = Number(op.center?.hourly_rate || 0); return <tr key={op.id}>
              <td style={styles.td}>{op.product?.name || '—'}</td><td style={styles.td}>{op.center?.name || '—'}</td><td style={styles.td}>{op.sequence}</td><td style={styles.td}>{Number(op.setup_hours || 0).toFixed(2)}</td><td style={styles.td}>{Number(op.run_hours_per_unit || 0).toFixed(2)}</td><td style={styles.td}>{money(rate)}</td><td style={{ ...styles.td, fontWeight: 700 }}>{money(hours * rate)}</td>
            </tr>; })}</tbody></table></div>}
          </section>
        </>
      )}
    </div>
  );
}

function marginColor(percent) {
  if (percent === null) return { color: 'var(--text-dim)' };
  if (percent < 0) return { color: 'var(--red)' };
  if (percent < 20) return { color: 'var(--amber)' };
  return { color: 'var(--green)' };
}

const styles = {
  title: { fontFamily: 'var(--font-display)', fontSize: 22, margin: 0 },
  subtitle: { color: 'var(--text-dim)', fontSize: 13, margin: '6px 0 0', maxWidth: 760, lineHeight: 1.5 },
  dim: { color: 'var(--text-dim)', fontSize: 14 },
  error: { color: 'var(--red)', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 12, marginBottom: 16, fontSize: 13 },
  cards: { display: 'grid', gridTemplateColumns: 'repeat(4,minmax(150px,1fr))', gap: 12, marginBottom: 18 },
  card: { background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 16 },
  section: { marginBottom: 20 },
  sectionTitle: { fontFamily: 'var(--font-display)', fontSize: 16, margin: '0 0 10px' },
  tableWrap: { border: '1px solid var(--line)', borderRadius: 'var(--radius)', overflow: 'hidden', overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-dim)', padding: '10px 14px', background: 'var(--panel)', borderBottom: '1px solid var(--line)' },
  td: { padding: '10px 14px', fontSize: 13.5, background: 'var(--panel)', borderBottom: '1px solid var(--line)' },
};
