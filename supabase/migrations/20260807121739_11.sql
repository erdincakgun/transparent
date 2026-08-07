CREATE POLICY "Enable insert for ledger members" ON public.accounts FOR INSERT TO authenticated
WITH
   CHECK (
      (
         EXISTS (
            SELECT
               1
            FROM
               public.ledgers_users
            WHERE
               (
                  (ledgers_users.ledger_id = accounts.ledger_id)
                  AND (
                     ledgers_users.user_id = (
                        SELECT
                           auth.uid() AS uid
                     )
                  )
               )
         )
      )
   );