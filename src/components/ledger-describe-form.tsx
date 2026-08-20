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

export function LedgerDescribeForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const navigate = useNavigate();
  const { ledgerId } = useParams();
  const { ledgers, refreshLedgers, loading } = useLedger();
  const [rewrites, setRewrites] = useState<Rewrite[]>([]);
  const [original, setOriginal] = useState<Original>();
  const [current, setCurrent] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>();
  const [descriptionLoading, setDescriptionLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string>();

  const ledger = ledgers.find((item) => item.id === ledgerId);

  useEffect(() => {
    if (loading || !ledgerId) return;

    let cancelled = false;

    const load = async () => {
      setDescriptionLoading(true);

      const [currentResult, rewriteResult, originalResult, sessionResult] =
        await Promise.all([
          supabase
            .from("active_ledgers")
            .select("description")
            .eq("id", ledgerId)
            .maybeSingle(),
          fetchAllRows<Rewrite>((from, to) =>
            supabase
              .from("ledger_descriptions")
              .select("id, description, created_at, created_by")
              .eq("ledger_id", ledgerId)
              .order("id", { ascending: false })
              .range(from, to),
          ),
          supabase
            .from("ledgers")
            .select("description, created_at, created_by")
            .eq("id", ledgerId)
            .maybeSingle(),
          supabase.auth.getSession(),
        ]);

      if (cancelled) return;

      setCurrent(currentResult.data?.description ?? null);
      setRewrites(rewriteResult.data ?? []);
      setOriginal(originalResult.data ?? undefined);
      setCurrentUserId(sessionResult.data.session?.user.id);
      setError(
        (currentResult.error ?? rewriteResult.error ?? originalResult.error)
          ?.message,
      );
      setDescriptionLoading(false);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [loading, ledgerId]);

  async function handleSubmit(e: { preventDefault: () => void; target: any }) {
    e.preventDefault();

    if (!ledgerId) return;

    const form = e.target;
    const formData = new FormData(form);
    const description = formData.get("description")?.toString().trim();

    setSubmitted(true);
    setError(undefined);

    const { error } = await supabase
      .from("ledger_descriptions")
      .insert({ ledger_id: ledgerId, description: description || null });

    if (error) {
      setSubmitted(false);
      setError(
        error.code === "23514"
          ? "That description is too long."
          : error.code === "23503"
            ? "This ledger no longer exists."
            : error.message,
      );
      return;
    }

    await refreshLedgers();

    navigate(-1);
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
            {/* Not a control — `FieldTitle` is the div that looks like a
                label without claiming to label anything focusable. */}
            <FieldTitle>Ledger</FieldTitle>
            <div className="flex w-full flex-col rounded-lg border border-input bg-transparent px-2.5 py-2 text-left text-sm leading-tight dark:bg-input/30">
              <span className="truncate font-medium">{ledger.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {ledger.id}
              </span>
            </div>
          </Field>
          {descriptionLoading ? null : (
            <>
              <Field>
                <FieldLabel htmlFor="description">
                  Description (optional)
                </FieldLabel>
                <Input
                  id="description"
                  name="description"
                  type="text"
                  defaultValue={current ?? ""}
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
