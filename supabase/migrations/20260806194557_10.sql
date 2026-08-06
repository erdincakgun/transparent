ALTER TABLE public.accounts ADD COLUMN name text NOT NULL;
ALTER TABLE public.accounts ADD CONSTRAINT accounts_ledger_name_key UNIQUE (ledger, name);
