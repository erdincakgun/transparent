import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useEffect, useRef, useState } from "react";
import supabase from "@/lib/supabase/client";
import { mfaErrorMessage, verifyMfaCode } from "@/lib/supabase/mfa";
import { useNavigate } from "react-router";
import { Copy, CopyCheck } from "lucide-react";

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
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    // `enroll` mints a factor server-side, so it must survive StrictMode's
    // second pass in dev without minting a second one
    if (enrolled.current) return;
    enrolled.current = true;

    const enroll = async () => {
      const { data: factors } = await supabase.auth.mfa.listFactors();

      // `totp` only ever lists verified factors — having one means this screen
      // is the wrong one
      if (factors?.totp.length) {
        navigate("/mfa-verify", { replace: true });
        return;
      }

      // an abandoned enrollment leaves its unverified factor behind, and those
      // still count against the account's factor limit
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

  const copySecret = () => {
    if (!secret) return;

    navigator.clipboard.writeText(secret);
    setCopied(true);
  };

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
              Scan this with your authenticator app
            </p>
          </Field>
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
