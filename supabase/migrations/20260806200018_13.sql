ALTER TABLE public.transactions ADD CONSTRAINT transactions_amount_positive CHECK (amount > 0::numeric);
ALTER TABLE public.transactions ADD CONSTRAINT transactions_distinct_accounts CHECK (from_account <> to_account);
