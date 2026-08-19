import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { Link } from "react-router-dom";
import ModulePage from "../components/ModulePage";

export default function ProducaoPage() {
  const { company } = useAuth();
  const [stages, setStages] = useState([]);
  const [products, setProducts] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!company?.id) return;
    Promise.all([
      supabase.from("production_stages").select("id, name").order("sort_order", { ascending: true }),
      supabase.from("products").select("id, sku, name").order("name"),
    ]).then(([stagesRes, productsRes]) => {
      setStages(stagesRes.data ?? []);
      setProducts(productsRes.data ?? []);
      setLoaded(true);
    });
  }, [company?.id]);

  const stageOptions = stages.map((s) => ({ value: s.id, label: s.name }));
  const productOptions = products.map((p) => ({ value: p.id, label: `${p.sku} — ${p.name}` }));

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
    <ModulePage
      table="production_orders"
      title="Produção"
      subtitle="Ordens de produção e etapa atual"
      emptyLabel="Nenhuma ordem de produção cadastrada ainda."
      fields={[
        { key: "code", label: "Código", placeholder: "OP-0001", required: true },
        { key: "product_id", label: "Produto", type: "select", required: true, options: productOptions },
        { key: "quantity", label: "Quantidade", type: "number", required: true },
        { key: "stage_id", label: "Etapa", type: "select", required: true, options: stageOptions },
        { key: "due_date", label: "Prazo", type: "date" },
      ]}
    />
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
