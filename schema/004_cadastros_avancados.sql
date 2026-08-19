-- =========================================================
-- ProdOS — Migração 004: Cadastros avançados
-- Centros de Trabalho/Recursos, Almoxarifados, Unidades de
-- Medida, Condições de Pagamento, Centros de Custo, Transportadoras
-- Rode DEPOIS do 001, 002 e 003
-- =========================================================

-- ---------------------------------------------------------
-- 1. CENTROS DE TRABALHO / RECURSOS
-- Base para o MRP II: capacidade disponível por etapa
-- (máquina, linha, sala, equipe...).
-- ---------------------------------------------------------
create table public.work_centers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  stage_id uuid references public.production_stages(id) on delete set null,
  capacity numeric not null default 0,          -- ex: 8 (horas/dia) ou 500 (peças/dia)
  capacity_unit text not null default 'horas/dia',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 2. ALMOXARIFADOS / LOCAIS DE ESTOQUE
-- ---------------------------------------------------------
create table public.warehouses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  location text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 3. UNIDADES DE MEDIDA
-- ---------------------------------------------------------
create table public.units_of_measure (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,       -- ex: KG, UN, M, L, H
  name text not null,       -- ex: Quilograma, Unidade, Metro, Litro, Hora
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 4. CONDIÇÕES DE PAGAMENTO
-- ---------------------------------------------------------
create table public.payment_terms (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,           -- ex: "30/60/90", "À vista"
  installments integer not null default 1,
  days_between integer not null default 0,   -- intervalo entre parcelas
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 5. CENTROS DE CUSTO
-- ---------------------------------------------------------
create table public.cost_centers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text,
  name text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 6. TRANSPORTADORAS
-- ---------------------------------------------------------
create table public.carriers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  document text,
  phone text,
  email text,
  created_at timestamptz not null default now()
);

-- =========================================================
-- RLS — mesmo padrão das demais tabelas
-- =========================================================
alter table public.work_centers enable row level security;
alter table public.warehouses enable row level security;
alter table public.units_of_measure enable row level security;
alter table public.payment_terms enable row level security;
alter table public.cost_centers enable row level security;
alter table public.carriers enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['work_centers','warehouses','units_of_measure','payment_terms','cost_centers','carriers']
  loop
    execute format('create policy "select own company data" on public.%I for select using (company_id = public.current_company_id());', t);
    execute format('create policy "insert own company data" on public.%I for insert with check (company_id = public.current_company_id());', t);
    execute format('create policy "update own company data" on public.%I for update using (company_id = public.current_company_id());', t);
    execute format('create policy "delete own company data" on public.%I for delete using (company_id = public.current_company_id());', t);
  end loop;
end $$;
