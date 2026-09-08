import ModulePage from "../components/ModulePage";

const WAREHOUSE_TYPES = [
  { value: "produto_acabado", label: "Produto Acabado" },
  { value: "materia_prima", label: "Matéria-prima" },
  { value: "insumos", label: "Insumos" },
  { value: "embalagens", label: "Embalagens" },
  { value: "geral", label: "Geral" },
];

export default function AlmoxarifadosPage() {
  return (
    <ModulePage
      table="warehouses"
      title="Almoxarifados"
      subtitle="Cadastre e mantenha os depósitos físicos utilizados pelo estoque. O código é gerado automaticamente."
      emptyLabel="Nenhum almoxarifado cadastrado ainda."
      fields={[
        { key: "code", label: "Código", formHidden: true },
        { key: "name", label: "Nome do Almoxarifado", placeholder: "Ex: Almoxarifado de Matéria-prima", required: true },
        { key: "warehouse_type", label: "Tipo", type: "select", options: WAREHOUSE_TYPES, required: true },
        { key: "location", label: "Localização", placeholder: "Endereço ou referência física" },
      ]}
      statusField={{ key: "active", label: "Status", trueLabel: "Ativo", falseLabel: "Inativo" }}
      extraValues={{ active: true }}
    />
  );
}
