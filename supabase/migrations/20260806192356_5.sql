ALTER TABLE public.organizations ADD COLUMN name text NOT NULL;
ALTER TABLE public.organizations ADD CONSTRAINT organizations_name_key UNIQUE (name);
