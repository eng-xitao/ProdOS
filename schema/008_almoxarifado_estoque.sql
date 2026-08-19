-- =========================================================
-- ProdOS — Migração 008: Estoque por Almoxarifado
-- Permite saber a quantidade de cada produto em cada local
-- (ex: Almoxarifado de Insumos vs Depósito de Produtos Acabados),
-- em vez de apenas um número único por produto.
-- Rode DEPOIS do 001 a 007.
-- =========================================================

create table public.stock_levels (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  quantity numeric not null default 0,
  updated_at timestamptz not null default now(),
  unique (product_id, warehouse_id)
);

alter table public.stock_levels enable row level security;

create policy "select own company data" on public.stock_levels
  for select using (company_id = public.current_company_id());
create policy "insert own company data" on public.stock_levels
  for insert with check (company_id = public.current_company_id());
create policy "update own company data" on public.stock_levels
  for update using (company_id = public.current_company_id());
create policy "delete own company data" on public.stock_levels
  for delete using (company_id = public.current_company_id());
