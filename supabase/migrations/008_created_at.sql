alter table public.ledgers
  add column created_at timestamptz not null default now();

alter table public.accounts
  add column created_at timestamptz not null default now();

create or replace view public.active_accounts
with (security_invoker = true) as
select
  a.id,
  a.ledger_id,
  a.name,
  a.description,
  a.created_by,
  a.created_at
from public.accounts a
where not exists (
  select 1
  from public.deleted_accounts d
  where d.account_id = a.id
);

revoke all on public.active_accounts from anon, authenticated, service_role;

grant select on public.active_accounts to authenticated;
