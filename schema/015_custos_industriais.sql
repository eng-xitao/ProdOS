-- =========================================================
-- ProdOS — Migração 015: Custos industriais
-- Custo por centro de trabalho + roteiro de operações por produto.
-- Rode depois das migrações anteriores.
-- =========================================================

alter table public.work_centers
  add column if not exists hourly_rate numeric not null default 0;

create table if not exists public.product_operations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  stage_id uuid references public.production_stages(id) on delete set null,
  work_center_id uuid references public.work_centers(id) on delete set null,
  sequence integer not null default 1,
  setup_hours numeric not null default 0,
  run_hours_per_unit numeric not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  constraint product_operations_hours_nonnegative check (setup_hours >= 0 and run_hours_per_unit >= 0)
);

alter table public.product_operations enable row level security;

create policy "select own company data" on public.product_operations
  for select using (company_id = public.current_company_id());
create policy "insert own company data" on public.product_operations
  for insert with check (company_id = public.current_company_id());
create policy "update own company data" on public.product_operations
  for update using (company_id = public.current_company_id());
create policy "delete own company data" on public.product_operations
  for delete using (company_id = public.current_company_id());

create index if not exists idx_product_operations_company_product
  on public.product_operations(company_id, product_id, sequence);
create index if not exists idx_product_operations_work_center
  on public.product_operations(company_id, work_center_id);

comment on column public.work_centers.hourly_rate is 'Custo industrial por hora do recurso, incluindo mão de obra e/ou overhead alocado';
comment on table public.product_operations is 'Roteiro de fabricação usado para calcular custo de processo por produto';
