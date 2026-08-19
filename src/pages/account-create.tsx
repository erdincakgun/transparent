import { AccountCreateForm } from "@/components/account-create-form";

export default function AccountCreatePage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-4 sm:p-6 md:p-10">
      <div className="w-full max-w-sm">
        <AccountCreateForm />
      </div>
    </div>
  );
}
