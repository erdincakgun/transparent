import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  ArrowRightIcon,
  CopyPlusIcon,
  DownloadIcon,
  PlusIcon,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLedger } from "@/components/ledger-provider";
import { downloadCsv } from "@/lib/csv";
import { trimAmount } from "@/lib/utils";
import supabase from "@/lib/supabase/client";

type Transaction = {
  id: string;
  created_at: string;
  from_account_id: string;
  to_account_id: string;
  amount: string;
  description: string;
};

const amountFormat = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

const dateFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "medium",
  hourCycle: "h23",
});

const exportColumns = [
  "id",
  "created_at",
  "ledger_id",
  "from_account_id",
  "to_account_id",
  "amount::text",
  "description",
];

export default function TransactionsPage() {
  const { activeLedger, loading: ledgerLoading } = useLedger();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accountNames, setAccountNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string>();

  const ledgerId = activeLedger?.id;

  async function handleExport() {
    if (!ledgerId) return;

    setExporting(true);

    const { data, error } = await supabase
      .from("transactions")
      .select(exportColumns.join(", "))
      .eq("ledger_id", ledgerId)
      .order("created_at", { ascending: false });

    setExporting(false);

    if (error) {
      setError(error.message);
      return;
    }

    downloadCsv(`transactions-${ledgerId}.csv`, exportColumns, data ?? []);
  }

  useEffect(() => {
    if (ledgerLoading) return;

    if (!ledgerId) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(undefined);

      const [transactionResult, accountResult] = await Promise.all([
        supabase
          .from("transactions")
          .select(
            "id, created_at, from_account_id, to_account_id, amount::text, description",
          )
          .eq("ledger_id", ledgerId)
          .order("created_at", { ascending: false }),
        supabase.from("accounts").select("id, name").eq("ledger_id", ledgerId),
      ]);

      if (cancelled) return;

      setTransactions(transactionResult.data ?? []);
      setAccountNames(
        Object.fromEntries(
          (accountResult.data ?? []).map((account) => [
            account.id,
            account.name,
          ]),
        ),
      );
      setError((transactionResult.error ?? accountResult.error)?.message);
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
            ? "Loading transactions"
            : `${transactions.length} ${transactions.length === 1 ? "transaction" : "transactions"}`}
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
          <Button
            nativeButton={false}
            render={<Link to="/transaction-create" />}
          >
            <PlusIcon />
            Add transaction
          </Button>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : loading ? (
        <div className="divide-y rounded-lg border">
          {[0, 1, 2].map((row) => (
            <div key={row} className="px-4 py-3">
              <Skeleton className="h-4 w-56" />
            </div>
          ))}
        </div>
      ) : transactions.length ? (
        <div className="divide-y rounded-lg border">
          {transactions.map((transaction) => (
            <div
              key={transaction.id}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <div className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
                  <span className="truncate">
                    {accountNames[transaction.from_account_id]}
                  </span>
                  <ArrowRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">
                    {accountNames[transaction.to_account_id]}
                  </span>
                </div>
                <span className="truncate text-sm text-muted-foreground">
                  {transaction.description}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-sm font-medium tabular-nums">
                    {amountFormat.format(Number(transaction.amount))}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {dateFormat.format(new Date(transaction.created_at))}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Duplicate transaction"
                  nativeButton={false}
                  render={
                    <Link
                      to={{
                        pathname: "/transaction-create",
                        search: new URLSearchParams({
                          from: transaction.from_account_id,
                          to: transaction.to_account_id,
                          amount: trimAmount(transaction.amount),
                          description: transaction.description,
                        }).toString(),
                      }}
                    />
                  }
                >
                  <CopyPlusIcon />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Revert transaction"
                  nativeButton={false}
                  render={
                    <Link
                      to={{
                        pathname: "/transaction-create",
                        search: new URLSearchParams({
                          from: transaction.to_account_id,
                          to: transaction.from_account_id,
                          amount: trimAmount(transaction.amount),
                          description: `revert: ${transaction.description} (${dateFormat.format(new Date(transaction.created_at))})`,
                        }).toString(),
                      }}
                    />
                  }
                >
                  <Undo2 />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          This ledger has no transactions yet
        </div>
      )}
    </div>
  );
}
