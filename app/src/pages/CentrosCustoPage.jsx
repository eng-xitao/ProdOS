import ModulePage from "../components/ModulePage";

export default function CentrosCustoPage() {
  return (
    <ModulePage
      table="cost_centers"
      title="Centros de Custo"
      subtitle="Setores ou projetos usados para separar e analisar despesas. Veja a análise em Financeiro → Análise por Centro de Custo."
      emptyLabel="Nenhum centro de custo cadastrado ainda."
      fields={[
        { key: "code", label: "Código", placeholder: "Ex: CC-001" },
        { key: "name", label: "Nome", placeholder: "Ex: Produção, Administrativo, Comercial", required: true },
        { key: "type", label: "Tipo", type: "select", options: [{ value: "setor", label: "Setor" }, { value: "projeto", label: "Projeto" }], required: true },
      ]}
    />
  );
}
