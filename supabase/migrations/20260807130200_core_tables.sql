CREATE TABLE public.ledgers (
    id          uuid        NOT NULL DEFAULT gen_random_uuid(),
    created_at  timestamptz NOT NULL DEFAULT now(),
    created_by  uuid        NOT NULL DEFAULT auth.uid(),
    name        text,
    description text,

    CONSTRAINT ledgers_pkey PRIMARY KEY (id),
    CONSTRAINT ledgers_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users (id) ON DELETE RESTRICT,
    CONSTRAINT ledgers_name_not_blank CHECK (btrim(name) <> ''),
    CONSTRAINT ledgers_name_length CHECK (char_length(name) <= 100),
    CONSTRAINT ledgers_description_length CHECK (char_length(description) <= 500)
);

CREATE TABLE public.ledgers_users (
    id         uuid        NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    ledger_id  uuid        NOT NULL,
    user_id    uuid        NOT NULL,

    CONSTRAINT ledgers_users_pkey PRIMARY KEY (id),
    CONSTRAINT ledgers_users_ledger_id_fkey FOREIGN KEY (ledger_id) REFERENCES public.ledgers (id) ON DELETE CASCADE,
    CONSTRAINT ledgers_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
    CONSTRAINT ledgers_users_unique_membership UNIQUE (ledger_id, user_id)
);

CREATE INDEX ledgers_users_user_id_idx ON public.ledgers_users (user_id);

CREATE TABLE public.accounts (
    id          uuid        NOT NULL DEFAULT gen_random_uuid(),
    created_at  timestamptz NOT NULL DEFAULT now(),
    created_by  uuid        NOT NULL DEFAULT auth.uid(),
    ledger_id   uuid        NOT NULL,
    name        text,
    currency    text        NOT NULL,
    description text,

    CONSTRAINT accounts_pkey PRIMARY KEY (id),
    CONSTRAINT accounts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users (id) ON DELETE RESTRICT,
    CONSTRAINT accounts_ledger_id_fkey FOREIGN KEY (ledger_id) REFERENCES public.ledgers (id) ON DELETE RESTRICT,
    CONSTRAINT accounts_currency_format CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT accounts_name_not_blank CHECK (btrim(name) <> ''),
    CONSTRAINT accounts_name_length CHECK (char_length(name) <= 100),
    CONSTRAINT accounts_description_length CHECK (char_length(description) <= 500),
    CONSTRAINT accounts_id_ledger_currency_key UNIQUE (id, ledger_id, currency)
);

CREATE INDEX accounts_ledger_id_idx ON public.accounts (ledger_id);

CREATE TABLE public.transactions (
    id              uuid           NOT NULL DEFAULT gen_random_uuid(),
    created_at      timestamptz    NOT NULL DEFAULT now(),
    created_by      uuid           NOT NULL DEFAULT auth.uid(),
    ledger_id       uuid           NOT NULL,
    from_account_id uuid           NOT NULL,
    to_account_id   uuid           NOT NULL,
    currency        text           NOT NULL,
    amount          numeric(20, 4) NOT NULL,
    description     text,

    CONSTRAINT transactions_pkey PRIMARY KEY (id),
    CONSTRAINT transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users (id) ON DELETE RESTRICT,
    CONSTRAINT transactions_ledger_id_fkey FOREIGN KEY (ledger_id) REFERENCES public.ledgers (id) ON DELETE RESTRICT,
    CONSTRAINT transactions_from_account_fkey FOREIGN KEY (from_account_id, ledger_id, currency) REFERENCES public.accounts (id, ledger_id, currency) ON DELETE RESTRICT,
    CONSTRAINT transactions_to_account_fkey FOREIGN KEY (to_account_id, ledger_id, currency) REFERENCES public.accounts (id, ledger_id, currency) ON DELETE RESTRICT,
    CONSTRAINT transactions_amount_positive CHECK (amount > 0),
    CONSTRAINT transactions_accounts_differ CHECK (from_account_id <> to_account_id),
    CONSTRAINT transactions_description_length CHECK (char_length(description) <= 500)
);

CREATE INDEX transactions_ledger_id_created_at_idx ON public.transactions (ledger_id, created_at DESC);
CREATE INDEX transactions_from_account_id_idx ON public.transactions (from_account_id);
CREATE INDEX transactions_to_account_id_idx ON public.transactions (to_account_id);

ALTER TABLE public.ledgers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledgers_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions  ENABLE ROW LEVEL SECURITY;
