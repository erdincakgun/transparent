import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldTitle,
} from "@/components/ui/field";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import supabase from "@/lib/supabase/client";
import { listVerifiedTotpFactors, mfaErrorMessage } from "@/lib/supabase/mfa";
import { MfaBackupFactorForm } from "@/components/mfa-backup-factor-form";
import type { Factor } from "@supabase/supabase-js";

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

export function MfaSettingsForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const navigate = useNavigate();
  const [factors, setFactors] = useState<Factor<"totp", "verified">[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [addAttempt, setAddAttempt] = useState(0);
  const [removingId, setRemovingId] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { factors, error } = await listVerifiedTotpFactors();

      if (cancelled) return;

      setFactors(factors);
      setError(error ? mfaErrorMessage(error) : undefined);
      setLoading(false);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const refreshFactors = async () => {
    const { factors, error } = await listVerifiedTotpFactors();

    setFactors(factors);
    setError(error ? mfaErrorMessage(error) : undefined);
  };

  async function handleRemove(factorId: string) {
    setRemovingId(factorId);
    setError(undefined);

    const { error } = await supabase.auth.mfa.unenroll({ factorId });

    if (error) {
      setRemovingId(undefined);
      setError(mfaErrorMessage(error));
      return;
    }

    await refreshFactors();
    setRemovingId(undefined);
  }

  if (loading) return null;

  if (adding) {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <MfaBackupFactorForm
          key={addAttempt}
          onCancel={() => setAdding(false)}
          onEnrolled={() => {
            setAdding(false);
            refreshFactors();
          }}
        />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <FieldGroup>
        <Field>
          <p className="text-center text-sm text-muted-foreground">
            Add a backup authenticator so losing one device doesn't lock you
            out
          </p>
        </Field>
        {error ? (
          <Field>
            <FieldError>{error}</FieldError>
          </Field>
        ) : null}
        {factors.map((factor) => (
          <Field key={factor.id} orientation="horizontal">
            <FieldContent>
              <FieldTitle>{factor.friendly_name ?? "Authenticator"}</FieldTitle>
              <FieldDescription>
                Added {dateFormat.format(new Date(factor.created_at))}
              </FieldDescription>
            </FieldContent>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={factors.length === 1 || !!removingId}
              onClick={() => handleRemove(factor.id)}
            >
              Remove
            </Button>
          </Field>
        ))}
        {factors.length === 1 ? (
          <Field>
            <FieldDescription>
              You need at least one authenticator. Add a backup before
              removing this one.
            </FieldDescription>
          </Field>
        ) : null}
        <Field>
          <Button
            type="button"
            disabled={!!removingId}
            onClick={() => {
              setAddAttempt((n) => n + 1);
              setAdding(true);
            }}
          >
            Add backup authenticator
          </Button>
        </Field>
        <Field>
          <Button
            type="button"
            variant="outline"
            disabled={!!removingId}
            onClick={() => navigate(-1)}
          >
            Back
          </Button>
        </Field>
      </FieldGroup>
    </div>
  );
}
