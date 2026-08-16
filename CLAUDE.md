# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Transparent

Shared, append-only bookkeeping. A **ledger** holds **accounts**; accounts exchange
**transactions**; people get access to a ledger through **ledgers_users**; a settled
account retires into **deleted_accounts**. The landing page turns the resulting balances
into a minimal list of "who pays whom" transfers.

Single-page React app talking directly to Supabase (Postgres + Auth) from the browser.
There is no backend of our own — no API server, no edge functions. The database *is* the
backend.

## Commands

```bash
yarn dev        # vite dev server on :5173
yarn build      # tsc -b && vite build
yarn lint       # oxlint
yarn knip       # unused files/exports/deps
yarn test       # pgTAP suite against the local database
npx supabase start / db reset / status   # CLI is not installed globally
```

**The tests are SQL, because the rules being tested are SQL.** `supabase/tests/database/`
holds pgTAP suites run by `yarn test` (`supabase test db`); there is no JS test framework
and no component tests. Each file builds its own fixture inside a transaction and rolls
back, so the suites are order-independent and do not read `seed.sql`. They assert the
things that must never regress — anon and `service_role` reach nothing, `aal1` reads zero
rows, a non-member reads zero rows through tables *and* views, append-only holds at both
the grant layer and the trigger layer, and the settlement plan zeroes every balance.
**Any change to a policy, grant or trigger must leave `yarn test` green**; if a change
makes a test fail, the change is wrong until proven otherwise.

Impersonation inside a test goes through the local `pg_temp.read_as` / `pg_temp.exec_as`
helpers: they set `request.jwt.claims`, switch role, run the one statement under test, and
switch back, returning either the value or `ERROR:<sqlstate>` so a refusal is an assertable
outcome rather than an aborted run. pgTAP assertions themselves stay as `postgres` —
`authenticated` has no `execute` on functions in `public`, so asserting as that role would
fail for the wrong reason.

Beyond that, verification is `yarn lint`, `tsc -b`, and driving the app (Playwright MCP is
available; its scratch output lands in the gitignored `.playwright-mcp/`). A postgres MCP
server is also wired up for querying the local database directly.

`supabase/seed.sql` gives `db reset` a working fixture: four users
(`*@transparent.test`), two ledgers with overlapping membership, a retired account and an
unsettled one. Every user gets a verified TOTP factor built from the shared dev secret
`JBSWY3DPEHPK3PXP` — without a factor a seeded user cannot reach `aal2`, and without
`aal2` they read nothing, which would make the fixture invisible in the app it seeds.

Node is pinned to 24.18.0 (`.nvmrc`). Local Supabase: API `:54321`, DB `:54322`,
Studio `:54323`, mail catcher `:54324`. Env vars live in `.env.local` (see `.env.example`);
all four are dev/test values, including the Turnstile test site key.

## The database contract

This is the part to internalise before writing any data code. The schema
(`supabase/migrations/000_initial.sql`) is finished and deliberate: **correctness and
security are enforced in Postgres, not in this app.** Do not add client-side guards that
duplicate a database rule, and do not work around one.

**Only `authenticated` exists.** `anon` and `service_role` are revoked from every
schema, table and function. An unauthenticated client can read nothing. There is no
service key anywhere in this repo and none should ever appear.

**RLS is enabled *and forced* on all five tables.** Every policy resolves membership
through one helper, `private.is_ledger_member(uuid)` — `security definer`, `search_path`
empty, living in the `private` schema (not exposed via the API) so policies never recurse
into the tables they protect. If you need a new policy, call that helper; never inline a
subquery against `ledgers_users`.

**MFA is mandatory, and the database is what makes it mandatory.** Every one of the
eleven policies is `private.is_mfa_verified() and private.is_ledger_member(…)`
(`005_require_mfa.sql`); the one policy with no membership test,
`ledgers_insert_authenticated`, is `private.is_mfa_verified()` alone. The helper reads
`auth.jwt() ->> 'aal'` and is true only for `aal2`, so a session that has not passed a
TOTP challenge reads zero rows from every table and every view, and cannot insert
anything — including a first ledger. A user with no factor enrolled can never reach
`aal2`, so **no MFA means no data**, enforced in Postgres and not in the app. It fails
closed: no claims at all is not `aal2`. Any new policy must carry the check too.

**Everything is append-only.** `before update or delete` triggers raise
`restrict_violation` on `ledgers`, `accounts`, `transactions` and `deleted_accounts`;
truncate is blocked on all five. The only permitted mutation besides insert is `delete`
on `ledgers_users` (removing a member). **A wrong transaction is corrected with a
storno** — a second, opposite transaction referencing the original in its description.
Never reach for an `UPDATE`; it will not fail silently, it will throw.

