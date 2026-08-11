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
import { useEffect, useState } from "react";
import supabase from "@/lib/supabase/client";
import { Link, useNavigate } from "react-router";
import { ACTIVE_LEDGER_STORAGE_KEY } from "@/components/ledgers-switcher";

type Ledger = { id: string; name: string };

export function AccountCreateForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const navigate = useNavigate();
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(true);
  const [ledgerId, setLedgerId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("ledgers")
        .select("id, name")
        .order("name");

      const ledgerData = data ?? [];
      setLedgers(ledgerData);

      const storedId = localStorage.getItem(ACTIVE_LEDGER_STORAGE_KEY);

      setLedgerId(
        (ledgerData.find((ledger) => ledger.id === storedId) ?? ledgerData[0])
          ?.id ?? null,
      );

      setLoading(false);
    };
    load();
  }, []);

  async function handleSubmit(e: { preventDefault: () => void; target: any }) {
    e.preventDefault();

    if (!ledgerId) return;

    const form = e.target;
    const formData = new FormData(form);
    const name = formData.get("name")?.toString() ?? "";

    setSubmitted(true);
    setError(undefined);

    const { error } = await supabase
      .from("accounts")
      .insert({ ledger_id: ledgerId, name });

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
              items={ledgers.map((ledger) => ({
                value: ledger.id,
                label: ledger.name,
              }))}
              value={ledgerId}
              onValueChange={(value: string | null) => setLedgerId(value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a ledger" />
              </SelectTrigger>
              <SelectContent>
                {ledgers.map((ledger) => (
                  <SelectItem key={ledger.id} value={ledger.id}>
                    {ledger.name}
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
        </FieldGroup>
      </form>
    </div>
  );
}
