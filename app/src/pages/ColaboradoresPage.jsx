import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import ModulePage from "../components/ModulePage";

export default function ColaboradoresPage() {
  const { company } = useAuth();
  const [workCenters, setWorkCenters] = useState([]);

  useEffect(() => {
    if (!company?.id) return;
    supabase.from("work_centers").select("id, name").order("name").then(({ data }) => setWorkCenters(data ?? []));
  }, [company?.id]);

  const workCenterOptions = workCenters.map((w) => ({ value: w.id, label: w.name }));

  return (
    <ModulePage
      table="employees"
      title="Colaboradores"
      subtitle="Equipe da empresa — pode ser vinculada a um Centro de Trabalho"
      emptyLabel="Nenhum colaborador cadastrado ainda."
      fields={[
        { key: "full_name", label: "Nome completo", placeholder: "Nome do colaborador", required: true },
        { key: "role", label: "Cargo", placeholder: "Ex: Soldador, Vendedor, Analista" },
        { key: "email", label: "E-mail", type: "email" },
        { key: "phone", label: "Telefone", placeholder: "(11) 90000-0000" },
        { key: "hire_date", label: "Data de admissão", type: "date" },
        { key: "status", label: "Status", type: "select", options: ["ativo", "inativo"] },
        { key: "work_center_id", label: "Centro de Trabalho", type: "select", options: workCenterOptions },
      ]}
    />
  );
}
