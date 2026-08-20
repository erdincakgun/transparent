import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import supabase from "@/lib/supabase/client";
import {
  listVerifiedTotpFactors,
  mfaErrorMessage,
  verifyMfaCodeAnyFactor,
} from "@/lib/supabase/mfa";
import { useNavigate } from "react-router";

export function MfaVerifyForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const navigate = useNavigate();
  const [factorIds, setFactorIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { factors, error } = await listVerifiedTotpFactors();

      if (cancelled) return;

      if (error) {
        setError(mfaErrorMessage(error));
        setLoading(false);
        return;
      }

      if (!factors.length) {
        navigate("/mfa-enroll", { replace: true });
        return;
      }

      setFactorIds(factors.map((factor) => factor.id));
      setLoading(false);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  async function handleSubmit(e: { preventDefault: () => void; target: any }) {
    e.preventDefault();

    if (!factorIds.length) return;

    const form = e.target;
    const formData = new FormData(form);
    const code = formData.get("code")?.toString().trim() ?? "";

    setSubmitted(true);
    setError(undefined);

    const error = await verifyMfaCodeAnyFactor(factorIds, code);

    if (error) {
      setSubmitted(false);
      setError(mfaErrorMessage(error));
      return;
    }

    navigate("/", { replace: true });
  }

  if (loading) return null;

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <Field>
            <p className="text-center text-sm text-muted-foreground">
              Enter the code from your authenticator app
            </p>
          </Field>
          <Field>
            <FieldLabel htmlFor="code">Six-digit code from the app</FieldLabel>
            <Input
              id="code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              disabled={!factorIds.length}
              required
              autoFocus
            />
          </Field>
          {error ? (
            <Field>
              <FieldError>{error}</FieldError>
            </Field>
          ) : null}
          <Field>
            <Button type="submit" disabled={submitted || !factorIds.length}>
              Continue
            </Button>
          </Field>
          <Field>
            <Button
              type="button"
              variant="outline"
              disabled={submitted}
              onClick={signOut}
            >
              Log out
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </div>
  );
}
