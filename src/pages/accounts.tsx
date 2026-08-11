import { useEffect, useState } from "react";
import { Link } from "react-router";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLedger } from "@/components/ledger-provider";
import supabase from "@/lib/supabase/client";

type Account = { id: string; name: string; description: string | null };

export default function AccountsPage() {
  const { activeLedger, loading: ledgerLoading } = useLedger();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const ledgerId = activeLedger?.id;

  useEffect(() => {
    if (ledgerLoading) return;

    if (!ledgerId) {
      setAccounts([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(undefined);

      const { data, error } = await supabase
        .from("accounts")
        .select("id, name, description")
        .eq("ledger_id", ledgerId)
        .order("name");

      if (cancelled) return;

      setAccounts(data ?? []);
      setError(error?.message);
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
            ? "Loading accounts"
            : `${accounts.length} ${accounts.length === 1 ? "account" : "accounts"}`}
        </p>
        <Button nativeButton={false} render={<Link to="/account-create" />}>
          <PlusIcon />
          Add account
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : loading ? (
        <div className="divide-y rounded-lg border">
          {[0, 1, 2].map((row) => (
            <div key={row} className="px-4 py-3">
              <Skeleton className="h-4 w-40" />
            </div>
          ))}
        </div>
      ) : accounts.length ? (
        <div className="divide-y rounded-lg border">
          {accounts.map((account) => (
            <div key={account.id} className="flex flex-col gap-0.5 px-4 py-3">
              <span className="text-sm font-medium">{account.name}</span>
              {account.description ? (
                <span className="text-sm text-muted-foreground">
                  {account.description}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          This ledger has no accounts yet
        </div>
      )}
    </div>
  );
}
