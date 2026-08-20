import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Copy, CopyCheck } from "lucide-react";

/**
 * The QR/secret/code markup shared by first-time enrollment and adding a
 * backup factor. Flow control (enroll/verify calls, navigation, errors,
 * submit/cancel buttons) stays with each caller, since those differ enough
 * between the two that folding them in here would mean mode-branching the
 * gate every session has to pass through.
 */
export function MfaEnrollFields({
  qrCode,
  secret,
  factorId,
}: {
  qrCode: string | undefined;
  secret: string | undefined;
  factorId: string | undefined;
}) {
  const [copied, setCopied] = useState(false);

  const copySecret = () => {
    if (!secret) return;

    navigator.clipboard.writeText(secret);
    setCopied(true);
  };

  return (
    <>
      {qrCode ? (
        <Field>
          {/* Field stretches its direct children with `*:w-full`, which would
              squash a square QR into a rectangle — hence the wrapper. The SVG
              carries no background of its own, so the white one is what makes
              it scannable in the default dark theme. */}
          <div className="flex justify-center">
            <img
              src={qrCode}
              alt="Authenticator setup QR code"
              className="size-48 rounded-lg bg-white p-2"
            />
          </div>
        </Field>
      ) : null}
      {secret ? (
        <Field>
          <FieldLabel htmlFor="secret">Setup key</FieldLabel>
          <div className="flex items-center gap-2">
            <Input
              id="secret"
              name="secret"
              type="text"
              value={secret}
              className="font-mono text-xs"
              readOnly
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Copy setup key"
              onClick={copySecret}
            >
              {copied ? <CopyCheck /> : <Copy />}
            </Button>
          </div>
          <FieldDescription>
            Can't scan? Type this setup key into the app instead
          </FieldDescription>
        </Field>
      ) : null}
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
          disabled={!factorId}
          required
          autoFocus
        />
      </Field>
    </>
  );
}
