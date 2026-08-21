-- =========================================================
-- ProdOS — Migração 024: Assinatura e Cobrança (Asaas)
-- Adiciona controle de plano/assinatura em cada empresa, e um
-- histórico dos eventos de pagamento recebidos do Asaas.
-- Rode DEPOIS do 001 a 023.
-- =========================================================

alter table public.companies
  add column if not exists plan text not null default 'basico' check (plan in ('basico', 'intermediario', 'premium'));

alter table public.companies
  add column if not exists subscription_status text not null default 'trial'
  check (subscription_status in ('trial', 'active', 'overdue', 'canceled'));

alter table public.companies
  add column if not exists trial_ends_at timestamptz not null default (now() + interval '14 days');

alter table public.companies
  add column if not exists asaas_customer_id text;

alter table public.companies
  add column if not exists asaas_subscription_id text;

-- ---------------------------------------------------------
-- Histórico de eventos de cobrança recebidos via webhook —
-- fica registrado tudo, mesmo que não altere o status (útil
-- pra auditoria e pra depurar problema de pagamento).
-- ---------------------------------------------------------
create table public.billing_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  event_type text not null,
  payment_id text,
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

alter table public.billing_events enable row level security;
create policy "select own company data" on public.billing_events for select using (company_id = public.current_company_id());
-- Sem policy de insert/update — só a Edge Function (que usa a chave
-- de serviço, ignorando RLS) grava nessa tabela.
