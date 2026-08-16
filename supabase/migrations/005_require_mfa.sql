create function private.is_mfa_verified()
returns boolean
language sql
stable
set search_path to ''
as $$
  select coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2';
$$;

revoke all on function private.is_mfa_verified() from public;
grant execute on function private.is_mfa_verified() to authenticated;

alter policy ledgers_select_member
  on public.ledgers
  using (private.is_mfa_verified() and private.is_ledger_member(id));

alter policy ledgers_insert_authenticated
  on public.ledgers
  with check (private.is_mfa_verified());

alter policy ledgers_users_select_member
  on public.ledgers_users
  using (private.is_mfa_verified() and private.is_ledger_member(ledger_id));

alter policy ledgers_users_insert_member
  on public.ledgers_users
  with check (private.is_mfa_verified() and private.is_ledger_member(ledger_id));

alter policy ledgers_users_delete_member
  on public.ledgers_users
  using (private.is_mfa_verified() and private.is_ledger_member(ledger_id));

alter policy accounts_select_member
  on public.accounts
  using (private.is_mfa_verified() and private.is_ledger_member(ledger_id));

alter policy accounts_insert_member
  on public.accounts
  with check (private.is_mfa_verified() and private.is_ledger_member(ledger_id));

alter policy transactions_select_member
  on public.transactions
  using (private.is_mfa_verified() and private.is_ledger_member(ledger_id));

alter policy transactions_insert_member
  on public.transactions
  with check (private.is_mfa_verified() and private.is_ledger_member(ledger_id));

alter policy deleted_accounts_select_member
  on public.deleted_accounts
  using (private.is_mfa_verified() and private.is_ledger_member(ledger_id));

alter policy deleted_accounts_insert_member
  on public.deleted_accounts
  with check (private.is_mfa_verified() and private.is_ledger_member(ledger_id));
