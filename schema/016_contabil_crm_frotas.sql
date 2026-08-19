-- =========================================================
-- ProdOS — Migração 016: Plano de Contas, CRM/SAC, Frotas
-- Rode DEPOIS do 001 a 015.
-- =========================================================

-- ---------------------------------------------------------
-- 1. PLANO DE CONTAS (classificação contábil formal)
-- ---------------------------------------------------------
create table public.chart_of_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text,                     -- ex: 3.1.01
  name text not null,            -- ex: Receita de Vendas, Despesas com Pessoal
  account_type text not null default 'despesa' check (account_type in ('receita', 'despesa')),
  created_at timestamptz not null default now()
);

alter table public.chart_of_accounts enable row level security;
create policy "select own company data" on public.chart_of_accounts for select using (company_id = public.current_company_id());
create policy "insert own company data" on public.chart_of_accounts for insert with check (company_id = public.current_company_id());
create policy "update own company data" on public.chart_of_accounts for update using (company_id = public.current_company_id());
create policy "delete own company data" on public.chart_of_accounts for delete using (company_id = public.current_company_id());

alter table public.financial_entries
  add column if not exists account_id uuid references public.chart_of_accounts(id) on delete set null;

-- ---------------------------------------------------------
-- 2. CRM / SAC — chamados de atendimento
-- ---------------------------------------------------------
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  subject text not null,
  description text,
  priority text not null default 'media' check (priority in ('baixa', 'media', 'alta')),
  status text not null default 'aberto' check (status in ('aberto', 'em_atendimento', 'resolvido', 'fechado')),
  assigned_to uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.support_tickets enable row level security;
create policy "select own company data" on public.support_tickets for select using (company_id = public.current_company_id());
create policy "insert own company data" on public.support_tickets for insert with check (company_id = public.current_company_id());
create policy "update own company data" on public.support_tickets for update using (company_id = public.current_company_id());
create policy "delete own company data" on public.support_tickets for delete using (company_id = public.current_company_id());

-- ---------------------------------------------------------
-- 3. FROTAS E EQUIPAMENTOS
-- ---------------------------------------------------------
create table public.fleet_assets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  asset_type text not null default 'equipamento' check (asset_type in ('veiculo', 'equipamento', 'ferramenta')),
  identifier text,               -- placa, nº de série, nº de patrimônio
  status text not null default 'ativo' check (status in ('ativo', 'manutencao', 'inativo')),
  acquisition_date date,
  notes text,
  created_at timestamptz not null default now()
);

create table public.maintenance_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  asset_id uuid not null references public.fleet_assets(id) on delete cascade,
  maintenance_date date not null,
  description text,
  cost numeric not null default 0,
  next_maintenance_date date,
  status text not null default 'concluida' check (status in ('agendada', 'concluida')),
  created_at timestamptz not null default now()
);

alter table public.fleet_assets enable row level security;
alter table public.maintenance_records enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['fleet_assets','maintenance_records']
  loop
    execute format('create policy "select own company data" on public.%I for select using (company_id = public.current_company_id());', t);
    execute format('create policy "insert own company data" on public.%I for insert with check (company_id = public.current_company_id());', t);
    execute format('create policy "update own company data" on public.%I for update using (company_id = public.current_company_id());', t);
    execute format('create policy "delete own company data" on public.%I for delete using (company_id = public.current_company_id());', t);
  end loop;
end $$;
