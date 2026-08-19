import ModulePage from "../components/ModulePage";

export default function VendasPage() {
  return (
    <ModulePage
      table="sales_orders"
      title="Vendas"
      subtitle="Pedidos de clientes"
      emptyLabel="Nenhum pedido cadastrado ainda."
      fields={[
        { key: "code", label: "Código", placeholder: "PV-0001", required: true },
        { key: "customer_name", label: "Cliente", placeholder: "Nome do cliente", required: true },
        { key: "total_value", label: "Valor total", type: "number", required: true },
        {
          key: "status",
          label: "Status",
          type: "select",
          required: true,
          options: ["aberto", "faturado", "entregue", "cancelado"],
        },
        { key: "order_date", label: "Data do pedido", type: "date" },
      ]}
    />
  );
}
