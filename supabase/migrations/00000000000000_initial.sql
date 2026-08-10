create schema private;

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated, service_role;

alter default privileges for role postgres in schema private
  revoke all on tables from anon, authenticated, service_role;

alter default privileges for role postgres in schema private
  revoke all on sequences from anon, authenticated, service_role;

alter default privileges for role postgres in schema private
  revoke all on functions from anon, authenticated, service_role;

revoke all on schema public from anon;
revoke all on schema private from public, anon, authenticated, service_role;

grant usage on schema private to authenticated;

create table public.ledgers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text
);

alter table public.ledgers
  add constraint ledgers_name_length
  check (length(btrim(name)) between 1 and 100);

alter table public.ledgers
  add constraint ledgers_description_length
  check (length(btrim(description)) between 1 and 1000);

create table public.ledgers_users (
  ledger_id uuid not null references public.ledgers (id),
  user_id uuid not null references auth.users (id),
  primary key (ledger_id, user_id)
);

create index ledgers_users_user_id_index
  on public.ledgers_users (user_id);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.ledgers (id),
  name text not null,
  description text,
  unique (id, ledger_id)
);

alter table public.accounts
  add constraint accounts_name_length
  check (length(btrim(name)) between 1 and 200);

alter table public.accounts
  add constraint accounts_description_length
  check (length(btrim(description)) between 1 and 1000);

create unique index accounts_ledger_id_name_unique
  on public.accounts (ledger_id, lower(name));

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  ledger_id uuid not null,
  from_account_id uuid not null,
  to_account_id uuid not null,
  amount numeric(20, 4) not null,
  description text not null,

  foreign key (from_account_id, ledger_id)
    references public.accounts (id, ledger_id),

  foreign key (to_account_id, ledger_id)
    references public.accounts (id, ledger_id)
);

alter table public.transactions
  add constraint transactions_amount_positive
  check (amount > 0);

alter table public.transactions
  add constraint transactions_distinct_accounts
  check (from_account_id <> to_account_id);

alter table public.transactions
  add constraint transactions_description_length
  check (length(btrim(description)) between 1 and 1000);

create index transactions_ledger_id_index
  on public.transactions (ledger_id);

create index transactions_from_account_id_index
  on public.transactions (from_account_id);

create index transactions_to_account_id_index
  on public.transactions (to_account_id);

create function private.is_ledger_member(target_ledger_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from public.ledgers_users
    where ledger_id = target_ledger_id
      and user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_ledger_member(uuid) from public;
grant execute on function private.is_ledger_member(uuid) to authenticated;

create function private.reject_statement()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  raise exception '% is not permitted on %.%',
    tg_op, tg_table_schema, tg_table_name
    using errcode = 'restrict_violation';
end;
$$;

revoke all on function private.reject_statement() from public;

create function private.add_ledger_creator_as_member()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  insert into public.ledgers_users (ledger_id, user_id)
  values (new.id, (select auth.uid()));

  return null;
end;
$$;

revoke all on function private.add_ledger_creator_as_member() from public;

create trigger ledgers_add_creator_as_member
  after insert on public.ledgers
  for each row
  execute function private.add_ledger_creator_as_member();

create trigger ledgers_reject_update_delete
  before update or delete on public.ledgers
  for each row
  execute function private.reject_statement();

create trigger ledgers_reject_truncate
  before truncate on public.ledgers
  for each statement
  execute function private.reject_statement();

create trigger ledgers_users_reject_update
  before update on public.ledgers_users
  for each row
  execute function private.reject_statement();

create trigger ledgers_users_reject_truncate
  before truncate on public.ledgers_users
  for each statement
  execute function private.reject_statement();

create trigger accounts_reject_update_delete
  before update or delete on public.accounts
  for each row
  execute function private.reject_statement();

create trigger accounts_reject_truncate
  before truncate on public.accounts
  for each statement
  execute function private.reject_statement();

create trigger transactions_reject_update_delete
  before update or delete on public.transactions
  for each row
  execute function private.reject_statement();

create trigger transactions_reject_truncate
  before truncate on public.transactions
  for each statement
  execute function private.reject_statement();

alter table public.ledgers enable row level security;
alter table public.ledgers force row level security;

alter table public.ledgers_users enable row level security;
alter table public.ledgers_users force row level security;

alter table public.accounts enable row level security;
alter table public.accounts force row level security;

alter table public.transactions enable row level security;
alter table public.transactions force row level security;

create policy ledgers_select_member
  on public.ledgers
  for select
  to authenticated
  using (private.is_ledger_member(id));

create policy ledgers_insert_authenticated
  on public.ledgers
  for insert
  to authenticated
  with check (true);

create policy ledgers_users_select_member
  on public.ledgers_users
  for select
  to authenticated
  using (private.is_ledger_member(ledger_id));

create policy ledgers_users_insert_member
  on public.ledgers_users
  for insert
  to authenticated
  with check (private.is_ledger_member(ledger_id));

create policy ledgers_users_delete_member
  on public.ledgers_users
  for delete
  to authenticated
  using (private.is_ledger_member(ledger_id));

create policy accounts_select_member
  on public.accounts
  for select
  to authenticated
  using (private.is_ledger_member(ledger_id));

create policy accounts_insert_member
  on public.accounts
  for insert
  to authenticated
  with check (private.is_ledger_member(ledger_id));

create policy transactions_select_member
  on public.transactions
  for select
  to authenticated
  using (private.is_ledger_member(ledger_id));

create policy transactions_insert_member
  on public.transactions
  for insert
  to authenticated
  with check (private.is_ledger_member(ledger_id));

revoke all on public.ledgers from anon, authenticated, service_role;
revoke all on public.ledgers_users from anon, authenticated, service_role;
revoke all on public.accounts from anon, authenticated, service_role;
revoke all on public.transactions from anon, authenticated, service_role;

grant select on public.ledgers to authenticated;
grant insert (id, name, description) on public.ledgers to authenticated;

grant select on public.ledgers_users to authenticated;
grant insert (ledger_id, user_id) on public.ledgers_users to authenticated;
grant delete on public.ledgers_users to authenticated;

grant select on public.accounts to authenticated;
grant insert (ledger_id, name, description) on public.accounts to authenticated;

grant select on public.transactions to authenticated;
grant insert (ledger_id, from_account_id, to_account_id, amount, description)
  on public.transactions to authenticated;
