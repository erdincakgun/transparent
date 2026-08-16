-- Who can read what. These are the properties that must survive every future
-- change to the policies; if one of them starts failing, the change is wrong.
--
--   npx supabase test db
--
-- Each file builds its own fixture and rolls back, so tests do not depend on
-- seed.sql and do not depend on each other.

begin;
create extension if not exists pgtap;
select plan(16);

-- ------------------------------------------------------------- helpers ----
-- Assertions run as `postgres`; only the query under test runs as the
-- impersonated user. Both helpers return a value or 'ERROR:<sqlstate>' so a
-- refusal is an assertable outcome rather than an aborted test run.

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

-- ------------------------------------------------------------- fixture ----

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-4000-f000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'member@test.invalid', '', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-4000-f000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'outsider@test.invalid', '', now(), now(), now(), '', '', '', '');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-f000-000000000001","role":"authenticated","aal":"aal2"}';

insert into public.ledgers (id, name) values ('00000000-0000-4000-f000-00000000000a', 'Fixture');
insert into public.accounts (id, ledger_id, name) values
  ('00000000-0000-4000-f000-0000000000a1', '00000000-0000-4000-f000-00000000000a', 'A'),
  ('00000000-0000-4000-f000-0000000000a2', '00000000-0000-4000-f000-00000000000a', 'B');
insert into public.transactions (ledger_id, from_account_id, to_account_id, amount, description)
values ('00000000-0000-4000-f000-00000000000a', '00000000-0000-4000-f000-0000000000a1',
        '00000000-0000-4000-f000-0000000000a2', 10, 'fixture');

reset request.jwt.claims;

-- ------------------------------------------------------------ constants ----

create function pg_temp.member()   returns text language sql immutable as
  $$ select '{"sub":"00000000-0000-4000-f000-000000000001","role":"authenticated","aal":"aal2"}' $$;
create function pg_temp.member_aal1() returns text language sql immutable as
  $$ select '{"sub":"00000000-0000-4000-f000-000000000001","role":"authenticated","aal":"aal1"}' $$;
create function pg_temp.outsider() returns text language sql immutable as
  $$ select '{"sub":"00000000-0000-4000-f000-000000000002","role":"authenticated","aal":"aal2"}' $$;
create function pg_temp.anon()     returns text language sql immutable as
  $$ select '{"role":"anon"}' $$;
create function pg_temp.svc()      returns text language sql immutable as
  $$ select '{"role":"service_role"}' $$;

-- ------------------------------------------------- anon reaches nothing ----

select is(pg_temp.read_as(pg_temp.anon(), 'select count(*) from public.ledgers'),
          'ERROR:42501', 'anon is refused ledgers outright, not merely filtered');

select is(pg_temp.read_as(pg_temp.anon(), 'select count(*) from public.transactions'),
          'ERROR:42501', 'anon is refused transactions outright');

-- ------------------------------- a leaked service key is worth nothing ----

select is(pg_temp.read_as(pg_temp.svc(), 'select count(*) from public.ledgers'),
          'ERROR:42501', 'service_role has no grant on ledgers, so BYPASSRLS has nothing to bypass');

select is(pg_temp.read_as(pg_temp.svc(), 'select count(*) from public.transactions'),
          'ERROR:42501', 'service_role cannot read transactions');

select is(pg_temp.exec_as(pg_temp.svc(),
          'insert into public.transactions (ledger_id, from_account_id, to_account_id, amount, description)
           values (''00000000-0000-4000-f000-00000000000a'', ''00000000-0000-4000-f000-0000000000a1'',
                   ''00000000-0000-4000-f000-0000000000a2'', 1, ''x'')'),
          'ERROR:42501', 'service_role cannot write transactions either');

-- ------------------------------------ signed in but not MFA-challenged ----

select is(pg_temp.read_as(pg_temp.member_aal1(), 'select count(*) from public.ledgers'),
          '0', 'aal1 member reads zero ledgers -- MFA is enforced in Postgres, not in React');

select is(pg_temp.read_as(pg_temp.member_aal1(), 'select count(*) from public.transactions'),
          '0', 'aal1 member reads zero transactions');

select is(pg_temp.read_as(pg_temp.member_aal1(), 'select count(*) from public.account_balances'),
          '0', 'aal1 member reads zero balances');

select is(pg_temp.exec_as(pg_temp.member_aal1(),
          'insert into public.ledgers (id, name) values (gen_random_uuid(), ''nope'')'),
          'ERROR:42501', 'aal1 cannot create even a first ledger');

-- ------------------------------------------------- cross-tenant reads ----

select is(pg_temp.read_as(pg_temp.outsider(), 'select count(*) from public.ledgers'),
          '0', 'a non-member at full aal2 sees no ledgers');

select is(pg_temp.read_as(pg_temp.outsider(), 'select count(*) from public.transactions'),
          '0', 'a non-member sees no transactions');

select is(pg_temp.read_as(pg_temp.outsider(), 'select count(*) from public.account_balances'),
          '0', 'the account_balances view inherits RLS');

select is(pg_temp.read_as(pg_temp.outsider(), 'select count(*) from public.settlement_transfers'),
          '0', 'the settlement_transfers view inherits RLS');

select is(pg_temp.read_as(pg_temp.outsider(), 'select count(*) from public.active_accounts'),
          '0', 'the active_accounts view inherits RLS');

-- --------------------------------------------------- the member can read ----

select is(pg_temp.read_as(pg_temp.member(), 'select count(*) from public.ledgers'),
          '1', 'the member sees exactly their own ledger');

-- ------------------------------------------------------ no claims at all ----

select is(pg_temp.read_as('{"role":"authenticated"}', 'select count(*) from public.ledgers'),
          '0', 'a token carrying no aal claim fails closed');

select * from finish();
rollback;
