import { balanceStanding, cn, formatBalance } from "@/lib/utils";

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
