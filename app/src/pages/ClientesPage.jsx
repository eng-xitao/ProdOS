import ModulePage from "../components/ModulePage";

export default function ClientesPage() {
  return (
    <ModulePage
      table="customers"
      title="Clientes"
      subtitle="Cadastro de clientes"
      emptyLabel="Nenhum cliente cadastrado ainda."
      fields={[
        { key: "name", label: "Nome", placeholder: "Nome ou razão social", required: true },
        { key: "document", label: "CPF/CNPJ", placeholder: "000.000.000-00" },
        { key: "email", label: "E-mail", type: "email" },
        { key: "phone", label: "Telefone", placeholder: "(11) 90000-0000" },
        { key: "address", label: "Endereço" },
        { key: "credit_limit", label: "Limite de Crédito", type: "currency" },
      ]}
    />
  );
}
