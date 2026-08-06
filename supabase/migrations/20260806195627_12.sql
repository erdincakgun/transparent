CREATE POLICY "Enable insert for users based on created_by" ON public.organizations FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = created_by));
CREATE POLICY "Enable users to view their own data only" ON public.organizations FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = created_by));
