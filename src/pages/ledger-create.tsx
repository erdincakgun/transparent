import { LedgerCreateForm } from "@/components/ledger-create-form";
import { useDocumentTitle } from "@/hooks/use-document-title";

export default function LedgerCreatePage() {
  useDocumentTitle("New ledger");

  return (
    <main className="aurora flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-4 sm:p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <h1 className="text-center text-lg font-medium">New ledger</h1>
        <LedgerCreateForm />
      </div>
    </main>
  );
}
