import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import ModulePage from "../components/ModulePage";

export default function LancamentosPage() {
  const { company } = useAuth();
  const [costCenters, setCostCenters] = useState([]);

  useEffect(() => {
    if (!company?.id) return;
    supabase.from("cost_centers").select("id, name").order("name").then(({ data }) => setCostCenters(data ?? []));
  }, [company?.id]);

  const costCenterOptions = costCenters.map((c) => ({ value: c.id, label: c.name }));

  return (
    <ModulePage
      table="financial_entries"
      title="Lançamentos Avulsos"
      subtitle="Despesas e receitas que não vêm de um Pedido de Venda ou Compra (ex: aluguel, folha de pagamento)"
      emptyLabel="Nenhum lançamento avulso cadastrado ainda."
      filterRows={(rows) => rows.filter((r) => !r.sales_order_id && !r.purchase_order_id && !r.employee_id)}
      statusField={{ key: "paid", label: "Situação", trueLabel: "Baixado", falseLabel: "Em aberto" }}
      fields={[
        { key: "description", label: "Descrição", placeholder: "Ex: Aluguel do galpão", required: true },
        { key: "entry_type", label: "Tipo", type: "select", required: true, options: ["receita", "despesa"] },
        { key: "amount", label: "Valor (R$)", type: "number", required: true },
        { key: "due_date", label: "Vencimento", type: "date", required: true },
        { key: "cost_center_id", label: "Centro de Custo", type: "select", options: costCenterOptions },
      ]}
    />
  );
}
