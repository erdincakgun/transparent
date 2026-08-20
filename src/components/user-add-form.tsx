import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
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

export function UserAddForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const navigate = useNavigate();
  const { ledgers, activeLedger, selectLedger, loading } = useLedger();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string>();

  const ledgerId = activeLedger?.id;

  async function handleSubmit(e: { preventDefault: () => void; target: any }) {
    e.preventDefault();

    if (!ledgerId) return;

    const form = e.target;
    const formData = new FormData(form);
    const userId = formData.get("user_id")?.toString().trim() ?? "";

    setSubmitted(true);
    setError(undefined);

    const { error } = await supabase
      .from("ledgers_users")
      .insert({ ledger_id: ledgerId, user_id: userId });

    if (error) {
      setSubmitted(false);
      setError(
        error.code === "23505"
          ? "This user is already in the ledger."
          : error.code === "23503"
            ? "No user has that ID."
            : error.code === "22P02"
              ? "That is not a valid user ID."
              : error.message,
      );
      return;
    }

    navigate("/users", { replace: true });
  }

  if (loading) return null;

  if (!ledgers.length) {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <FieldGroup>
          <Field>
            <p className="text-center text-sm text-muted-foreground">
              Create a ledger before adding users
            </p>
          </Field>
          <Field>
            <Button nativeButton={false} render={<Link to="/ledger-create" />}>
              Create ledger
            </Button>
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
            <FieldLabel id="ledger-label" htmlFor="ledger">
              Ledger
            </FieldLabel>
            <Select
              value={ledgerId ?? null}
              onValueChange={(value: string | null) => {
                if (value) selectLedger(value);
              }}
            >
              <SelectTrigger
                id="ledger"
                aria-labelledby="ledger-label ledger"
                className="w-full data-[size=default]:h-auto"
              >
                <SelectValue className="line-clamp-none">
                  {(value: string | null) => {
                    const ledger = ledgers.find((item) => item.id === value);

                    if (!ledger) return "Select a ledger";

                    return (
                      <div className="grid flex-1 text-left leading-tight">
                        <span className="truncate font-medium">
                          {ledger.name}
                        </span>
                        {ledger.description ? (
                          <span className="truncate text-xs text-muted-foreground">
                            {ledger.description}
                          </span>
                        ) : null}
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
                      {ledger.description ? (
                        <span className="truncate text-xs text-muted-foreground">
                          {ledger.description}
                        </span>
                      ) : null}
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
            <FieldLabel htmlFor="user_id">User ID</FieldLabel>
            <Input
              id="user_id"
              name="user_id"
              type="text"
              placeholder="Paste a user ID"
              required
            />
            <FieldDescription>
              Ask the person to copy their user ID from their sidebar user menu
            </FieldDescription>
          </Field>
          {error ? (
            <Field>
              <FieldError>{error}</FieldError>
            </Field>
          ) : null}
          <Field>
            <Button type="submit" disabled={submitted || !ledgerId}>
              Add user
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
