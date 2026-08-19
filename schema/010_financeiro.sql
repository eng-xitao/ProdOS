-- =========================================================
-- ProdOS — Migração 010: Financeiro
-- Liga lançamentos a Pedidos de Venda/Compra, Cliente/Fornecedor
-- e Centro de Custo. Base para Contas a Receber/Pagar, Fluxo de
-- Caixa e DRE simplificado.
-- Rode DEPOIS do 001 a 009.
-- =========================================================

alter table public.financial_entries
  add column if not exists customer_id uuid references public.customers(id) on delete set null;

alter table public.financial_entries
  add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;

alter table public.financial_entries
  add column if not exists sales_order_id uuid references public.sales_orders(id) on delete set null;

alter table public.financial_entries
  add column if not exists purchase_order_id uuid references public.purchase_orders(id) on delete set null;

alter table public.financial_entries
  add column if not exists cost_center_id uuid references public.cost_centers(id) on delete set null;

alter table public.financial_entries
  add column if not exists installment_number integer;

alter table public.financial_entries
  add column if not exists total_installments integer;

-- Evita gerar as parcelas em dobro se o usuário clicar 2x
alter table public.sales_orders
  add column if not exists receivable_generated boolean not null default false;

alter table public.purchase_orders
  add column if not exists payable_generated boolean not null default false;
