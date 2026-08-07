CREATE POLICY "Enable users to view their own data only" ON public.ledgers_users FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));
