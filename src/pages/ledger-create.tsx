import { LedgerCreateForm } from "@/components/ledger-create-form";

export default function CreateLedgerPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LedgerCreateForm />
      </div>
    </div>
  );
}