**Deleting an account is an insert too.** `public.deleted_accounts`
(`003_deleted_accounts.sql`) carries `(account_id, ledger_id)` with the same composite
foreign key as `transactions`, so an account can only be retired inside its own ledger.
Two triggers keep the pair of invariants that make the table meaningful, both raising
`restrict_violation` (`23001`):

- `deleted_accounts_reject_unsettled` refuses the insert unless `account_balances` reads
  exactly `0` for that account.
- `transactions_reject_deleted_account` refuses any transaction whose `from`/`to` side is
  already in `deleted_accounts`.

Together they mean **a deleted account's balance is zero forever**. Each trigger locks the
`accounts` row first (`for update` when deleting, `for share` when inserting a
transaction) so the two checks cannot pass concurrently and leave a retired account
holding money; those locks are the reason both functions are `security definer` —
`authenticated` has no `update` privilege to lock a row with. Deletion is final: there is
no undelete, because `deleted_accounts` is append-only like everything else.

**Cross-ledger transactions are impossible by construction.** `accounts` carries a
`unique (id, ledger_id)` and `transactions` has two *composite* foreign keys
`(from_account_id, ledger_id)` and `(to_account_id, ledger_id)`. This is why every
transaction insert must send `ledger_id` explicitly alongside the two account ids — it is
not redundant, it is the mechanism. No trigger does this checking.

**Column-level grants restrict what you may insert:**

| table | insertable columns | notes |
|---|---|---|
| `ledgers` | `id, name, description` | client supplies the `id` |
| `ledgers_users` | `ledger_id, user_id` | plus `delete` |
| `accounts` | `ledger_id, name, description` | `id` is server-generated |
| `transactions` | `ledger_id, from_account_id, to_account_id, amount, description` | `id`/`created_at` server-generated |
| `deleted_accounts` | `account_id, ledger_id` | `deleted_at` server-generated |

Sending any other column fails. Amounts are `numeric(20,4)`, must be `> 0`, and the two
accounts must differ — direction is expressed by which side an account sits on, never by
a negative amount. Account names are unique per ledger, case-insensitively. `name` and
`description` have length checks (`ledgers` 100, `accounts` 200, descriptions 1000).

**Creating a ledger is a two-step dance handled by the DB.** `ledgers_insert_authenticated`
lets any authenticated user insert, and an `after insert` trigger adds the creator to
`ledgers_users`. Because that trigger fires *after* the row is projected, `RETURNING`
cannot pass the SELECT policy — so the established pattern is: generate the id with
`crypto.randomUUID()` client-side, insert without `.select()`, then use the id you already
hold (`src/components/ledger-create-form.tsx`). Inserts into `accounts` and
`transactions` have no such problem; membership already exists there.

**Derived numbers are views, never stored columns.** Three exist, all
`security_invoker = true` so the caller's RLS on the underlying tables applies and none
needs a policy of its own — but each still needs the explicit
`revoke all … from anon, authenticated, service_role` + `grant select … to authenticated`,
because default privileges are revoked repo-wide. Any new view or function must repeat
that pattern.

- `public.account_balances` (`001_account_balances.sql`) → `id, ledger_id, balance`, as
  *credits in minus debits out*. A **positive** balance means the account has received
  more than it sent, so in settle-up terms it is the one that **pays**.
- `public.settlement_transfers` (`002_settlement_transfers.sql`) → `ledger_id,
  from_account_id, to_account_id, amount`, the minimal set of transfers that zeroes every
  balance. It first matches exact opposite pairs (`+50` against `−50`), then greedily
  matches the remainder by overlapping running-sum intervals. It is pure SQL over
  `account_balances` — do not reimplement any of this arithmetic in the client.
- `public.active_accounts` (`004_active_accounts.sql`) → `id, ledger_id, name,
  description`, every account with no `deleted_accounts` row. **Anything that offers an
  account to pick reads this, not `accounts`** — the accounts list and its CSV export,
  both transaction selects, the heir select on the delete form. Name lookups on the
  transactions and settle-up pages still read `accounts`, because a retired account keeps
  its history and that history has to stay readable.

**Membership is granted by user id, not email.** `auth.users` is not exposed through the
API, so there is no way to look a person up. The sidebar user menu offers "Copy user ID"
(`nav-user.tsx`) precisely so it can be pasted into an invite by whoever adds the member.

## Frontend shape

