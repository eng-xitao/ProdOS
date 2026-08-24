import ModulePage from "../components/ModulePage";

export default function PlanoContasPage() {
  return (
    <ModulePage
      table="chart_of_accounts"
      title="Plano de Contas"
      subtitle="Classificação contábil formal, usada para agrupar lançamentos no DRE Gerencial"
      emptyLabel="Nenhuma conta cadastrada ainda."
      fields={[
        { key: "code", label: "Código", placeholder: "Ex: 3.1.01" },
        { key: "name", label: "Nome", placeholder: "Ex: Receita de Vendas, Despesas com Pessoal", required: true },
        { key: "account_type", label: "Tipo", type: "select", required: true, options: ["receita", "despesa"] },
      ]}
    />
  );
}
