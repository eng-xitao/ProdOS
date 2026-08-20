-- =========================================================
-- ProdOS — Migração 020: Histórico de Recebimento de Produção
-- Guarda quando e em qual almoxarifado cada ordem foi recebida,
-- para exibir um histórico em vez de simplesmente "sumir" da tela.
-- Rode DEPOIS do 001 a 019.
-- =========================================================

alter table public.production_orders
  add column if not exists stock_entry_at timestamptz;

alter table public.production_orders
  add column if not exists stock_entry_warehouse_id uuid references public.warehouses(id) on delete set null;
