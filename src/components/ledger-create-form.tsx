import { cn } from "@/lib/utils";
import { LogOutIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useState } from "react";
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

    const id = crypto.randomUUID();
    const { error } = await supabase
      .from("ledgers")
      .insert({ id, name, description: description || null });

    if (error) {
      setSubmitted(false);
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
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="Enter a ledger name"
              maxLength={100}
              required
            />
          </Field>
          <Field>
            <Input
              id="description"
              name="description"
              type="text"
              placeholder="Enter a description (optional)"
              maxLength={1000}
            />
          </Field>
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
          )}
        </FieldGroup>
      </form>
    </div>
  );
}
