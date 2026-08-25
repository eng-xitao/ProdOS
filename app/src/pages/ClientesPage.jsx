import ModulePage from "../components/ModulePage";

export default function ClientesPage() {
  return (
    <ModulePage
      table="customers"
      title="Clientes"
      subtitle="Cadastro de clientes"
      emptyLabel="Nenhum cliente cadastrado ainda."
      autoGenerateCode={{ field: "code", rpc: "next_customer_code" }}
      fields={[
        { key: "code", label: "Código", placeholder: "Gerado automaticamente", required: true },
        { key: "name", label: "Nome", placeholder: "Nome ou razão social", required: true },
        { key: "document", label: "CPF/CNPJ", placeholder: "000.000.000-00" },
        { key: "email", label: "E-mail", type: "email" },
        { key: "phone", label: "Telefone", placeholder: "(11) 90000-0000" },
        { key: "address", label: "Endereço (referência)", placeholder: "Descrição livre, opcional" },
        { key: "logradouro", label: "Logradouro", placeholder: "Rua/Av." },
        { key: "numero", label: "Número" },
        { key: "bairro", label: "Bairro" },
        { key: "municipio", label: "Município" },
        { key: "uf", label: "UF", placeholder: "SP" },
        { key: "cep", label: "CEP", placeholder: "00000-000" },
        {
          key: "indicador_ie", label: "Situação de Inscrição Estadual", type: "select",
          options: [
            { value: "9", label: "Não contribuinte" },
            { value: "1", label: "Contribuinte ICMS" },
            { value: "2", label: "Contribuinte isento" },
          ],
        },
        { key: "credit_limit", label: "Limite de Crédito", type: "currency" },
      ]}
    />
  );
}
