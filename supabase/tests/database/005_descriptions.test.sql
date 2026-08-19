-- Rewriting a description without overwriting one. The log holds every
-- description a row has carried, the newest wins, and clearing one is a
-- rewrite to null rather than a resurrection of the original.

begin;
create extension if not exists pgtap;
select plan(39);

create function pg_temp.read_as(claims text, query text)
returns text language plpgsql as $$
declare result text;
begin
  perform set_config('request.jwt.claims', claims, true);
  execute 'set local role ' || quote_ident(coalesce(nullif(claims, ''), '{}')::jsonb ->> 'role');
  begin
    execute query into result;
  exception when others then
    result := 'ERROR:' || sqlstate;
  end;
  execute 'set local role postgres';
  return result;
end $$;

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

-- as the table owner: grants and RLS are out of the way, so only the trigger
-- can refuse
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
values ('00000000-0000-4000-f000-000000000041', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'desc@test.invalid', '', now(), now(), now(), '', '', '', ''),
       ('00000000-0000-4000-f000-000000000042', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'desc2@test.invalid', '', now(), now(), now(), '', '', '', '');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-f000-000000000041","role":"authenticated","aal":"aal2"}';

insert into public.ledgers (id, name, description) values
  ('00000000-0000-4000-f000-00000000004a', 'D1', 'the first word'),
  ('00000000-0000-4000-f000-00000000004b', 'D2', null);

-- 'Gone' has no transactions, so it sits at exactly zero and can be retired
insert into public.accounts (id, ledger_id, name, description) values
  ('00000000-0000-4000-f000-0000000000e1', '00000000-0000-4000-f000-00000000004a', 'A', 'as first written'),
  ('00000000-0000-4000-f000-0000000000e2', '00000000-0000-4000-f000-00000000004a', 'B', 'never rewritten'),
  ('00000000-0000-4000-f000-0000000000e3', '00000000-0000-4000-f000-00000000004a', 'Gone', 'died with this'),
  ('00000000-0000-4000-f000-0000000000f1', '00000000-0000-4000-f000-00000000004b', 'Other', null);

insert into public.deleted_accounts (account_id, ledger_id)
values ('00000000-0000-4000-f000-0000000000e3', '00000000-0000-4000-f000-00000000004a');

reset request.jwt.claims;

create function pg_temp.member() returns text language sql immutable as
  $$ select '{"sub":"00000000-0000-4000-f000-000000000041","role":"authenticated","aal":"aal2"}' $$;
create function pg_temp.member_aal1() returns text language sql immutable as
  $$ select '{"sub":"00000000-0000-4000-f000-000000000041","role":"authenticated","aal":"aal1"}' $$;
create function pg_temp.outsider() returns text language sql immutable as
  $$ select '{"sub":"00000000-0000-4000-f000-000000000042","role":"authenticated","aal":"aal2"}' $$;
create function pg_temp.anon() returns text language sql immutable as
  $$ select '{"role":"anon"}' $$;
create function pg_temp.svc() returns text language sql immutable as
  $$ select '{"role":"service_role"}' $$;

-- ------------------------------------------------------- the newest wins ----
-- Both rewrites below land inside this one transaction and therefore share a
-- `now()`. The identity key is what still orders them; a uuid would have left
-- "which is current" to a coin toss.

