-- =========================================================
-- ProdOS — Migração 025: Planos configuráveis + Admin da Plataforma
-- Os preços e o que cada plano libera deixam de estar fixos no
-- código e passam a ser configuráveis numa tela — só visível pra
-- quem tiver o novo papel de Administrador da Plataforma (você).
-- Rode DEPOIS do 001 a 024.
-- =========================================================

-- ---------------------------------------------------------
-- 1. Marca quem é Administrador da Plataforma (você) — diferente
-- de "admin" de uma empresa cliente, que só administra a própria
-- empresa. Ninguém começa com isso — é preciso ativar manualmente
-- (ver Passo 2 do README desta migração).
-- ---------------------------------------------------------
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

-- ---------------------------------------------------------
-- 2. PLANOS — configurável, não fixo no código
-- ---------------------------------------------------------
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,          -- identificador interno, ex: "basico"
  name text not null,                -- nome mostrado, ex: "Plano Básico"
  price numeric not null default 0,
  description text,
  features text[] not null default '{}',  -- lista de seções do menu liberadas, ex: {Cadastro,Comercial}
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.plans enable row level security;
-- Qualquer usuário logado pode LER os planos (precisa ver preço/features
-- pra escolher um). Só o Admin da Plataforma pode criar/editar/excluir.
create policy "authenticated users can read plans" on public.plans for select using (auth.role() = 'authenticated');
create policy "only platform admin can insert plans" on public.plans for insert with check (public.is_platform_admin());
create policy "only platform admin can update plans" on public.plans for update using (public.is_platform_admin());
create policy "only platform admin can delete plans" on public.plans for delete using (public.is_platform_admin());

-- ---------------------------------------------------------
-- 3. Liga a empresa a um Plano de verdade (antes era só um texto solto)
-- ---------------------------------------------------------
alter table public.companies
  add column if not exists plan_id uuid references public.plans(id);

-- ---------------------------------------------------------
-- 4. Planos iniciais — os 3 que já tínhamos desenhado, com preços
-- de exemplo. Edite os valores e o que cada um libera na tela nova.
-- ---------------------------------------------------------
insert into public.plans (key, name, price, description, features, sort_order) values
  ('basico', 'Básico', 97.00, 'Cadastro essencial e vendas simples.',
    array['Cadastro', 'Comercial', 'Logística'], 1),
  ('intermediario', 'Intermediário', 197.00, 'Operação industrial completa.',
    array['Cadastro', 'PCP', 'Comercial', 'Compras', 'Logística', 'Custos', 'CRM', 'Frotas', 'Relatórios'], 2),
  ('premium', 'Premium', 397.00, 'Inclui financeiro, RH e múltiplos usuários.',
    array['Cadastro', 'PCP', 'Comercial', 'Compras', 'Logística', 'Custos', 'CRM', 'Frotas', 'Relatórios', 'Financeiro', 'RH', 'Configurações'], 3)
on conflict (key) do nothing;

-- Toda empresa que ainda não tem plano vinculado recebe o Básico
update public.companies
set plan_id = (select id from public.plans where key = 'basico' limit 1)
where plan_id is null;

-- ---------------------------------------------------------
-- 5. Empresa nova (cadastro via "Criar conta") já nasce no Básico
-- ---------------------------------------------------------
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
