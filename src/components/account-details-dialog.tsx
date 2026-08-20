import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DetailField } from "@/components/detail-field";
import { BalanceAmount } from "@/components/balance-amount";

const balanceFormat = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

export type Account = {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
};

export function AccountDetailsDialog({
  account,
  balance,
  currentUserId,
}: {
  account: Account;
  balance: string;
  currentUserId?: string;
}) {
  return (
    <Dialog>
      <DialogTrigger className="absolute inset-0 z-10 cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
        <span className="sr-only">Details for {account.name}</span>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-4rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="pr-6 break-words">{account.name}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-baseline gap-1.5">
            Balance
            <BalanceAmount balance={balance} className="text-sm" />
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <DetailField label="Description">
            {account.description ? (
              <p className="whitespace-pre-wrap">{account.description}</p>
            ) : (
              <span className="italic text-muted-foreground">
                no description
              </span>
            )}
          </DetailField>
          {/* The row says "1,100.00 owes"; this is the signed figure that
              sits behind it — the same "spell out what the row only hints at"
              the raw uuids below are here for. */}
          <DetailField label="Ledger balance">
            <span className="tabular-nums">
              {balanceFormat.format(Number(balance))}
            </span>
            <span className="text-xs text-muted-foreground">
              {" "}
              · credits in minus debits out
            </span>
          </DetailField>
          <DetailField label="Opened by">
            <span className="font-mono text-xs break-all">
              {account.created_by}
            </span>
            {account.created_by === currentUserId ? (
              <span className="text-xs text-muted-foreground"> · you</span>
            ) : null}
          </DetailField>
          <DetailField label="Account ID">
            <span className="font-mono text-xs break-all">{account.id}</span>
          </DetailField>
        </div>
      </DialogContent>
    </Dialog>
  );
}
