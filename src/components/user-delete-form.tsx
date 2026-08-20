import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import supabase from "@/lib/supabase/client";
import { Link, useNavigate, useParams } from "react-router";
import { useLedger } from "@/components/ledger-provider";
import {
  listVerifiedTotpFactors,
  mfaErrorMessage,
  verifyMfaCodeAnyFactor,
} from "@/lib/supabase/mfa";

export function UserDeleteForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const navigate = useNavigate();
  const { userId } = useParams();
  const { ledgers, activeLedger, refreshLedgers, loading } = useLedger();
  const [factorIds, setFactorIds] = useState<string[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string>();

  const ledgerId = activeLedger?.id;
  const leavingSelf = !!currentUserId && userId === currentUserId;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const [{ factors, error }, sessionResult] = await Promise.all([
        listVerifiedTotpFactors(),
        supabase.auth.getSession(),
      ]);

      if (cancelled) return;

      setFactorIds(factors.map((factor) => factor.id));
      setCurrentUserId(sessionResult.data.session?.user.id);
      if (error) setError(mfaErrorMessage(error));
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: { preventDefault: () => void; target: any }) {
    e.preventDefault();

    if (!ledgerId || !userId) return;

    const form = e.target;
    const formData = new FormData(form);
    const code = formData.get("code")?.toString().trim() ?? "";

    setSubmitted(true);
    setError(undefined);

    const mfaError = await verifyMfaCodeAnyFactor(factorIds, code);

    if (mfaError) {
      setSubmitted(false);
      setError(mfaErrorMessage(mfaError));
      return;
    }

    const { error, count } = await supabase
      .from("ledgers_users")
      .delete({ count: "exact" })
      .eq("ledger_id", ledgerId)
      .eq("user_id", userId);

    if (error) {
      setSubmitted(false);
      setError(
        error.code === "22P02"
          ? "That is not a valid user ID."
          : error.code === "23001"
            ? "A ledger has to keep at least one member."
            : error.message,
      );
      return;
    }

    if (!count) {
      setSubmitted(false);
      setError("This user is not in the ledger.");
      return;
    }

    const ledgersLeft = await refreshLedgers();

    navigate(leavingSelf || !ledgersLeft.length ? "/" : "/users", {
      replace: true,
    });
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
            {/* Not a control — `FieldTitle` is the div that looks like a
                label without claiming to label anything focusable. */}
            <FieldTitle>Ledger</FieldTitle>
            <div className="flex w-full flex-col rounded-lg border border-input bg-transparent px-2.5 py-2 text-left text-sm leading-tight dark:bg-input/30">
              <span className="truncate font-medium">{activeLedger.name}</span>
              {activeLedger.description ? (
                <span className="truncate text-xs text-muted-foreground">
                  {activeLedger.description}
                </span>
              ) : null}
              <span className="truncate text-xs text-muted-foreground">
                {activeLedger.id}
              </span>
            </div>
          </Field>
          <Field>
            <FieldLabel htmlFor="user_id">User ID</FieldLabel>
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
          <Field>
            <FieldLabel htmlFor="code">Authenticator code</FieldLabel>
            <Input
              id="code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              disabled={!factorIds.length}
              required
            />
            <FieldDescription>
              Confirm with your authenticator app before removing this user.
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
              disabled={submitted || !userId || !factorIds.length}
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
