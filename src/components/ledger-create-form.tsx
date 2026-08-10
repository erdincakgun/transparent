import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import type {} from "@marsidev/react-turnstile";
import supabase from "@/lib/supabase/client";

export function LedgerCreateForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [captchaToken, setCaptchaToken] = useState<string | undefined>();
  const [emailSent, setEmailSent] = useState(false);

  async function handleSubmit(e: { preventDefault: () => void; target: any }) {
    e.preventDefault();

    const form = e.target;
    const formData = new FormData(form);
    const email = formData.get("email")?.toString() ?? "";

    const { error } = await supabase.auth.signInWithOtp({
      email: email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: import.meta.env.VITE_SITE_URL!,
        captchaToken: captchaToken,
      },
    });

    if (error) {
      console.log(error);
      alert(error.message);
    } else {
      setEmailSent(true);
    }
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
              <Field>
                <Button type="submit">Login</Button>
              </Field>
              <Turnstile
                siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
                options={{
                  size: "flexible",
                  appearance: "interaction-only",
                }}
                onSuccess={(token) => {
                  setCaptchaToken(token);
                }}
              />
            </>
          )}
        </FieldGroup>
      </form>
    </div>
  );
}
