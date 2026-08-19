import ModulePage from "../components/ModulePage";

export default function AlmoxarifadosPage() {
  return (
    <ModulePage
      table="warehouses"
      title="Almoxarifados"
      subtitle="Locais físicos de estoque (depósitos, obras, lojas...)"
      emptyLabel="Nenhum almoxarifado cadastrado ainda."
      fields={[
        { key: "name", label: "Nome", placeholder: "Ex: Depósito central, Obra Zona Leste", required: true },
        { key: "location", label: "Localização", placeholder: "Endereço ou referência" },
      ]}
    />
  );
}
