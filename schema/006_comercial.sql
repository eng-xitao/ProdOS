-- =========================================================
-- ProdOS — Migração 006: Comercial (CRM)
-- Pipeline de Oportunidades + Orçamentos com itens + upgrade
-- de Pedidos de Venda (cliente real + itens).
-- Rode DEPOIS do 001 a 005.
-- =========================================================

-- ---------------------------------------------------------
-- 1. ETAPAS DO FUNIL COMERCIAL (configurável por empresa,
-- mesmo padrão das Etapas de Produção)
-- ---------------------------------------------------------
create table public.opportunity_stages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 2. OPORTUNIDADES (pipeline)
-- ---------------------------------------------------------
create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null,
  customer_id uuid references public.customers(id) on delete set null,
  stage_id uuid references public.opportunity_stages(id) on delete set null,
  estimated_value numeric not null default 0,
  expected_close_date date,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 3. ORÇAMENTOS (cabeçalho)
-- ---------------------------------------------------------
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  customer_id uuid references public.customers(id) on delete set null,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  payment_term_id uuid references public.payment_terms(id) on delete set null,
  status text not null default 'rascunho'
    check (status in ('rascunho', 'enviado', 'aprovado', 'rejeitado', 'convertido')),
  valid_until date,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 4. ITENS DO ORÇAMENTO
-- ---------------------------------------------------------
create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  quantity numeric not null default 1,
  unit_price numeric not null default 0,
  discount_percent numeric not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 5. UPGRADE de Pedidos de Venda: cliente real (não texto
-- livre) + rastreio de origem (se nasceu de um orçamento)
-- ---------------------------------------------------------
alter table public.sales_orders drop column if exists customer_name;

alter table public.sales_orders
  add column if not exists customer_id uuid references public.customers(id) on delete set null;

alter table public.sales_orders
  add column if not exists quote_id uuid references public.quotes(id) on delete set null;

-- ---------------------------------------------------------
-- 6. ITENS DO PEDIDO DE VENDA
-- ---------------------------------------------------------
create table public.sales_order_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  sales_order_id uuid not null references public.sales_orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  quantity numeric not null default 1,
  unit_price numeric not null default 0,
  discount_percent numeric not null default 0,
  created_at timestamptz not null default now()
);

-- =========================================================
-- RLS — mesmo padrão das demais tabelas
-- =========================================================
alter table public.opportunity_stages enable row level security;
alter table public.opportunities enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.sales_order_items enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['opportunity_stages','opportunities','quotes','quote_items','sales_order_items']
  loop
    execute format('create policy "select own company data" on public.%I for select using (company_id = public.current_company_id());', t);
    execute format('create policy "insert own company data" on public.%I for insert with check (company_id = public.current_company_id());', t);
    execute format('create policy "update own company data" on public.%I for update using (company_id = public.current_company_id());', t);
    execute format('create policy "delete own company data" on public.%I for delete using (company_id = public.current_company_id());', t);
  end loop;
end $$;