select is(pg_temp.exec_as(pg_temp.member(),
          'insert into public.ledger_descriptions (ledger_id, description) values
           (''00000000-0000-4000-f000-00000000004a'', ''a second word'')'),
          'OK', 'a member rewrites a ledger description by inserting');

select is((select description from public.active_ledgers
            where id = '00000000-0000-4000-f000-00000000004a'),
          'a second word', 'active_ledgers reads the rewrite, not the original');

select is((select description from public.ledgers
            where id = '00000000-0000-4000-f000-00000000004a'),
          'the first word', 'the original is untouched on the base row -- nothing was overwritten');

select is(pg_temp.exec_as(pg_temp.member(),
          'insert into public.ledger_descriptions (ledger_id, description) values
           (''00000000-0000-4000-f000-00000000004a'', ''a third word'')'),
          'OK', 'a description can be rewritten again');

select is((select description from public.active_ledgers
            where id = '00000000-0000-4000-f000-00000000004a'),
          'a third word', 'the last rewrite wins even when both share a timestamp');

select is((select count(*)::text from public.ledger_descriptions
            where ledger_id = '00000000-0000-4000-f000-00000000004a'),
          '2', 'both rewrites are still in the log');

select is((select description from public.active_ledgers
            where id = '00000000-0000-4000-f000-00000000004b'),
          null::text, 'a ledger never rewritten still reads its own description');

-- --------------------------------------------------------------- accounts ----

select is(pg_temp.exec_as(pg_temp.member(),
          'insert into public.account_descriptions (account_id, ledger_id, description) values
           (''00000000-0000-4000-f000-0000000000e1'', ''00000000-0000-4000-f000-00000000004a'', ''as rewritten'')'),
          'OK', 'an account description is rewritten the same way');

select is((select description from public.active_accounts
            where id = '00000000-0000-4000-f000-0000000000e1'),
          'as rewritten', 'active_accounts reads the rewrite');

select is((select description from public.accounts
            where id = '00000000-0000-4000-f000-0000000000e1'),
          'as first written', 'the account keeps the description it was opened with');

select is((select description from public.active_accounts
            where id = '00000000-0000-4000-f000-0000000000e2'),
          'never rewritten', 'an account never rewritten reads its own description');

-- ------------------------------------------------------ clearing it away ----

select is(pg_temp.exec_as(pg_temp.member(),
          'insert into public.account_descriptions (account_id, ledger_id, description) values
           (''00000000-0000-4000-f000-0000000000e1'', ''00000000-0000-4000-f000-00000000004a'', null)'),
          'OK', 'a rewrite to null clears the description, as omitting it at creation does');

select is((select description from public.active_accounts
            where id = '00000000-0000-4000-f000-0000000000e1'),
          null::text,
          'the cleared description stays cleared -- the original is not resurrected in its place');

select is((select count(*)::text from public.account_descriptions
            where account_id = '00000000-0000-4000-f000-0000000000e1'),
          '2', 'clearing is an entry in the log like any other');

-- ------------------------------------------------------- what is refused ----

select is(pg_temp.exec_as(pg_temp.member(),
          'insert into public.account_descriptions (account_id, ledger_id, description) values
           (''00000000-0000-4000-f000-0000000000e3'', ''00000000-0000-4000-f000-00000000004a'', ''second thoughts'')'),
          'ERROR:23001', 'a retired account keeps the description it died with');

select is(pg_temp.exec_as(pg_temp.member(),
          'insert into public.account_descriptions (account_id, ledger_id, description) values
           (''00000000-0000-4000-f000-0000000000e1'', ''00000000-0000-4000-f000-00000000004b'', ''wrong ledger'')'),
          'ERROR:23503',
          'a description cannot be filed against another ledger -- the same composite FK transactions use');

select is(pg_temp.exec_as(pg_temp.member(),
          'insert into public.ledger_descriptions (ledger_id, description) values
           (''00000000-0000-4000-f000-00000000004a'', '''')'),
          'ERROR:23514', 'a blank description is refused, as it is on the base tables');

select is(pg_temp.exec_as(pg_temp.member(),
          'insert into public.ledger_descriptions (ledger_id, description) values
           (''00000000-0000-4000-f000-00000000004a'', repeat(''x'', 1001))'),
          'ERROR:23514', 'and one over 1000 characters');

-- ------------------------------- server-generated columns are not insertable ----

select is(pg_temp.exec_as(pg_temp.member(),
          'insert into public.ledger_descriptions (ledger_id, description, created_by) values
           (''00000000-0000-4000-f000-00000000004a'', ''spoofed'',
            ''00000000-0000-4000-f000-000000000042'')'),
          'ERROR:42501', 'created_by is absent from the ledger_descriptions insert grant');

select is(pg_temp.exec_as(pg_temp.member(),
          'insert into public.account_descriptions (account_id, ledger_id, description, created_by) values
           (''00000000-0000-4000-f000-0000000000e1'', ''00000000-0000-4000-f000-00000000004a'', ''spoofed'',
            ''00000000-0000-4000-f000-000000000042'')'),
          'ERROR:42501', 'created_by is absent from the account_descriptions insert grant');

select is(pg_temp.exec_as(pg_temp.member(),
          'insert into public.ledger_descriptions (ledger_id, description, created_at) values
           (''00000000-0000-4000-f000-00000000004a'', ''backdated'', now())'),
          'ERROR:42501', 'created_at is absent from the insert grant');

select is(pg_temp.exec_owner(
          'insert into public.ledger_descriptions (id, ledger_id, description) values
           (1, ''00000000-0000-4000-f000-00000000004a'', ''forged order'')'),
          'ERROR:428C9',
          'the identity key refuses a supplied value even for the owner -- order is the sequence''s to decide');

-- ----------------------------------- append-only: no grant for authenticated ----

select is(pg_temp.exec_as(pg_temp.member(), 'update public.ledger_descriptions set description = ''x'''),
          'ERROR:42501', 'authenticated holds no UPDATE grant on ledger_descriptions');
select is(pg_temp.exec_as(pg_temp.member(), 'delete from public.ledger_descriptions'),
          'ERROR:42501', 'authenticated holds no DELETE grant on ledger_descriptions');
select is(pg_temp.exec_as(pg_temp.member(), 'update public.account_descriptions set description = ''x'''),
          'ERROR:42501', 'authenticated holds no UPDATE grant on account_descriptions');
select is(pg_temp.exec_as(pg_temp.member(), 'delete from public.account_descriptions'),
          'ERROR:42501', 'authenticated holds no DELETE grant on account_descriptions');

-- ------------------------------ append-only: the trigger refuses the owner ----

select is(pg_temp.exec_owner('update public.ledger_descriptions set description = ''x'''),
          'ERROR:23001', 'the trigger refuses UPDATE on ledger_descriptions -- a rewrite is a new row');
select is(pg_temp.exec_owner('delete from public.ledger_descriptions'),
          'ERROR:23001', 'the trigger refuses DELETE on ledger_descriptions');
select is(pg_temp.exec_owner('update public.account_descriptions set description = ''x'''),
          'ERROR:23001', 'the trigger refuses UPDATE on account_descriptions');
select is(pg_temp.exec_owner('delete from public.account_descriptions'),
          'ERROR:23001', 'the trigger refuses DELETE on account_descriptions');
select is(pg_temp.exec_owner('truncate public.ledger_descriptions'),
          'ERROR:23001', 'TRUNCATE is blocked on ledger_descriptions');
select is(pg_temp.exec_owner('truncate public.account_descriptions'),
          'ERROR:23001', 'TRUNCATE is blocked on account_descriptions');

-- --------------------------------------------------------- who may read ----

select is(pg_temp.read_as(pg_temp.anon(), 'select count(*) from public.ledger_descriptions'),
          'ERROR:42501', 'anon is refused ledger_descriptions outright');

select is(pg_temp.read_as(pg_temp.svc(), 'select count(*) from public.account_descriptions'),
          'ERROR:42501', 'service_role has no grant on account_descriptions either');

select is(pg_temp.read_as(pg_temp.outsider(), 'select count(*) from public.ledger_descriptions'),
          '0', 'a non-member reads no ledger descriptions');

select is(pg_temp.read_as(pg_temp.outsider(), 'select count(*) from public.account_descriptions'),
          '0', 'nor any account descriptions');

select is(pg_temp.exec_as(pg_temp.outsider(),
          'insert into public.ledger_descriptions (ledger_id, description) values
           (''00000000-0000-4000-f000-00000000004a'', ''not yours'')'),
          'ERROR:42501', 'a non-member cannot rewrite a description either');

select is(pg_temp.read_as(pg_temp.member_aal1(), 'select count(*) from public.ledger_descriptions'),
          '0', 'aal1 reads zero -- MFA gates the log like every other table');

select is(pg_temp.exec_as(pg_temp.member_aal1(),
          'insert into public.account_descriptions (account_id, ledger_id, description) values
           (''00000000-0000-4000-f000-0000000000e1'', ''00000000-0000-4000-f000-00000000004a'', ''unchallenged'')'),
          'ERROR:42501', 'and cannot write one');

select * from finish();

rollback;
