import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import supabase from "@/lib/supabase/client";
import { Link, useNavigate } from "react-router";
import { useLedger } from "@/components/ledger-provider";

export function AccountCreateForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const navigate = useNavigate();
  const { ledgers, activeLedger, loading } = useLedger();
  const [selectedLedgerId, setSelectedLedgerId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string>();

  const ledgerId = selectedLedgerId ?? activeLedger?.id ?? null;

  async function handleSubmit(e: { preventDefault: () => void; target: any }) {
    e.preventDefault();

    if (!ledgerId) return;

    const form = e.target;
    const formData = new FormData(form);
    const name = formData.get("name")?.toString() ?? "";
    const description = formData.get("description")?.toString().trim();

    setSubmitted(true);
    setError(undefined);

    const { error } = await supabase
      .from("accounts")
      .insert({ ledger_id: ledgerId, name, description: description || null });

    if (error) {
      setSubmitted(false);
      setError(
        error.code === "23505"
          ? "This ledger already has an account with that name."
          : error.message,
      );
      return;
    }

    navigate("/accounts", { replace: true });
  }

  if (loading) return null;

  if (!ledgers.length) {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <FieldGroup>
          <Field>
            <p className="text-center text-sm text-muted-foreground">
              Create a ledger before adding accounts
            </p>
          </Field>
          <Field>
            <Button render={<Link to="/ledger-create" />}>Create ledger</Button>
          </Field>
        </FieldGroup>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <Field>
            <Select
              value={ledgerId}
              onValueChange={(value: string | null) =>
                setSelectedLedgerId(value)
              }
            >
              <SelectTrigger className="w-full data-[size=default]:h-auto">
                <SelectValue className="line-clamp-none">
                  {(value: string | null) => {
                    const ledger = ledgers.find((item) => item.id === value);

                    if (!ledger) return "Select a ledger";

                    return (
                      <div className="grid flex-1 text-left leading-tight">
                        <span className="truncate font-medium">
                          {ledger.name}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {ledger.id}
                        </span>
                      </div>
                    );
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ledgers.map((ledger) => (
                  <SelectItem key={ledger.id} value={ledger.id}>
                    <div className="grid flex-1 text-left leading-tight">
                      <span className="truncate font-medium">
                        {ledger.name}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {ledger.id}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="Enter an account name"
              maxLength={200}
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
          {error ? (
            <Field>
              <FieldError>{error}</FieldError>
            </Field>
          ) : null}
          <Field>
            <Button type="submit" disabled={submitted || !ledgerId}>
              Create account
            </Button>
          </Field>
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
        </FieldGroup>
      </form>
    </div>
  );
}
