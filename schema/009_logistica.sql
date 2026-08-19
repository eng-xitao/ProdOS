-- =========================================================
-- ProdOS — Migração 009: Logística / Expedição
-- Fecha o ciclo físico: Produção concluída entra no estoque,
-- Expedição baixa o estoque e marca o pedido como entregue,
-- e Transferências movem quantidade entre almoxarifados.
-- Rode DEPOIS do 001 a 008.
-- =========================================================

-- ---------------------------------------------------------
-- 1. Marca se uma ordem de produção já teve seu resultado
-- lançado no estoque (evita lançar em dobro).
-- ---------------------------------------------------------
alter table public.production_orders
  add column if not exists stock_entry_done boolean not null default false;

-- ---------------------------------------------------------
-- 2. ROMANEIOS DE SAÍDA (Expedição)
-- ---------------------------------------------------------
create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  sales_order_id uuid references public.sales_orders(id) on delete set null,
  carrier_id uuid references public.carriers(id) on delete set null,
  warehouse_id uuid references public.warehouses(id) on delete set null,
  driver_name text,
  vehicle_plate text,
  status text not null default 'preparando'
    check (status in ('preparando', 'em_transito', 'entregue')),
  created_at timestamptz not null default now()
);

create table public.shipment_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  quantity numeric not null default 1,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 3. TRANSFERÊNCIAS ENTRE ALMOXARIFADOS (registro de auditoria)
-- ---------------------------------------------------------
create table public.warehouse_transfers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  from_warehouse_id uuid references public.warehouses(id) on delete set null,
  to_warehouse_id uuid references public.warehouses(id) on delete set null,
  quantity numeric not null default 0,
  created_at timestamptz not null default now()
);

-- =========================================================
-- RLS — mesmo padrão das demais tabelas
-- =========================================================
alter table public.shipments enable row level security;
alter table public.shipment_items enable row level security;
alter table public.warehouse_transfers enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['shipments','shipment_items','warehouse_transfers']
  loop
    execute format('create policy "select own company data" on public.%I for select using (company_id = public.current_company_id());', t);
    execute format('create policy "insert own company data" on public.%I for insert with check (company_id = public.current_company_id());', t);
    execute format('create policy "update own company data" on public.%I for update using (company_id = public.current_company_id());', t);
    execute format('create policy "delete own company data" on public.%I for delete using (company_id = public.current_company_id());', t);
  end loop;
end $$;
