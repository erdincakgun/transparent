import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import supabase from "@/lib/supabase/client";
import { mfaErrorMessage, verifyMfaCode } from "@/lib/supabase/mfa";
import { useNavigate } from "react-router";

export function MfaVerifyForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const navigate = useNavigate();
  const [factorId, setFactorId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();

      if (cancelled) return;

      if (error) {
        setError(mfaErrorMessage(error));
        setLoading(false);
        return;
      }

      const totp = data.totp[0];

      if (!totp) {
        navigate("/mfa-enroll", { replace: true });
        return;
      }

      setFactorId(totp.id);
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

    if (!factorId) return;

    const form = e.target;
    const formData = new FormData(form);
    const code = formData.get("code")?.toString().trim() ?? "";

    setSubmitted(true);
    setError(undefined);

    const error = await verifyMfaCode(factorId, code);

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
            <Input
              id="code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="Enter the six digits from your app"
              disabled={!factorId}
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
            <Button type="submit" disabled={submitted || !factorId}>
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
