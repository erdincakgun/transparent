import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  ArrowRightIcon,
  ArrowRightLeftIcon,
  CopyPlusIcon,
  PlusIcon,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLedger } from "@/components/ledger-provider";
import { Actor } from "@/components/actor";
import {
  TransactionDetailsDialog,
  type Transaction,
} from "@/components/transaction-details-dialog";
import { KindBadge } from "@/components/kind-badge";
import { ExportMenu, type ExportFormat } from "@/components/export-menu";
import { downloadCsv } from "@/lib/csv";
import { downloadHtmlReport } from "@/lib/html-report";
import { fetchAllRows } from "@/lib/pagination";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { shortId, trimAmount } from "@/lib/utils";
import supabase from "@/lib/supabase/client";

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
  "kind",
  "created_by",
];

export default function TransactionsPage() {
  useDocumentTitle("Transactions");
  const { activeLedger, loading: ledgerLoading } = useLedger();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accountNames, setAccountNames] = useState<Record<string, string>>({});
  const [currentUserId, setCurrentUserId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string>();

  const ledgerId = activeLedger?.id;

  async function handleExport(format: ExportFormat) {
    if (!ledgerId || !activeLedger) return;

    setExporting(true);

    const [{ data, error }, { count, error: countError }, names] =
      await Promise.all([
        fetchAllRows((from, to) =>
          supabase
            .from("transactions")
            .select(exportColumns.join(", "))
            .eq("ledger_id", ledgerId)
            .order("created_at", { ascending: false })
            .order("id", { ascending: true })
            .range(from, to),
        ),
        supabase
          .from("transactions")
          .select("*", { count: "exact", head: true })
          .eq("ledger_id", ledgerId),
        // The CSV carries account ids because a spreadsheet can join them
        // back; the report carries names, so the HTML path reads them in the
        // same breath as the rows rather than off the page's state — one
        // consistent read. `accounts`, not `active_accounts`: a retired
        // account keeps the history it took part in, and that history has to
        // stay readable.
        format === "html"
          ? fetchAllRows<{ id: string; name: string }>((from, to) =>
              supabase
                .from("accounts")
                .select("id, name")
                .eq("ledger_id", ledgerId)
                .order("id", { ascending: true })
                .range(from, to),
            )
          : Promise.resolve({
              data: [] as { id: string; name: string }[],
              error: null,
            }),
      ]);

    setExporting(false);

    if (error ?? countError ?? names.error) {
      setError((error ?? countError ?? names.error)?.message);
      return;
    }

    if (!data || data.length !== count) {
      setError("Export incomplete — nothing was saved.");
      return;
    }

    if (format === "csv") {
      downloadCsv(`transactions-${ledgerId}.csv`, exportColumns, data);
      return;
    }

    const exported = data as unknown as Transaction[];
    const nameById = Object.fromEntries(
      (names.data ?? []).map((account) => [account.id, account.name]),
    );

    downloadHtmlReport(`transactions-${ledgerId}.html`, {
      title: "Transactions",
      ledger: {
        name: activeLedger.name,
        description: activeLedger.description,
        id: ledgerId,
      },
      exportedBy: currentUserId,
      generatedAt: new Date(),
      count: `${exported.length} ${exported.length === 1 ? "transaction" : "transactions"}`,
      rows: exported.map((transaction) => ({
        key: transaction.id,
        heading: {
          from:
            nameById[transaction.from_account_id] ??
            transaction.from_account_id,
          to: nameById[transaction.to_account_id] ?? transaction.to_account_id,
          relation: "to",
        },
        kind: transaction.kind,
        description: transaction.description,
        amount: { text: amountFormat.format(Number(transaction.amount)) },
        meta: [
          { value: dateFormat.format(new Date(transaction.created_at)) },
          { label: "by", value: shortId(transaction.created_by), mono: true },
        ],
      })),
      empty: {
        title: "This ledger has no transactions yet",
        body: "Record what one account covered for another, or a payment settling it.",
      },
    });
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

      const [transactionResult, accountResult, sessionResult] =
        await Promise.all([
          fetchAllRows<Transaction>((from, to) =>
            supabase
              .from("transactions")
              .select(
                "id, created_at, from_account_id, to_account_id, amount::text, description, kind, created_by",
              )
              .eq("ledger_id", ledgerId)
              .order("created_at", { ascending: false })
              .order("id", { ascending: true })
              .range(from, to),
          ),
          fetchAllRows<{ id: string; name: string }>((from, to) =>
            supabase
              .from("accounts")
              .select("id, name")
              .eq("ledger_id", ledgerId)
              .order("id", { ascending: true })
              .range(from, to),
          ),
          supabase.auth.getSession(),
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
      setCurrentUserId(sessionResult.data.session?.user.id);
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
      <h1 className="sr-only">Transactions</h1>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p role="status" className="text-sm text-muted-foreground">
            {loading
              ? "Loading transactions"
              : `${transactions.length} ${transactions.length === 1 ? "transaction" : "transactions"}`}
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
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : loading ? (
        <div aria-hidden="true" className="divide-y rounded-lg border">
          {[0, 1, 2].map((row) => (
            <div key={row} className="px-4 py-3">
              <Skeleton className="h-4 w-56" />
            </div>
          ))}
        </div>
      ) : transactions.length ? (
        <div className="divide-y overflow-hidden rounded-lg border">
          {transactions.map((transaction) => (
            <div
              key={transaction.id}
              className="relative flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <TransactionDetailsDialog
                transaction={transaction}
                fromName={accountNames[transaction.from_account_id]}
                toName={accountNames[transaction.to_account_id]}
                currentUserId={currentUserId}
              />
              <div className="flex min-w-0 flex-col gap-0.5">
                <div className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
                  <span className="truncate">
                    {accountNames[transaction.from_account_id]}
                  </span>
                  {/* The arrow is the only thing saying which way the money
                      went, and lucide hides its icons from assistive tech —
                      so the direction is spelled out for anyone not seeing
                      it (1.3.1, 1.3.3). */}
                  <ArrowRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="sr-only">to</span>
                  <span className="truncate">
                    {accountNames[transaction.to_account_id]}
                  </span>
                </div>
                <div className="flex min-w-0 items-center gap-1.5">
                  <KindBadge kind={transaction.kind} />
                  <span className="truncate text-sm text-muted-foreground">
                    {transaction.description}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 sm:shrink-0">
                <div className="flex min-w-0 flex-col gap-0.5 sm:items-end">
                  <span className="text-sm font-medium tabular-nums">
                    {amountFormat.format(Number(transaction.amount))}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {dateFormat.format(new Date(transaction.created_at))} ·{" "}
                    <Actor
                      userId={transaction.created_by}
                      currentUserId={currentUserId}
                    />
                  </span>
                </div>
                <div className="relative z-20 flex shrink-0 items-center gap-2 sm:gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="max-sm:size-9"
                    // One "Duplicate transaction" per row is indistinguishable
                    // from the next when read out of context (2.4.4).
                    aria-label={`Duplicate transaction: ${transaction.description}`}
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
                            kind: transaction.kind,
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
                    className="max-sm:size-9"
                    aria-label={`Revert transaction: ${transaction.description}`}
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
                            kind: transaction.kind,
                          }).toString(),
                        }}
                      />
                    }
                  >
                    <Undo2 />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-lg border p-8 text-center">
          <ArrowRightLeftIcon className="size-6 text-muted-foreground" />
          <p className="text-sm font-medium">This ledger has no transactions yet</p>
          <p className="text-sm text-muted-foreground">Record what one account covered for another, or a payment settling it.</p>
        </div>
      )}
    </div>
  );
}
