import { cn } from "@/lib/utils";

const balanceFormat = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

/**
 * The sign of a balance is the least obvious number in this app: it is credits
 * in minus debits out, so a *positive* balance means the account took in more
 * than it sent and is the one `settlement_transfers` puts on the paying side
 * (`payer.balance > 0` in `002_settlement_transfers.sql`). Reading "1,100.00"
 * and inferring "owes" from that is a step nobody should have to take, so the
 * standing is spelled out in words beside the figure.
 *
 * Colour repeats what the words already say rather than replacing it (1.4.1):
 * amber for a debt, green for a credit, muted for square. The figure itself is
 * shown unsigned, because "-1,100.00 is owed" asks the reader to cancel a minus
 * against a phrase; the signed ledger value is still one click away in the
 * account's dialog, and untouched in the CSV.
 */
export type Standing = "owes" | "owed" | "settled";

export function standingOf(balance: string): Standing {
  const value = Number(balance);

  if (!value) return "settled";

  return value > 0 ? "owes" : "owed";
}

const standingLabel: Record<Standing, string> = {
  owes: "owes",
  owed: "is owed",
  settled: "settled",
};

const standingColor: Record<Standing, string> = {
  owes: "text-warning",
  owed: "text-success",
  settled: "text-muted-foreground",
};

export function BalanceAmount({
  balance,
  className,
}: {
  balance: string;
  className?: string;
}) {
  const standing = standingOf(balance);

  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1.5",
        standingColor[standing],
        className,
      )}
    >
      <span className="font-medium tabular-nums">
        {balanceFormat.format(Math.abs(Number(balance)))}
      </span>
      <span className="text-xs font-normal">{standingLabel[standing]}</span>
    </span>
  );
}
