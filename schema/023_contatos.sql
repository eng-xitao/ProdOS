-- =========================================================
-- ProdOS — Migração 023: Contatos por Cliente/Fornecedor
-- Um cliente ou fornecedor pode ter vários contatos, cada um
-- em um departamento diferente (Compras, Financeiro, etc.) —
-- usado para saber pra quem mandar cada tipo de documento.
-- Rode DEPOIS do 001 a 022.
-- =========================================================

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete cascade,
  name text not null,
  department text,          -- ex: Compras, Financeiro, Comercial
  email text,
  phone text,
  created_at timestamptz not null default now(),
  constraint contacts_single_owner check (
    (customer_id is not null and supplier_id is null) or
    (customer_id is null and supplier_id is not null)
  )
);

alter table public.contacts enable row level security;
create policy "select own company data" on public.contacts for select using (company_id = public.current_company_id());
create policy "insert own company data" on public.contacts for insert with check (company_id = public.current_company_id());
create policy "update own company data" on public.contacts for update using (company_id = public.current_company_id());
create policy "delete own company data" on public.contacts for delete using (company_id = public.current_company_id());
