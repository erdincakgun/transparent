CREATE TABLE public.accounts (id uuid DEFAULT gen_random_uuid() NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL, ledger_id uuid NOT NULL);
CREATE TABLE public.ledgers (id uuid DEFAULT gen_random_uuid() NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public.ledgers_users (id uuid DEFAULT gen_random_uuid() NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL, ledger_id uuid NOT NULL, user_id uuid NOT NULL);
CREATE TABLE public.transactions (id uuid DEFAULT gen_random_uuid() NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL, from_account_id uuid NOT NULL, to_account_id uuid NOT NULL, amount numeric NOT NULL, description text);

REVOKE ALL ON public.accounts FROM anon, service_role;
REVOKE ALL ON public.ledgers FROM anon, service_role;
REVOKE ALL ON public.ledgers_users FROM anon, service_role;
REVOKE ALL ON public.transactions FROM anon, service_role;

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledgers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledgers_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.accounts ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);
ALTER TABLE public.accounts ADD CONSTRAINT accounts_ledger_id_fkey FOREIGN KEY (ledger_id) REFERENCES public.ledgers(id);

ALTER TABLE public.ledgers ADD CONSTRAINT ledgers_pkey PRIMARY KEY (id);

ALTER TABLE public.ledgers_users ADD CONSTRAINT ledgers_users_ledger_id_fkey FOREIGN KEY (ledger_id) REFERENCES public.ledgers(id);
ALTER TABLE public.ledgers_users ADD CONSTRAINT ledgers_users_pkey PRIMARY KEY (id);
ALTER TABLE public.ledgers_users ADD CONSTRAINT ledgers_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE public.transactions ADD CONSTRAINT transactions_amount_check CHECK (amount > 0::numeric);
ALTER TABLE public.transactions ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);

GRANT SELECT, INSERT ON public.accounts TO authenticated;
GRANT SELECT, INSERT ON public.ledgers TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.ledgers_users TO authenticated;
GRANT SELECT, INSERT ON public.transactions TO authenticated;
