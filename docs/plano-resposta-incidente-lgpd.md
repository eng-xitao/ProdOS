# Plano de Resposta a Incidente de Vazamento de Dados — ProdOS

> ⚠️ RASCUNHO — este documento é um ponto de partida operacional, não
> um documento jurídico validado. Revise com um advogado/DPO antes de
> considerá-lo oficial.

## 1. Como identificar um incidente
Sinais de possível vazamento ou incidente de segurança:
- Alerta de acesso não autorizado no Supabase (logs de autenticação incomuns)
- Denúncia de um cliente sobre dado exposto
- E-mail de segurança de algum fornecedor (Supabase, Vercel, Asaas, Resend)
- Comportamento anômalo identificado em `admin_audit_log`

## 2. Primeiras 24 horas
1. **Conter**: revogar chaves/tokens comprometidos (Supabase secrets, API keys), desativar
   contas suspeitas em Administração → Administradores.
2. **Avaliar o escopo**: quantas empresas/pessoas afetadas, que tipo de dado (nome/e-mail é
   menos grave que CPF/salário).
3. **Documentar**: data e hora da descoberta, o que se sabe até agora, ações já tomadas.
4. **Acionar o Encarregado (DPO)** — contato configurado em Administração → Solicitações LGPD.

## 3. Notificação
A LGPD exige comunicação à ANPD e aos titulares afetados em prazo razoável quando o incidente
representar risco ou dano relevante. Isso deve ser conduzido com apoio jurídico, mas o mínimo
inclui:
- O que aconteceu
- Que dados foram afetados
- Quem foi afetado (quantidade/quais empresas)
- O que já foi feito pra conter
- O que a pessoa afetada pode fazer

## 4. Após o incidente
- Corrigir a causa raiz (ex: policy de RLS ausente, chave exposta, etc.)
- Revisar se outros pontos têm a mesma vulnerabilidade
- Atualizar este documento com o aprendizado

## 5. Contatos de emergência dos fornecedores
- Supabase: suporte via dashboard (support.supabase.com)
- Vercel: suporte via dashboard
- Asaas: suporte via chat no painel
