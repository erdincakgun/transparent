-- A ledger with no members is unreachable. Every policy resolves membership
-- through `private.is_ledger_member`, so the rows survive but nothing can read
-- them -- and `ledgers_users_insert_member` needs a membership that no longer
-- exists to put one back. Nothing the app offers can repair it; only an
-- operator connecting as `postgres` (which carries `bypassrls`) can insert the
-- row that makes the ledger visible again.
--
-- `delete` on `ledgers_users` stays the schema's one permitted mutation. This
-- refuses exactly the delete that would empty a ledger, and nothing else.
--
-- The check runs per row, so it also catches an unfiltered
-- `delete from ledgers_users where ledger_id = …`: the earlier rows go first,
-- and the last one finds no sibling left and raises, which rolls the whole
-- statement back.

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
