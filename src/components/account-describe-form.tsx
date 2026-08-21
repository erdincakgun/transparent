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
  DescriptionHistory,
  type DescriptionEntry,
} from "@/components/description-history";
import { fetchAllRows } from "@/lib/pagination";

type Account = { id: string; name: string; description: string | null };

type Rewrite = {
  id: number;
  description: string | null;
  created_at: string;
  created_by: string;
};

type Original = {
  description: string | null;
  created_at: string;
  created_by: string;
};

export function AccountDescribeForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const navigate = useNavigate();
  const { accountId } = useParams();
  const { ledgers, activeLedger, loading } = useLedger();
  const [account, setAccount] = useState<Account>();
  const [rewrites, setRewrites] = useState<Rewrite[]>([]);
  const [original, setOriginal] = useState<Original>();
  const [currentUserId, setCurrentUserId] = useState<string>();
  const [accountLoading, setAccountLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string>();

  const ledgerId = activeLedger?.id;

  useEffect(() => {
    if (loading) return;

    if (!ledgerId || !accountId) {
      setAccount(undefined);
      setAccountLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setAccountLoading(true);

      const [accountResult, rewriteResult, originalResult, sessionResult] =
        await Promise.all([
          supabase
            .from("active_accounts")
            .select("id, name, description")
            .eq("id", accountId)
            .eq("ledger_id", ledgerId)
            .maybeSingle(),
          fetchAllRows<Rewrite>((from, to) =>
            supabase
              .from("account_descriptions")
              .select("id, description, created_at, created_by")
              .eq("account_id", accountId)
              .order("id", { ascending: false })
              .range(from, to),
          ),
          supabase
            .from("accounts")
            .select("description, created_at, created_by")
            .eq("id", accountId)
            .maybeSingle(),
          supabase.auth.getSession(),
        ]);

      if (cancelled) return;

      setAccount(accountResult.data ?? undefined);
      setRewrites(rewriteResult.data ?? []);
      setOriginal(originalResult.data ?? undefined);
      setCurrentUserId(sessionResult.data.session?.user.id);
      setError(
        (accountResult.error ?? rewriteResult.error ?? originalResult.error)
          ?.message,
      );
      setAccountLoading(false);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [loading, ledgerId, accountId]);

  async function handleSubmit(e: { preventDefault: () => void; target: any }) {
    e.preventDefault();

    if (!ledgerId || !accountId) return;

    const form = e.target;
    const formData = new FormData(form);
    const description = formData.get("description")?.toString().trim();

    setSubmitted(true);
    setError(undefined);

    const { error } = await supabase.from("account_descriptions").insert({
      account_id: accountId,
      ledger_id: ledgerId,
      description: description || null,
    });

    if (error) {
      setSubmitted(false);
      setError(
        error.code === "23001"
          ? "This account is deleted. It keeps the description it was deleted with."
          : error.code === "23514"
            ? "That description is too long."
            : error.code === "23503"
              ? "This account is not in the ledger."
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
              Create a ledger before describing accounts
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

  const entries: DescriptionEntry[] = [
    ...rewrites.map((rewrite) => ({
      key: String(rewrite.id),
      description: rewrite.description,
      createdAt: rewrite.created_at,
      createdBy: rewrite.created_by,
    })),
    ...(original
      ? [
          {
            key: "original",
            description: original.description,
            createdAt: original.created_at,
            createdBy: original.created_by,
            original: true,
          },
        ]
      : []),
  ];

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <Field>
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

          {accountLoading ? null : !account ? (
            <Field>
              <p className="text-center text-sm text-muted-foreground">
                This account is not in the ledger
              </p>
            </Field>
          ) : (
            <>
              <Field>
                <FieldLabel htmlFor="name">Account</FieldLabel>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  defaultValue={account.name}
                  readOnly
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="description">
                  Description (optional)
                </FieldLabel>
                <Input
                  id="description"
                  name="description"
                  type="text"
                  defaultValue={account.description ?? ""}
                  maxLength={1000}
                />
                <FieldDescription>
                  Saving writes a new description beside the old one, which is
                  kept. An empty field clears the description without erasing
                  anything.
                </FieldDescription>
              </Field>
              {error ? (
                <Field>
                  <FieldError>{error}</FieldError>
                </Field>
              ) : null}
              <Field>
                <Button type="submit" disabled={submitted}>
                  Save description
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
          {entries.length ? (
            <Field>
              <DescriptionHistory
                entries={entries}
                currentUserId={currentUserId}
              />
            </Field>
          ) : null}
        </FieldGroup>
      </form>
    </div>
  );
}
