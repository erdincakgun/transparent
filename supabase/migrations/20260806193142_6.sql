ALTER TABLE public.accounts ADD COLUMN ledger bigint NOT NULL;
ALTER TABLE public.accounts ADD CONSTRAINT accounts_ledger_fkey FOREIGN KEY (ledger) REFERENCES public.ledgers(id);
ALTER TABLE public.ledgers ADD COLUMN organization bigint NOT NULL;
ALTER TABLE public.ledgers ADD CONSTRAINT ledgers_organization_fkey FOREIGN KEY (organization) REFERENCES public.organizations(id);
ALTER TABLE public.transactions ADD COLUMN from_account bigint NOT NULL;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_from_account_fkey FOREIGN KEY (from_account) REFERENCES public.accounts(id);
ALTER TABLE public.transactions ADD COLUMN to_account bigint NOT NULL;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_to_account_fkey FOREIGN KEY (to_account) REFERENCES public.accounts(id);
