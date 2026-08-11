create view public.settlement_transfers
with (security_invoker = true) as
with balances as (
  select
    ledger_id,
    id as account_id,
    balance,
    abs(balance) as magnitude,
    row_number() over (
      partition by ledger_id, abs(balance), balance > 0
      order by id
    ) as pair_rank,
    least(
      count(*) filter (where balance > 0)
        over (partition by ledger_id, abs(balance)),
      count(*) filter (where balance < 0)
        over (partition by ledger_id, abs(balance))
    ) as pair_count
  from public.account_balances
  where balance <> 0
),

pair_transfers as (
  select
    debtor.ledger_id,
    debtor.account_id as from_account_id,
    creditor.account_id as to_account_id,
    creditor.balance as amount
  from balances debtor
  join balances creditor
    on debtor.ledger_id = creditor.ledger_id
    and debtor.magnitude = creditor.magnitude
    and debtor.pair_rank = creditor.pair_rank
  where debtor.balance < 0
    and creditor.balance > 0
    and debtor.pair_rank <= debtor.pair_count
),

remainder as (
  select
    ledger_id,
    account_id,
    balance
  from balances
  where pair_rank > pair_count
),

debtors as (
  select
    ledger_id,
    account_id,
    -balance as amount,
    sum(-balance) over (
      partition by ledger_id
      order by balance, account_id
      rows between unbounded preceding and current row
    ) as position_end
  from remainder
  where balance < 0
),

creditors as (
  select
    ledger_id,
    account_id,
    balance as amount,
    sum(balance) over (
      partition by ledger_id
      order by balance desc, account_id
      rows between unbounded preceding and current row
    ) as position_end
  from remainder
  where balance > 0
)

select
  ledger_id,
  from_account_id,
  to_account_id,
  amount
from pair_transfers

union all

select
  debtors.ledger_id,
  debtors.account_id as from_account_id,
  creditors.account_id as to_account_id,
  least(debtors.position_end, creditors.position_end)
    - greatest(
        debtors.position_end - debtors.amount,
        creditors.position_end - creditors.amount
      ) as amount
from debtors
join creditors
  on debtors.ledger_id = creditors.ledger_id
  and debtors.position_end - debtors.amount < creditors.position_end
  and creditors.position_end - creditors.amount < debtors.position_end;

revoke all on public.settlement_transfers from anon, authenticated, service_role;

grant select on public.settlement_transfers to authenticated;
