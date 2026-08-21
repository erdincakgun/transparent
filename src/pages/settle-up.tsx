import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ArrowRightIcon, CircleCheckIcon, HandCoinsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLedger } from "@/components/ledger-provider";
import { ExportMenu, type ExportFormat } from "@/components/export-menu";
import { downloadCsv } from "@/lib/csv";
import { downloadHtmlReport } from "@/lib/html-report";
import { fetchAllRows } from "@/lib/pagination";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { trimAmount } from "@/lib/utils";
import supabase from "@/lib/supabase/client";

type SettlementTransfer = {
  from_account_id: string;
  to_account_id: string;
  amount: string;
};

const amountFormat = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

const exportColumns = [
  "ledger_id",
  "from_account_id",
  "to_account_id",
  "amount::text",
];

export default function SettleUpPage() {
  useDocumentTitle("Settle Up");
  const { activeLedger, loading: ledgerLoading } = useLedger();
  const [transfers, setTransfers] = useState<SettlementTransfer[]>([]);
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
            .from("settlement_transfers")
            .select(exportColumns.join(", "))
            .eq("ledger_id", ledgerId)
            .order("amount", { ascending: false })
            .order("from_account_id", { ascending: true })
            .order("to_account_id", { ascending: true })
            .range(from, to),
        ),
        supabase
          .from("settlement_transfers")
          .select("*", { count: "exact", head: true })
          .eq("ledger_id", ledgerId),
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
      downloadCsv(`settlement_transfers-${ledgerId}.csv`, exportColumns, data);
      return;
    }

    const exported = data as unknown as SettlementTransfer[];
    const nameById = Object.fromEntries(
      (names.data ?? []).map((account) => [account.id, account.name]),
    );

    downloadHtmlReport(`settlement_transfers-${ledgerId}.html`, {
      title: "Settle Up",
      ledger: {
        name: activeLedger.name,
        description: activeLedger.description,
        id: ledgerId,
      },
      exportedBy: currentUserId,
      generatedAt: new Date(),
      count: `${exported.length} ${exported.length === 1 ? "transfer" : "transfers"} to settle up`,
      rows: exported.map((transfer) => ({
        key: `${transfer.from_account_id}-${transfer.to_account_id}`,
        heading: {
          from: nameById[transfer.from_account_id] ?? transfer.from_account_id,
          to: nameById[transfer.to_account_id] ?? transfer.to_account_id,
          relation: "pays",
        },
        amount: { text: amountFormat.format(Number(transfer.amount)) },
      })),
      empty: {
        title: "Everyone in this ledger is settled up",
        body: "Every account sits at zero — nobody owes anybody.",
        tone: "success",
      },
    });
  }

  useEffect(() => {
    if (ledgerLoading) return;

    if (!ledgerId) {
      setTransfers([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(undefined);

      const [transferResult, accountResult, sessionResult] = await Promise.all([
        fetchAllRows<SettlementTransfer>((from, to) =>
          supabase
            .from("settlement_transfers")
            .select("from_account_id, to_account_id, amount::text")
            .eq("ledger_id", ledgerId)
            .order("amount", { ascending: false })
            .order("from_account_id", { ascending: true })
            .order("to_account_id", { ascending: true })
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

      setTransfers((transferResult.data ?? []) as SettlementTransfer[]);
      setAccountNames(
        Object.fromEntries(
          (accountResult.data ?? []).map((account) => [
            account.id,
            account.name,
          ]),
        ),
      );
      setCurrentUserId(sessionResult.data.session?.user.id);
      setError((transferResult.error ?? accountResult.error)?.message);
      setLoading(false);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [ledgerLoading, ledgerId]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="sr-only">Settle Up</h1>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p role="status" className="text-sm text-muted-foreground">
            {loading
              ? "Loading transfers"
              : `${transfers.length} ${transfers.length === 1 ? "transfer" : "transfers"} to settle up`}
          </p>
          {activeLedger?.description ? (
            <p className="truncate text-xs text-muted-foreground">
              {activeLedger.description}
            </p>
          ) : null}
        </div>
        <div className="ml-auto">
          <ExportMenu
            disabled={exporting || !ledgerId}
            onExport={handleExport}
          />
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
      ) : transfers.length ? (
        <div className="divide-y rounded-lg border">
          {transfers.map((transfer) => {
            const fromName = accountNames[transfer.from_account_id] ?? "";
            const toName = accountNames[transfer.to_account_id] ?? "";

            return (
              <div
                key={`${transfer.from_account_id}-${transfer.to_account_id}`}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <div className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
                  <span className="truncate">{fromName}</span>
                  <ArrowRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="sr-only">pays</span>
                  <span className="truncate">{toName}</span>
                </div>
                <div className="flex items-center justify-between gap-3 sm:shrink-0">
                  <span className="text-sm font-medium tabular-nums">
                    {amountFormat.format(Number(transfer.amount))}
                  </span>
                  <Button
                    size="sm"
                    className="max-sm:size-9"
                    aria-label={`Record transfer from ${fromName} to ${toName}`}
                    nativeButton={false}
                    render={
                      <Link
                        to={{
                          pathname: "/transaction-create",
                          search: new URLSearchParams({
                            from: transfer.from_account_id,
                            to: transfer.to_account_id,
                            amount: trimAmount(transfer.amount),
                            description: `settle up from the suggestions`,
                            kind: "payment",
                          }).toString(),
                        }}
                      />
                    }
                  >
                    <HandCoinsIcon />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-success/30 bg-success/5 p-8 text-center">
          <CircleCheckIcon className="size-6 text-success" />
          <p className="text-sm font-medium text-success">
            Everyone in this ledger is settled up
          </p>
          <p className="text-sm text-muted-foreground">
            Every account sits at zero — nobody owes anybody.
          </p>
        </div>
      )}
    </div>
  );
}
