-- Append-only is defended twice: `authenticated` has no UPDATE/DELETE grant at
-- all, and a trigger raises restrict_violation even for a role that does. Both
-- layers are asserted separately, because losing one silently would leave the
-- other looking like it still works.

begin;
create extension if not exists pgtap;
select plan(29);

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

-- as the table owner: RLS and grants are out of the way, so only the trigger
-- can refuse. This is the layer that survives a mis-granted role.
create function pg_temp.exec_owner(statement text)
returns text language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    return 'ERROR:' || sqlstate;
  end;
  return 'OK';
end $$;

-- ------------------------------------------------------------- fixture ----

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-4000-f000-000000000011', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'ao@test.invalid', '', now(), now(), now(), '', '', '', ''),
       ('00000000-0000-4000-f000-000000000012', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'ao2@test.invalid', '', now(), now(), now(), '', '', '', '');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-f000-000000000011","role":"authenticated","aal":"aal2"}';

insert into public.ledgers (id, name) values ('00000000-0000-4000-f000-00000000001a', 'AO');
insert into public.ledgers_users (ledger_id, user_id)
values ('00000000-0000-4000-f000-00000000001a', '00000000-0000-4000-f000-000000000012');
insert into public.accounts (id, ledger_id, name) values
  ('00000000-0000-4000-f000-0000000000b1', '00000000-0000-4000-f000-00000000001a', 'A'),
  ('00000000-0000-4000-f000-0000000000b2', '00000000-0000-4000-f000-00000000001a', 'B'),
  ('00000000-0000-4000-f000-0000000000b3', '00000000-0000-4000-f000-00000000001a', 'Gone');
insert into public.transactions (ledger_id, from_account_id, to_account_id, amount, description, kind)
values ('00000000-0000-4000-f000-00000000001a', '00000000-0000-4000-f000-0000000000b1',
        '00000000-0000-4000-f000-0000000000b2', 10, 'fixture', 'accrual');
insert into public.deleted_accounts (account_id, ledger_id)
values ('00000000-0000-4000-f000-0000000000b3', '00000000-0000-4000-f000-00000000001a');

reset request.jwt.claims;

create function pg_temp.member() returns text language sql immutable as
  $$ select '{"sub":"00000000-0000-4000-f000-000000000011","role":"authenticated","aal":"aal2"}' $$;

-- ----------------------------------- layer 1: no grant for authenticated ----

select is(pg_temp.exec_as(pg_temp.member(), 'update public.ledgers set name = ''x'''),
          'ERROR:42501', 'authenticated holds no UPDATE grant on ledgers');
select is(pg_temp.exec_as(pg_temp.member(), 'delete from public.ledgers'),
          'ERROR:42501', 'authenticated holds no DELETE grant on ledgers');
select is(pg_temp.exec_as(pg_temp.member(), 'update public.accounts set name = ''x'''),
          'ERROR:42501', 'authenticated holds no UPDATE grant on accounts');
select is(pg_temp.exec_as(pg_temp.member(), 'delete from public.accounts'),
          'ERROR:42501', 'authenticated holds no DELETE grant on accounts');
select is(pg_temp.exec_as(pg_temp.member(), 'update public.transactions set amount = 1'),
          'ERROR:42501', 'authenticated holds no UPDATE grant on transactions');
select is(pg_temp.exec_as(pg_temp.member(), 'delete from public.transactions'),
          'ERROR:42501', 'authenticated holds no DELETE grant on transactions');
select is(pg_temp.exec_as(pg_temp.member(), 'update public.deleted_accounts set deleted_at = now()'),
          'ERROR:42501', 'authenticated holds no UPDATE grant on deleted_accounts');
select is(pg_temp.exec_as(pg_temp.member(), 'delete from public.deleted_accounts'),
          'ERROR:42501', 'authenticated holds no DELETE grant on deleted_accounts');

-- ---------------------------- layer 2: the trigger refuses the owner too ----

select is(pg_temp.exec_owner('update public.ledgers set name = ''x'''),
          'ERROR:23001', 'the trigger refuses UPDATE on ledgers even for the owner');
select is(pg_temp.exec_owner('delete from public.ledgers'),
          'ERROR:23001', 'the trigger refuses DELETE on ledgers even for the owner');
select is(pg_temp.exec_owner('update public.accounts set name = ''x'''),
          'ERROR:23001', 'the trigger refuses UPDATE on accounts');
select is(pg_temp.exec_owner('delete from public.accounts'),
          'ERROR:23001', 'the trigger refuses DELETE on accounts');
select is(pg_temp.exec_owner('update public.transactions set amount = 1'),
          'ERROR:23001', 'the trigger refuses UPDATE on transactions -- corrections are a storno');
select is(pg_temp.exec_owner('delete from public.transactions'),
          'ERROR:23001', 'the trigger refuses DELETE on transactions');
