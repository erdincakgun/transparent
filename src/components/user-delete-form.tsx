import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import supabase from "@/lib/supabase/client";
import { Link, useNavigate, useParams } from "react-router";
import { useLedger } from "@/components/ledger-provider";

export function UserDeleteForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const navigate = useNavigate();
  const { userId } = useParams();
  const { ledgers, activeLedger, refreshLedgers, loading } = useLedger();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string>();

  const ledgerId = activeLedger?.id;

  async function handleSubmit(e: { preventDefault: () => void }) {
    e.preventDefault();

    if (!ledgerId || !userId) return;

    setSubmitted(true);
    setError(undefined);

    const { error, count } = await supabase
      .from("ledgers_users")
      .delete({ count: "exact" })
      .eq("ledger_id", ledgerId)
      .eq("user_id", userId);

    if (error) {
      setSubmitted(false);
      setError(
        error.code === "22P02" ? "That is not a valid user ID." : error.message,
      );
      return;
    }

    if (!count) {
      setSubmitted(false);
      setError("This user is not in the ledger.");
      return;
    }

    await refreshLedgers();

    navigate("/users", { replace: true });
  }

  if (loading) return null;

  if (!ledgers.length || !activeLedger) {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <FieldGroup>
          <Field>
            <p className="text-center text-sm text-muted-foreground">
              Create a ledger before removing users
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
            <div className="flex w-full flex-col rounded-lg border border-input bg-transparent px-2.5 py-2 text-left text-sm leading-tight dark:bg-input/30">
              <span className="truncate font-medium">{activeLedger.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {activeLedger.id}
              </span>
            </div>
          </Field>
          <Field>
            <Input
              id="user_id"
              name="user_id"
              type="text"
              defaultValue={userId}
              readOnly
            />
            <FieldDescription>
              This user loses access to the ledger. Everything they recorded
              stays.
            </FieldDescription>
          </Field>
          {error ? (
            <Field>
              <FieldError>{error}</FieldError>
            </Field>
          ) : null}
          <Field>
            <Button
              type="submit"
              variant="destructive"
              disabled={submitted || !userId}
            >
              Delete user
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
