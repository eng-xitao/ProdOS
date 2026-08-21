-- =========================================================
-- ProdOS — Migração 025 (versão segura pra rodar de novo)
-- Usa "if not exists" e recria as políticas com segurança —
-- pode rodar mesmo se uma tentativa anterior já tiver criado
-- parte disso. Não vai duplicar nem dar erro.
-- =========================================================

alter table public.profiles
  add column if not exists is_platform_admin boolean not null default false;

create or replace function public.is_platform_admin()
returns boolean
language sql
security definer
stable
as $$
  select coalesce((select is_platform_admin from public.profiles where id = auth.uid()), false);
$$;

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  price numeric not null default 0,
  description text,
  features text[] not null default '{}',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.plans enable row level security;

drop policy if exists "authenticated users can read plans" on public.plans;
create policy "authenticated users can read plans" on public.plans for select using (auth.role() = 'authenticated');

drop policy if exists "only platform admin can insert plans" on public.plans;
create policy "only platform admin can insert plans" on public.plans for insert with check (public.is_platform_admin());

drop policy if exists "only platform admin can update plans" on public.plans;
create policy "only platform admin can update plans" on public.plans for update using (public.is_platform_admin());

drop policy if exists "only platform admin can delete plans" on public.plans;
create policy "only platform admin can delete plans" on public.plans for delete using (public.is_platform_admin());

alter table public.companies
  add column if not exists plan_id uuid references public.plans(id);

insert into public.plans (key, name, price, description, features, sort_order) values
  ('basico', 'Básico', 97.00, 'Cadastro essencial e vendas simples.',
    array['Cadastro', 'Comercial', 'Logística'], 1),
  ('intermediario', 'Intermediário', 197.00, 'Operação industrial completa.',
    array['Cadastro', 'PCP', 'Comercial', 'Compras', 'Logística', 'Custos', 'CRM', 'Frotas', 'Relatórios'], 2),
  ('premium', 'Premium', 397.00, 'Inclui financeiro, RH e múltiplos usuários.',
    array['Cadastro', 'PCP', 'Comercial', 'Compras', 'Logística', 'Custos', 'CRM', 'Frotas', 'Relatórios', 'Financeiro', 'RH', 'Configurações'], 3)
on conflict (key) do nothing;

update public.companies
set plan_id = (select id from public.plans where key = 'basico' limit 1)
where plan_id is null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
declare
  new_company_id uuid;
  pending_invite record;
  basic_plan_id uuid;
begin
  select id into basic_plan_id from public.plans where key = 'basico' limit 1;

  select * into pending_invite
  from public.user_invites
  where email = new.email and status = 'pendente'
  order by created_at desc
  limit 1;

  if pending_invite.id is not null then
    insert into public.profiles (id, company_id, full_name, role, email)
    values (new.id, pending_invite.company_id, new.raw_user_meta_data->>'full_name', pending_invite.role, new.email);

    update public.user_invites set status = 'aceito' where id = pending_invite.id;
  else
    insert into public.companies (name, segment, plan_id)
    values (
      coalesce(new.raw_user_meta_data->>'company_name', 'Minha Empresa'),
      new.raw_user_meta_data->>'segment',
      basic_plan_id
    )
    returning id into new_company_id;

    insert into public.profiles (id, company_id, full_name, role, email)
    values (new.id, new_company_id, new.raw_user_meta_data->>'full_name', 'admin', new.email);
  end if;

  return new;
end;
$$;
