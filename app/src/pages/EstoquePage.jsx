import ModulePage from "../components/ModulePage";

export default function EstoquePage() {
  return (
    <ModulePage
      table="inventory_items"
      title="Estoque"
      subtitle="Produtos e insumos disponíveis"
      emptyLabel="Nenhum item de estoque cadastrado ainda."
      fields={[
        { key: "sku", label: "SKU", placeholder: "Ex: CHP-001", required: true },
        { key: "name", label: "Nome", placeholder: "Ex: Chapa de aço 2mm", required: true },
        { key: "quantity", label: "Quantidade", type: "number", required: true },
        { key: "unit", label: "Unidade", placeholder: "un, kg, m..." },
        { key: "min_quantity", label: "Estoque mínimo", type: "number" },
      ]}
    />
  );
}
