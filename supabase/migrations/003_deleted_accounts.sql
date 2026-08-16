create table public.deleted_accounts (
  account_id uuid primary key,
  ledger_id uuid not null,
  deleted_at timestamptz not null default now(),

  foreign key (account_id, ledger_id)
    references public.accounts (id, ledger_id)
);

create index deleted_accounts_ledger_id_index
  on public.deleted_accounts (ledger_id);

create function private.reject_unsettled_account_deletion()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  perform 1
  from public.accounts
  where id = new.account_id
  for update;

  if (
    select balance
    from public.account_balances
    where id = new.account_id
  ) <> 0 then
    raise exception 'account % has a balance', new.account_id
      using errcode = 'restrict_violation';
  end if;

  return new;
end;
$$;

revoke all on function private.reject_unsettled_account_deletion() from public;

create function private.reject_deleted_account_transaction()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  perform 1
  from public.accounts
  where id in (new.from_account_id, new.to_account_id)
  for share;

  if exists (
    select 1
    from public.deleted_accounts
    where account_id in (new.from_account_id, new.to_account_id)
  ) then
    raise exception 'account % or % is deleted',
      new.from_account_id, new.to_account_id
      using errcode = 'restrict_violation';
  end if;

  return new;
end;
$$;

revoke all on function private.reject_deleted_account_transaction() from public;

create trigger deleted_accounts_reject_unsettled
  before insert on public.deleted_accounts
  for each row
  execute function private.reject_unsettled_account_deletion();

create trigger deleted_accounts_reject_update_delete
  before update or delete on public.deleted_accounts
  for each row
  execute function private.reject_statement();

create trigger deleted_accounts_reject_truncate
  before truncate on public.deleted_accounts
  for each statement
  execute function private.reject_statement();

create trigger transactions_reject_deleted_account
  before insert on public.transactions
  for each row
  execute function private.reject_deleted_account_transaction();

alter table public.deleted_accounts enable row level security;
alter table public.deleted_accounts force row level security;

create policy deleted_accounts_select_member
  on public.deleted_accounts
  for select
  to authenticated
  using (private.is_ledger_member(ledger_id));

create policy deleted_accounts_insert_member
  on public.deleted_accounts
  for insert
  to authenticated
  with check (private.is_ledger_member(ledger_id));

revoke all on public.deleted_accounts from anon, authenticated, service_role;

grant select on public.deleted_accounts to authenticated;
grant insert (account_id, ledger_id) on public.deleted_accounts to authenticated;
