import { useEffect, useState } from "react";
import { Link } from "react-router";
import { DownloadIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLedger } from "@/components/ledger-provider";
import { downloadCsv } from "@/lib/csv";
import supabase from "@/lib/supabase/client";

type Account = { id: string; name: string; description: string | null };

type AccountBalance = { id: string; balance: string };

const balanceFormat = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

const exportColumns = ["id", "ledger_id", "name", "description"];

export default function AccountsPage() {
  const { activeLedger, loading: ledgerLoading } = useLedger();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [balances, setBalances] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string>();

  const ledgerId = activeLedger?.id;

  async function handleExport() {
    if (!ledgerId) return;

    setExporting(true);

    const { data, error } = await supabase
      .from("active_accounts")
      .select(exportColumns.join(", "))
      .eq("ledger_id", ledgerId)
      .order("name");

    setExporting(false);

    if (error) {
      setError(error.message);
      return;
    }

    downloadCsv(`accounts-${ledgerId}.csv`, exportColumns, data ?? []);
  }

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
          .from("active_accounts")
          .select("id, name, description")
          .eq("ledger_id", ledgerId)
          .order("name"),
        supabase
          .from("account_balances")
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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            disabled={exporting || !ledgerId}
            onClick={handleExport}
          >
            <DownloadIcon />
            Export CSV
          </Button>
          <Button nativeButton={false} render={<Link to="/account-create" />}>
            <PlusIcon />
            Add account
          </Button>
        </div>
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
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-sm font-medium tabular-nums">
                  {balanceFormat.format(Number(balances[account.id] ?? 0))}
                </span>
                <Button
                  variant="destructive"
                  size="sm"
                  aria-label="Delete account"
                  nativeButton={false}
                  render={<Link to={`/accounts/delete/${account.id}`} />}
                >
                  <Trash2Icon />
                </Button>
              </div>
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
