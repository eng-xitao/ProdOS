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
      subtitle="Dados de admissão, contrato e informações usadas por Férias e Folha de Pagamento"
      emptyLabel="Nenhum colaborador cadastrado ainda."
      fields={[
        { key: "full_name", label: "Nome completo", placeholder: "Nome do colaborador", required: true },
        { key: "role", label: "Cargo", placeholder: "Ex: Soldador, Vendedor, Analista" },
        { key: "status", label: "Status", type: "select", options: ["ativo", "inativo"], quickEdit: true },
        { key: "contract_type", label: "Tipo de contrato", type: "select", options: ["clt", "pj", "estagio", "temporario", "terceirizado"] },
        { key: "work_schedule", label: "Jornada", placeholder: "Ex: 44h semanais" },
        { key: "base_salary", label: "Salário base (R$)", type: "number" },
        { key: "hire_date", label: "Data de admissão", type: "date" },
        { key: "work_center_id", label: "Centro de Trabalho", type: "select", options: workCenterOptions },
        { key: "email", label: "E-mail", type: "email" },
        { key: "phone", label: "Telefone", placeholder: "(11) 90000-0000" },
        { key: "cpf", label: "CPF", placeholder: "000.000.000-00" },
        { key: "rg", label: "RG" },
        { key: "pis", label: "PIS/PASEP" },
        { key: "ctps", label: "CTPS" },
        { key: "birth_date", label: "Data de nascimento", type: "date" },
        { key: "dependents_count", label: "Nº de dependentes", type: "number" },
        { key: "address", label: "Endereço" },
        { key: "bank_name", label: "Banco" },
        { key: "bank_agency", label: "Agência" },
        { key: "bank_account", label: "Conta" },
      ]}
    />
  );
}
