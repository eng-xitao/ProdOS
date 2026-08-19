-- =========================================================
-- ProdOS — Migração 015: Múltiplos usuários por empresa
-- Convite por e-mail, papéis por departamento, e ajuste no
-- gatilho de cadastro para reconhecer convites pendentes.
-- Rode DEPOIS do 001 a 014.
-- =========================================================

-- ---------------------------------------------------------
-- 1. Guarda o e-mail no perfil (para exibir a lista de usuários
-- sem precisar de acesso administrativo ao auth.users)
-- ---------------------------------------------------------
alter table public.profiles add column if not exists email text;

-- Preenche o e-mail de perfis já existentes (roda com privilégio
-- elevado no SQL Editor, então consegue ler auth.users aqui)
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is null;

-- ---------------------------------------------------------
-- 2. Amplia os papéis possíveis para os novos perfis por
-- departamento (antes só existia 'admin' e 'member')
-- ---------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'gerente', 'vendas', 'compras', 'producao', 'financeiro', 'rh', 'member'));

-- ---------------------------------------------------------
-- 3. CONVITES DE USUÁRIO
-- ---------------------------------------------------------
create table public.user_invites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'gerente', 'vendas', 'compras', 'producao', 'financeiro', 'rh')),
  invited_by uuid references public.profiles(id) on delete set null,
  status text not null default 'pendente' check (status in ('pendente', 'aceito', 'cancelado')),
  created_at timestamptz not null default now()
);

alter table public.user_invites enable row level security;
create policy "select own company data" on public.user_invites for select using (company_id = public.current_company_id());
create policy "insert own company data" on public.user_invites for insert with check (company_id = public.current_company_id());
create policy "update own company data" on public.user_invites for update using (company_id = public.current_company_id());
create policy "delete own company data" on public.user_invites for delete using (company_id = public.current_company_id());

-- ---------------------------------------------------------
-- 4. Atualiza o gatilho de cadastro: se o e-mail usado no
-- cadastro corresponder a um convite pendente, a pessoa entra
-- na empresa já existente com o papel do convite — em vez de
-- criar uma empresa nova (comportamento padrão anterior).
-- ---------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
declare
  new_company_id uuid;
  pending_invite record;
begin
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
    insert into public.companies (name, segment)
    values (
      coalesce(new.raw_user_meta_data->>'company_name', 'Minha Empresa'),
      new.raw_user_meta_data->>'segment'
    )
    returning id into new_company_id;

    insert into public.profiles (id, company_id, full_name, role, email)
    values (new.id, new_company_id, new.raw_user_meta_data->>'full_name', 'admin', new.email);
  end if;

  return new;
end;
$$;
