REVOKE DELETE, MAINTAIN, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.accounts FROM authenticated;
REVOKE ALL ON public.accounts FROM service_role;
REVOKE DELETE, MAINTAIN, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.ledgers FROM authenticated;
REVOKE ALL ON public.ledgers FROM service_role;
REVOKE DELETE, MAINTAIN, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.organizations FROM authenticated;
REVOKE ALL ON public.organizations FROM service_role;
REVOKE DELETE, MAINTAIN, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.transactions FROM authenticated;
REVOKE ALL ON public.transactions FROM service_role;
