-- =========================================================
-- ProdOS — Migração 021: Livro de Movimentações de Estoque
-- Toda entrada/saída de estoque (Compra, Produção, Venda,
-- Transferência, Ajuste manual) grava uma linha permanente
-- aqui — nada desaparece, mesmo depois de processado.
-- Rode DEPOIS do 001 a 020.
-- =========================================================

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  warehouse_id uuid references public.warehouses(id) on delete set null,
  movement_type text not null check (movement_type in ('entrada', 'saida')),
  quantity numeric not null default 0,
  reference_type text not null check (reference_type in ('compra', 'producao', 'venda', 'transferencia', 'ajuste')),
  reference_code text,           -- ex: código do pedido/ordem de origem, pra referência rápida
  notes text,
  created_at timestamptz not null default now()
);

alter table public.stock_movements enable row level security;
create policy "select own company data" on public.stock_movements for select using (company_id = public.current_company_id());
create policy "insert own company data" on public.stock_movements for insert with check (company_id = public.current_company_id());
create policy "update own company data" on public.stock_movements for update using (company_id = public.current_company_id());
create policy "delete own company data" on public.stock_movements for delete using (company_id = public.current_company_id());
