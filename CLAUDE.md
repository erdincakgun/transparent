# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Transparent

Shared, append-only bookkeeping. A **ledger** holds **accounts**; accounts exchange
**transactions**; people get access to a ledger through **ledgers_users**.

Single-page React app talking directly to Supabase (Postgres + Auth) from the browser.
There is no backend of our own — no API server, no edge functions. The database *is* the
backend.

## Commands

```bash
yarn dev        # vite dev server on :5173
yarn build      # tsc -b && vite build   (currently fails — see Known breakage)
yarn lint       # oxlint
yarn knip       # unused files/exports/deps
npx supabase start / db reset / status   # CLI is not installed globally
```

There is no test framework and no test files — don't go looking for them. Verification is
`yarn lint`, `tsc -b`, and driving the app (Playwright MCP is available; its scratch
output lands in the gitignored `.playwright-mcp/`).

Node is pinned to 24.18.0 (`.nvmrc`). Local Supabase: API `:54321`, DB `:54322`,
Studio `:54323`, Inbucket `:54324`. Env vars live in `.env.local` (see `.env.example`);
all four are dev/test values, including the Turnstile test site key.

## The database contract

This is the part to internalise before writing any data code. The schema
(`supabase/migrations/00000000000000_initial.sql`) is finished and deliberate:
**correctness and security are enforced in Postgres, not in this app.** Do not add
client-side guards that duplicate a database rule, and do not work around one.

**Only `authenticated` exists.** `anon` and `service_role` are revoked from every
schema, table and function. An unauthenticated client can read nothing. There is no
service key anywhere in this repo and none should ever appear.

**RLS is enabled *and forced* on all four tables.** Every policy resolves membership
through one helper, `private.is_ledger_member(uuid)` — `security definer`, `search_path`
empty, living in the `private` schema (not exposed via the API) so policies never recurse
into the tables they protect. If you need a new policy, call that helper; never inline a
subquery against `ledgers_users`.

**Everything is append-only.** `before update or delete` triggers raise
`restrict_violation` on `ledgers`, `accounts` and `transactions`; truncate is blocked on
all four. The only permitted mutation besides insert is `delete` on `ledgers_users`
(removing a member). **A wrong transaction is corrected with a storno** — a second,
opposite transaction referencing the original in its description. Never reach for an
`UPDATE`; it will not fail silently, it will throw.

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

Sending any other column fails. Amounts are `numeric(20,4)`, must be `> 0`, and the two
accounts must differ — direction is expressed by which side an account sits on, never by
a negative amount. Account names are unique per ledger, case-insensitively.

**Creating a ledger is a two-step dance handled by the DB.** `ledgers_insert_authenticated`
lets any authenticated user insert, and an `after insert` trigger adds the creator to
`ledgers_users`. Because that trigger fires *after* the row is projected, `RETURNING`
cannot pass the SELECT policy — so the established pattern is: generate the id with
`crypto.randomUUID()` client-side, insert without `.select()`, then use the id you already
hold (`src/components/ledger-create-form.tsx`). Inserts into `accounts` and
`transactions` have no such problem; membership already exists there.

**Balances are a view, never a stored column.** `public.account_balances`
(`20260811000000_account_balancess.sql`) exposes `id, ledger_id, balance` as
*credits in minus debits out* (`sum` where `to_account_id` = account, minus `sum` where
`from_account_id` = account). It is `security_invoker = true`, so the caller's RLS on
`transactions` applies and no policy of its own is needed — but it still needs the
explicit `revoke all … from anon, authenticated, service_role` + `grant select … to
authenticated`, because default privileges are revoked repo-wide. Any new view or function
must repeat that pattern.

**Membership is granted by user id, not email.** `auth.users` is not exposed through the
API, so there is no way to look a person up. The sidebar user menu offers "Copy user ID"
(`nav-user.tsx`) precisely so it can be pasted into an invite by whoever adds the member.

