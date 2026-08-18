import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup } from "@/components/ui/field";
import { useEffect, useRef, useState } from "react";
import { ShieldCheckIcon } from "lucide-react";
import supabase from "@/lib/supabase/client";
import { mfaErrorMessage, verifyMfaCode } from "@/lib/supabase/mfa";
import { useNavigate } from "react-router";
import { MfaEnrollFields } from "@/components/mfa-enroll-fields";

export function MfaEnrollForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const navigate = useNavigate();
  const enrolled = useRef(false);
  const [factorId, setFactorId] = useState<string>();
  const [qrCode, setQrCode] = useState<string>();
  const [secret, setSecret] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (enrolled.current) return;
    enrolled.current = true;

    const enroll = async () => {
      const { data: factors } = await supabase.auth.mfa.listFactors();

      if (factors?.totp.length) {
        navigate("/mfa-verify", { replace: true });
        return;
      }

      await Promise.all(
        (factors?.all ?? [])
          .filter((factor) => factor.status === "unverified")
          .map((factor) => supabase.auth.mfa.unenroll({ factorId: factor.id })),
      );

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
      });

      if (error) {
        setError(mfaErrorMessage(error));
        setLoading(false);
        return;
      }

      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setLoading(false);
    };

    enroll();
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

    setVerified(true);
  }

  if (loading) return null;

  if (verified) {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <FieldGroup>
          <Field>
            <p className="text-center text-sm text-muted-foreground">
              Two-factor is on. Add a second authenticator now — if you lose
              this device and it is your only one, nobody can get you back in.
            </p>
          </Field>
          <Field>
            <Button
              type="button"
              onClick={() => navigate("/mfa-settings", { replace: true })}
            >
              <ShieldCheckIcon />
              Add a backup authenticator
            </Button>
          </Field>
          <Field>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/", { replace: true })}
            >
              Not now
            </Button>
          </Field>
        </FieldGroup>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <Field>
            <p className="text-center text-sm text-muted-foreground">
              Scan this with your authenticator app
            </p>
          </Field>
          <MfaEnrollFields qrCode={qrCode} secret={secret} factorId={factorId} />
          {error ? (
            <Field>
              <FieldError>{error}</FieldError>
            </Field>
          ) : null}
          <Field>
            <Button type="submit" disabled={submitted || !factorId}>
              Turn on two-factor
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
