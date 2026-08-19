-- A transaction is one of two economic events, and the difference is not
-- visible in the numbers: an *accrual* is value actually changing hands --
-- someone covered a cost for someone else -- while a *payment* only settles a
-- balance an earlier accrual created. Both move money, so both belong in
-- account_balances exactly as before; only the accruals are income or expense.

create type public.transaction_kind as enum ('accrual', 'payment');

revoke usage on type public.transaction_kind from public;

grant usage on type public.transaction_kind to authenticated;

-- The default is here to answer for the rows that predate the column -- every
-- one of them settled something, so every one of them is a payment -- and is
-- dropped again immediately. Nothing written from here on may leave the kind
-- unsaid: an insert that omits it raises not_null_violation (23502) rather
-- than being filed as a payment by inattention.

alter table public.transactions
  add column kind public.transaction_kind not null default 'payment';

alter table public.transactions
  alter column kind drop default;

grant insert (kind) on public.transactions to authenticated;

-- Deliberately *not* touched: public.account_balances still sums every
-- transaction whatever its kind, so a ledger still sums to zero. A payment
-- cancels the balance its accrual created; excluding it there would break the
-- one invariant the whole app rests on.

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
