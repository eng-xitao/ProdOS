import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

/**
 * Política de Privacidade — RASCUNHO gerado automaticamente com base
 * nos dados que o ProdOS realmente coleta e nos fornecedores que
 * realmente usa. Não substitui revisão de um advogado antes de valer
 * como documento oficial.
 */
export default function PrivacidadePage() {
  const [dpo, setDpo] = useState({ dpo_name: "", dpo_email: "" });

  useEffect(() => {
    supabase.from("platform_settings").select("dpo_name, dpo_email").eq("id", true).single().then(({ data }) => {
      if (data) setDpo(data);
    });
  }, []);

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.draftBanner}>
          ⚠ RASCUNHO — este documento foi gerado automaticamente e precisa de revisão por um
          advogado antes de valer como documento oficial da empresa.
        </div>

        <h1 style={styles.title}>Política de Privacidade — ProdOS</h1>
        <p style={styles.updated}>Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>

        <Section title="1. Quem somos">
          <p>
            O ProdOS é um sistema de gestão (ERP) para pequenas e médias empresas industriais,
            operado pela empresa responsável pela plataforma ("Controlador", conforme a Lei Geral
            de Proteção de Dados — LGPD).
          </p>
        </Section>

        <Section title="2. Que dados coletamos">
          <ul style={styles.list}>
            <li>Dados da empresa cliente: razão social, CNPJ, endereço, telefone, e-mail</li>
            <li>Dados de usuários do sistema: nome, e-mail, cargo/função</li>
            <li>Dados de folha de pagamento (quando o cliente usa o módulo de RH): CPF, salário, dependentes</li>
            <li>Dados de clientes e fornecedores cadastrados pelo cliente dentro do sistema</li>
            <li>Dados de pagamento da assinatura (processados pelo Asaas — não guardamos número de cartão)</li>
          </ul>
        </Section>

        <Section title="3. Para que usamos">
          <p>
            Para prestar o serviço contratado (execução do contrato), processar pagamentos,
            comunicar mudanças importantes, e cumprir obrigações legais e fiscais. Não vendemos
            dados a terceiros.
          </p>
        </Section>

        <Section title="4. Com quem compartilhamos (operadores)">
          <p>Usamos os seguintes fornecedores para operar a plataforma, cada um tratando dados em nosso nome:</p>
          <ul style={styles.list}>
            <li><strong>Supabase</strong> (banco de dados e autenticação) — servidores no Canadá</li>
            <li><strong>Vercel</strong> (hospedagem da aplicação)</li>
            <li><strong>Asaas</strong> (processamento de pagamentos e cobranças)</li>
            <li><strong>Resend</strong> (envio de e-mails transacionais)</li>
          </ul>
        </Section>

        <Section title="5. Seus direitos">
          <p>
            Você pode solicitar acesso, correção, portabilidade ou exclusão dos seus dados a
            qualquer momento em <strong>Configurações → Meus Dados (LGPD)</strong> dentro do
            sistema, ou entrando em contato com nosso Encarregado.
          </p>
        </Section>

        <Section title="6. Encarregado (DPO)">
          <p>
            {dpo.dpo_name ? `${dpo.dpo_name} — ` : ""}
            {dpo.dpo_email ? <a href={`mailto:${dpo.dpo_email}`} style={styles.link}>{dpo.dpo_email}</a> : "a definir"}
          </p>
        </Section>

        <Section title="7. Retenção de dados">
          <p>
            Mantemos os dados enquanto a conta estiver ativa. Após o cancelamento, os dados podem
            ser mantidos pelo prazo exigido por obrigações fiscais e legais antes de excluídos.
          </p>
        </Section>

        <Section title="8. Segurança">
          <p>
            Usamos controle de acesso por permissão (cada usuário só acessa os dados da própria
            empresa), conexão criptografada e políticas de segurança em nível de banco de dados.
          </p>
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
  list: { fontSize: 14, lineHeight: 1.8, paddingLeft: 20 },
  link: { color: "#2563EB", fontWeight: 600 },
};
