create type public.transaction_kind as enum ('accrual', 'payment');

revoke usage on type public.transaction_kind from public;

grant usage on type public.transaction_kind to authenticated;

alter table public.transactions
  add column kind public.transaction_kind not null default 'payment';

alter table public.transactions
  alter column kind drop default;

grant insert (kind) on public.transactions to authenticated;

create view public.account_income_expense
with (security_invoker = true) as
select
  a.id,
  a.ledger_id,
  coalesce(
    (
      select sum(t.amount)
      from public.transactions t
      where t.to_account_id = a.id
        and t.kind = 'accrual'
    ),
    0
  ) as income,
  coalesce(
    (
      select sum(t.amount)
      from public.transactions t
      where t.from_account_id = a.id
        and t.kind = 'accrual'
    ),
    0
  ) as expense
from public.accounts a;

revoke all on public.account_income_expense from anon, authenticated, service_role;

grant select on public.account_income_expense to authenticated;
