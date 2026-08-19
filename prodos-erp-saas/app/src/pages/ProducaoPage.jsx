import ModulePage from "../components/ModulePage";

export default function ProducaoPage() {
  return (
    <ModulePage
      table="production_orders"
      title="Produção"
      subtitle="Ordens de produção e etapa atual"
      emptyLabel="Nenhuma ordem de produção cadastrada ainda."
      fields={[
        { key: "code", label: "Código", placeholder: "OP-0001", required: true },
        { key: "product_name", label: "Produto", placeholder: "Ex: Portão basculante", required: true },
        { key: "quantity", label: "Quantidade", type: "number", required: true },
        {
          key: "stage",
          label: "Etapa",
          type: "select",
          required: true,
          options: ["planejamento", "corte", "solda", "lixacao", "acabamento", "pintura", "concluido"],
        },
        { key: "due_date", label: "Prazo", type: "date" },
      ]}
    />
  );
}
