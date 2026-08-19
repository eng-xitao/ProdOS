import ModulePage from "../components/ModulePage";

export default function FinanceiroPage() {
  return (
    <ModulePage
      table="financial_entries"
      title="Financeiro"
      subtitle="Contas a pagar e a receber"
      emptyLabel="Nenhum lançamento cadastrado ainda."
      fields={[
        { key: "description", label: "Descrição", placeholder: "Ex: Pagamento fornecedor X", required: true },
        {
          key: "entry_type",
          label: "Tipo",
          type: "select",
          required: true,
          options: ["receita", "despesa"],
        },
        { key: "amount", label: "Valor (R$)", type: "number", required: true },
        { key: "due_date", label: "Vencimento", type: "date", required: true },
      ]}
    />
  );
}
