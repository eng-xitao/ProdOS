-- =========================================================
-- ProdOS — Migração 018: Contas a Receber automáticas
-- Ao mudar o status de um Pedido de Venda para "faturado", as
-- parcelas de Contas a Receber são geradas automaticamente —
-- usando a Condição de Pagamento do orçamento de origem (se
-- houver), ou uma parcela única à vista como padrão.
-- Rode DEPOIS do 001 a 017.
-- =========================================================

create or replace function public.generate_receivables_for_order(p_order_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_order record;
  v_installments integer := 1;
  v_days_between integer := 0;
  v_amount numeric;
  i integer;
begin
  select * into v_order from public.sales_orders where id = p_order_id;
  if v_order is null then return; end if;
  if coalesce(v_order.receivable_generated, false) then return; end if;

  -- Busca a condição de pagamento do orçamento de origem, se houver
  select pt.installments, pt.days_between into v_installments, v_days_between
  from public.quotes q
  join public.payment_terms pt on pt.id = q.payment_term_id
  where q.id = v_order.quote_id;

  if v_installments is null then
    v_installments := 1;
    v_days_between := 0;
  end if;

  v_amount := v_order.total_value / v_installments;

  for i in 1..v_installments loop
    insert into public.financial_entries (
      company_id, description, entry_type, amount, due_date,
      customer_id, sales_order_id, installment_number, total_installments, paid
    ) values (
      v_order.company_id,
      format('Pedido %s — parcela %s/%s', v_order.code, i, v_installments),
      'receita',
      v_amount,
      v_order.order_date + make_interval(days => v_days_between * i),
      v_order.customer_id,
      v_order.id,
      i,
      v_installments,
      false
    );
  end loop;

  update public.sales_orders set receivable_generated = true where id = p_order_id;
end;
$$;

create or replace function public.trg_sales_order_invoiced()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.status = 'faturado' and coalesce(new.receivable_generated, false) = false then
    perform public.generate_receivables_for_order(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sales_order_invoiced on public.sales_orders;
create trigger trg_sales_order_invoiced
  after insert or update on public.sales_orders
  for each row execute function public.trg_sales_order_invoiced();

-- ---------------------------------------------------------
-- Corrige pedidos que já estavam "faturado" antes desta
-- migração e ainda não tinham gerado as parcelas
-- ---------------------------------------------------------
do $$
declare
  r record;
begin
  for r in select id from public.sales_orders where status = 'faturado' and coalesce(receivable_generated, false) = false
  loop
    perform public.generate_receivables_for_order(r.id);
  end loop;
end $$;