- **React 19** with the **React Compiler** enabled via Babel (`vite.config.ts`) — do not
  hand-write `useMemo`/`useCallback`/`memo` for performance; the compiler handles it.
- **react-router v8**, all routes declared inline in `src/main.tsx`. The tree is
  `RequireAuth` (subscribes to `onAuthStateChange`) → `RequireMfa` → `LedgerProvider` →
  either `Dashboard` (`src/layouts/dashboard.tsx`, sidebar+header layout with an
  `<Outlet />`, holding `/` → Settle Up, `/transactions`, `/accounts`, `/users`) or the
  standalone full-screen routes that sit beside it (`/ledger-create`, `/account-create`,
  `/accounts/delete/:accountId`, `/transaction-create`, `/user-add`,
  `/users/delete/:userId`). Anything needing `useLedger` must sit inside the provider.
  `/mfa-enroll` and `/mfa-verify` are the only routes between `RequireAuth` and
  `RequireMfa` — they need a session but cannot need `aal2`, because reaching `aal2` is
  what they are for.
- Adding a dashboard route means touching **three** places: the `<Route>` in `main.tsx`,
  the breadcrumb `pageNames` map in `layouts/dashboard.tsx`, and `data.navItems` in
  `components/app-sidebar.tsx`.
- **shadcn `base-nova` style built on `@base-ui/react`, not Radix.** Composition uses the
  `render={<Component />}` prop, *not* `asChild` (and `nativeButton={false}` when a
  `Button` renders a `Link`). `SelectValue` takes a *render function* child receiving the
  current value, not a placeholder string. Copy new primitives with the shadcn CLI so they
  land in the same style; a `@supabase` registry is configured in `components.json`, and
  `.mcp.json` wires up the shadcn MCP server.
- **Tailwind v4**, configured entirely in CSS (`src/index.css`) — there is no
  `tailwind.config`. Theme is class-based (`.dark`) via `ThemeProvider`, defaulting to
  dark.
- Auth is **magic-link OTP + Cloudflare Turnstile** (the token goes to
  `signInWithOtp` as `options.captchaToken`), then **TOTP MFA**. One shared Supabase
  client, default export from `src/lib/supabase/client.ts`.

### The MFA gate

Signing in only gets you to `aal1`, which the database treats as a stranger. `RequireMfa`
(`src/components/require-mfa.tsx`) reads `getAuthenticatorAssuranceLevel()` and sends the
session on: `aal1`/`aal1` (no factor) → `/mfa-enroll`, `aal1`/`aal2` (factor enrolled, not
challenged) → `/mfa-verify`, `aal2` → through. It re-reads on `onAuthStateChange`, but
inside a `setTimeout(…, 0)` — supabase-js holds its session lock for the length of that
callback, so calling back into `auth` synchronously deadlocks. This gate is UX only; it
decides which screen you see, never whether the data is safe.

`MfaEnrollForm` calls `enroll({ factorType: "totp" })` and shows `data.totp.qr_code` in an
`<img>`. supabase-js has already prefixed it with `data:image/svg+xml;utf-8,`, so pass it
through unchanged — but the SVG has **no background rect**, so the wrapper has to force
`bg-white` or the QR is black-on-black in the default dark theme. `data.totp.secret` is
offered beside it for anyone who cannot scan. Because `enroll` mints server-side state,
the effect is guarded by a `useRef` so StrictMode's second pass in dev does not create a
second factor, and each visit first `unenroll`s any `unverified` factor left behind by an
abandoned attempt. `listFactors().totp` lists **verified** factors only — that is how both
screens tell "not enrolled" from "not challenged" apart.

Checking a code is always `challenge` then `verify`, shared as `verifyMfaCode`
(`src/lib/supabase/mfa.ts`) and translated by `mfaErrorMessage` in the same file, the same
submit-then-translate habit the data forms use for Postgres errors
(`mfa_verification_failed`, `mfa_challenge_expired`, `over_request_rate_limit`). Both
screens carry a **Log out** button; without one a half-enrolled user has no way out.
Local dev needs `enroll_enabled`/`verify_enabled` under `[auth.mfa.totp]` in
`supabase/config.toml`, and a `supabase stop && supabase start` to load them — `db reset`
alone does not.

### The active ledger

`LedgerProvider` (`src/components/ledger-provider.tsx`) owns the ledger list and the
selection; consume it with `useLedger()` — `{ ledgers, activeLedger, selectLedger,
refreshLedgers, loading }`. The choice persists in a **per-user** localStorage key,
`transparent:active-ledger-id:<userId>`, and a `storage` listener keeps other tabs in
sync. Pages read `activeLedger?.id` and must wait out `loading` before deciding a ledger
is absent. After creating a ledger, call `refreshLedgers()` then `selectLedger(id)`.
`AppSidebar` redirects to `/ledger-create` when a signed-in user has no ledgers at all.
The standalone create forms embed their own ledger `Select` wired to `selectLedger`, so
the target ledger can be switched without going back to the sidebar.

