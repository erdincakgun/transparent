ALTER TABLE public.accounts ADD CONSTRAINT accounts_id_ledger_id_key UNIQUE (id, ledger_id);
