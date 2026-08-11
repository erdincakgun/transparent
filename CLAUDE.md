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
`crypto.randomUUID()` client-side, insert without `.select()`, then navigate using the id
you already hold (`src/components/ledger-create-form.tsx`). Inserts into `accounts` and
`transactions` have no such problem; membership already exists there.

## Frontend shape

- **React 19** with the **React Compiler** enabled via Babel (`vite.config.ts`) — do not
  hand-write `useMemo`/`useCallback`/`memo` for performance; the compiler handles it.
- **react-router v8**, all routes declared inline in `src/main.tsx`. `RequireAuth` wraps
  the authenticated tree and subscribes to `onAuthStateChange`; `Dashboard` is the
  sidebar+header layout with an `<Outlet />`.
- **shadcn `base-nova` style built on `@base-ui/react`, not Radix.** Composition uses the
  `render={<Component />}` prop, *not* `asChild`. Copy new primitives with the shadcn CLI
  so they land in the same style; a `@supabase` registry is configured in
  `components.json`.
- **Tailwind v4**, configured entirely in CSS (`src/index.css`) — there is no
  `tailwind.config`. Theme is class-based (`.dark`) via `ThemeProvider`, defaulting to
  dark.
- Auth is **magic-link OTP + Cloudflare Turnstile**. One shared Supabase client, default
  export from `src/lib/supabase/client.ts`.

Conventions: `@/*` → `src/*`. Filenames kebab-case. Pages are default exports under
`src/pages/`, components are named exports under `src/components/`, untouched shadcn
primitives stay in `src/components/ui/`. Data loading is currently a plain
`useEffect` + `async load()` inside the component — there is no query library.

## Known breakage and gaps

- **`yarn build` fails.** TypeScript 7.0.2 removed `baseUrl`; it is still set in both
  `tsconfig.json` and `tsconfig.app.json:26`. Deleting the two `baseUrl` lines is enough —
  `paths` now resolves relative to the tsconfig itself. `yarn lint` passes (three
  fast-refresh warnings only).
- `ledger-create-form.tsx` navigates to `/ledgers/:id`, **a route that does not exist** in
  `main.tsx`. Creating a ledger currently lands on a blank page.
- The active ledger lives in `LedgerSwitcher`'s local state plus a `localStorage` key
  (`transparent:active-ledger-id`) and is not shared with anything else. Pages have no way
  to know which ledger they are showing — this is the main thing to solve before building
  them out.
- `summary`, `transactions`, `accounts` and `users` pages are one-line placeholders. The
  dashboard breadcrumb is still template text.
- No generated Supabase types — `supabase.from(...)` is untyped. `supabase gen types`
  would fix this.
- `README.md` is still the stock Vite template.
