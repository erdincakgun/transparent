import { AccountDeleteForm } from "@/components/account-delete-form";

export default function AccountDeletePage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="w-full max-w-sm">
        <AccountDeleteForm />
      </div>
    </div>
  );
}
