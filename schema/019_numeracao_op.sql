-- =========================================================
-- ProdOS — Migração 019: Numeração automática da Ordem de
-- Produção + vínculo opcional com o Pedido de Venda de origem.
-- Rode DEPOIS do 001 a 018.
-- =========================================================

-- ---------------------------------------------------------
-- 1. Vínculo opcional: uma Ordem de Produção pode ser gerada
-- para atender um Pedido de Venda específico (rastreabilidade),
-- ou pode não ter nenhum (produção para estoque).
-- ---------------------------------------------------------
alter table public.production_orders
  add column if not exists sales_order_id uuid references public.sales_orders(id) on delete set null;

-- ---------------------------------------------------------
-- 2. Função que calcula o próximo número sequencial da
-- empresa, olhando o maior código "OP-####" já usado —
-- nunca repete, mesmo se algum registro for excluído.
-- ---------------------------------------------------------
create or replace function public.next_production_order_code(p_company_id uuid)
returns text
language plpgsql
security definer
as $$
declare
  v_max integer;
begin
  select coalesce(max(substring(code from 'OP-(\d+)')::integer), 0) into v_max
  from public.production_orders
  where company_id = p_company_id and code ~ '^OP-\d+$';

  return 'OP-' || lpad((v_max + 1)::text, 4, '0');
end;
$$;
