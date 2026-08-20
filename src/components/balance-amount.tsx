import { cn } from "@/lib/utils";

/**
 * `signDisplay: "exceptZero"` is what puts the + back on a credit: a bare
 * "1,250.50" beside a "-1,100.00" reads as two unrelated figures, where "+" and
 * "−" read as two directions of the same one.
 */
const balanceFormat = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
  signDisplay: "exceptZero",
});

/**
 * Every balance is one figure in one colour. A credit and a debit are the same
 * quantity pointing two ways, not two kinds of thing, and coloring the sign
 * implies a judgement the ledger does not make — so the sign carries it alone
 * and the colour stays out of it.
 *
 * What a sign cannot carry is *which way round it is*: the balance is credits
 * in minus debits out, so a **positive** balance is the account that pays
 * (`payer.balance > 0` in `002_settlement_transfers.sql`). That reading rides
 * along as `sr-only` text, where it costs a screen reader nothing and a sighted
 * reader no space.
 */
function standingLabel(balance: string) {
  const value = Number(balance);

  if (!value) return "settled";

  return value > 0 ? "owes this" : "is owed this";
}

export function BalanceAmount({
  balance,
  className,
}: {
  balance: string;
  className?: string;
}) {
  return (
    <span className={cn("font-medium tabular-nums", className)}>
      {balanceFormat.format(Number(balance))}
      <span className="sr-only"> — {standingLabel(balance)}</span>
    </span>
  );
}
