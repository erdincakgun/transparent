-- The arithmetic and the structural rules: money cannot cross a ledger
-- boundary, a retired account is settled forever, and the settlement plan
-- really does zero every balance it touches.

begin;
create extension if not exists pgtap;
select plan(34);

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
-- Two ledgers owned by the same person, so a cross-ledger attempt is refused
-- by structure rather than by lack of access.

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-4000-f000-000000000021', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'inv@test.invalid', '', now(), now(), now(), '', '', '', '');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-f000-000000000021","role":"authenticated","aal":"aal2"}';

insert into public.ledgers (id, name) values
  ('00000000-0000-4000-f000-00000000002a', 'L1'),
  ('00000000-0000-4000-f000-00000000002b', 'L2');

-- five accounts in L1: an exact opposite pair plus a three-way remainder,
-- so both branches of settlement_transfers are exercised
insert into public.accounts (id, ledger_id, name) values
  ('00000000-0000-4000-f000-0000000000c1', '00000000-0000-4000-f000-00000000002a', 'A'),
  ('00000000-0000-4000-f000-0000000000c2', '00000000-0000-4000-f000-00000000002a', 'B'),
  ('00000000-0000-4000-f000-0000000000c3', '00000000-0000-4000-f000-00000000002a', 'C'),
  ('00000000-0000-4000-f000-0000000000c4', '00000000-0000-4000-f000-00000000002a', 'D'),
  ('00000000-0000-4000-f000-0000000000c5', '00000000-0000-4000-f000-00000000002a', 'E'),
  ('00000000-0000-4000-f000-0000000000c6', '00000000-0000-4000-f000-00000000002a', 'Settled'),
  ('00000000-0000-4000-f000-0000000000d1', '00000000-0000-4000-f000-00000000002b', 'Other');

insert into public.transactions (ledger_id, from_account_id, to_account_id, amount, description) values
  ('00000000-0000-4000-f000-00000000002a', '00000000-0000-4000-f000-0000000000c2', '00000000-0000-4000-f000-0000000000c1', 100.0000, 'pair'),
  ('00000000-0000-4000-f000-00000000002a', '00000000-0000-4000-f000-0000000000c4', '00000000-0000-4000-f000-0000000000c3',  30.0000, 'rem 1'),
  ('00000000-0000-4000-f000-00000000002a', '00000000-0000-4000-f000-0000000000c5', '00000000-0000-4000-f000-0000000000c3',  45.0000, 'rem 2'),
  ('00000000-0000-4000-f000-00000000002a', '00000000-0000-4000-f000-0000000000c1', '00000000-0000-4000-f000-0000000000c6',  20.0000, 'to settled'),
  ('00000000-0000-4000-f000-00000000002a', '00000000-0000-4000-f000-0000000000c6', '00000000-0000-4000-f000-0000000000c1',  20.0000, 'storno: back');

reset request.jwt.claims;

create function pg_temp.owner() returns text language sql immutable as
  $$ select '{"sub":"00000000-0000-4000-f000-000000000021","role":"authenticated","aal":"aal2"}' $$;

-- ------------------------------------------- the creator becomes a member ----

select is((select count(*)::text from public.ledgers_users
            where ledger_id = '00000000-0000-4000-f000-00000000002a'),
          '1', 'the after-insert trigger enrols the ledger creator');

-- ------------------------------------------------ money stays in a ledger ----

