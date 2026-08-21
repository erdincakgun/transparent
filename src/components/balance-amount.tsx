import { balanceStanding, cn, formatBalance } from "@/lib/utils";

/**
 * Every balance is one figure in one colour. A credit and a debit are the same
 * quantity pointing two ways, not two kinds of thing, and coloring the sign
 * implies a judgement the ledger does not make — so the sign carries it alone
 * and the colour stays out of it.
 *
 * What a sign cannot carry is *which way round it is*, so that reading rides
 * along as `sr-only` text, where it costs a screen reader nothing and a
 * sighted reader no space. Both the formatting and the standing live in
 * `lib/utils` rather than here, because the HTML export renders the same
 * balance into a file where this component cannot go.
 */
export function BalanceAmount({
  balance,
  className,
}: {
  balance: string;
  className?: string;
}) {
  return (
    <span className={cn("font-medium tabular-nums", className)}>
      {formatBalance(balance)}
      <span className="sr-only"> — {balanceStanding(balance)}</span>
    </span>
  );
}
