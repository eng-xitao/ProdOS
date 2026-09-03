import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { Link } from "react-router-dom";
import ModulePage from "../components/ModulePage";

export default function ProducaoPage() {
  const { company, profile } = useAuth();
  const [stages, setStages] = useState([]);
  const [products, setProducts] = useState([]);
  const [salesOrders, setSalesOrders] = useState([]);
  const [orderTypes, setOrderTypes] = useState([]);
  const [pending, setPending] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [processingId, setProcessingId] = useState("");

  async function loadPending() {
    const { data } = await supabase
      .from("production_orders")
      .select("id, code, quantity, created_at, products:product_id (sku, name), sales_orders:sales_order_id (code, customers:customer_id (name))")
      .eq("status", "solicitada")
      .order("created_at", { ascending: true });
    setPending(data ?? []);
  }

  useEffect(() => {
    if (!company?.id) return;
    Promise.all([
      supabase.from("production_stages").select("id, name").order("sort_order", { ascending: true }),
      supabase.from("products").select("id, sku, name").order("name"),
      supabase.from("sales_orders").select("id, code").order("code"),
      supabase.from("production_order_types").select("id, name, prefix").order("name"),
    ]).then(([stagesRes, productsRes, salesOrdersRes, typesRes]) => {
      setStages(stagesRes.data ?? []);
      setProducts(productsRes.data ?? []);
      setSalesOrders(salesOrdersRes.data ?? []);
      setOrderTypes(typesRes.data ?? []);
      setLoaded(true);
    });
    loadPending();
  }, [company?.id]);

  async function approve(id) {
    setProcessingId(id);
    const defaultStage = stages[0]?.id ?? null;
    await supabase.from("production_orders").update({
      status: "planejada", approved_by: profile?.id || null, approved_at: new Date().toISOString(), stage_id: defaultStage,
    }).eq("id", id);
    setProcessingId("");
    await loadPending();
    setRefreshKey((k) => k + 1);
  }

  async function reject(id) {
    const reason = window.prompt("Motivo da rejeição (o Comercial vai ver isso):");
    if (reason === null) return;
    setProcessingId(id);
    await supabase.from("production_orders").update({
      status: "rejeitada", approved_by: profile?.id || null, approved_at: new Date().toISOString(), rejection_reason: reason || null,
    }).eq("id", id);
    setProcessingId("");
    await loadPending();
    setRefreshKey((k) => k + 1);
  }

  const stageOptions = stages.map((s) => ({ value: s.id, label: s.name }));
  const productOptions = products.map((p) => ({ value: p.id, label: `${p.sku} — ${p.name}` }));
  const salesOrderOptions = salesOrders.map((o) => ({ value: o.id, label: o.code }));
  const orderTypeOptions = orderTypes.map((t) => ({ value: t.id, label: `${t.name} (${t.prefix})` }));

  if (loaded && stages.length === 0) {
    return (
      <div style={styles.notice}>
        Antes de cadastrar ordens de produção, configure ao menos uma etapa do seu processo em{" "}
        <Link to="/etapas" style={styles.link}>Cadastro → Etapas de Produção</Link>.
      </div>
    );
  }

  if (loaded && products.length === 0) {
    return (
      <div style={styles.notice}>
        Antes de cadastrar ordens de produção, cadastre ao menos um produto em{" "}
        <Link to="/produtos" style={styles.link}>Cadastro → Produtos</Link>.
      </div>
    );
  }

  return (
    <div>
      {pending.length > 0 && (
        <div style={styles.pendingBox}>
          <p style={styles.pendingTitle}>⏳ Solicitações do Comercial aguardando sua aprovação ({pending.length})</p>
          <p style={styles.pendingSub}>O Comercial só solicita — cabe ao PCP decidir se aprova, quando programa e em qual etapa entra.</p>
          <div style={styles.pendingList}>
            {pending.map((p) => (
              <div key={p.id} style={styles.pendingRow}>
                <div>
                  <strong>{p.products?.sku} — {p.products?.name}</strong>
                  <span style={styles.pendingDetail}>{p.quantity} unidade(s) · Pedido {p.sales_orders?.code ?? "—"} ({p.sales_orders?.customers?.name ?? "sem cliente"})</span>
                </div>
                <div style={styles.pendingActions}>
                  <button style={styles.approveBtn} onClick={() => approve(p.id)} disabled={processingId === p.id} type="button">✓ Aprovar</button>
                  <button style={styles.rejectBtn} onClick={() => reject(p.id)} disabled={processingId === p.id} type="button">✕ Rejeitar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ModulePage
        key={refreshKey}
        table="production_orders"
        title="Produção"
        subtitle="Ordens de produção e etapa atual"
        emptyLabel="Nenhuma ordem de produção cadastrada ainda."
        autoGenerateCode={{ field: "code", rpc: "next_production_order_code" }}
        fields={[
          { key: "code", label: "Código", placeholder: "Gerado automaticamente", required: true },
          { key: "order_type_id", label: "Tipo de Ordem", type: "select", options: orderTypeOptions },
          {
            key: "priority", label: "Prioridade", type: "select", quickEdit: true,
            options: [
              { value: "baixa", label: "Baixa" },
              { value: "normal", label: "Normal" },
              { value: "alta", label: "Alta" },
              { value: "urgente", label: "Urgente" },
            ],
          },
          { key: "product_id", label: "Produto", type: "select", required: true, options: productOptions },
          { key: "quantity", label: "Quantidade", type: "number", required: true },
          { key: "stage_id", label: "Etapa", type: "select", required: true, options: stageOptions, quickEdit: true },
          { key: "sales_order_id", label: "Pedido de Venda relacionado", type: "select", options: salesOrderOptions },
          { key: "planned_start_date", label: "Início planejado", type: "date" },
          { key: "due_date", label: "Término planejado (prazo)", type: "date" },
          { key: "actual_start_date", label: "Início real", type: "date", formHidden: true },
          { key: "actual_end_date", label: "Término real", type: "date", formHidden: true },
          { key: "quantity_produced", label: "Produzido", type: "number", formHidden: true },
          {
            key: "status", label: "Status", type: "select", formHidden: true, quickEdit: true,
            options: [
              { value: "planejada", label: "Planejada" },
              { value: "em_andamento", label: "Em andamento" },
              { value: "concluida", label: "Concluída" },
            ],
          },
        ]}
      />
    </div>
  );
}

const styles = {
  notice: {
    background: "rgba(232,163,61,0.1)",
    border: "1px solid var(--amber)",
    color: "var(--text)",
    borderRadius: "var(--radius)",
    padding: "14px 16px",
    fontSize: 13.5,
    lineHeight: 1.5,
    maxWidth: 620,
  },
  link: { color: "var(--amber)", fontWeight: 600 },
  pendingBox: { background: "rgba(232,163,61,0.08)", border: "1px solid var(--amber)", borderRadius: "var(--radius)", padding: 18, marginBottom: 24 },
  pendingTitle: { fontWeight: 700, fontSize: 15, margin: "0 0 4px" },
  pendingSub: { color: "var(--text-dim)", fontSize: 12.5, margin: "0 0 14px" },
  pendingList: { display: "flex", flexDirection: "column", gap: 8 },
  pendingRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, padding: "12px 14px", flexWrap: "wrap" },
  pendingDetail: { display: "block", fontSize: 12, color: "var(--text-dim)", marginTop: 3 },
  pendingActions: { display: "flex", gap: 8 },
  approveBtn: { background: "var(--green)", color: "#fff", border: "none", borderRadius: 7, padding: "7px 12px", fontWeight: 700, fontSize: 12.5, cursor: "pointer" },
  rejectBtn: { background: "transparent", border: "1px solid var(--danger)", color: "var(--danger)", borderRadius: 7, padding: "7px 12px", fontWeight: 700, fontSize: 12.5, cursor: "pointer" },
};
