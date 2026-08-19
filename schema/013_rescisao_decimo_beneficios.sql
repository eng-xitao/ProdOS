-- =========================================================
-- ProdOS — Migração 013: Rescisão, 13º Salário e Benefícios
-- Assim como a Folha de Pagamento, os valores de verbas
-- rescisórias e descontos são informados manualmente — o
-- sistema não calcula as fórmulas da CLT automaticamente.
-- Rode DEPOIS do 001 a 012.
-- =========================================================

-- ---------------------------------------------------------
-- 1. RESCISÃO / DESLIGAMENTO
-- ---------------------------------------------------------
create table public.terminations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  termination_date date not null,
  termination_type text not null
    check (termination_type in ('sem_justa_causa', 'justa_causa', 'pedido_demissao', 'acordo', 'termino_contrato')),
  notice_type text check (notice_type in ('trabalhado', 'indenizado', 'dispensado')),
  balance_salary numeric not null default 0,         -- saldo de salário
  proportional_vacation numeric not null default 0,   -- férias proporcionais + 1/3
  proportional_13th numeric not null default 0,        -- 13º proporcional
  notice_amount numeric not null default 0,            -- aviso prévio indenizado
  fgts_fine numeric not null default 0,                 -- multa 40% FGTS
  other_amounts numeric not null default 0,
  total_amount numeric not null default 0,
  financial_entry_id uuid references public.financial_entries(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.terminations enable row level security;
create policy "select own company data" on public.terminations for select using (company_id = public.current_company_id());
create policy "insert own company data" on public.terminations for insert with check (company_id = public.current_company_id());
create policy "update own company data" on public.terminations for update using (company_id = public.current_company_id());
create policy "delete own company data" on public.terminations for delete using (company_id = public.current_company_id());

-- ---------------------------------------------------------
-- 2. 13º SALÁRIO
-- ---------------------------------------------------------
create table public.thirteenth_salary_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  reference_year integer not null,
  installment integer not null default 1 check (installment in (1, 2)),
  gross_amount numeric not null default 0,
  discounts numeric not null default 0,
  net_amount numeric not null default 0,
  financial_entry_id uuid references public.financial_entries(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.thirteenth_salary_entries enable row level security;
create policy "select own company data" on public.thirteenth_salary_entries for select using (company_id = public.current_company_id());
create policy "insert own company data" on public.thirteenth_salary_entries for insert with check (company_id = public.current_company_id());
create policy "update own company data" on public.thirteenth_salary_entries for update using (company_id = public.current_company_id());
create policy "delete own company data" on public.thirteenth_salary_entries for delete using (company_id = public.current_company_id());

-- ---------------------------------------------------------
-- 3. BENEFÍCIOS (catálogo + vínculo por colaborador)
-- ---------------------------------------------------------
create table public.benefit_types (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,                    -- ex: Vale Transporte, Vale Refeição, Plano de Saúde
  default_monthly_cost numeric not null default 0,
  created_at timestamptz not null default now()
);

create table public.employee_benefits (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  benefit_type_id uuid not null references public.benefit_types(id) on delete cascade,
  monthly_cost numeric not null default 0,
  employee_discount numeric not null default 0,  -- quanto é descontado do colaborador, se houver
  start_date date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.benefit_types enable row level security;
alter table public.employee_benefits enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['benefit_types','employee_benefits']
  loop
    execute format('create policy "select own company data" on public.%I for select using (company_id = public.current_company_id());', t);
    execute format('create policy "insert own company data" on public.%I for insert with check (company_id = public.current_company_id());', t);
    execute format('create policy "update own company data" on public.%I for update using (company_id = public.current_company_id());', t);
    execute format('create policy "delete own company data" on public.%I for delete using (company_id = public.current_company_id());', t);
  end loop;
end $$;
