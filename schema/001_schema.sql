-- =========================================================
-- ERP SaaS Multi-tenant — Schema inicial
-- Rode este script no SQL Editor do seu projeto Supabase
-- (Project > SQL Editor > New query > cole tudo > Run)
-- =========================================================

-- Extensão para gerar UUIDs
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- 1. EMPRESAS (tenants)
-- Cada empresa cliente vira uma linha aqui. Todo o resto do
-- sistema referencia company_id para isolar os dados.
-- ---------------------------------------------------------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  segment text,               -- ex: "metalurgia", "varejo", "serviços"
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 2. PERFIS DE USUÁRIO
-- Estende o auth.users do Supabase (criado automaticamente
-- no cadastro) com o vínculo a uma empresa e um papel.
-- ---------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  full_name text,
  role text not null default 'admin' check (role in ('admin', 'member')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 3. PRODUÇÃO — Ordens de Produção
-- ---------------------------------------------------------
create table public.production_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,               -- ex: OP-0001
  product_name text not null,
  quantity numeric not null default 0,
  stage text not null default 'planejamento'
    check (stage in ('planejamento','corte','solda','lixacao','acabamento','pintura','concluido')),
  due_date date,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 4. ESTOQUE — Produtos / Insumos
-- ---------------------------------------------------------
create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  sku text not null,
  name text not null,
  quantity numeric not null default 0,
  unit text not null default 'un',   -- un, kg, m, l...
  min_quantity numeric not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 5. VENDAS — Pedidos
-- ---------------------------------------------------------
create table public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,               -- ex: PV-0001
  customer_name text not null,
  total_value numeric not null default 0,
  status text not null default 'aberto'
    check (status in ('aberto','faturado','entregue','cancelado')),
  order_date date not null default current_date,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 6. FINANCEIRO — Lançamentos (contas a pagar/receber)
-- ---------------------------------------------------------
create table public.financial_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  description text not null,
  entry_type text not null check (entry_type in ('receita','despesa')),
  amount numeric not null default 0,
  due_date date not null default current_date,
  paid boolean not null default false,
  created_at timestamptz not null default now()
);

-- =========================================================
-- ROW LEVEL SECURITY (RLS)
-- Isso é o que garante isolamento entre empresas: cada
-- usuário só enxerga linhas onde company_id == a empresa
-- do seu próprio perfil.
-- =========================================================

alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.production_orders enable row level security;
alter table public.inventory_items enable row level security;
alter table public.sales_orders enable row level security;
alter table public.financial_entries enable row level security;

-- Função helper: retorna o company_id do usuário logado
create or replace function public.current_company_id()
returns uuid
language sql
security definer
stable
as $$
  select company_id from public.profiles where id = auth.uid()
$$;

-- --- companies: só vê/edita a própria empresa
create policy "select own company" on public.companies
  for select using (id = public.current_company_id());
create policy "update own company" on public.companies
  for update using (id = public.current_company_id());

-- --- profiles: só vê perfis da própria empresa
create policy "select own company profiles" on public.profiles
  for select using (company_id = public.current_company_id());
create policy "update own profile" on public.profiles
  for update using (id = auth.uid());

-- --- tabelas de dados: padrão idêntico nas 4 tabelas
create policy "select own company data" on public.production_orders
  for select using (company_id = public.current_company_id());
create policy "insert own company data" on public.production_orders
  for insert with check (company_id = public.current_company_id());
create policy "update own company data" on public.production_orders
  for update using (company_id = public.current_company_id());
create policy "delete own company data" on public.production_orders
  for delete using (company_id = public.current_company_id());

create policy "select own company data" on public.inventory_items
  for select using (company_id = public.current_company_id());
create policy "insert own company data" on public.inventory_items
  for insert with check (company_id = public.current_company_id());
create policy "update own company data" on public.inventory_items
  for update using (company_id = public.current_company_id());
create policy "delete own company data" on public.inventory_items
  for delete using (company_id = public.current_company_id());

create policy "select own company data" on public.sales_orders
  for select using (company_id = public.current_company_id());
create policy "insert own company data" on public.sales_orders
  for insert with check (company_id = public.current_company_id());
create policy "update own company data" on public.sales_orders
  for update using (company_id = public.current_company_id());
create policy "delete own company data" on public.sales_orders
  for delete using (company_id = public.current_company_id());

create policy "select own company data" on public.financial_entries
  for select using (company_id = public.current_company_id());
create policy "insert own company data" on public.financial_entries
  for insert with check (company_id = public.current_company_id());
create policy "update own company data" on public.financial_entries
  for update using (company_id = public.current_company_id());
create policy "delete own company data" on public.financial_entries
  for delete using (company_id = public.current_company_id());

-- =========================================================
-- CADASTRO SELF-SERVICE
-- Quando alguém se cadastra (auth.users), este trigger cria
-- automaticamente uma empresa nova + o perfil admin vinculado.
-- O nome da empresa vem do campo "company_name" enviado no
-- signup (ver app: supabase.auth.signUp com options.data).
-- =========================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
declare
  new_company_id uuid;
begin
  insert into public.companies (name, segment)
  values (
    coalesce(new.raw_user_meta_data->>'company_name', 'Minha Empresa'),
    new.raw_user_meta_data->>'segment'
  )
  returning id into new_company_id;

  insert into public.profiles (id, company_id, full_name, role)
  values (
    new.id,
    new_company_id,
    new.raw_user_meta_data->>'full_name',
    'admin'
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
