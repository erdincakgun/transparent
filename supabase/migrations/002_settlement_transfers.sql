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
    payer.ledger_id,
    payer.account_id as from_account_id,
    payee.account_id as to_account_id,
    payer.balance as amount
  from balances payer
  join balances payee
    on payer.ledger_id = payee.ledger_id
    and payer.magnitude = payee.magnitude
    and payer.pair_rank = payee.pair_rank
  where payer.balance > 0
    and payee.balance < 0
    and payer.pair_rank <= payer.pair_count
),

remainder as (
  select
    ledger_id,
    account_id,
    balance
  from balances
  where pair_rank > pair_count
),

payers as (
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
),

payees as (
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
)

select
  ledger_id,
  from_account_id,
  to_account_id,
  amount
from pair_transfers

union all

select
  payers.ledger_id,
  payers.account_id as from_account_id,
  payees.account_id as to_account_id,
  least(payers.position_end, payees.position_end)
    - greatest(
        payers.position_end - payers.amount,
        payees.position_end - payees.amount
      ) as amount
from payers
join payees
  on payers.ledger_id = payees.ledger_id
  and payers.position_end - payers.amount < payees.position_end
  and payees.position_end - payees.amount < payers.position_end;

revoke all on public.settlement_transfers from anon, authenticated, service_role;

grant select on public.settlement_transfers to authenticated;
