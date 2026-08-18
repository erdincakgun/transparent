create function private.reject_last_member_removal()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if not exists (
    select 1
    from public.ledgers_users
    where ledger_id = old.ledger_id
      and user_id <> old.user_id
  ) then
    raise exception 'ledger % must keep at least one member', old.ledger_id
      using errcode = 'restrict_violation';
  end if;

  return old;
end;
$$;

revoke all on function private.reject_last_member_removal() from public;

create trigger ledgers_users_reject_last_member
  before delete on public.ledgers_users
  for each row
  execute function private.reject_last_member_removal();
