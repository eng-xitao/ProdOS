/**
 * Termos de Uso — RASCUNHO. Precisa de revisão por um advogado antes
 * de valer como documento oficial da empresa.
 */
export default function TermosPage() {
  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.draftBanner}>
          ⚠ RASCUNHO — este documento precisa de revisão por um advogado antes de valer como
          documento oficial da empresa.
        </div>

        <h1 style={styles.title}>Termos de Uso — ProdOS</h1>
        <p style={styles.updated}>Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>

        <Section title="1. Aceite">
          <p>Ao criar uma conta no ProdOS, você concorda com estes Termos de Uso e com a Política de Privacidade.</p>
        </Section>

        <Section title="2. O serviço">
          <p>
            O ProdOS é um sistema de gestão empresarial (ERP) oferecido como assinatura mensal, nos
            planos Básico, Intermediário e Premium, cada um liberando um conjunto de módulos.
          </p>
        </Section>

        <Section title="3. Período de teste e aprovação">
          <p>
            Novas contas têm 14 dias de teste gratuito e passam por uma análise do time comercial
            antes da liberação completa de acesso.
          </p>
        </Section>

        <Section title="4. Pagamento">
          <p>
            A assinatura é cobrada mensalmente via Asaas (PIX, boleto ou cartão). O não pagamento
            pode resultar em suspensão do acesso após o vencimento.
          </p>
        </Section>

        <Section title="5. Cancelamento">
          <p>
            Você pode cancelar a assinatura a qualquer momento em Configurações → Assinatura. O
            acesso permanece até o fim do período já pago.
          </p>
        </Section>

        <Section title="6. Responsabilidade sobre os dados inseridos">
          <p>
            Você é responsável pela exatidão dos dados que insere no sistema (cadastros, valores
            fiscais, folha de pagamento). O ProdOS fornece ferramentas de cálculo, mas não
            substitui a orientação de um contador ou advogado para questões fiscais e trabalhistas.
          </p>
        </Section>

        <Section title="7. Disponibilidade">
          <p>Empregamos esforços razoáveis para manter o serviço disponível, mas não garantimos operação ininterrupta.</p>
        </Section>

        <Section title="8. Alterações">
          <p>Podemos atualizar estes Termos periodicamente. Mudanças relevantes serão comunicadas por e-mail.</p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={styles.section}>
      <h2 style={styles.sectionTitle}>{title}</h2>
      <div style={styles.sectionBody}>{children}</div>
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", background: "var(--bg, #F7F5F1)", padding: "40px 20px" },
  container: { maxWidth: 720, margin: "0 auto" },
  draftBanner: {
    background: "rgba(232,163,61,0.15)", border: "1px solid #E8A33D", borderRadius: 8,
    padding: "12px 16px", fontSize: 13, marginBottom: 24, fontWeight: 600,
  },
  title: { fontSize: 26, margin: "0 0 4px" },
  updated: { fontSize: 12.5, color: "#8A8780", marginBottom: 32 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, marginBottom: 8 },
  sectionBody: { fontSize: 14, lineHeight: 1.7, color: "#3A3833" },
};
