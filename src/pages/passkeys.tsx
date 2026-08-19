import { PasskeySettingsForm } from "@/components/passkey-settings-form";

export default function PasskeysPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-4 sm:p-6 md:p-10">
      <div className="w-full max-w-sm">
        <PasskeySettingsForm />
      </div>
    </div>
  );
}
