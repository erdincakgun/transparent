-- Local development fixture. Loaded by `supabase db reset` via db.seed.sql_paths.
--
-- Runs as `postgres`, which bypasses RLS -- but the `ledgers_add_creator_as_member`
-- trigger still reads `auth.uid()`, so every ledger insert has to be preceded by
-- the claims of whoever is meant to own it. That is why this file switches
-- `request.jwt.claims` instead of inserting into `ledgers_users` directly.
--
-- Sign in locally with any of the addresses below at http://localhost:5173.
-- The magic link lands in Mailpit on http://127.0.0.1:54324. Each user already
-- has a verified TOTP factor built from the same shared secret, so add it to an
-- authenticator once and every seeded account is reachable:
--
--     otpauth://totp/Transparent:dev?secret=JBSWY3DPEHPK3PXP&issuer=Transparent
--
-- | user                   | sees                                        |
-- |------------------------|---------------------------------------------|
-- | alice@transparent.test | Ev Giderleri                                |
-- | bob@transparent.test   | Ev Giderleri + Ofis Kasasi (both)           |
-- | carol@transparent.test | Ofis Kasasi                                 |
-- | dave@transparent.test  | nothing -- the empty state, and the outsider|
-- |                        | the RLS tests probe isolation with          |

-- ---------------------------------------------------------------- users ----

insert into auth.users (
  id, instance_id, aud, role, email,
  encrypted_password, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  u.id,
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  u.email,
  '',
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  '', '', '', ''
from (values
  ('00000000-0000-4000-a000-00000000a11c'::uuid, 'alice@transparent.test'),
  ('00000000-0000-4000-a000-00000000b0b0'::uuid, 'bob@transparent.test'),
  ('00000000-0000-4000-a000-00000000ca50'::uuid, 'carol@transparent.test'),
  ('00000000-0000-4000-a000-00000000da7e'::uuid, 'dave@transparent.test')
) as u (id, email);

-- A verified TOTP factor per user, all sharing one dev secret. Without a factor
-- no seeded user can reach aal2, and without aal2 they read zero rows -- so
-- skipping this would make the fixture invisible in the app it seeds.
insert into auth.mfa_factors (
  id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret
)
select u.id, u.id, 'Dev authenticator', 'totp', 'verified', now(), now(), 'JBSWY3DPEHPK3PXP'
from auth.users u
where u.email like '%@transparent.test';

-- ------------------------------------------------------ ledger: household --

set request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000a11c","role":"authenticated","aal":"aal2"}';

insert into public.ledgers (id, name, description) values (
  '00000000-0000-4000-b000-000000000001',
  'Ev Giderleri',
  'Paylasilan ev masraflari'
);

insert into public.ledgers_users (ledger_id, user_id)
values ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-00000000b0b0');

insert into public.accounts (id, ledger_id, name, description) values
  ('00000000-0000-4000-c000-00000000acc1', '00000000-0000-4000-b000-000000000001', 'Erdinc', 'Kira ve faturalar'),
  ('00000000-0000-4000-c000-00000000acc2', '00000000-0000-4000-b000-000000000001', 'Ayse',   'Market'),
  ('00000000-0000-4000-c000-00000000acc3', '00000000-0000-4000-b000-000000000001', 'Mehmet', null);

insert into public.transactions (ledger_id, from_account_id, to_account_id, amount, description) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-c000-00000000acc1', '00000000-0000-4000-c000-00000000acc2', 1200.0000, 'Market alisverisi'),
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-c000-00000000acc1', '00000000-0000-4000-c000-00000000acc3',  800.5000, 'Elektrik faturasi'),
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-c000-00000000acc2', '00000000-0000-4000-c000-00000000acc3',  450.2500, 'Internet'),
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-c000-00000000acc3', '00000000-0000-4000-c000-00000000acc1',  300.0000, 'Kira katkisi');

-- resulting balances: Erdinc -1700.5000, Ayse +749.7500, Mehmet +950.7500

-- --------------------------------------------------------- ledger: office --

set request.jwt.claims = '{"sub":"00000000-0000-4000-a000-00000000ca50","role":"authenticated","aal":"aal2"}';

insert into public.ledgers (id, name, description) values (
  '00000000-0000-4000-b000-000000000002',
  'Ofis Kasasi',
  'Kucuk kasa hareketleri'
);

insert into public.ledgers_users (ledger_id, user_id)
values ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-a000-00000000b0b0');

insert into public.accounts (id, ledger_id, name, description) values
  ('00000000-0000-4000-c000-00000000acc4', '00000000-0000-4000-b000-000000000002', 'Ofis',       'Sirket butcesi'),
  ('00000000-0000-4000-c000-00000000acc5', '00000000-0000-4000-b000-000000000002', 'Kasa',       'Nakit kasa'),
  ('00000000-0000-4000-c000-00000000acc6', '00000000-0000-4000-b000-000000000002', 'Eski Hesap', 'Kapatilacak'),
  ('00000000-0000-4000-c000-00000000acc7', '00000000-0000-4000-b000-000000000002', 'Acik Hesap', 'Bakiyesi duran hesap');

insert into public.transactions (ledger_id, from_account_id, to_account_id, amount, description) values
  ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-c000-00000000acc4', '00000000-0000-4000-c000-00000000acc5', 5000.0000, 'Aylik butce'),
  ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-c000-00000000acc5', '00000000-0000-4000-c000-00000000acc6',  500.0000, 'Devir'),
  ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-c000-00000000acc6', '00000000-0000-4000-c000-00000000acc5',  500.0000, 'storno: devir geri alindi'),
  ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-c000-00000000acc5', '00000000-0000-4000-c000-00000000acc7',  250.0000, 'Kirtasiye avansi');

-- 'Eski Hesap' is now settled at exactly 0, the only state the deleted_accounts
-- trigger accepts. 'Acik Hesap' deliberately is not -- it is the fixture for the
-- hand-over-the-balance flow on the account delete form.
insert into public.deleted_accounts (account_id, ledger_id)
values ('00000000-0000-4000-c000-00000000acc6', '00000000-0000-4000-b000-000000000002');

reset request.jwt.claims;
