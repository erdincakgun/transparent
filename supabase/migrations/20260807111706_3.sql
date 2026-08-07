SET check_function_bodies = false;
CREATE FUNCTION public.add_ledger_creator_as_member()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$begin
insert into
  public.ledgers_users (ledger_id, user_id)
values
  (NEW.id, auth.uid ());
end;$function$;
CREATE TRIGGER add_ledger_creator_as_member AFTER INSERT ON public.ledgers FOR EACH ROW EXECUTE FUNCTION public.add_ledger_creator_as_member();
