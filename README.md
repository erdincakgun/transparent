# Transparent

Shared, append-only bookkeeping for a group of people.

A **ledger** holds **accounts**; accounts exchange **transactions**; people get access to a
ledger through its member list. Nothing is ever edited or erased — a mistake is corrected by
appending its opposite — and the landing page turns the resulting balances into the minimal
set of "who pays whom" transfers that settles everyone up.

It is a single-page React app talking directly to Supabase (Postgres + Auth) from the
browser. There is no backend of our own: no API server, no edge functions, no service key.
**The database is the backend**, and every rule that matters is enforced there.

## What it does

- **Ledgers** — create one, describe it, switch between the ones you belong to, invite
  people by user id, archive a ledger you are done with.
- **Accounts** — one per person or pot the ledger keeps a balance for. Retire a settled
  account and its name becomes free again; its history stays readable forever.
- **Transactions** — an **accrual** (a cost one account covered for another) or a
  **payment** (settling a balance an accrual created). Both move money; only accruals count
  as income and expense. Duplicate or revert a row in one click — a revert writes the
  opposite transaction rather than deleting anything.
- **Settle up** — the minimal list of transfers that zeroes every balance in the ledger,
  computed in SQL, each row one click away from being recorded as a payment.
- **Export** — every list page exports as CSV (raw columns, for a spreadsheet) or as a
  self-contained HTML report (the page as a file: no script, no external stylesheet, nothing
  truncated).
- **Auth** — magic link or passkey to sign in, then a TOTP code, always. Both entry points
  sit behind Cloudflare Turnstile.

## Security model

Worth knowing before reading any data code, because it explains why the client looks as thin
as it does.

- **Only `authenticated` exists.** `anon` and `service_role` are revoked from every schema,
  table, view and function. An unauthenticated client reads nothing. There is no service key
  in this repo and none should ever appear.
- **RLS is enabled and forced on every table.** Membership resolves through a single
  `security definer` helper in a non-exposed `private` schema, so policies never recurse into
  the tables they protect.
- **MFA is mandatory in Postgres, not in the UI.** Every policy carries an `aal2` check, so a
  session that has not spent a TOTP code reads zero rows from every table and every view and
  cannot insert anything — including its first ledger. A passkey signs you in but mints
  `aal1`; it replaces the magic link, not the authenticator app.
- **Everything is append-only.** `before update or delete` triggers raise `restrict_violation`
  on the data tables; truncate is blocked everywhere. Removing a member is the one permitted
  mutation. A wrong transaction is corrected with a storno, not an `UPDATE`.
- **Deleting is an insert too.** Retiring an account or archiving a ledger writes a row to a
  tombstone table, and triggers refuse to retire an account whose balance is not exactly zero
  — so a deleted account's balance is zero forever.
- **Cross-ledger transactions are impossible by construction**, via composite foreign keys
  rather than a trigger. Derived numbers — balances, income/expense, the settlement plan — are
  views, never stored columns.
- **Column-level grants decide what a client may insert.** Every `*_by` column defaults to
  `auth.uid()` and is excluded from the insert grant, so nobody can spoof who performed a write.

Consequently, forms here **submit and translate the Postgres error into copy** instead of
pre-checking. Do not add client-side guards that duplicate a database rule, and do not work
around one.

## Stack

React 19 (with the React Compiler) · TypeScript · Vite 8 (Rolldown) · react-router v8 ·
Tailwind v4 configured in CSS · shadcn `base-nova` on `@base-ui/react` · `@supabase/supabase-js`
· Supabase CLI + pgTAP for the database and its tests.

## Getting started

Node is pinned in `.nvmrc` (24.18.0). The Supabase CLI is not installed globally — it is
invoked through `npx`.

```bash
nvm use
yarn install

cp .env.example .env.local      # all four values are dev/test values
npx supabase start              # API :54321 · DB :54322 · Studio :54323 · mail :54324
npx supabase db reset           # apply migrations and load the seed fixture
yarn dev                        # http://localhost:5173
```

The seed gives you four users (`*@transparent.test`), two ledgers with overlapping
membership, a retired account, an unsettled one, and a mix of accruals and payments. Every
seeded user carries a verified TOTP factor built from the shared dev secret
`JBSWY3DPEHPK3PXP` — feed that to any authenticator app to get past the MFA screen, since
without `aal2` the fixture is invisible. Magic links land in the mail catcher on
<http://localhost:54324>.

MFA and passkey settings live under `[auth.mfa.totp]`, `[auth.passkey]` and `[auth.webauthn]`
in `supabase/config.toml`; changing them needs `npx supabase stop && npx supabase start`, as
`db reset` alone does not reload config.

## Commands

```bash
yarn dev        # vite dev server on :5173
yarn build      # tsc -b && vite build
yarn lint       # oxlint
yarn knip       # unused files, exports and dependencies
yarn test       # pgTAP suite against the local database
```

## Tests

**The tests are SQL, because the rules being tested are SQL.** `supabase/tests/database/`
holds pgTAP suites run by `yarn test`; there is no JS test framework and no component tests.
Each file builds its own fixture inside a transaction and rolls back, so the suites are
order-independent and never read the seed.

They assert the things that must never regress: that `anon` and `service_role` reach nothing,
that an `aal1` session reads zero rows, that a non-member reads zero rows through tables *and*
views, that append-only holds at both the grant layer and the trigger layer, that the
settlement plan zeroes every balance, and that a payment moves a balance without touching
income or expense.

**Any change to a policy, grant or trigger must leave `yarn test` green.** If a change makes a
test fail, the change is wrong until proven otherwise. Beyond that, verification is
`yarn lint`, `tsc -b`, and driving the app — at 320px as well as at desktop width.

## Layout

```
src/
  components/       named exports; untouched shadcn primitives under ui/
  pages/            default exports, one per route
  layouts/          dashboard shell (sidebar + header + <Outlet />)
  lib/              supabase client and auth helpers, csv, html report, pagination
  hooks/
  main.tsx          every route declared inline
  lazy-pages.tsx    the React.lazy declaration for each page
supabase/
  migrations/       the schema; finished and deliberate
  tests/database/   pgTAP suites
  seed.sql          the dev fixture
```

Path alias `@/*` → `src/*`. Filenames are kebab-case.

## Conventions

Two house rules that are easy to trip over:

- **Nothing under `src/` carries a comment** — not a `//`, not a `/* */`, not a JSDoc block,
  not a `{/* */}` in JSX. The files were stripped deliberately. What a comment would have said
  goes in `CLAUDE.md`, which is where the reasoning for every non-obvious decision in this repo
  lives; what is left after that, the code carries in a clearer name or a small extraction.
- **`CLAUDE.md` is the design document**, not a scratch file. Read it before writing data code
  — the database contract, the palette and its measured contrast ratios, the MFA gate, the
  accessibility habits and the known gaps are all spelled out there in far more detail than
  this file.
