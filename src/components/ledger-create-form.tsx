import { cn } from "@/lib/utils";
import { Copy, CopyCheck, LogOutIcon, ShieldCheckIcon } from "lucide-react";
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
import { useNavigate } from "react-router";
import { useLedger } from "@/components/ledger-provider";

export function LedgerCreateForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const navigate = useNavigate();
  const { ledgers, refreshLedgers, selectLedger } = useLedger();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string>();
  const [userId, setUserId] = useState<string>();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setUserId(data.session?.user.id);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const copyUserId = () => {
    if (!userId) return;

    navigator.clipboard.writeText(userId);
    setCopied(true);
  };

  const signOut = () => {
    supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  async function handleSubmit(e: { preventDefault: () => void; target: any }) {
    e.preventDefault();

    const form = e.target;
    const formData = new FormData(form);
    const name = formData.get("name")?.toString() ?? "";
    const description = formData.get("description")?.toString().trim();

    setSubmitted(true);
    setError(undefined);

    const id = crypto.randomUUID();
    const { error } = await supabase
      .from("ledgers")
      .insert({ id, name, description: description || null });

    if (error) {
      setSubmitted(false);
      setError(error.message);
      return;
    }

    await refreshLedgers();
    selectLedger(id);
    navigate("/", { replace: true });
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="name">Ledger name</FieldLabel>
            <Input
              id="name"
              name="name"
              type="text"
              maxLength={100}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="description">
              Description (optional)
            </FieldLabel>
            <Input
              id="description"
              name="description"
              type="text"
              maxLength={1000}
            />
          </Field>
          {error ? (
            <Field>
              <FieldError>{error}</FieldError>
            </Field>
          ) : null}
          <Field>
            <Button type="submit" disabled={submitted}>
              Create ledger
            </Button>
          </Field>
          {ledgers.length ? (
            <Field>
              <Button
                type="button"
                variant="outline"
                disabled={submitted}
                onClick={() => navigate(-1)}
              >
                Cancel
              </Button>
            </Field>
          ) : (
            <>
              <Field>
                <p className="text-center text-sm text-muted-foreground">
                  Waiting to join someone else's ledger? Send them your user ID
                  and they can add you.
                </p>
              </Field>
              <Field>
                <FieldLabel htmlFor="user_id">Your user ID</FieldLabel>
                <div className="flex items-center gap-2">
                  <Input
                    id="user_id"
                    name="user_id"
                    type="text"
                    value={userId ?? ""}
                    className="font-mono text-xs"
                    readOnly
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Copy user ID"
                    disabled={!userId}
                    onClick={copyUserId}
                  >
                    {copied ? <CopyCheck /> : <Copy />}
                  </Button>
                </div>
              </Field>
              <Field>
                <Button
                  type="button"
                  variant="outline"
                  disabled={submitted}
                  onClick={() => navigate("/mfa-settings")}
                >
                  <ShieldCheckIcon />
                  Manage two-factor
                </Button>
              </Field>
              <Field>
                <Button
                  type="button"
                  variant="outline"
                  disabled={submitted}
                  onClick={signOut}
                >
                  <LogOutIcon />
                  Log out
                </Button>
              </Field>
            </>
          )}
        </FieldGroup>
      </form>
    </div>
  );
}
