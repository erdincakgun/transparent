import { MfaSettingsForm } from "@/components/mfa-settings-form";

export default function MfaSettingsPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="w-full max-w-sm">
        <MfaSettingsForm />
      </div>
    </div>
  );
}
