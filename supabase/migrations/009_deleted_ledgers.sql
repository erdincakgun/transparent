create table public.deleted_ledgers (
  ledger_id uuid primary key references public.ledgers (id),
  deleted_at timestamptz not null default now(),
  deleted_by uuid not null default auth.uid() references auth.users (id)
);

create trigger deleted_ledgers_reject_update_delete
  before update or delete on public.deleted_ledgers
  for each row
  execute function private.reject_statement();

create trigger deleted_ledgers_reject_truncate
  before truncate on public.deleted_ledgers
  for each statement
  execute function private.reject_statement();

alter table public.deleted_ledgers enable row level security;
alter table public.deleted_ledgers force row level security;

create policy deleted_ledgers_select_member
  on public.deleted_ledgers
  for select
  to authenticated
  using (private.is_mfa_verified() and private.is_ledger_member(ledger_id));

create policy deleted_ledgers_insert_member
  on public.deleted_ledgers
  for insert
  to authenticated
  with check (private.is_mfa_verified() and private.is_ledger_member(ledger_id));

revoke all on public.deleted_ledgers from anon, authenticated, service_role;

grant select on public.deleted_ledgers to authenticated;
grant insert (ledger_id) on public.deleted_ledgers to authenticated;

create view public.active_ledgers
with (security_invoker = true) as
select
  l.id,
  l.name,
  l.description,
  l.created_by,
  l.created_at
from public.ledgers l
where not exists (
  select 1
  from public.deleted_ledgers d
  where d.ledger_id = l.id
);

revoke all on public.active_ledgers from anon, authenticated, service_role;

grant select on public.active_ledgers to authenticated;
