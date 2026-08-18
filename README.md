# ProdOS — ERP SaaS multi-tenant (starter)

Aplicação de gestão para qualquer segmento de empresa: cada cliente cria sua própria conta,
sua empresa é criada automaticamente, e os dados ficam isolados por empresa (multi-tenant)
usando Row Level Security do Supabase.

Módulos incluídos nesta versão inicial: **Produção, Estoque, Vendas e Financeiro.**

---

## Passo 1 — Criar o projeto no Supabase

1. Crie uma conta gratuita em [supabase.com](https://supabase.com) (se ainda não tiver).
2. Clique em **New Project**. Escolha um nome, uma senha de banco (guarde-a) e a região mais próxima (ex: São Paulo/`sa-east-1`).
3. Aguarde ~2 minutos até o projeto ficar pronto.

## Passo 2 — Rodar o schema do banco

1. No painel do projeto, vá em **SQL Editor** (menu lateral) → **New query**.
2. Abra o arquivo `schema/001_schema.sql` (nesta pasta), copie todo o conteúdo e cole no editor.
3. Clique em **Run**. Isso cria todas as tabelas, ativa a segurança por linha (RLS) e configura
   o cadastro automático de empresa no signup.

## Passo 3 — Configurar confirmação de e-mail (opcional, recomendado)

Por padrão o Supabase exige confirmação de e-mail no cadastro. Para testar rapidamente sem
precisar confirmar e-mail toda hora:

- Vá em **Authentication → Providers → Email** e desative "Confirm email" (apenas em ambiente de teste).
- Em produção, deixe habilitado e configure o template de e-mail em **Authentication → Email Templates**.

## Passo 4 — Pegar as chaves da API

1. Vá em **Project Settings → API**.
2. Copie a **Project URL** e a chave **anon public** (NÃO a `service_role`, que é secreta e não deve ir para o frontend).

## Passo 5 — Rodar a aplicação localmente

```bash
cd app
cp .env.example .env
# edite .env e cole a URL e a chave anon copiadas no passo 4

npm install
npm run dev
```

Acesse `http://localhost:5173`, clique em **Criar conta**, preencha o nome da empresa e pronto —
sua primeira empresa cliente já está criada e isolada no banco.

## Passo 6 — Colocar no ar (deploy)

A forma mais simples é a [Vercel](https://vercel.com) ou [Netlify](https://netlify.com), ambas com plano gratuito:

1. Suba a pasta `app/` para um repositório no GitHub.
2. Na Vercel/Netlify, importe o repositório.
3. Configure as mesmas variáveis de ambiente (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) no
   painel do serviço de deploy (nunca comite o arquivo `.env`).
4. Deploy — a aplicação fica disponível numa URL pública, pronta para os clientes acessarem e se cadastrarem sozinhos.

---

## Como funciona o multi-tenant

- Cada empresa cliente vira uma linha na tabela `companies`.
- Cada usuário (`auth.users`, gerenciado pelo próprio Supabase) tem um `profile` vinculado a uma `company_id`.
- Todas as tabelas de dados (produção, estoque, vendas, financeiro) têm uma coluna `company_id`.
- As políticas de **Row Level Security** garantem que cada usuário só consiga ler/escrever
  linhas da própria empresa — mesmo que alguém tente manipular a chamada da API, o banco
  bloqueia no nível do PostgreSQL.
- Quando alguém se cadastra, um *trigger* no banco (`handle_new_user`) cria a empresa e o
  perfil automaticamente — não precisa de nenhum backend próprio para isso.

## Próximos passos sugeridos

- Adicionar mais módulos (RH, Compras, CRM) seguindo o mesmo padrão de `ModulePage.jsx`.
- Convite de novos usuários para uma empresa já existente (hoje, todo cadastro cria uma empresa nova).
- Planos pagos: integrar Stripe e checar `company.plan` antes de liberar funcionalidades.
- Dashboard com gráficos reais (hoje mostra só contagens).
