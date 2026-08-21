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

export function LedgerDeleteForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const navigate = useNavigate();
  const { ledgerId } = useParams();
  const { ledgers, refreshLedgers, loading } = useLedger();
  const [factorIds, setFactorIds] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string>();

  const ledger = ledgers.find((item) => item.id === ledgerId);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { factors, error } = await listVerifiedTotpFactors();

      if (cancelled) return;

      setFactorIds(factors.map((factor) => factor.id));
      if (error) setError(mfaErrorMessage(error));
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: { preventDefault: () => void; target: any }) {
    e.preventDefault();

    if (!ledgerId) return;

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

    const { error } = await supabase
      .from("deleted_ledgers")
      .insert({ ledger_id: ledgerId });

    if (error) {
      setSubmitted(false);
      setError(
        error.code === "23505"
          ? "This ledger is already archived."
          : error.code === "22P02"
            ? "That is not a valid ledger ID."
            : error.message,
      );
      return;
    }

    await refreshLedgers();

    navigate("/", { replace: true });
  }

  if (loading) return null;

  if (!ledger) {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <FieldGroup>
          <Field>
            <p className="text-center text-sm text-muted-foreground">
              This ledger is not one of yours
            </p>
          </Field>
          <Field>
            <Button nativeButton={false} render={<Link to="/" />}>
              Go back
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
            <FieldTitle>Ledger</FieldTitle>
            <div className="flex w-full flex-col rounded-lg border border-input bg-transparent px-2.5 py-2 text-left text-sm leading-tight dark:bg-input/30">
              <span className="truncate font-medium">{ledger.name}</span>
              {ledger.description ? (
                <span className="truncate text-xs text-muted-foreground">
                  {ledger.description}
                </span>
              ) : null}
              <span className="truncate text-xs text-muted-foreground">
                {ledger.id}
              </span>
            </div>
            <FieldDescription>
              This ledger disappears for everyone in it. Its accounts and
              transactions are kept, not deleted.
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
              Confirm with your authenticator app before archiving this ledger.
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
              disabled={submitted || !factorIds.length}
            >
              Archive ledger
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
