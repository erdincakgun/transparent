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
import { Link, useNavigate, useSearchParams } from "react-router";
import { useLedger } from "@/components/ledger-provider";

type Account = { id: string; name: string };

export function TransactionCreateForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { ledgers, activeLedger, selectLedger, loading } = useLedger();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [fromAccountId, setFromAccountId] = useState<string | null>(null);
  const [toAccountId, setToAccountId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string>();

  const ledgerId = activeLedger?.id;
  const prefillFrom = searchParams.get("from");
  const prefillTo = searchParams.get("to");
  const prefillAmount = searchParams.get("amount") ?? "";
  const prefillDescription = searchParams.get("description") ?? "";

  useEffect(() => {
    if (loading) return;

    if (!ledgerId) {
      setAccounts([]);
      setAccountsLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setAccountsLoading(true);

      const { data } = await supabase
        .from("active_accounts")
        .select("id, name")
        .eq("ledger_id", ledgerId)
        .order("name");

      if (cancelled) return;

      const loaded = data ?? [];
      const inLedger = (id: string | null) =>
        id && loaded.some((account) => account.id === id) ? id : null;

      setAccounts(loaded);
      setFromAccountId(inLedger(prefillFrom));
      setToAccountId(inLedger(prefillTo));
      setAccountsLoading(false);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [loading, ledgerId, prefillFrom, prefillTo]);

  async function handleSubmit(e: { preventDefault: () => void; target: any }) {
    e.preventDefault();

    if (!ledgerId || !fromAccountId || !toAccountId) return;

    const form = e.target;
    const formData = new FormData(form);
    const amount = formData.get("amount")?.toString() ?? "";
    const description = formData.get("description")?.toString() ?? "";

    setSubmitted(true);
    setError(undefined);

    const { error } = await supabase.from("transactions").insert({
      ledger_id: ledgerId,
      from_account_id: fromAccountId,
      to_account_id: toAccountId,
      amount,
      description,
    });

    if (error) {
      setSubmitted(false);
      setError(
        error.message.includes("transactions_distinct_accounts")
          ? "Pick two different accounts."
          : error.code === "23001"
            ? "One of these accounts has been deleted."
            : error.message,
      );
      return;
    }

    navigate("/transactions", { replace: true });
  }

  if (loading) return null;

  if (!ledgers.length) {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <FieldGroup>
          <Field>
            <p className="text-center text-sm text-muted-foreground">
              Create a ledger before adding transactions
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
            <Select
              value={ledgerId ?? null}
              onValueChange={(value: string | null) => {
                if (value) selectLedger(value);
              }}
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

          {accountsLoading ? null : accounts.length < 2 ? (
            <>
              <Field>
                <p className="text-center text-sm text-muted-foreground">
                  This ledger needs at least two accounts before you can add a
                  transaction
                </p>
              </Field>
              <Field>
                <Button
                  nativeButton={false}
                  render={<Link to="/account-create" />}
                >
                  Create account
                </Button>
              </Field>
            </>
          ) : (
            <>
              <Field>
                <Select
                  value={fromAccountId}
                  onValueChange={(value: string | null) =>
                    setFromAccountId(value)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(value: string | null) =>
                        accounts.find((item) => item.id === value)?.name ??
                        "From account"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <Select
                  value={toAccountId}
                  onValueChange={(value: string | null) =>
                    setToAccountId(value)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(value: string | null) =>
                        accounts.find((item) => item.id === value)?.name ??
                        "To account"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  inputMode="decimal"
                  step="0.0001"
                  placeholder="Enter an amount"
                  defaultValue={prefillAmount}
                  required
                />
              </Field>
              <Field>
                <Input
                  id="description"
                  name="description"
                  type="text"
                  placeholder="Enter a description"
                  maxLength={1000}
                  defaultValue={prefillDescription}
                  required
                />
              </Field>
              {error ? (
                <Field>
                  <FieldError>{error}</FieldError>
                </Field>
              ) : null}
              <Field>
                <Button
                  type="submit"
                  disabled={submitted || !fromAccountId || !toAccountId}
                >
                  Add transaction
                </Button>
              </Field>
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