select is(pg_temp.exec_as(pg_temp.owner(),
          'insert into public.transactions (ledger_id, from_account_id, to_account_id, amount, description)
           values (''00000000-0000-4000-f000-00000000002a'', ''00000000-0000-4000-f000-0000000000c1'',
                   ''00000000-0000-4000-f000-0000000000d1'', 5, ''cross'')'),
          'ERROR:23503',
          'a transaction cannot reach an account in another ledger -- composite FK, no trigger needed');

-- ------------------------------------------------------ amount and sides ----

select is(pg_temp.exec_as(pg_temp.owner(),
          'insert into public.transactions (ledger_id, from_account_id, to_account_id, amount, description)
           values (''00000000-0000-4000-f000-00000000002a'', ''00000000-0000-4000-f000-0000000000c1'',
                   ''00000000-0000-4000-f000-0000000000c2'', 0, ''zero'')'),
          'ERROR:23514', 'a zero amount is refused');

select is(pg_temp.exec_as(pg_temp.owner(),
          'insert into public.transactions (ledger_id, from_account_id, to_account_id, amount, description)
           values (''00000000-0000-4000-f000-00000000002a'', ''00000000-0000-4000-f000-0000000000c1'',
                   ''00000000-0000-4000-f000-0000000000c2'', -5, ''negative'')'),
          'ERROR:23514', 'direction is which side you sit on, never a negative amount');

select is(pg_temp.exec_as(pg_temp.owner(),
          'insert into public.transactions (ledger_id, from_account_id, to_account_id, amount, description)
           values (''00000000-0000-4000-f000-00000000002a'', ''00000000-0000-4000-f000-0000000000c1'',
                   ''00000000-0000-4000-f000-0000000000c1'', 5, ''self'')'),
          'ERROR:23514', 'an account cannot pay itself');

select is(pg_temp.exec_as(pg_temp.owner(),
          'insert into public.transactions (ledger_id, from_account_id, to_account_id, amount, description)
           values (''00000000-0000-4000-f000-00000000002a'', ''00000000-0000-4000-f000-0000000000c1'',
                   ''00000000-0000-4000-f000-0000000000c2'', 0.00004, ''rounds to zero'')'),
          'ERROR:23514', 'an amount that rounds away to zero at scale 4 is refused, not silently stored');

select is(pg_temp.exec_as(pg_temp.owner(),
          'insert into public.transactions (ledger_id, from_account_id, to_account_id, amount, description)
           values (''00000000-0000-4000-f000-00000000002a'', ''00000000-0000-4000-f000-0000000000c1'',
                   ''00000000-0000-4000-f000-0000000000c2'', 5, '''')'),
          'ERROR:23514', 'a blank description is refused');

-- ------------------------------------------------------- account naming ----

select is(pg_temp.exec_as(pg_temp.owner(),
          'insert into public.accounts (ledger_id, name) values
           (''00000000-0000-4000-f000-00000000002a'', ''a'')'),
          'ERROR:23505', 'account names are unique per ledger, case-insensitively');

select is(pg_temp.exec_as(pg_temp.owner(),
          'insert into public.accounts (ledger_id, name) values
           (''00000000-0000-4000-f000-00000000002b'', ''A'')'),
          'OK', 'the same name is free in a different ledger');

-- --------------------------------------------------- retiring an account ----

select is(pg_temp.exec_as(pg_temp.owner(),
          'insert into public.deleted_accounts (account_id, ledger_id) values
           (''00000000-0000-4000-f000-0000000000c1'', ''00000000-0000-4000-f000-00000000002a'')'),
          'ERROR:23001', 'an account holding a balance cannot be retired');

select is(pg_temp.exec_as(pg_temp.owner(),
          'insert into public.deleted_accounts (account_id, ledger_id) values
           (''00000000-0000-4000-f000-0000000000c6'', ''00000000-0000-4000-f000-00000000002a'')'),
          'OK', 'an account settled at exactly zero can be retired');

select is(pg_temp.exec_as(pg_temp.owner(),
          'insert into public.transactions (ledger_id, from_account_id, to_account_id, amount, description)
           values (''00000000-0000-4000-f000-00000000002a'', ''00000000-0000-4000-f000-0000000000c1'',
                   ''00000000-0000-4000-f000-0000000000c6'', 5, ''after death'')'),
          'ERROR:23001', 'a retired account can never receive again -- its balance is zero forever');

select is(pg_temp.exec_as(pg_temp.owner(),
          'insert into public.transactions (ledger_id, from_account_id, to_account_id, amount, description)
           values (''00000000-0000-4000-f000-00000000002a'', ''00000000-0000-4000-f000-0000000000c6'',
                   ''00000000-0000-4000-f000-0000000000c1'', 5, ''after death'')'),
          'ERROR:23001', 'nor send');

select is((select count(*)::text from public.active_accounts
            where ledger_id = '00000000-0000-4000-f000-00000000002a'),
          '5', 'active_accounts hides the retired one');

-- ------------------------------------------------ reusing a freed name ----
-- The retired row keeps its name in the history it took part in; what
-- retirement releases is the claim on that name for accounts opened later.

select is(pg_temp.exec_as(pg_temp.owner(),
          'insert into public.accounts (ledger_id, name) values
           (''00000000-0000-4000-f000-00000000002a'', ''settled'')'),
          'OK', 'a retired account frees its name, case-insensitively like the index it replaced');

select is((select count(*)::text from public.accounts
            where ledger_id = '00000000-0000-4000-f000-00000000002a'
              and lower(name) = 'settled'),
          '2', 'the retired row keeps its name -- the replacement is a second account, not a rename');

select is((select count(*)::text from public.active_accounts
            where ledger_id = '00000000-0000-4000-f000-00000000002a'
              and lower(name) = 'settled'),
          '1', 'only one of the two is active, so the name still names one account today');

select is(pg_temp.exec_as(pg_temp.owner(),
          'insert into public.accounts (ledger_id, name) values
           (''00000000-0000-4000-f000-00000000002a'', ''SETTLED'')'),
          'ERROR:23505', 'and the replacement holds the name in its turn');

-- ------------------------------------------------------------- balances ----

select is((select balance from public.account_balances where id = '00000000-0000-4000-f000-0000000000c1'),
          100.0000::numeric, 'balance is credits in minus debits out');

select is((select balance from public.account_balances where id = '00000000-0000-4000-f000-0000000000c3'),
          75.0000::numeric, 'balances aggregate across several counterparties');

select is((select sum(balance) from public.account_balances
            where ledger_id = '00000000-0000-4000-f000-00000000002a'),
          0.0000::numeric, 'a ledger always sums to zero');

-- --------------------------------------------------- the settlement plan ----

select is(
  (select coalesce(max(abs(residual)), 0) from (
     select b.balance
            - coalesce((select sum(s.amount) from public.settlement_transfers s
                         where s.from_account_id = b.id), 0)
            + coalesce((select sum(s.amount) from public.settlement_transfers s
                         where s.to_account_id = b.id), 0) as residual
     from public.account_balances b
     where b.ledger_id = '00000000-0000-4000-f000-00000000002a'
   ) r),
  0::numeric,
  'applying every settlement transfer leaves every balance in L1 at zero');

select is(
  (select count(*)::text from public.settlement_transfers
    where ledger_id = '00000000-0000-4000-f000-00000000002a' and amount <= 0),
  '0', 'no settlement transfer is zero or negative');


insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-4000-f000-000000000022', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'inv2@test.invalid', '', now(), now(), now(), '', '', '', '');

select is(pg_temp.exec_as(pg_temp.owner(),
          'insert into public.ledgers_users (ledger_id, user_id)
           values (''00000000-0000-4000-f000-00000000002b'',
                   ''00000000-0000-4000-f000-000000000022'')'),
          'OK', 'a member adds a second member to L2');

select is(pg_temp.exec_as(pg_temp.owner(),
          'delete from public.ledgers_users
            where ledger_id = ''00000000-0000-4000-f000-00000000002b'''),
          'ERROR:23001',
          'an unfiltered delete that would empty a ledger is refused for the last row');

select is((select count(*)::text from public.ledgers_users
            where ledger_id = '00000000-0000-4000-f000-00000000002b'),
          '2', 'that refusal rolled the whole statement back -- both members survive');

select is(pg_temp.exec_as(pg_temp.owner(),
          'delete from public.ledgers_users
            where ledger_id = ''00000000-0000-4000-f000-00000000002b''
              and user_id = ''00000000-0000-4000-f000-000000000022'''),
          'OK', 'removing a member while another remains is still permitted');

select is(pg_temp.exec_as(pg_temp.owner(),
          'delete from public.ledgers_users
            where ledger_id = ''00000000-0000-4000-f000-00000000002b''
              and user_id = ''00000000-0000-4000-f000-000000000021'''),
          'ERROR:23001',
          'removing yourself is refused once you are the only member left');

select is(pg_temp.exec_as(pg_temp.owner(),
          'insert into public.deleted_ledgers (ledger_id, deleted_by)
           values (''00000000-0000-4000-f000-00000000002b'',
                   ''00000000-0000-4000-f000-000000000021'')'),
          'ERROR:42501', 'deleted_by is absent from the deleted_ledgers insert grant');

select is((select count(*)::text from public.active_ledgers
              where id in ('00000000-0000-4000-f000-00000000002a', '00000000-0000-4000-f000-00000000002b')), '2',
          'both fixture ledgers are active before either is archived');

select is(pg_temp.exec_as(pg_temp.owner(),
          'insert into public.deleted_ledgers (ledger_id)
           values (''00000000-0000-4000-f000-00000000002b'')'),
          'OK', 'a member archives a ledger by inserting, like retiring an account');

select is((select count(*)::text from public.active_ledgers
              where id in ('00000000-0000-4000-f000-00000000002a', '00000000-0000-4000-f000-00000000002b')), '1',
          'active_ledgers hides the archived one');

select is((select count(*)::text from public.ledgers
              where id in ('00000000-0000-4000-f000-00000000002a', '00000000-0000-4000-f000-00000000002b')), '2',
          'archiving destroys nothing -- the ledger row is still there');

select is(pg_temp.exec_as(pg_temp.owner(),
          'delete from public.deleted_ledgers
            where ledger_id = ''00000000-0000-4000-f000-00000000002b'''),
          'ERROR:42501',
          'un-archiving is refused at the grant layer -- authenticated has no delete on deleted_ledgers');

select * from finish();

rollback;
