import { ArrowRightIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DetailField } from "@/components/detail-field";

export type Transaction = {
  id: string;
  created_at: string;
  from_account_id: string;
  to_account_id: string;
  amount: string;
  description: string;
  kind: "accrual" | "payment";
  created_by: string;
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

export function TransactionDetailsDialog({
  transaction,
  fromName,
  toName,
  currentUserId,
}: {
  transaction: Transaction;
  fromName?: string;
  toName?: string;
  currentUserId?: string;
}) {
  const amount = amountFormat.format(Number(transaction.amount));

  return (
    <Dialog>
      <DialogTrigger className="absolute inset-0 z-10 cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
        <span className="sr-only">
          Details for {fromName} to {toName}, {amount}
        </span>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-4rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-1.5 pr-6">
            <span className="break-words">{fromName}</span>
            <ArrowRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="break-words">{toName}</span>
          </DialogTitle>
          <DialogDescription>
            <span className="capitalize">{transaction.kind}</span> ·{" "}
            {dateFormat.format(new Date(transaction.created_at))}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <DetailField label="Description">
            <p className="whitespace-pre-wrap">{transaction.description}</p>
          </DetailField>
          <DetailField label="Amount">
            <span className="tabular-nums">{amount}</span>
          </DetailField>
          <DetailField label="Recorded by">
            <span className="font-mono text-xs break-all">
              {transaction.created_by}
            </span>
            {transaction.created_by === currentUserId ? (
              <span className="text-xs text-muted-foreground"> · you</span>
            ) : null}
          </DetailField>
          <DetailField label="Transaction ID">
            <span className="font-mono text-xs break-all">
              {transaction.id}
            </span>
          </DetailField>
        </div>
      </DialogContent>
    </Dialog>
  );
}
