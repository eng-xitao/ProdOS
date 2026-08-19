-- =========================================================
-- ProdOS — Migração 007: Compras
-- Cotações (comparação entre fornecedores), Pedidos de Compra
-- com itens, e recebimento que atualiza o estoque automaticamente.
-- Rode DEPOIS do 001 a 006.
-- =========================================================

-- ---------------------------------------------------------
-- 1. COTAÇÕES (cabeçalho)
-- ---------------------------------------------------------
create table public.purchase_quotes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  status text not null default 'aberta' check (status in ('aberta', 'fechada')),
  winning_supplier_id uuid references public.suppliers(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 2. ITENS NECESSÁRIOS NA COTAÇÃO (o que se quer comprar)
-- ---------------------------------------------------------
create table public.purchase_quote_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  quote_id uuid not null references public.purchase_quotes(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  quantity numeric not null default 1,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 3. PREÇOS INFORMADOS POR CADA FORNECEDOR (para comparar)
-- ---------------------------------------------------------
create table public.purchase_quote_prices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  quote_id uuid not null references public.purchase_quotes(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  unit_price numeric not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 4. PEDIDOS DE COMPRA (cabeçalho)
-- ---------------------------------------------------------
create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  quote_id uuid references public.purchase_quotes(id) on delete set null,
  payment_term_id uuid references public.payment_terms(id) on delete set null,
  status text not null default 'aberto' check (status in ('aberto', 'recebido', 'cancelado')),
  order_date date not null default current_date,
  total_value numeric not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 5. ITENS DO PEDIDO DE COMPRA (com quantidade recebida,
-- usada para atualizar o estoque no recebimento)
-- ---------------------------------------------------------
create table public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  quantity numeric not null default 1,
  unit_price numeric not null default 0,
  received_quantity numeric not null default 0,
  created_at timestamptz not null default now()
);

-- =========================================================
-- RLS — mesmo padrão das demais tabelas
-- =========================================================
alter table public.purchase_quotes enable row level security;
alter table public.purchase_quote_items enable row level security;
alter table public.purchase_quote_prices enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['purchase_quotes','purchase_quote_items','purchase_quote_prices','purchase_orders','purchase_order_items']
  loop
    execute format('create policy "select own company data" on public.%I for select using (company_id = public.current_company_id());', t);
    execute format('create policy "insert own company data" on public.%I for insert with check (company_id = public.current_company_id());', t);
    execute format('create policy "update own company data" on public.%I for update using (company_id = public.current_company_id());', t);
    execute format('create policy "delete own company data" on public.%I for delete using (company_id = public.current_company_id());', t);
  end loop;
end $$;
