import ModulePage from "../components/ModulePage";

export default function ClientesPage() {
  function handlePrint() {
    window.print();
  }

  return (
    <div>
      <div className="no-print" style={styles.toolbar}>
        <button type="button" onClick={handlePrint} style={styles.printBtn}>
          🖨️ Imprimir
        </button>
      </div>

      <ModulePage
        table="customers"
        title="Clientes"
        subtitle="Cadastro completo de clientes"
        emptyLabel="Nenhum cliente cadastrado ainda."
        autoGenerateCode={{ field: "code", rpc: "next_customer_code" }}
        fields={[
          { key: "code", label: "Código", placeholder: "Gerado automaticamente", required: true },
          { key: "name", label: "Razão Social", placeholder: "Razão social", required: true },
          { key: "nome_fantasia", label: "Nome Fantasia", placeholder: "Nome fantasia" },
          { key: "document", label: "CNPJ", placeholder: "00.000.000/0000-00" },
          { key: "inscricao_estadual", label: "Inscrição Estadual", placeholder: "000.000.000.000" },
          { key: "cep", label: "CEP", placeholder: "00000-000" },
          { key: "logradouro", label: "Logradouro", placeholder: "Rua/Avenida" },
          { key: "numero", label: "Número", placeholder: "Número" },
          { key: "complemento", label: "Complemento", placeholder: "Sala, bloco, galpão..." },
          { key: "bairro", label: "Bairro", placeholder: "Bairro" },
          { key: "municipio", label: "Cidade", placeholder: "Cidade" },
          { key: "uf", label: "Estado", placeholder: "SP" },
          { key: "pais", label: "País", placeholder: "Brasil" },
          { key: "contato", label: "Contato", placeholder: "Nome do contato" },
          { key: "departamento", label: "Departamento", placeholder: "Compras, Financeiro..." },
          { key: "phone", label: "Telefone 1", placeholder: "(11) 90000-0000" },
          { key: "phone2", label: "Telefone 2", placeholder: "(11) 90000-0000" },
          { key: "email", label: "E-mail", type: "email", placeholder: "cliente@empresa.com.br" },
          {
            key: "status",
            label: "Status",
            type: "select",
            options: [
              { value: "Ativo", label: "Ativo" },
              { value: "Inativo", label: "Inativo" },
              { value: "Bloqueado", label: "Bloqueado" },
            ],
          },
          {
            key: "condicao_pagamento",
            label: "Condição de Pagamento",
            type: "select",
            options: [
              { value: "À vista", label: "À vista" },
              { value: "7 dias", label: "7 dias" },
              { value: "14 dias", label: "14 dias" },
              { value: "21 dias", label: "21 dias" },
              { value: "28 dias", label: "28 dias" },
              { value: "30 dias", label: "30 dias" },
              { value: "45 dias", label: "45 dias" },
              { value: "60 dias", label: "60 dias" },
            ],
          },
          { key: "credit_limit", label: "Limite de Crédito", type: "currency" },
          { key: "address", label: "Observações", placeholder: "Observações comerciais" },
        ]}
      />
    </div>
  );
}

const styles = {
  toolbar: {
    display: "flex",
    justifyContent: "flex-end",
    marginBottom: 10,
  },
  printBtn: {
    background: "var(--panel)",
    color: "var(--text)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius)",
    padding: "9px 16px",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  },
};
