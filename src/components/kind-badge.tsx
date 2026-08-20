import { HandCoinsIcon, ReceiptTextIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * An accrual is money one account spent for another; a payment only clears a
 * balance an accrual created. Both move the same figure, and only the accrual
 * reaches `account_income_expense` — which makes the distinction worth reading
 * at a glance rather than deducing.
 *
 * Three things say which is which: the word (unchanged), an icon, and the
 * colour. Colour alone would fail 1.4.1, and the word alone was what the row
 * had before.
 */
const kinds = {
  accrual: {
    label: "Accrual",
    icon: ReceiptTextIcon,
    className: "border-warning/30 bg-warning/10 text-warning",
  },
  payment: {
    label: "Payment",
    icon: HandCoinsIcon,
    className: "border-success/30 bg-success/10 text-success",
  },
} as const;

export function KindBadge({
  kind,
  className,
}: {
  kind: "accrual" | "payment";
  className?: string;
}) {
  const { label, icon: Icon, className: tone } = kinds[kind];

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-sm border px-1.5 py-px text-xs font-medium",
        tone,
        className,
      )}
    >
      <Icon className="size-3" />
      {label}
    </span>
  );
}
