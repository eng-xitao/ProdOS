import ModulePage from "../components/ModulePage";

export default function UnidadesMedidaPage() {
  return (
    <ModulePage
      table="units_of_measure"
      title="Unidades de Medida"
      subtitle="Catálogo de unidades usadas em produtos e estoque"
      emptyLabel="Nenhuma unidade de medida cadastrada ainda."
      fields={[
        { key: "code", label: "Sigla", placeholder: "Ex: KG, UN, M, L, H", required: true },
        { key: "name", label: "Nome", placeholder: "Ex: Quilograma, Unidade, Metro", required: true },
      ]}
    />
  );
}
