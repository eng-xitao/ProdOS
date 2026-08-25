import ModulePage from "../components/ModulePage";

export default function TiposOrdemPage() {
  return (
    <ModulePage
      table="production_order_types"
      title="Tipos de Ordem"
      subtitle="Categorias de Ordem de Produção com prefixo próprio (ex: OE-Estrutura, OM-Montagem)"
      emptyLabel="Nenhum tipo de ordem cadastrado ainda."
      fields={[
        { key: "name", label: "Nome", placeholder: "Ex: Estrutura, Montagem, Pintura", required: true },
        { key: "prefix", label: "Prefixo", placeholder: "Ex: OE, OM, OP", required: true },
      ]}
    />
  );
}
