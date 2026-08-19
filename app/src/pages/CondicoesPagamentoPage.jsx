import ModulePage from "../components/ModulePage";

export default function CondicoesPagamentoPage() {
  return (
    <ModulePage
      table="payment_terms"
      title="Condições de Pagamento"
      subtitle="Prazos e parcelamentos usados em vendas e compras"
      emptyLabel="Nenhuma condição de pagamento cadastrada ainda."
      fields={[
        { key: "name", label: "Nome", placeholder: "Ex: À vista, 30/60/90", required: true },
        { key: "installments", label: "Nº de parcelas", type: "number", placeholder: "Ex: 3" },
        { key: "days_between", label: "Intervalo entre parcelas (dias)", type: "number", placeholder: "Ex: 30" },
      ]}
    />
  );
}