## Frontend shape

- **React 19** with the **React Compiler** enabled via Babel (`vite.config.ts`) — do not
  hand-write `useMemo`/`useCallback`/`memo` for performance; the compiler handles it.
- **react-router v8**, all routes declared inline in `src/main.tsx`. The tree is
  `RequireAuth` (subscribes to `onAuthStateChange`) → `LedgerProvider` → either
  `Dashboard` (sidebar+header layout with an `<Outlet />`, holding `/`, `/transactions`,
  `/accounts`, `/users`) or the standalone full-screen create routes (`/ledger-create`,
  `/account-create`, `/transaction-create`). Anything needing `useLedger` must sit inside
  the provider.
- **shadcn `base-nova` style built on `@base-ui/react`, not Radix.** Composition uses the
  `render={<Component />}` prop, *not* `asChild` (and `nativeButton={false}` when a
  `Button` renders a `Link`). Copy new primitives with the shadcn CLI so they land in the
  same style; a `@supabase` registry is configured in `components.json`, and `.mcp.json`
  wires up the shadcn MCP server.
- **Tailwind v4**, configured entirely in CSS (`src/index.css`) — there is no
  `tailwind.config`. Theme is class-based (`.dark`) via `ThemeProvider`, defaulting to
  dark.
- Auth is **magic-link OTP + Cloudflare Turnstile**. One shared Supabase client, default
  export from `src/lib/supabase/client.ts`.

### The active ledger

`LedgerProvider` (`src/components/ledger-provider.tsx`) owns the ledger list and the
selection; consume it with `useLedger()` — `{ ledgers, activeLedger, selectLedger,
refreshLedgers, loading }`. The choice persists in a **per-user** localStorage key,
`transparent:active-ledger-id:<userId>`, and a `storage` listener keeps other tabs in
sync. Pages read `activeLedger?.id` and must wait out `loading` before deciding a ledger
is absent. After creating a ledger, call `refreshLedgers()` then `selectLedger(id)`.
`AppSidebar` redirects to `/ledger-create` when a signed-in user has no ledgers at all.

### Data-loading conventions

There is no query library. Every page/form does `useEffect` + a local `async load()`,
guarded by a `cancelled` flag, keyed on `[ledgerLoading, ledgerId]`, with parallel reads
batched through `Promise.all` (see `src/pages/accounts.tsx`, `src/pages/transactions.tsx`).
Local `loading`/`error` state renders `Skeleton` rows and an empty-state card.

Because the database is the validator, forms submit and then **translate the Postgres
error into copy** rather than pre-checking: `error.code === "23505"` → duplicate account
name, `transactions_distinct_accounts` in the message → pick two different accounts.
Follow that pattern for new constraints instead of adding client-side guards.

Money stays a **string** all the way from PostgREST (`numeric` is serialised as text to
preserve precision) and is only converted at the last moment for
`Intl.NumberFormat`. The balance view is selected as `"id, balance::text"` for the same
reason — don't drop the cast.

Conventions: `@/*` → `src/*`. Filenames kebab-case. Pages are default exports under
`src/pages/`, components are named exports under `src/components/`, untouched shadcn
primitives stay in `src/components/ui/`. Create routes follow a fixed split: an
11-line page that centres the viewport wrapping a `*-create-form` component that holds
all logic.

## Known breakage and gaps

- **`yarn build` fails.** TypeScript 7.0.2 removed `baseUrl`; `tsc -b` reports
  `TS5102` at `tsconfig.app.json:26`, and the same line sits in `tsconfig.json:9`.
  Deleting both is verified sufficient — `paths` resolves relative to the tsconfig
  itself. `yarn lint` passes (three fast-refresh warnings only).
- No generated Supabase types — `supabase.from(...)` is untyped and every row shape is
  hand-declared at the top of the file that reads it. `supabase gen types` would fix this.
- `README.md` is still the stock Vite template.
