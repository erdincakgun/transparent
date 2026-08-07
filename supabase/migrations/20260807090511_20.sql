SET check_function_bodies = false;
CREATE FUNCTION public.add_organization_owner_as_member()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$BEGIN
  INSERT INTO public.organizations_members (organization, member, created_by) VALUES (NEW.id, NEW.created_by, NEW.created_by);
  RETURN NULL;
END;$function$;
CREATE TRIGGER add_organization_owner_as_member AFTER INSERT ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.add_organization_owner_as_member();
