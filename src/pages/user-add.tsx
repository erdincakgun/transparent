import { UserAddForm } from "@/components/user-add-form";
import { useDocumentTitle } from "@/hooks/use-document-title";

export default function UserAddPage() {
  useDocumentTitle("Add user");

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-4 sm:p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <h1 className="text-center text-lg font-medium">Add user</h1>
        <UserAddForm />
      </div>
    </main>
  );
}
