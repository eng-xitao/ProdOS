import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { Link } from "react-router-dom";
import ModulePage from "../components/ModulePage";

export default function ProducaoPage() {
  const { company } = useAuth();
  const [stages, setStages] = useState([]);
  const [products, setProducts] = useState([]);
  const [salesOrders, setSalesOrders] = useState([]);
  const [orderTypes, setOrderTypes] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

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
  }, [company?.id]);

  const stageOptions = stages.map((s) => ({ value: s.id, label: s.name }));
  const productOptions = products.map((p) => ({ value: p.id, label: `${p.sku} — ${p.name}` }));
  const salesOrderOptions = salesOrders.map((o) => ({ value: o.id, label: o.code }));
  const orderTypeOptions = orderTypes.map((t) => ({ value: t.id, label: `${t.name} (${t.prefix})` }));

  if (loaded && stages.length === 0) {
    return (
      <div style={styles.notice}>
        Antes de cadastrar ordens de produção, configure ao menos uma etapa do seu processo em{" "}
        <Link to="/etapas" style={styles.link}>Cadastro → Etapas</Link>.
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
};
