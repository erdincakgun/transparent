import { cn, trimAmount } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
} from "@/components/ui/field";
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
import { Link, useNavigate, useParams } from "react-router";
import { useLedger } from "@/components/ledger-provider";
import {
  listVerifiedTotpFactors,
  mfaErrorMessage,
  verifyMfaCodeAnyFactor,
} from "@/lib/supabase/mfa";

type Account = { id: string; name: string };

type AccountBalance = { balance: string };

const balanceFormat = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

export function AccountDeleteForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const navigate = useNavigate();
  const { accountId } = useParams();
  const { ledgers, activeLedger, loading } = useLedger();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [balance, setBalance] = useState("0");
  const [heirId, setHeirId] = useState<string | null>(null);
  const [factorIds, setFactorIds] = useState<string[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string>();

  const ledgerId = activeLedger?.id;
  const account = accounts.find((item) => item.id === accountId);
  const settled = Number(balance) === 0;
  const negative = balance.startsWith("-");

  useEffect(() => {
    if (loading) return;

    if (!ledgerId || !accountId) {
      setAccounts([]);
      setAccountsLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setAccountsLoading(true);

      const [accountResult, balanceResult, factorsResult] = await Promise.all([
        supabase
          .from("active_accounts")
          .select("id, name")
          .eq("ledger_id", ledgerId)
          .order("name"),
        supabase
          .from("account_balances")
          .select("balance::text")
          .eq("id", accountId),
        listVerifiedTotpFactors(),
      ]);

      if (cancelled) return;

      setAccounts(accountResult.data ?? []);
      setBalance(
        ((balanceResult.data ?? []) as AccountBalance[])[0]?.balance ?? "0",
      );
      setFactorIds(factorsResult.factors.map((factor) => factor.id));
      if (factorsResult.error) setError(mfaErrorMessage(factorsResult.error));
      setAccountsLoading(false);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [loading, ledgerId, accountId]);

  function handleHandOver() {
    if (!accountId || !heirId || !account) return;

    navigate({
      pathname: "/transaction-create",
      search: new URLSearchParams({
        from: negative ? heirId : accountId,
        to: negative ? accountId : heirId,
        amount: trimAmount(negative ? balance.slice(1) : balance),
        description: `close account: ${account.name}`,
        kind: "payment",
      }).toString(),
    });
  }

  async function handleSubmit(e: { preventDefault: () => void; target: any }) {
    e.preventDefault();

    if (!ledgerId || !accountId) return;

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
      .from("deleted_accounts")
      .insert({ account_id: accountId, ledger_id: ledgerId });

    if (error) {
      setSubmitted(false);
      setError(
        error.code === "23001"
          ? "This account still has a balance."
          : error.code === "23505"
            ? "This account is already deleted."
            : error.message,
      );
      return;
    }

    navigate("/accounts", { replace: true });
  }

  if (loading) return null;

  if (!ledgers.length || !activeLedger) {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <FieldGroup>
          <Field>
            <p className="text-center text-sm text-muted-foreground">
              Create a ledger before deleting accounts
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

          {accountsLoading ? null : !account ? (
            <Field>
              <p className="text-center text-sm text-muted-foreground">
                This account is not in the ledger
              </p>
            </Field>
          ) : (
            <>
              <Field>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  defaultValue={account.name}
                  readOnly
                />
                <FieldDescription>
                  {settled
                    ? "The account keeps its transactions. It can no longer send or receive."
                    : `This account sits at ${balanceFormat.format(Number(balance))}. Hand that balance to another account first.`}
                </FieldDescription>
              </Field>
              {settled ? (
                <>
                  <Field>
                    <Input
                      id="code"
                      name="code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      placeholder="Enter the six digits from your app"
                      disabled={!factorIds.length}
                      required
                    />
                    <FieldDescription>
                      Confirm with your authenticator app before deleting this
                      account.
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
                      Delete account
                    </Button>
                  </Field>
                </>
              ) : (
                <>
                  <Field>
                    <Select
                      value={heirId}
                      onValueChange={(value: string | null) => setHeirId(value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(value: string | null) =>
                            accounts.find((item) => item.id === value)?.name ??
                            "Hand the balance to"
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {accounts
                          .filter((item) => item.id !== accountId)
                          .map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <Button
                      type="button"
                      disabled={!heirId}
                      onClick={handleHandOver}
                    >
                      Hand over balance
                    </Button>
                  </Field>
                </>
              )}
            </>
          )}
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
