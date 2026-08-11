import { useEffect, useState } from "react";
import { Link } from "react-router";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLedger } from "@/components/ledger-provider";
import supabase from "@/lib/supabase/client";

type LedgerUser = { user_id: string };

export default function UsersPage() {
  const { activeLedger, loading: ledgerLoading } = useLedger();
  const [users, setUsers] = useState<LedgerUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const ledgerId = activeLedger?.id;

  useEffect(() => {
    if (ledgerLoading) return;

    if (!ledgerId) {
      setUsers([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(undefined);

      const [userResult, sessionResult] = await Promise.all([
        supabase
          .from("ledgers_users")
          .select("user_id")
          .eq("ledger_id", ledgerId)
          .order("user_id"),
        supabase.auth.getSession(),
      ]);

      if (cancelled) return;

      setUsers(userResult.data ?? []);
      setCurrentUserId(sessionResult.data.session?.user.id);
      setError(userResult.error?.message);
      setLoading(false);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [ledgerLoading, ledgerId]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {loading
            ? "Loading users"
            : `${users.length} ${users.length === 1 ? "user" : "users"}`}
        </p>
        <Button nativeButton={false} render={<Link to="/user-add" />}>
          <PlusIcon />
          Add user
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : loading ? (
        <div className="divide-y rounded-lg border">
          {[0, 1, 2].map((row) => (
            <div key={row} className="px-4 py-3">
              <Skeleton className="h-4 w-72" />
            </div>
          ))}
        </div>
      ) : users.length ? (
        <div className="divide-y rounded-lg border">
          {users.map((user) => (
            <div
              key={user.user_id}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <span className="truncate text-sm font-medium">
                {user.user_id}
              </span>
              <div className="flex shrink-0 items-center gap-3">
                {user.user_id === currentUserId ? (
                  <span className="text-sm text-muted-foreground">You</span>
                ) : null}
                <Button
                  variant="destructive"
                  size="sm"
                  nativeButton={false}
                  render={<Link to={`/users/delete/${user.user_id}`} />}
                >
                  <Trash2Icon />
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          This ledger has no users yet
        </div>
      )}
    </div>
  );
}
