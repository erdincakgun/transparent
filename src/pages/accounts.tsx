import { useEffect, useState } from "react";
import { Link } from "react-router";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLedger } from "@/components/ledger-provider";
import supabase from "@/lib/supabase/client";

type Account = { id: string; name: string; description: string | null };

type AccountBalance = { id: string; balance: string };

const balanceFormat = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

export default function AccountsPage() {
  const { activeLedger, loading: ledgerLoading } = useLedger();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [balances, setBalances] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const ledgerId = activeLedger?.id;

  useEffect(() => {
    if (ledgerLoading) return;

    if (!ledgerId) {
      setAccounts([]);
      setBalances({});
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(undefined);

      const [accountResult, balanceResult] = await Promise.all([
        supabase
          .from("accounts")
          .select("id, name, description")
          .eq("ledger_id", ledgerId)
          .order("name"),
        supabase
          .from("account_balance")
          .select("id, balance::text")
          .eq("ledger_id", ledgerId),
      ]);

      if (cancelled) return;

      setAccounts(accountResult.data ?? []);
      setBalances(
        Object.fromEntries(
          ((balanceResult.data ?? []) as AccountBalance[]).map((row) => [
            row.id,
            row.balance,
          ]),
        ),
      );
      setError((accountResult.error ?? balanceResult.error)?.message);
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
            <div
              key={account.id}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-sm font-medium">
                  {account.name}
                </span>
                {account.description ? (
                  <span className="truncate text-sm text-muted-foreground">
                    {account.description}
                  </span>
                ) : null}
              </div>
              <span className="shrink-0 text-sm font-medium tabular-nums">
                {balanceFormat.format(Number(balances[account.id] ?? 0))}
              </span>
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
