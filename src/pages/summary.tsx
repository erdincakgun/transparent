import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ArrowRightIcon, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLedger } from "@/components/ledger-provider";
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

export default function SummaryPage() {
  const { activeLedger, loading: ledgerLoading } = useLedger();
  const [transfers, setTransfers] = useState<SettlementTransfer[]>([]);
  const [accountNames, setAccountNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const ledgerId = activeLedger?.id;

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

      const [transferResult, accountResult] = await Promise.all([
        supabase
          .from("settlement_transfers")
          .select("from_account_id, to_account_id, amount::text")
          .eq("ledger_id", ledgerId)
          .order("amount", { ascending: false }),
        supabase.from("accounts").select("id, name").eq("ledger_id", ledgerId),
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
      <p className="text-sm text-muted-foreground">
        {loading
          ? "Loading summary"
          : `${transfers.length} ${transfers.length === 1 ? "transfer" : "transfers"} to settle up`}
      </p>

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
      ) : transfers.length ? (
        <div className="divide-y rounded-lg border">
          {transfers.map((transfer) => {
            const fromName = accountNames[transfer.from_account_id] ?? "";
            const toName = accountNames[transfer.to_account_id] ?? "";

            return (
              <div
                key={`${transfer.from_account_id}-${transfer.to_account_id}`}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
                  <span className="truncate">{fromName}</span>
                  <ArrowRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{toName}</span>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-medium tabular-nums">
                    {amountFormat.format(Number(transfer.amount))}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
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
                          }).toString(),
                        }}
                      />
                    }
                  >
                    <Play />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          Everyone in this ledger is settled up
        </div>
      )}
    </div>
  );
}
