alter table public.ledgers add column created_by uuid not null default auth.uid () references auth.users (id);
alter table public.ledgers_users add column added_by uuid not null default auth.uid () references auth.users (id);
alter table public.ledgers_users add column added_at timestamptz not null default now ();
alter table public.accounts add column created_by uuid not null default auth.uid () references auth.users (id);
alter table public.transactions add column created_by uuid not null default auth.uid () references auth.users (id);
alter table public.deleted_accounts add column deleted_by uuid not null default auth.uid () references auth.users (id);

create or replace view public.active_accounts
with
  (security_invoker = true) as
select
  a.id,
  a.ledger_id,
  a.name,
  a.description,
  a.created_by
from
  public.accounts a
where
  not exists (
    select
      1
    from
      public.deleted_accounts d
    where
      d.account_id = a.id
  );

revoke all on public.active_accounts from anon, authenticated, service_role;
grant select on public.active_accounts to authenticated;