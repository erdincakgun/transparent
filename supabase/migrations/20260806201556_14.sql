ALTER TABLE public.accounts ADD CONSTRAINT accounts_id_ledger_currency_key UNIQUE (id, ledger, currency);
ALTER TABLE public.transactions ADD COLUMN ledger bigint NOT NULL;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_ledger_fkey FOREIGN KEY (ledger) REFERENCES public.ledgers(id);
ALTER TABLE public.transactions ADD COLUMN currency public.currency NOT NULL;
