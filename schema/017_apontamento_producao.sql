-- =========================================================
-- ProdOS — Migração 017: Apontamento de Produção
-- Registro de horas trabalhadas em cada Ordem de Produção,
-- por colaborador e etapa, com campos livres (não obrigatório
-- preencher tudo — início/fim são opcionais).
-- Rode DEPOIS do 001 a 016.
-- =========================================================

create table public.production_time_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  production_order_id uuid references public.production_orders(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  stage_id uuid references public.production_stages(id) on delete set null,
  log_date date not null default current_date,
  start_time time,
  end_time time,
  hours numeric,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.production_time_logs enable row level security;
create policy "select own company data" on public.production_time_logs for select using (company_id = public.current_company_id());
create policy "insert own company data" on public.production_time_logs for insert with check (company_id = public.current_company_id());
create policy "update own company data" on public.production_time_logs for update using (company_id = public.current_company_id());
create policy "delete own company data" on public.production_time_logs for delete using (company_id = public.current_company_id());
