import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [emailSent, setEmailSent] = useState(false);
  const supabase = createClient();

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
            </>
          )}
        </FieldGroup>
      </form>
    </div>
  );
}
