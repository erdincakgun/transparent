begin;
create extension if not exists pgtap;
select plan(16);

create function pg_temp.exec_as(claims text, statement text)
returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims', claims, true);
  execute 'set local role ' || quote_ident(coalesce(nullif(claims, ''), '{}')::jsonb ->> 'role');
  begin
    execute statement;
  exception when others then
    execute 'set local role postgres';
    return 'ERROR:' || sqlstate;
  end;
  execute 'set local role postgres';
  return 'OK';
end $$;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-4000-f000-000000000031', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'attr1@test.invalid', '', now(), now(), now(), '', '', '', ''),
       ('00000000-0000-4000-f000-000000000032', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'attr2@test.invalid', '', now(), now(), now(), '', '', '', '');

create function pg_temp.creator() returns text language sql immutable as
  $$ select '{"sub":"00000000-0000-4000-f000-000000000031","role":"authenticated","aal":"aal2"}' $$;
create function pg_temp.invitee() returns text language sql immutable as
  $$ select '{"sub":"00000000-0000-4000-f000-000000000032","role":"authenticated","aal":"aal2"}' $$;

-- creator opens a ledger; the after-insert trigger enrols them as a member
select is(pg_temp.exec_as(pg_temp.creator(),
          'insert into public.ledgers (id, name) values
           (''00000000-0000-4000-f000-00000000003a'', ''Attribution'')'),
          'OK', 'fixture: creator opens a ledger');

-- creator opens account A -- id is server-generated, so it isn't named here
select is(pg_temp.exec_as(pg_temp.creator(),
          'insert into public.accounts (ledger_id, name) values
           (''00000000-0000-4000-f000-00000000003a'', ''A'')'),
          'OK', 'fixture: creator opens account A');

-- creator invites the second member
select is(pg_temp.exec_as(pg_temp.creator(),
          'insert into public.ledgers_users (ledger_id, user_id) values
           (''00000000-0000-4000-f000-00000000003a'', ''00000000-0000-4000-f000-000000000032'')'),
          'OK', 'fixture: creator invites the second member');

-- the invitee, now a member, opens their own account
select is(pg_temp.exec_as(pg_temp.invitee(),
          'insert into public.accounts (ledger_id, name) values
           (''00000000-0000-4000-f000-00000000003a'', ''B'')'),
          'OK', 'fixture: the invitee opens account B once a member');

-- both actors record a transaction each, netting back to zero so the
-- account can be retired below
select is(pg_temp.exec_as(pg_temp.creator(),
          'insert into public.transactions (ledger_id, from_account_id, to_account_id, amount, description, kind)
           values (''00000000-0000-4000-f000-00000000003a'',
                   (select id from public.accounts where ledger_id = ''00000000-0000-4000-f000-00000000003a'' and name = ''A''),
                   (select id from public.accounts where ledger_id = ''00000000-0000-4000-f000-00000000003a'' and name = ''B''),
                   10, ''out'', ''accrual'')'),
          'OK', 'fixture: creator records a transaction');

select is(pg_temp.exec_as(pg_temp.invitee(),
          'insert into public.transactions (ledger_id, from_account_id, to_account_id, amount, description, kind)
           values (''00000000-0000-4000-f000-00000000003a'',
                   (select id from public.accounts where ledger_id = ''00000000-0000-4000-f000-00000000003a'' and name = ''B''),
                   (select id from public.accounts where ledger_id = ''00000000-0000-4000-f000-00000000003a'' and name = ''A''),
                   10, ''storno: back'', ''accrual'')'),
          'OK', 'fixture: the invitee records the storno, netting account A back to zero');

-- creator retires their now-settled account
select is(pg_temp.exec_as(pg_temp.creator(),
          'insert into public.deleted_accounts (account_id, ledger_id) values
           ((select id from public.accounts where ledger_id = ''00000000-0000-4000-f000-00000000003a'' and name = ''A''),
            ''00000000-0000-4000-f000-00000000003a'')'),
          'OK', 'fixture: creator retires account A once it is settled at zero');

-- ------------------------------------------------------- the assertions ----

select is((select created_by from public.ledgers
            where id = '00000000-0000-4000-f000-00000000003a'),
          '00000000-0000-4000-f000-000000000031'::uuid,
          'a ledger records the auth.uid() of whoever created it');

select is((select created_by from public.accounts
            where ledger_id = '00000000-0000-4000-f000-00000000003a' and name = 'A'),
          '00000000-0000-4000-f000-000000000031'::uuid,
          'account A was opened by the creator');

select is((select created_by from public.accounts
            where ledger_id = '00000000-0000-4000-f000-00000000003a' and name = 'B'),
          '00000000-0000-4000-f000-000000000032'::uuid,
          'account B was opened by the invitee -- attribution follows the actual actor');

select is((select added_by from public.ledgers_users
            where ledger_id = '00000000-0000-4000-f000-00000000003a'
              and user_id = '00000000-0000-4000-f000-000000000031'),
          '00000000-0000-4000-f000-000000000031'::uuid,
          'the after-insert trigger stamps added_by with the creator -- they added themselves');

select is((select added_by from public.ledgers_users
            where ledger_id = '00000000-0000-4000-f000-00000000003a'
              and user_id = '00000000-0000-4000-f000-000000000032'),
          '00000000-0000-4000-f000-000000000031'::uuid,
          'an invited member''s added_by is the inviter, distinct from user_id -- the invitee did not add themselves');

select is((select (added_at > now() - interval '1 minute') from public.ledgers_users
            where ledger_id = '00000000-0000-4000-f000-00000000003a'
              and user_id = '00000000-0000-4000-f000-000000000032'),
          true,
          'added_at is server-stamped at insert time');

select is((select created_by from public.transactions where description = 'out'),
          '00000000-0000-4000-f000-000000000031'::uuid,
          'the creator''s transaction is stamped with their own auth.uid()');

select is((select created_by from public.transactions where description = 'storno: back'),
          '00000000-0000-4000-f000-000000000032'::uuid,
          'the invitee''s transaction is stamped with theirs, not the ledger creator''s');

select is((select deleted_by from public.deleted_accounts
            where account_id = (select id from public.accounts
                                  where ledger_id = '00000000-0000-4000-f000-00000000003a' and name = 'A')),
          '00000000-0000-4000-f000-000000000031'::uuid,
          'the retiring member is recorded as deleted_by');

select * from finish();
rollback;
