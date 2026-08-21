import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
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
import { ExportMenu, type ExportFormat } from "@/components/export-menu";
import { downloadCsv } from "@/lib/csv";
import { downloadHtmlReport } from "@/lib/html-report";
import { fetchAllRows } from "@/lib/pagination";
import { useDocumentTitle } from "@/hooks/use-document-title";
import {
  balanceStanding,
  countLabel,
  formatBalance,
  shortId,
} from "@/lib/utils";
import supabase from "@/lib/supabase/client";

type AccountBalance = { id: string; balance: string };

const exportColumns = ["id", "ledger_id", "name", "description", "created_by"];

const emptyState = {
  title: "This ledger has no accounts yet",
  body: "An account is one person or pot the ledger keeps a balance for.",
};

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

  async function handleExport(format: ExportFormat) {
    if (!activeLedger) return;

    const ledgerId = activeLedger.id;

    setExporting(true);

    const [{ data, error }, { count, error: countError }, figures] =
      await Promise.all([
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
        format === "html"
          ? fetchAllRows<AccountBalance>((from, to) =>
              supabase
                .from("account_balances")
                .select("id, balance::text")
                .eq("ledger_id", ledgerId)
                .order("id", { ascending: true })
                .range(from, to),
            )
          : Promise.resolve({ data: [] as AccountBalance[], error: null }),
      ]);

    setExporting(false);

    if (error ?? countError ?? figures.error) {
      setError((error ?? countError ?? figures.error)?.message);
      return;
    }

    if (!data || data.length !== count) {
      setError("Export incomplete — nothing was saved.");
      return;
    }

    if (format === "csv") {
      downloadCsv(`accounts-${ledgerId}.csv`, exportColumns, data);
      return;
    }

    const exported = data as unknown as Account[];
    const balanceById = Object.fromEntries(
      (figures.data ?? []).map((row) => [
        row.id,
        row.balance,
      ]),
    );

    downloadHtmlReport(`accounts-${ledgerId}.html`, {
      title: "Accounts",
      ledger: activeLedger,
      exportedBy: currentUserId,
      generatedAt: new Date(),
      count: countLabel(exported.length, "account"),
      rows: exported.map((account) => {
        const balance = balanceById[account.id] ?? "0";

        return {
          key: account.id,
          heading: account.name,
          description: account.description,
          amount: {
            text: formatBalance(balance),
            standing: balanceStanding(balance),
          },
          meta: [
            {
              label: "opened by",
              value: shortId(account.created_by),
              mono: true,
            },
          ],
        };
      }),
      empty: emptyState,
    });
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
          (balanceResult.data ?? []).map((row) => [
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
      <h1 className="sr-only">Accounts</h1>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p role="status" className="text-sm text-muted-foreground">
            {loading
              ? "Loading accounts"
              : countLabel(accounts.length, "account")}
          </p>
          {activeLedger?.description ? (
            <p className="truncate text-xs text-muted-foreground">
              {activeLedger.description}
            </p>
          ) : null}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <ExportMenu
            disabled={exporting || !ledgerId}
            onExport={handleExport}
          />
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
          {accounts.map((account) => {
            const balance = balances[account.id] ?? "0";

            return (
              <div
                key={account.id}
                className="relative flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <AccountDetailsDialog
                  account={account}
                  balance={balance}
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
                      balance={balance}
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
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-lg border p-8 text-center">
          <ReceiptTextIcon className="size-6 text-muted-foreground" />
          <p className="text-sm font-medium">{emptyState.title}</p>
          <p className="text-sm text-muted-foreground">{emptyState.body}</p>
        </div>
      )}
    </div>
  );
}
