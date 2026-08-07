CREATE POLICY "Enable insert for authenticated users only" ON public.ledgers FOR INSERT TO authenticated WITH CHECK (true);
