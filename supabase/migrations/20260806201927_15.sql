ALTER TABLE public.transactions DROP CONSTRAINT transactions_from_account_fkey;
ALTER TABLE public.transactions DROP CONSTRAINT transactions_to_account_fkey;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_from_account_fkey FOREIGN KEY (from_account, ledger, currency) REFERENCES public.accounts(id, ledger, currency);
ALTER TABLE public.transactions ADD CONSTRAINT transactions_to_account_fkey FOREIGN KEY (to_account, ledger, currency) REFERENCES public.accounts(id, ledger, currency);
