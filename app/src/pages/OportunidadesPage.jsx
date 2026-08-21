import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { Link } from "react-router-dom";
import ModulePage from "../components/ModulePage";

export default function OportunidadesPage() {
  const { company } = useAuth();
  const [stages, setStages] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!company?.id) return;
    Promise.all([
      supabase.from("opportunity_stages").select("id, name").order("sort_order", { ascending: true }),
      supabase.from("customers").select("id, name").order("name"),
    ]).then(([stagesRes, customersRes]) => {
      setStages(stagesRes.data ?? []);
      setCustomers(customersRes.data ?? []);
      setLoaded(true);
    });
  }, [company?.id]);

  const stageOptions = stages.map((s) => ({ value: s.id, label: s.name }));
  const customerOptions = customers.map((c) => ({ value: c.id, label: c.name }));

  if (loaded && stages.length === 0) {
    return (
      <div style={styles.notice}>
        Antes de cadastrar oportunidades, configure ao menos uma etapa do seu funil em{" "}
        <Link to="/etapas-comercial" style={styles.link}>Comercial → Etapas</Link>.
      </div>
    );
  }

  return (
    <ModulePage
      table="opportunities"
      title="Oportunidades"
      subtitle="Funil de vendas — negociações em andamento"
      emptyLabel="Nenhuma oportunidade cadastrada ainda."
      fields={[
        { key: "title", label: "Título", placeholder: "Ex: Projeto reforma industrial", required: true },
        { key: "customer_id", label: "Cliente", type: "select", options: customerOptions },
        { key: "stage_id", label: "Etapa", type: "select", required: true, options: stageOptions },
        { key: "estimated_value", label: "Valor estimado", type: "currency" },
        { key: "expected_close_date", label: "Previsão de fechamento", type: "date" },
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
