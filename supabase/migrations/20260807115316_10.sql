ALTER TABLE public.transactions ADD CONSTRAINT transactions_accounts_differ CHECK (from_account_id <> to_account_id);
ALTER TABLE public.transactions ADD CONSTRAINT transactions_from_account_fkey FOREIGN KEY (from_account_id, ledger_id) REFERENCES public.accounts(id, ledger_id);
ALTER TABLE public.transactions ADD CONSTRAINT transactions_to_account_fkey FOREIGN KEY (to_account_id, ledger_id) REFERENCES public.accounts(id, ledger_id);
