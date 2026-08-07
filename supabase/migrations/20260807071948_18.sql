CREATE POLICY "Enable insert for users based on created_by" ON public.accounts FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = created_by));
CREATE POLICY "Enable insert for users based on created_by" ON public.ledgers FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = created_by));
CREATE POLICY "Enable insert for users based on created_by" ON public.transactions FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = created_by));