### Data-loading conventions

There is no query library. Every page/form does `useEffect` + a local `async load()`,
guarded by a `cancelled` flag, keyed on `[ledgerLoading, ledgerId]`, with parallel reads
batched through `Promise.all` (see `src/pages/accounts.tsx`, `src/pages/transactions.tsx`,
`src/pages/settle-up.tsx`). Local `loading`/`error` state renders `Skeleton` rows and an
empty-state card. List pages resolve account names by fetching `accounts` alongside the
main query and building an id→name record — there are no PostgREST embedded joins here.

Because the database is the validator, forms submit and then **translate the Postgres
error into copy** rather than pre-checking. The vocabulary in use:

| signal | meaning |
|---|---|
| `error.code === "23505"` | duplicate account name / user already in ledger |
| `error.code === "23503"` | no `auth.users` row with that id |
| `error.code === "22P02"` | the pasted user id is not a uuid |
| `"transactions_distinct_accounts"` in the message | pick two different accounts |
| `error.code === "23001"` | the account still has a balance / the account is deleted |

Follow that pattern for new constraints instead of adding client-side guards. **A delete
blocked by RLS is not an error**, it is zero rows — `user-delete-form.tsx` therefore uses
`.delete({ count: "exact" })` and treats `!count` as "this user is not in the ledger".

Money stays a **string** all the way from PostgREST (`numeric` is serialised as text to
preserve precision) and is only converted at the last moment for `Intl.NumberFormat`.
Views are selected as `"…, balance::text"` / `"amount::text"` for the same reason — don't
drop the cast. `trimAmount` (`src/lib/utils.ts`) strips trailing fractional zeros when an
amount has to travel through a URL.

**CSV export** is `downloadCsv(filename, columns, rows)` (`src/lib/csv.ts`), on every list
page. The same `exportColumns` array is both the PostgREST select list and the CSV header
— `downloadCsv` splits each column on `::` so a `amount::text` cast still exports as
`amount`.

**Transaction prefill travels through the query string.** `/transaction-create` reads
`from`, `to`, `amount`, `description` search params; the duplicate and revert buttons on
the transactions page, the play button on settle-up and the hand-over button on the
account delete form all build such links. The form drops any prefilled account id that is
not in the active ledger's accounts. Revert is how the storno rule surfaces in the UI:
same amount, accounts swapped, description prefixed `revert:`.

**Deleting an account is a two-step flow** (`account-delete-form.tsx`). It loads the
account's balance alongside the ledger's `active_accounts`; at zero it offers the delete
button, otherwise it hides it and asks for an heir account instead, then builds the
prefill that zeroes the balance — the account on the `from` side when its balance is
positive, on the `to` side when it is negative, description `close account: <name>`.
Recording that transaction is the user's call, so the flow lands on `/transactions` like
every other prefill; deleting is a second visit.

Conventions: `@/*` → `src/*`. Filenames kebab-case. Pages are default exports under
`src/pages/`, layouts default exports under `src/layouts/`, components are named exports
under `src/components/`, untouched shadcn primitives stay in `src/components/ui/`.
Standalone (non-dashboard) routes follow a fixed split: an 11-line page that centres the
viewport wrapping a `*-form` component that holds all logic.

## Known gaps

- No generated Supabase types — `supabase.from(...)` is untyped and every row shape is
  hand-declared at the top of the file that reads it. `supabase gen types` would fix this.
- No CSV formula-injection guard, no row-attribution columns, no member role model, and
  every list/export silently truncates at PostgREST's `max_rows = 1000`. These are tracked
  as B1–B5 in the pre-production audit and are being worked through in order.
- There is no MFA settings screen, and deliberately no way to turn MFA off. A user who
  loses their authenticator is locked out: recovery means deleting their factor with
  `auth.admin.mfa.deleteFactor`, which needs a service key, and this repo has none. Adding
  recovery codes or a support path is the obvious next step.
- MFA on hosted Supabase requires a Pro plan; only the local stack is free.
- `README.md` is still the stock Vite template.
- `yarn lint` passes with three `only-export-components` fast-refresh warnings
  (`theme-provider`, `ledger-provider`, `ui/sidebar`) — those are known and expected.
- The production bundle is a single ~740 kB chunk; vite warns about it on every build.
