ALTER TABLE public.accounts ADD COLUMN currency public.currency NOT NULL;
ALTER TABLE public.transactions ADD COLUMN amount numeric NOT NULL;
