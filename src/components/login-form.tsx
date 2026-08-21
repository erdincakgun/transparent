import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { KeyRoundIcon } from "lucide-react";
import supabase from "@/lib/supabase/client";
import { otpErrorMessage } from "@/lib/supabase/auth";
import { passkeyErrorMessage, passkeysSupported } from "@/lib/supabase/passkey";
import { callbackMessage } from "@/lib/supabase/callback";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const location = useLocation();
  const navigate = useNavigate();
  const turnstileRef = useRef<TurnstileInstance | undefined>(undefined);
  const [captchaToken, setCaptchaToken] = useState<string | undefined>();
  const [emailSent, setEmailSent] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | undefined>(() =>
    callbackMessage(
      (location.state as { from?: { search?: string } } | null)?.from?.search ??
        location.search,
    ),
  );
  const [passkeyOffered] = useState(passkeysSupported);

  async function handleSubmit(e: { preventDefault: () => void; target: any }) {
    e.preventDefault();

    const form = e.target;
    const formData = new FormData(form);
    const email = formData.get("email")?.toString() ?? "";

    setSubmitted(true);
    setError(undefined);

    const { error } = await supabase.auth.signInWithOtp({
      email: email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: import.meta.env.VITE_SITE_URL!,
        captchaToken: captchaToken,
      },
    });

    if (error) {
      setSubmitted(false);
      setError(otpErrorMessage(error));
      turnstileRef.current?.reset();
      setCaptchaToken(undefined);
      return;
    }

    setEmailSent(true);
  }

  async function handlePasskey() {
    setSubmitted(true);
    setError(undefined);

    const { error } = await supabase.auth.signInWithPasskey({
      options: { captchaToken },
    });

    turnstileRef.current?.reset();
    setCaptchaToken(undefined);

    if (error) {
      setSubmitted(false);
      setError(passkeyErrorMessage(error));
      return;
    }

    navigate("/", { replace: true });
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <form onSubmit={handleSubmit}>
        <FieldGroup>
          {emailSent ? (
            <>
              <Field>
                <p role="status" className="text-center text-sm text-muted-foreground">
                  Check your inbox
                </p>
              </Field>
            </>
          ) : (
            <>
              <Field>
                <FieldLabel htmlFor="email">Email address</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                />
              </Field>
              {error ? (
                <Field>
                  <FieldError>{error}</FieldError>
                </Field>
              ) : null}
              <Field>
                <Button type="submit" disabled={submitted || !captchaToken}>
                  Login
                </Button>
              </Field>
              {passkeyOffered ? (
                <>
                  <FieldSeparator>or</FieldSeparator>
                  <Field>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={submitted || !captchaToken}
                      onClick={handlePasskey}
                    >
                      <KeyRoundIcon />
                      Use a passkey
                    </Button>
                  </Field>
                </>
              ) : null}
              <Turnstile
                ref={turnstileRef}
                siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
                options={{
                  size: "flexible",
                  appearance: "interaction-only",
                }}
                onSuccess={(token) => {
                  setCaptchaToken(token);
                }}
                onExpire={() => {
                  setCaptchaToken(undefined);
                }}
                onError={() => {
                  setCaptchaToken(undefined);
                }}
              />
            </>
          )}
        </FieldGroup>
      </form>
    </div>
  );
}
