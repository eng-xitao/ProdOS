import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import ModulePage from "../components/ModulePage";

export default function FeriasPage() {
  const { company } = useAuth();
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    if (!company?.id) return;
    supabase.from("employees").select("id, full_name").eq("status", "ativo").order("full_name").then(({ data }) => setEmployees(data ?? []));
  }, [company?.id]);

  const employeeOptions = employees.map((e) => ({ value: e.id, label: e.full_name }));

  return (
    <ModulePage
      table="vacations"
      title="Férias"
      subtitle="Controle de período aquisitivo, prazo de concessão e agendamento"
      emptyLabel="Nenhum período de férias cadastrado ainda."
      fields={[
        { key: "employee_id", label: "Colaborador", type: "select", options: employeeOptions, required: true },
        { key: "acquisition_start", label: "Início do período aquisitivo", type: "date", required: true },
        { key: "acquisition_end", label: "Fim do período aquisitivo", type: "date", required: true },
        { key: "concession_deadline", label: "Prazo limite para conceder", type: "date" },
        { key: "start_date", label: "Início do gozo (se agendado)", type: "date" },
        { key: "end_date", label: "Fim do gozo (se agendado)", type: "date" },
        { key: "days_taken", label: "Dias", type: "number" },
        { key: "status", label: "Status", type: "select", options: ["pendente", "agendada", "concluida"], quickEdit: true },
      ]}
    />
  );
}
