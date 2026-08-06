ALTER TABLE public.accounts ADD COLUMN created_by uuid DEFAULT auth.uid() NOT NULL;
ALTER TABLE public.accounts ADD CONSTRAINT accounts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE public.ledgers ADD COLUMN created_by uuid DEFAULT auth.uid() NOT NULL;
ALTER TABLE public.ledgers ADD CONSTRAINT ledgers_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE public.organizations ADD COLUMN created_by uuid DEFAULT auth.uid() NOT NULL;
ALTER TABLE public.organizations ADD CONSTRAINT organizations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE public.transactions ADD COLUMN created_by uuid DEFAULT auth.uid() NOT NULL;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
