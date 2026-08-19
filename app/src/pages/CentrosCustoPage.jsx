import ModulePage from "../components/ModulePage";

export default function CentrosCustoPage() {
  return (
    <ModulePage
      table="cost_centers"
      title="Centros de Custo"
      subtitle="Áreas para separar e analisar despesas"
      emptyLabel="Nenhum centro de custo cadastrado ainda."
      fields={[
        { key: "code", label: "Código", placeholder: "Ex: CC-001" },
        { key: "name", label: "Nome", placeholder: "Ex: Produção, Administrativo, Comercial", required: true },
      ]}
    />
  );
}
