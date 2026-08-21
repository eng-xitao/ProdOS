import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import ModulePage from "../components/ModulePage";

export default function SACPage() {
  const { company } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    if (!company?.id) return;
    supabase.from("customers").select("id, name").order("name").then(({ data }) => setCustomers(data ?? []));
    supabase.from("employees").select("id, full_name").eq("status", "ativo").order("full_name").then(({ data }) => setEmployees(data ?? []));
  }, [company?.id]);

  const customerOptions = customers.map((c) => ({ value: c.id, label: c.name }));
  const employeeOptions = employees.map((e) => ({ value: e.id, label: e.full_name }));

  return (
    <ModulePage
      table="support_tickets"
      title="SAC — Atendimento ao Cliente"
      subtitle="Chamados, reclamações e solicitações de suporte"
      emptyLabel="Nenhum chamado registrado ainda."
      fields={[
        { key: "subject", label: "Assunto", placeholder: "Resumo do chamado", required: true },
        { key: "customer_id", label: "Cliente", type: "select", options: customerOptions },
        { key: "description", label: "Descrição", placeholder: "Detalhes do problema/solicitação" },
        { key: "priority", label: "Prioridade", type: "select", options: ["baixa", "media", "alta"] },
        { key: "status", label: "Status", type: "select", options: ["aberto", "em_atendimento", "resolvido", "fechado"], quickEdit: true },
        { key: "assigned_to", label: "Responsável", type: "select", options: employeeOptions },
      ]}
    />
  );
}
