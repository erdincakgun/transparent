create table public.ledger_descriptions (
  id bigint primary key generated always as identity,
  ledger_id uuid not null references public.ledgers (id),
  description text,
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users (id)
);

alter table public.ledger_descriptions
  add constraint ledger_descriptions_description_length
  check (length(btrim(description)) between 1 and 1000);

create index ledger_descriptions_latest_index
  on public.ledger_descriptions (ledger_id, id desc);

create table public.account_descriptions (
  id bigint primary key generated always as identity,
  account_id uuid not null,
  ledger_id uuid not null,
  description text,
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users (id),

  foreign key (account_id, ledger_id)
    references public.accounts (id, ledger_id)
);

alter table public.account_descriptions
  add constraint account_descriptions_description_length
  check (length(btrim(description)) between 1 and 1000);

create index account_descriptions_latest_index
  on public.account_descriptions (account_id, id desc);

create index account_descriptions_ledger_id_index
  on public.account_descriptions (ledger_id);

create function private.reject_deleted_account_description()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  perform 1
  from public.accounts
  where id = new.account_id
  for share;

  if exists (
    select 1
    from public.deleted_accounts
    where account_id = new.account_id
  ) then
    raise exception 'account % is deleted', new.account_id
      using errcode = 'restrict_violation';
  end if;

  return new;
end;
$$;

revoke all on function private.reject_deleted_account_description() from public;

create trigger account_descriptions_reject_deleted_account
  before insert on public.account_descriptions
  for each row
  execute function private.reject_deleted_account_description();

create trigger ledger_descriptions_reject_update_delete
  before update or delete on public.ledger_descriptions
  for each row
  execute function private.reject_statement();

create trigger ledger_descriptions_reject_truncate
  before truncate on public.ledger_descriptions
  for each statement
  execute function private.reject_statement();

create trigger account_descriptions_reject_update_delete
  before update or delete on public.account_descriptions
  for each row
  execute function private.reject_statement();

create trigger account_descriptions_reject_truncate
  before truncate on public.account_descriptions
  for each statement
  execute function private.reject_statement();

alter table public.ledger_descriptions enable row level security;
alter table public.ledger_descriptions force row level security;

alter table public.account_descriptions enable row level security;
alter table public.account_descriptions force row level security;

create policy ledger_descriptions_select_member
  on public.ledger_descriptions
  for select
  to authenticated
  using (private.is_mfa_verified() and private.is_ledger_member(ledger_id));

create policy ledger_descriptions_insert_member
  on public.ledger_descriptions
  for insert
  to authenticated
  with check (private.is_mfa_verified() and private.is_ledger_member(ledger_id));

create policy account_descriptions_select_member
  on public.account_descriptions
  for select
  to authenticated
  using (private.is_mfa_verified() and private.is_ledger_member(ledger_id));

create policy account_descriptions_insert_member
  on public.account_descriptions
  for insert
  to authenticated
  with check (private.is_mfa_verified() and private.is_ledger_member(ledger_id));

revoke all on public.ledger_descriptions from anon, authenticated, service_role;
revoke all on public.account_descriptions from anon, authenticated, service_role;

grant select on public.ledger_descriptions to authenticated;
grant insert (ledger_id, description) on public.ledger_descriptions to authenticated;

grant select on public.account_descriptions to authenticated;
grant insert (account_id, ledger_id, description)
  on public.account_descriptions to authenticated;

create or replace view public.active_ledgers
with (security_invoker = true) as
select
  l.id,
  l.name,
  case when latest.id is null then l.description else latest.description end
    as description,
  l.created_by,
  l.created_at
from public.ledgers l
left join lateral (
  select d.id, d.description
  from public.ledger_descriptions d
  where d.ledger_id = l.id
  order by d.id desc
  limit 1
) latest on true
where not exists (
  select 1
  from public.deleted_ledgers dl
  where dl.ledger_id = l.id
);

revoke all on public.active_ledgers from anon, authenticated, service_role;

grant select on public.active_ledgers to authenticated;

create or replace view public.active_accounts
with (security_invoker = true) as
select
  a.id,
  a.ledger_id,
  a.name,
  case when latest.id is null then a.description else latest.description end
    as description,
  a.created_by,
  a.created_at
from public.accounts a
left join lateral (
  select d.id, d.description
  from public.account_descriptions d
  where d.account_id = a.id
  order by d.id desc
  limit 1
) latest on true
where not exists (
  select 1
  from public.deleted_accounts da
  where da.account_id = a.id
);

revoke all on public.active_accounts from anon, authenticated, service_role;

grant select on public.active_accounts to authenticated;
