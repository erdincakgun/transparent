ALTER TABLE public.ledgers ADD COLUMN name text NOT NULL;
ALTER TABLE public.ledgers ADD CONSTRAINT ledgers_organization_name_key UNIQUE (organization, name);
