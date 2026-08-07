ALTER TABLE public.transactions ADD COLUMN ledger_id uuid NOT NULL;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_ledger_id_fkey FOREIGN KEY (ledger_id) REFERENCES public.ledgers(id);
