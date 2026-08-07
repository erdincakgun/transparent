CREATE FUNCTION private.is_ledger_member(p_ledger_id uuid)
    RETURNS boolean
    LANGUAGE sql
    SECURITY DEFINER
    STABLE
    SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.ledgers_users AS lu
        WHERE lu.ledger_id = p_ledger_id
          AND lu.user_id   = auth.uid()
    );
$$;

CREATE FUNCTION private.is_ledger_owner(p_ledger_id uuid)
    RETURNS boolean
    LANGUAGE sql
    SECURITY DEFINER
    STABLE
    SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.ledgers AS l
        WHERE l.id         = p_ledger_id
          AND l.created_by = auth.uid()
    );
$$;

REVOKE ALL ON FUNCTION private.is_ledger_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_ledger_owner(uuid)  FROM PUBLIC;
