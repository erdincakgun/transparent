-- What the kind column is for. A payment and an accrual move money the same
-- way, so account_balances must not tell them apart -- and account_income_expense
-- must. The two properties are asserted against one fixture, because the whole
-- point is that the same rows read differently through the two views.

begin;
create extension if not exists pgtap;
select plan(17);

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
values ('00000000-0000-4000-f000-000000000041', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'kinds@test.invalid', '', now(), now(), now(), '', '', '', '');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-f000-000000000041","role":"authenticated","aal":"aal2"}';

insert into public.ledgers (id, name) values ('00000000-0000-4000-f000-00000000004a', 'Kinds');
insert into public.accounts (id, ledger_id, name) values
  ('00000000-0000-4000-f000-0000000000e1', '00000000-0000-4000-f000-00000000004a', 'A'),
  ('00000000-0000-4000-f000-0000000000e2', '00000000-0000-4000-f000-00000000004a', 'B'),
  ('00000000-0000-4000-f000-0000000000e3', '00000000-0000-4000-f000-00000000004a', 'C');

reset request.jwt.claims;

create function pg_temp.owner() returns text language sql immutable as
  $$ select '{"sub":"00000000-0000-4000-f000-000000000041","role":"authenticated","aal":"aal2"}' $$;

create function pg_temp.record(from_account text, to_account text, amount text, kind text)
returns text language sql as $$
  select pg_temp.exec_as(pg_temp.owner(),
    'insert into public.transactions
       (ledger_id, from_account_id, to_account_id, amount, description, kind)
     values (''00000000-0000-4000-f000-00000000004a'',
             ''00000000-0000-4000-f000-0000000000' || from_account || ''',
             ''00000000-0000-4000-f000-0000000000' || to_account || ''',
             ' || amount || ', ''fixture'', ''' || kind || ''')');
$$;

-- A covers 100 for B, B pays it back, A covers 60 for C, and C hands 20 of it
-- straight back. Written through the grant, so these four also assert that
-- `kind` is insertable by a member at all.

select is(pg_temp.record('e1', 'e2', '100', 'accrual'), 'OK', 'a member records an accrual');
select is(pg_temp.record('e2', 'e1', '100', 'payment'), 'OK', 'and a payment');
select is(pg_temp.record('e1', 'e3',  '60', 'accrual'), 'OK', 'and a second accrual');
select is(pg_temp.record('e3', 'e1',  '20', 'accrual'), 'OK', 'and an accrual back the other way');

-- --------------------------------------- a payment is not income or expense ----

select is((select income from public.account_income_expense
            where id = '00000000-0000-4000-f000-0000000000e2'),
          100.0000::numeric,
          'B still shows the 100 it was covered for -- being paid back does not unmake it');

select is((select expense from public.account_income_expense
            where id = '00000000-0000-4000-f000-0000000000e2'),
          0::numeric,
          'and paying that 100 back is not an expense of B''s');

select is((select balance from public.account_balances
            where id = '00000000-0000-4000-f000-0000000000e2'),
          0.0000::numeric,
          'what the payment did settle is the balance -- account_balances counts both kinds');

-- ------------------------------------------- accruals aggregate per account ----

select is((select expense from public.account_income_expense
            where id = '00000000-0000-4000-f000-0000000000e1'),
          160.0000::numeric, 'expense is every accrual the account sat on the from side of');

select is((select income from public.account_income_expense
            where id = '00000000-0000-4000-f000-0000000000e1'),
          20.0000::numeric, 'income is every accrual it sat on the to side of');

select is((select income from public.account_income_expense
            where id = '00000000-0000-4000-f000-0000000000e3'),
          60.0000::numeric, 'C was covered 60');

select is((select expense from public.account_income_expense
            where id = '00000000-0000-4000-f000-0000000000e3'),
          20.0000::numeric, 'and covered 20 in its turn');

-- ------------------------------------------------------- the invariants ----

select is((select sum(balance) from public.account_balances
            where ledger_id = '00000000-0000-4000-f000-00000000004a'),
          0.0000::numeric,
          'a ledger still sums to zero with both kinds in it -- kind changed no arithmetic');

select is((select sum(income) - sum(expense) from public.account_income_expense
            where ledger_id = '00000000-0000-4000-f000-00000000004a'),
          0::numeric,
          'every accrual has two sides, so a ledger''s income and expense match too');

-- ------------------------------------------------- kind must be stated ----

select is(pg_temp.exec_as(pg_temp.owner(),
          'insert into public.transactions (ledger_id, from_account_id, to_account_id, amount, description)
           values (''00000000-0000-4000-f000-00000000004a'', ''00000000-0000-4000-f000-0000000000e1'',
                   ''00000000-0000-4000-f000-0000000000e3'', 5, ''untagged'')'),
          'ERROR:23502',
          'an insert that leaves kind out is refused, not filed as a payment by inattention');

select is(pg_temp.exec_as(pg_temp.owner(),
          'insert into public.transactions (ledger_id, from_account_id, to_account_id, amount, description, kind)
           values (''00000000-0000-4000-f000-00000000004a'', ''00000000-0000-4000-f000-0000000000e1'',
                   ''00000000-0000-4000-f000-0000000000e3'', 5, ''invented'', ''transfer'')'),
          'ERROR:22P02', 'and there is no third kind');

-- ------------------------------------- retirement does not erase history ----
-- B is settled at exactly zero, so it can be retired -- and the 100 it was
-- covered for stays readable, the same way its transactions do.

select is(pg_temp.exec_as(pg_temp.owner(),
          'insert into public.deleted_accounts (account_id, ledger_id) values
           (''00000000-0000-4000-f000-0000000000e2'', ''00000000-0000-4000-f000-00000000004a'')'),
          'OK', 'the payment left B retirable');

select is((select income from public.account_income_expense
            where id = '00000000-0000-4000-f000-0000000000e2'),
          100.0000::numeric,
          'and a retired account keeps its income -- the view is over accounts, not active_accounts');

select * from finish();
rollback;
