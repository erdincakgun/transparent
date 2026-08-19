import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DetailField } from "@/components/detail-field";

export type Account = {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
};

const balanceFormat = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

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
          <DialogDescription>
            Balance{" "}
            <span className="tabular-nums">
              {balanceFormat.format(Number(balance))}
            </span>
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
