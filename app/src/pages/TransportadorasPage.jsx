import ModulePage from "../components/ModulePage";

export default function TransportadorasPage() {
  return (
    <ModulePage
      table="carriers"
      title="Transportadoras"
      subtitle="Empresas responsáveis pela logística e entregas"
      emptyLabel="Nenhuma transportadora cadastrada ainda."
      fields={[
        { key: "name", label: "Nome", placeholder: "Nome ou razão social", required: true },
        { key: "document", label: "CNPJ", placeholder: "00.000.000/0001-00" },
        { key: "phone", label: "Telefone", placeholder: "(11) 90000-0000" },
        { key: "email", label: "E-mail", type: "email" },
      ]}
    />
  );
}
