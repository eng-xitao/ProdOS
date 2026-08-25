import ModulePage from "../components/ModulePage";

export default function FornecedoresPage() {
  return (
    <ModulePage
      table="suppliers"
      title="Fornecedores"
      subtitle="Cadastro de fornecedores"
      emptyLabel="Nenhum fornecedor cadastrado ainda."
      autoGenerateCode={{ field: "code", rpc: "next_supplier_code" }}
      fields={[
        { key: "code", label: "Código", placeholder: "Gerado automaticamente", required: true },
        { key: "name", label: "Nome", placeholder: "Nome ou razão social", required: true },
        { key: "document", label: "CPF/CNPJ", placeholder: "00.000.000/0001-00" },
        { key: "email", label: "E-mail", type: "email" },
        { key: "phone", label: "Telefone", placeholder: "(11) 90000-0000" },
        { key: "lead_time_days", label: "Prazo de entrega (dias)", type: "number", placeholder: "Ex: 15" },
        { key: "address", label: "Endereço" },
      ]}
    />
  );
}
