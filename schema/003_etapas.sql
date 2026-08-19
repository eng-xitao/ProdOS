-- =========================================================
-- ProdOS — Migração 003: Etapas de produção configuráveis
-- Substitui a lista fixa (Corte, Solda, Lixação...) por uma
-- tabela que cada empresa configura do seu próprio jeito,
-- servindo qualquer segmento (indústria, serviços, saúde, etc.)
-- Rode DEPOIS do 001_schema.sql e 002_cadastros.sql
-- =========================================================

-- ---------------------------------------------------------
-- 1. ETAPAS (configuráveis por empresa)
-- ---------------------------------------------------------
create table public.production_stages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,   -- define a ordem de exibição/fluxo
  created_at timestamptz not null default now()
);

alter table public.production_stages enable row level security;

create policy "select own company data" on public.production_stages
  for select using (company_id = public.current_company_id());
create policy "insert own company data" on public.production_stages
  for insert with check (company_id = public.current_company_id());
create policy "update own company data" on public.production_stages
  for update using (company_id = public.current_company_id());
create policy "delete own company data" on public.production_stages
  for delete using (company_id = public.current_company_id());

-- ---------------------------------------------------------
-- 2. Ajusta production_orders: troca a coluna fixa "stage"
-- (texto com lista travada) por "stage_id", que referencia
-- a etapa configurada pela própria empresa.
-- ---------------------------------------------------------
alter table public.production_orders drop column if exists stage;

alter table public.production_orders
  add column stage_id uuid references public.production_stages(id) on delete set null;

-- ---------------------------------------------------------
-- 3. Semeia etapas padrão de indústria/fabricação para quem
-- já tinha empresa cadastrada antes desta migração — cada
-- empresa existente recebe uma sugestão inicial editável.
-- Empresas novas (cadastradas depois) começam sem etapas e
-- o próprio usuário define as suas na tela de Produção.
-- ---------------------------------------------------------
insert into public.production_stages (company_id, name, sort_order)
select id, stage_name, sort_order
from public.companies
cross join (
  values
    ('Planejamento', 0),
    ('Em andamento', 1),
    ('Concluído', 2)
) as defaults(stage_name, sort_order);
