import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  DownloadIcon,
  PencilLine,
  PlusIcon,
  ReceiptTextIcon,
  Trash2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLedger } from "@/components/ledger-provider";
import { Actor } from "@/components/actor";
import {
  AccountDetailsDialog,
  type Account,
} from "@/components/account-details-dialog";
import { BalanceAmount } from "@/components/balance-amount";
import { downloadCsv } from "@/lib/csv";
import { fetchAllRows } from "@/lib/pagination";
import { useDocumentTitle } from "@/hooks/use-document-title";
import supabase from "@/lib/supabase/client";

type AccountBalance = { id: string; balance: string };

const exportColumns = ["id", "ledger_id", "name", "description", "created_by"];

export default function AccountsPage() {
  useDocumentTitle("Accounts");
  const { activeLedger, loading: ledgerLoading } = useLedger();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [balances, setBalances] = useState<Record<string, string>>({});
  const [currentUserId, setCurrentUserId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string>();

  const ledgerId = activeLedger?.id;

  async function handleExport() {
    if (!ledgerId) return;

    setExporting(true);

    const [{ data, error }, { count, error: countError }] = await Promise.all([
      fetchAllRows((from, to) =>
        supabase
          .from("active_accounts")
          .select(exportColumns.join(", "))
          .eq("ledger_id", ledgerId)
          .order("name")
          .order("id", { ascending: true })
          .range(from, to),
      ),
      supabase
        .from("active_accounts")
        .select("*", { count: "exact", head: true })
        .eq("ledger_id", ledgerId),
    ]);

    setExporting(false);

    if (error ?? countError) {
      setError((error ?? countError)?.message);
      return;
    }

    if (!data || data.length !== count) {
      setError("Export incomplete — nothing was saved.");
      return;
    }

    downloadCsv(`accounts-${ledgerId}.csv`, exportColumns, data);
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

      const [accountResult, balanceResult, sessionResult] = await Promise.all([
        fetchAllRows<Account>((from, to) =>
          supabase
            .from("active_accounts")
            .select("id, name, description, created_by")
            .eq("ledger_id", ledgerId)
            .order("name")
            .order("id", { ascending: true })
            .range(from, to),
        ),
        fetchAllRows<AccountBalance>((from, to) =>
          supabase
            .from("account_balances")
            .select("id, balance::text")
            .eq("ledger_id", ledgerId)
            .order("id", { ascending: true })
            .range(from, to),
        ),
        supabase.auth.getSession(),
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
      setCurrentUserId(sessionResult.data.session?.user.id);
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
      {/* The breadcrumb names the page for anyone who can see it; this is the
          same name as a heading, which is what "jump to the main heading"
          finds. Hidden because repeating it on screen would say it twice. */}
      <h1 className="sr-only">Accounts</h1>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          {/* 4.1.3: the row count is the result of the load, and it arrives
              without focus moving anywhere. */}
          <p role="status" className="text-sm text-muted-foreground">
            {loading
              ? "Loading accounts"
              : `${accounts.length} ${accounts.length === 1 ? "account" : "accounts"}`}
          </p>
          {activeLedger?.description ? (
            <p className="truncate text-xs text-muted-foreground">
              {activeLedger.description}
            </p>
          ) : null}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
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
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : loading ? (
        <div aria-hidden="true" className="divide-y rounded-lg border">
          {[0, 1, 2].map((row) => (
            <div key={row} className="px-4 py-3">
              <Skeleton className="h-4 w-40" />
            </div>
          ))}
        </div>
      ) : accounts.length ? (
        <div className="divide-y overflow-hidden rounded-lg border">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="relative flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <AccountDetailsDialog
                account={account}
                balance={balances[account.id] ?? "0"}
                currentUserId={currentUserId}
              />
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
              <div className="flex items-center justify-between gap-3 sm:shrink-0">
                <div className="flex min-w-0 flex-col gap-0.5 sm:items-end">
                  <BalanceAmount
                    className="text-sm"
                    balance={balances[account.id] ?? "0"}
                  />
                  <span className="truncate text-xs text-muted-foreground">
                    opened by{" "}
                    <Actor
                      userId={account.created_by}
                      currentUserId={currentUserId}
                    />
                  </span>
                </div>
                <div className="relative z-20 flex shrink-0 items-center gap-2 sm:gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="max-sm:size-9"
                    // A row of identical "Edit description" buttons tells a
                    // screen reader nothing about which account it edits
                    // (2.4.4), so each one names its own.
                    aria-label={`Edit description for ${account.name}`}
                    nativeButton={false}
                    render={<Link to={`/accounts/describe/${account.id}`} />}
                  >
                    <PencilLine />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="max-sm:size-9"
                    aria-label={`Delete account ${account.name}`}
                    nativeButton={false}
                    render={<Link to={`/accounts/delete/${account.id}`} />}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-lg border p-8 text-center">
          <ReceiptTextIcon className="size-6 text-muted-foreground" />
          <p className="text-sm font-medium">This ledger has no accounts yet</p>
          <p className="text-sm text-muted-foreground">An account is one person or pot the ledger keeps a balance for.</p>
        </div>
      )}
    </div>
  );
}
