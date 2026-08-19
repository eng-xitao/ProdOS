-- =========================================================
-- ProdOS — Migração 002: Cadastros base (Cliente, Fornecedor,
-- Produto) + Estrutura de Produto (BOM), pré-requisito do MRP.
-- Rode este script no SQL Editor do Supabase DEPOIS do 001_schema.sql
-- =========================================================

-- ---------------------------------------------------------
-- 1. CLIENTES
-- ---------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  document text,              -- CPF ou CNPJ
  email text,
  phone text,
  address text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 2. FORNECEDORES
-- ---------------------------------------------------------
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  document text,              -- CPF ou CNPJ
  email text,
  phone text,
  lead_time_days integer default 0,  -- prazo médio de entrega, usado depois pelo MRP
  address text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 3. PRODUTOS
-- Cobre tanto matéria-prima/componente quanto produto acabado —
-- o campo "type" diferencia, e a estrutura (tabela 4) conecta os dois.
-- ---------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  sku text not null,
  name text not null,
  type text not null default 'acabado'
    check (type in ('acabado', 'componente', 'materia_prima')),
  unit text not null default 'un',
  cost numeric not null default 0,       -- custo de aquisição/produção
  sale_price numeric not null default 0, -- preço de venda (se aplicável)
  lead_time_days integer default 0,      -- tempo de produção/compra, usado pelo MRP
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 4. ESTRUTURA DE PRODUTO (BOM — Bill of Materials)
-- Cada linha diz: "para produzir 1 unidade de parent_product_id,
-- precisa de <quantity> unidades de component_id".
-- ---------------------------------------------------------
create table public.product_components (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  parent_product_id uuid not null references public.products(id) on delete cascade,
  component_id uuid not null references public.products(id) on delete cascade,
  quantity numeric not null default 1,
  created_at timestamptz not null default now(),
  constraint no_self_reference check (parent_product_id <> component_id)
);

-- =========================================================
-- RLS — mesmo padrão das demais tabelas: isolado por empresa
-- =========================================================

alter table public.customers enable row level security;
alter table public.suppliers enable row level security;
alter table public.products enable row level security;
alter table public.product_components enable row level security;

create policy "select own company data" on public.customers
  for select using (company_id = public.current_company_id());
create policy "insert own company data" on public.customers
  for insert with check (company_id = public.current_company_id());
create policy "update own company data" on public.customers
  for update using (company_id = public.current_company_id());
create policy "delete own company data" on public.customers
  for delete using (company_id = public.current_company_id());

create policy "select own company data" on public.suppliers
  for select using (company_id = public.current_company_id());
create policy "insert own company data" on public.suppliers
  for insert with check (company_id = public.current_company_id());
create policy "update own company data" on public.suppliers
  for update using (company_id = public.current_company_id());
create policy "delete own company data" on public.suppliers
  for delete using (company_id = public.current_company_id());

create policy "select own company data" on public.products
  for select using (company_id = public.current_company_id());
create policy "insert own company data" on public.products
  for insert with check (company_id = public.current_company_id());
create policy "update own company data" on public.products
  for update using (company_id = public.current_company_id());
create policy "delete own company data" on public.products
  for delete using (company_id = public.current_company_id());

create policy "select own company data" on public.product_components
  for select using (company_id = public.current_company_id());
create policy "insert own company data" on public.product_components
  for insert with check (company_id = public.current_company_id());
create policy "update own company data" on public.product_components
  for update using (company_id = public.current_company_id());
create policy "delete own company data" on public.product_components
  for delete using (company_id = public.current_company_id());
