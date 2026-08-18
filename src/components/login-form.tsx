import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useRef, useState } from "react";
import { useLocation } from "react-router";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import supabase from "@/lib/supabase/client";
import { otpErrorMessage } from "@/lib/supabase/auth";
import { callbackMessage } from "@/lib/supabase/callback";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const location = useLocation();
  const turnstileRef = useRef<TurnstileInstance | undefined>(undefined);
  const [captchaToken, setCaptchaToken] = useState<string | undefined>();
  const [emailSent, setEmailSent] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  // A magic link that could not be redeemed arrives here as a redirect from
  // `RequireAuth`, which forwards the original query string in router state.
  // Reading it once, as the initial value, means submitting clears it like any
  // other error and a later sign-out shows a clean form.
  const [error, setError] = useState<string | undefined>(() =>
    callbackMessage(
      (location.state as { from?: { search?: string } } | null)?.from?.search ??
        location.search,
    ),
  );

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

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <form onSubmit={handleSubmit}>
        <FieldGroup>
          {emailSent ? (
            <>
              <Field>
                <p className="text-center text-sm text-muted-foreground">
                  Check your inbox
                </p>
              </Field>
            </>
          ) : (
            <>
              <Field>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="Enter your email address"
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
