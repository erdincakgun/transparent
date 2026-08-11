create view public.account_balance
with (security_invoker = true) as
select
  a.id,
  a.ledger_id,
  coalesce(
    (
      select sum(t.amount)
      from public.transactions t
      where t.to_account_id = a.id
    ),
    0
  )
  - coalesce(
    (
      select sum(t.amount)
      from public.transactions t
      where t.from_account_id = a.id
    ),
    0
  ) as balance
from public.accounts a;

revoke all on public.account_balance from anon, authenticated, service_role;

grant select on public.account_balance to authenticated;
