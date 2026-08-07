GRANT SELECT ON public.organizations_members TO authenticated;
GRANT INSERT ON public.organizations_members TO authenticated;
GRANT SELECT ON public.ledgers_members TO authenticated;
GRANT INSERT ON public.ledgers_members TO authenticated;

ALTER TABLE public.organizations_members ADD CONSTRAINT organizations_members_organization_member_key UNIQUE (organization, member);
ALTER TABLE public.ledgers_members ADD CONSTRAINT ledgers_members_ledger_member_key UNIQUE (ledger, member);
