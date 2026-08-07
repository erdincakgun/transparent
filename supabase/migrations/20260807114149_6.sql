CREATE POLICY "Enable select for ledger members" ON public.ledgers FOR
SELECT
   TO authenticated USING (
      (
         EXISTS (
            SELECT
               1
            FROM
               public.ledgers_users
            WHERE
               (
                  (ledgers_users.ledger_id = ledgers.id)
                  AND (ledgers_users.user_id = auth.uid ())
               )
         )
      )
   );