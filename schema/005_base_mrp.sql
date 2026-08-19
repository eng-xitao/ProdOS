-- =========================================================
-- ProdOS — Migração 005: Base para MRP I e MRP II
-- Liga Ordens de Produção a um Produto real (necessário para
-- explodir a estrutura/BOM) e adiciona estoque atual ao Produto.
-- Rode DEPOIS do 001, 002, 003 e 004
-- =========================================================

-- ---------------------------------------------------------
-- 1. Produtos passam a ter estoque atual (usado pelo MRP I
-- para calcular o que falta comprar/produzir).
-- ---------------------------------------------------------
alter table public.products
  add column if not exists stock_quantity numeric not null default 0;

-- ---------------------------------------------------------
-- 2. Ordens de produção passam a referenciar um Produto real,
-- em vez de um texto livre — é isso que permite ao MRP I
-- explodir a estrutura (BOM) da ordem.
-- ---------------------------------------------------------
alter table public.production_orders drop column if exists product_name;

alter table public.production_orders
  add column if not exists product_id uuid references public.products(id) on delete set null;
