import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup } from "@/components/ui/field";
import { useEffect, useRef, useState } from "react";
import supabase from "@/lib/supabase/client";
import { mfaErrorMessage, verifyMfaCode } from "@/lib/supabase/mfa";
import { MfaEnrollFields } from "@/components/mfa-enroll-fields";

/**
 * Adds a second TOTP factor for a session that is already `aal2` (rendered
 * only from behind `RequireMfa`, where a verified factor is guaranteed to
 * already exist -- unlike `MfaEnrollForm`, this never has to check for one
 * or redirect away). GoTrue requires `aal2` to enroll once a verified factor
 * exists, which this route already guarantees.
 */
export function MfaBackupFactorForm({
  onCancel,
  onEnrolled,
}: {
  onCancel: () => void;
  onEnrolled: () => void;
}) {
  const enrolled = useRef(false);
  const [factorId, setFactorId] = useState<string>();
  const [qrCode, setQrCode] = useState<string>();
  const [secret, setSecret] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    // `enroll` mints a factor server-side, so it must survive StrictMode's
    // second pass in dev without minting a second one
    if (enrolled.current) return;
    enrolled.current = true;

    const enroll = async () => {
      const { data: factors } = await supabase.auth.mfa.listFactors();

      // an abandoned enrollment leaves its unverified factor behind, and those
      // still count against the account's factor limit
      await Promise.all(
        (factors?.all ?? [])
          .filter((factor) => factor.status === "unverified")
          .map((factor) => supabase.auth.mfa.unenroll({ factorId: factor.id })),
      );

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Backup authenticator",
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
  }, []);

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

    onEnrolled();
  }

  if (loading) return null;

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <Field>
          <p className="text-center text-sm text-muted-foreground">
            Scan this with a second authenticator app or device
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
            Add backup authenticator
          </Button>
        </Field>
        <Field>
          <Button
            type="button"
            variant="outline"
            disabled={submitted}
            onClick={onCancel}
          >
            Cancel
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
