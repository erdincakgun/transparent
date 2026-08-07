SET check_function_bodies = false;
CREATE FUNCTION public.add_ledger_creator_as_member()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$begin
INSERT INTO public.ledgers_users (ledger_id, user_id) VALUES (NEW.id, auth.uid ());
RETURN NULL;
end;$function$;
CREATE TRIGGER add_ledger_creator_as_member AFTER INSERT ON public.ledgers FOR EACH ROW EXECUTE FUNCTION public.add_ledger_creator_as_member();
