-- =========================================================
-- ProdOS — Migração 014: Contas a Pagar completa + DRE detalhado
-- Liga lançamentos financeiros ao colaborador de origem (Folha,
-- 13º, Rescisão), para que Contas a Pagar e o DRE consigam
-- identificar e agrupar por origem corretamente.
-- Rode DEPOIS do 001 a 013.
-- =========================================================

alter table public.financial_entries
  add column if not exists employee_id uuid references public.employees(id) on delete set null;
