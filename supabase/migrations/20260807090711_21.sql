SET check_function_bodies = false;
CREATE FUNCTION public.add_ledger_owner_as_member()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$BEGIN
  INSERT INTO public.ledgers_members (ledger, member, created_by) VALUES (NEW.id, NEW.created_by, NEW.created_by);
  RETURN NULL;
END;$function$;
CREATE TRIGGER add_ledger_owner_as_member AFTER INSERT ON public.ledgers FOR EACH ROW EXECUTE FUNCTION public.add_ledger_owner_as_member();