select is(pg_temp.exec_owner('update public.deleted_accounts set deleted_at = now()'),
          'ERROR:23001', 'the trigger refuses UPDATE on deleted_accounts');
select is(pg_temp.exec_owner('delete from public.deleted_accounts'),
          'ERROR:23001', 'deletion is final -- there is no undelete');
select is(pg_temp.exec_owner('update public.ledgers_users set user_id = gen_random_uuid()'),
          'ERROR:23001', 'the trigger refuses UPDATE on ledgers_users');

-- ---------------------------------------------------- truncate is blocked ----

select is(pg_temp.exec_owner('truncate public.transactions cascade'),
          'ERROR:23001', 'TRUNCATE is blocked on transactions');
select is(pg_temp.exec_owner('truncate public.ledgers_users'),
          'ERROR:23001', 'TRUNCATE is blocked on ledgers_users');

-- -------------------------------------------- the one permitted mutation ----

select is(pg_temp.exec_as(pg_temp.member(),
          'delete from public.ledgers_users
            where ledger_id = ''00000000-0000-4000-f000-00000000001a''
              and user_id = ''00000000-0000-4000-f000-000000000012'''),
          'OK', 'removing a member is the only DELETE the schema permits');

-- ------------------------------- server-generated columns are not insertable ----

select is(pg_temp.exec_as(pg_temp.member(),
          'insert into public.transactions (id, ledger_id, from_account_id, to_account_id, amount, description, kind)
           values (gen_random_uuid(), ''00000000-0000-4000-f000-00000000001a'',
                   ''00000000-0000-4000-f000-0000000000b1'', ''00000000-0000-4000-f000-0000000000b2'', 1, ''x'', ''accrual'')'),
          'ERROR:42501',
          'column-level grants reject a client-supplied id -- the mechanism that will protect created_by');

-- ------------------------- the new actor columns are not insertable either ----

select is(pg_temp.exec_as(pg_temp.member(),
          'insert into public.ledgers (id, name, created_by)
           values (gen_random_uuid(), ''spoofed'', ''00000000-0000-4000-f000-000000000012'')'),
          'ERROR:42501', 'created_by is absent from the ledgers insert grant');

select is(pg_temp.exec_as(pg_temp.member(),
          'insert into public.accounts (ledger_id, name, created_by)
           values (''00000000-0000-4000-f000-00000000001a'', ''Spoofed'',
                   ''00000000-0000-4000-f000-000000000012'')'),
          'ERROR:42501', 'created_by is absent from the accounts insert grant');

select is(pg_temp.exec_as(pg_temp.member(),
          'insert into public.transactions (ledger_id, from_account_id, to_account_id, amount, description, kind, created_by)
           values (''00000000-0000-4000-f000-00000000001a'', ''00000000-0000-4000-f000-0000000000b1'',
                   ''00000000-0000-4000-f000-0000000000b2'', 1, ''x'', ''accrual'',
                   ''00000000-0000-4000-f000-000000000012'')'),
          'ERROR:42501', 'created_by is absent from the transactions insert grant');

select is(pg_temp.exec_as(pg_temp.member(),
          'insert into public.deleted_accounts (account_id, ledger_id, deleted_by)
           values (''00000000-0000-4000-f000-0000000000b1'', ''00000000-0000-4000-f000-00000000001a'',
                   ''00000000-0000-4000-f000-000000000012'')'),
          'ERROR:42501', 'deleted_by is absent from the deleted_accounts insert grant');

select is(pg_temp.exec_as(pg_temp.member(),
          'insert into public.ledgers_users (ledger_id, user_id, added_by)
           values (''00000000-0000-4000-f000-00000000001a'', ''00000000-0000-4000-f000-000000000098'',
                   ''00000000-0000-4000-f000-000000000012'')'),
          'ERROR:42501', 'added_by is absent from the ledgers_users insert grant');

select is(pg_temp.exec_as(pg_temp.member(),
          'insert into public.ledgers_users (ledger_id, user_id, added_at)
           values (''00000000-0000-4000-f000-00000000001a'', ''00000000-0000-4000-f000-000000000099'', now())'),
          'ERROR:42501', 'added_at is absent from the ledgers_users insert grant');

select is(pg_temp.exec_as(pg_temp.member(),
          'insert into public.ledgers (id, name, created_at)
           values (gen_random_uuid(), ''x'', now())'),
          'ERROR:42501', 'created_at is absent from the ledgers insert grant');

select is(pg_temp.exec_as(pg_temp.member(),
          'insert into public.accounts (ledger_id, name, created_at)
           values (''00000000-0000-4000-f000-00000000001a'', ''ts'', now())'),
          'ERROR:42501', 'created_at is absent from the accounts insert grant');

select * from finish();

rollback;
