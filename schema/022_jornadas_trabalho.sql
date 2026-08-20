-- =========================================================
-- ProdOS — Migração 022: Jornadas de Trabalho (Carga Horária)
-- Cada empresa configura sua própria jornada, com blocos de
-- horário por dia da semana (normal, pausa, almoço).
-- Rode DEPOIS do 001 a 021.
-- =========================================================

-- ---------------------------------------------------------
-- 1. JORNADAS (o "molde" — ex: "Jornada Administrativa")
-- ---------------------------------------------------------
create table public.work_schedules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 2. BLOCOS DE HORÁRIO — cada linha é um intervalo de tempo
-- num dia da semana específico, classificado como normal
-- (trabalho), pausa (café) ou almoço.
-- ---------------------------------------------------------
create table public.work_schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  work_schedule_id uuid not null references public.work_schedules(id) on delete cascade,
  weekday text not null check (weekday in ('segunda','terca','quarta','quinta','sexta','sabado','domingo')),
  start_time time not null,
  end_time time not null,
  block_type text not null default 'normal' check (block_type in ('normal', 'pausa', 'almoco')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 3. Vínculo opcional do Colaborador com uma Jornada formal
-- (o campo de texto livre "work_schedule" continua existindo,
-- pra quem não quiser configurar isso em detalhe)
-- ---------------------------------------------------------
alter table public.employees
  add column if not exists work_schedule_id uuid references public.work_schedules(id) on delete set null;

-- =========================================================
-- RLS
-- =========================================================
alter table public.work_schedules enable row level security;
alter table public.work_schedule_blocks enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['work_schedules','work_schedule_blocks']
  loop
    execute format('create policy "select own company data" on public.%I for select using (company_id = public.current_company_id());', t);
    execute format('create policy "insert own company data" on public.%I for insert with check (company_id = public.current_company_id());', t);
    execute format('create policy "update own company data" on public.%I for update using (company_id = public.current_company_id());', t);
    execute format('create policy "delete own company data" on public.%I for delete using (company_id = public.current_company_id());', t);
  end loop;
end $$;
