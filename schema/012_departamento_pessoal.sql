-- =========================================================
-- ProdOS — Migração 012: Departamento Pessoal (DP)
-- Dados completos de admissão/contrato, Férias e Folha de
-- Pagamento (gerando Conta a Pagar automaticamente).
-- Rode DEPOIS do 001 a 011.
-- =========================================================

-- ---------------------------------------------------------
-- 1. Expande Colaboradores com dados de admissão e contrato
-- ---------------------------------------------------------
alter table public.employees add column if not exists cpf text;
alter table public.employees add column if not exists pis text;
alter table public.employees add column if not exists ctps text;
alter table public.employees add column if not exists rg text;
alter table public.employees add column if not exists birth_date date;
alter table public.employees add column if not exists address text;
alter table public.employees add column if not exists bank_name text;
alter table public.employees add column if not exists bank_agency text;
alter table public.employees add column if not exists bank_account text;
alter table public.employees add column if not exists dependents_count integer default 0;
alter table public.employees add column if not exists contract_type text
  check (contract_type in ('clt', 'pj', 'estagio', 'temporario', 'terceirizado'));
alter table public.employees add column if not exists work_schedule text; -- ex: "44h semanais"
alter table public.employees add column if not exists base_salary numeric default 0;
alter table public.employees add column if not exists termination_date date;

-- ---------------------------------------------------------
-- 2. FÉRIAS
-- ---------------------------------------------------------
create table public.vacations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  acquisition_start date not null,     -- início do período aquisitivo
  acquisition_end date not null,       -- fim do período aquisitivo (12 meses depois)
  concession_deadline date,            -- prazo legal para conceder (12 meses após acquisition_end)
  start_date date,                     -- início do período de gozo (quando agendado)
  end_date date,                       -- fim do período de gozo
  days_taken integer default 30,
  status text not null default 'pendente' check (status in ('pendente', 'agendada', 'concluida')),
  created_at timestamptz not null default now()
);

alter table public.vacations enable row level security;
create policy "select own company data" on public.vacations for select using (company_id = public.current_company_id());
create policy "insert own company data" on public.vacations for insert with check (company_id = public.current_company_id());
create policy "update own company data" on public.vacations for update using (company_id = public.current_company_id());
create policy "delete own company data" on public.vacations for delete using (company_id = public.current_company_id());

-- ---------------------------------------------------------
-- 3. FOLHA DE PAGAMENTO (simplificada)
-- Os valores de INSS/IRRF são informados manualmente — o
-- sistema não calcula tabelas fiscais automaticamente.
-- ---------------------------------------------------------
create table public.payroll_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  reference_month date not null,       -- primeiro dia do mês de referência
  base_salary numeric not null default 0,
  overtime_amount numeric not null default 0,
  inss_discount numeric not null default 0,
  irrf_discount numeric not null default 0,
  vt_discount numeric not null default 0,
  other_discounts numeric not null default 0,
  net_salary numeric not null default 0,
  financial_entry_id uuid references public.financial_entries(id) on delete set null,
  status text not null default 'aberta' check (status in ('aberta', 'paga')),
  created_at timestamptz not null default now()
);

alter table public.payroll_entries enable row level security;
create policy "select own company data" on public.payroll_entries for select using (company_id = public.current_company_id());
create policy "insert own company data" on public.payroll_entries for insert with check (company_id = public.current_company_id());
create policy "update own company data" on public.payroll_entries for update using (company_id = public.current_company_id());
create policy "delete own company data" on public.payroll_entries for delete using (company_id = public.current_company_id());
