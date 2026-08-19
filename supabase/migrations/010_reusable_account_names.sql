drop index public.accounts_ledger_id_name_unique;

create index accounts_ledger_id_name_index
  on public.accounts (ledger_id, lower(name));

create function private.reject_duplicate_active_account_name()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  perform pg_advisory_xact_lock(
    hashtext(new.ledger_id::text),
    hashtext(lower(new.name))
  );

  if exists (
    select 1
    from public.accounts a
    where a.ledger_id = new.ledger_id
      and lower(a.name) = lower(new.name)
      and not exists (
        select 1
        from public.deleted_accounts d
        where d.account_id = a.id
      )
  ) then
    raise exception 'ledger % already has an active account named %',
      new.ledger_id, new.name
      using errcode = 'unique_violation';
  end if;

  return new;
end;
$$;

revoke all on function private.reject_duplicate_active_account_name() from public;

create trigger accounts_reject_duplicate_active_name
  before insert on public.accounts
  for each row
  execute function private.reject_duplicate_active_account_name();
