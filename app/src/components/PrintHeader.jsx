import { useAuth } from "../lib/AuthContext";

/**
 * Cabeçalho que só aparece quando a página é impressa (via
 * window.print()) — invisível na tela normal. Mostra os dados
 * da empresa (Configurações → Dados da Empresa) e o título do
 * relatório.
 */
export default function PrintHeader({ title }) {
  const { company } = useAuth();
  const now = new Date().toLocaleString("pt-BR");

  return (
    <div className="print-only" style={styles.wrap}>
      <div style={styles.row}>
        <div>
          {company?.logo_url && (
            <img src={company.logo_url} alt="" style={styles.logo} />
          )}
          <div style={styles.companyName}>{company?.name ?? "—"}</div>
          {company?.cnpj && <div style={styles.detail}>CNPJ: {company.cnpj}</div>}
          {company?.address && <div style={styles.detail}>{company.address}</div>}
          {company?.phone && <div style={styles.detail}>{company.phone}</div>}
        </div>
        <div style={styles.generatedAt}>Gerado em {now}</div>
      </div>
      <h1 style={styles.title}>{title}</h1>
    </div>
  );
}

const styles = {
  wrap: { marginBottom: 20 },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottom: "2px solid #000",
    paddingBottom: 12,
    marginBottom: 14,
  },
  logo: { maxHeight: 46, marginBottom: 6, display: "block" },
  companyName: { fontWeight: 700, fontSize: 16 },
  detail: { fontSize: 11 },
  generatedAt: { fontSize: 11 },
  title: { fontSize: 18, margin: "0 0 4px" },
};
