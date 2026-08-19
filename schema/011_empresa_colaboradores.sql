-- =========================================================
-- ProdOS — Migração 011: Dados da Empresa + Colaboradores
-- Rode DEPOIS do 001 a 010.
-- =========================================================

-- ---------------------------------------------------------
-- 1. Dados completos da empresa (perfil, para aparecer em
-- documentos como orçamentos e no cabeçalho do sistema)
-- ---------------------------------------------------------
alter table public.companies add column if not exists cnpj text;
alter table public.companies add column if not exists address text;
alter table public.companies add column if not exists phone text;
alter table public.companies add column if not exists email text;
alter table public.companies add column if not exists logo_url text;

-- ---------------------------------------------------------
-- 2. COLABORADORES
-- ---------------------------------------------------------
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  full_name text not null,
  role text,                  -- cargo
  email text,
  phone text,
  hire_date date,
  status text not null default 'ativo' check (status in ('ativo', 'inativo')),
  work_center_id uuid references public.work_centers(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.employees enable row level security;

create policy "select own company data" on public.employees
  for select using (company_id = public.current_company_id());
create policy "insert own company data" on public.employees
  for insert with check (company_id = public.current_company_id());
create policy "update own company data" on public.employees
  for update using (company_id = public.current_company_id());
create policy "delete own company data" on public.employees
  for delete using (company_id = public.current_company_id());
