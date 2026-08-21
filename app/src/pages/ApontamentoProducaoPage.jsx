import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import ModulePage from "../components/ModulePage";

export default function ApontamentoProducaoPage() {
  const { company } = useAuth();
  const [orders, setOrders] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [stages, setStages] = useState([]);

  useEffect(() => {
    if (!company?.id) return;
    supabase.from("production_orders").select("id, code").order("code").then(({ data }) => setOrders(data ?? []));
    supabase.from("employees").select("id, full_name").eq("status", "ativo").order("full_name").then(({ data }) => setEmployees(data ?? []));
    supabase.from("production_stages").select("id, name").order("sort_order").then(({ data }) => setStages(data ?? []));
  }, [company?.id]);

  const orderOptions = orders.map((o) => ({ value: o.id, label: o.code }));
  const employeeOptions = employees.map((e) => ({ value: e.id, label: e.full_name }));
  const stageOptions = stages.map((s) => ({ value: s.id, label: s.name }));

  return (
    <ModulePage
      table="production_time_logs"
      title="Apontamento de Produção"
      subtitle="Registro de horas trabalhadas e quantidade produzida em cada ordem. A quantidade produzida atualiza automaticamente o progresso da OP em PCP → Ordens de Produção."
      emptyLabel="Nenhum apontamento registrado ainda."
      fields={[
        { key: "production_order_id", label: "Ordem de Produção", type: "select", options: orderOptions, required: true },
        { key: "employee_id", label: "Colaborador", type: "select", options: employeeOptions },
        { key: "stage_id", label: "Etapa", type: "select", options: stageOptions },
        { key: "log_date", label: "Data", type: "date", required: true },
        { key: "start_time", label: "Início", type: "time" },
        { key: "end_time", label: "Fim", type: "time" },
        { key: "hours", label: "Horas trabalhadas", type: "number", placeholder: "Ex: 4.5" },
        { key: "quantity_produced", label: "Qtd. produzida", type: "number", placeholder: "Ex: 50" },
        { key: "quantity_scrapped", label: "Qtd. refugada", type: "number", placeholder: "Ex: 2" },
        { key: "notes", label: "Observações", placeholder: "Campo livre" },
      ]}
    />
  );
}
