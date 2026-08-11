import { cn } from "@/lib/utils";
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
  const { refreshLedgers, selectLedger } = useLedger();
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: { preventDefault: () => void; target: any }) {
    e.preventDefault();

    const form = e.target;
    const formData = new FormData(form);
    const name = formData.get("name")?.toString() ?? "";

    setSubmitted(true);

    const id = crypto.randomUUID();
    const { error } = await supabase.from("ledgers").insert({ id, name });

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
            <Button type="submit" disabled={submitted}>
              Create ledger
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </div>
  );
}
