import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import ModulePage from "../components/ModulePage";

export default function CentrosTrabalhoPage() {
  const { company } = useAuth();
  const [stages, setStages] = useState([]);

  useEffect(() => {
    if (!company?.id) return;
    supabase
      .from("production_stages")
      .select("id, name")
      .order("sort_order", { ascending: true })
      .then(({ data }) => setStages(data ?? []));
  }, [company?.id]);

  const stageOptions = stages.map((s) => ({ value: s.id, label: s.name }));

  return (
    <ModulePage
      table="work_centers"
      title="Centros de Trabalho"
      subtitle="Máquinas, linhas, salas ou equipes — a capacidade disponível em cada etapa"
      emptyLabel="Nenhum centro de trabalho cadastrado ainda."
      fields={[
        { key: "name", label: "Nome", placeholder: "Ex: Linha de solda 1, Sala 2, Equipe A", required: true },
        { key: "stage_id", label: "Etapa vinculada", type: "select", options: stageOptions },
        { key: "capacity", label: "Capacidade", type: "number", placeholder: "Ex: 8", required: true },
        { key: "capacity_unit", label: "Unidade da capacidade", placeholder: "horas/dia, peças/dia..." },
      ]}
    />
  );
}
