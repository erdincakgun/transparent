import { useEffect, useState } from "react";
import { Link } from "react-router";
import { LogOutIcon, PlusIcon, Trash2Icon, UsersIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLedger } from "@/components/ledger-provider";
import { Actor } from "@/components/actor";
import { ExportMenu, type ExportFormat } from "@/components/export-menu";
import { downloadCsv } from "@/lib/csv";
import { downloadHtmlReport } from "@/lib/html-report";
import { fetchAllRows } from "@/lib/pagination";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { countLabel, formatTimestamp, shortId } from "@/lib/utils";
import supabase from "@/lib/supabase/client";

type LedgerUser = { user_id: string; added_by: string; added_at: string };

const exportColumns = ["ledger_id", "user_id", "added_by", "added_at"];

const emptyState = {
  title: "This ledger has no users yet",
  body: "Members are added by user ID — theirs is in their sidebar menu.",
};

export default function UsersPage() {
  useDocumentTitle("Users");
  const { activeLedger, loading: ledgerLoading } = useLedger();
  const [users, setUsers] = useState<LedgerUser[]>([]);
  const [ledgerCreatedBy, setLedgerCreatedBy] = useState<string>();
  const [currentUserId, setCurrentUserId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string>();

  const ledgerId = activeLedger?.id;

  async function handleExport(format: ExportFormat) {
    if (!activeLedger) return;

    const ledgerId = activeLedger.id;

    setExporting(true);

    const [{ data, error }, { count, error: countError }] = await Promise.all([
      fetchAllRows((from, to) =>
        supabase
          .from("ledgers_users")
          .select(exportColumns.join(", "))
          .eq("ledger_id", ledgerId)
          .order("added_at")
          .order("user_id")
          .range(from, to),
      ),
      supabase
        .from("ledgers_users")
        .select("*", { count: "exact", head: true })
        .eq("ledger_id", ledgerId),
    ]);

    setExporting(false);

    if (error ?? countError) {
      setError((error ?? countError)?.message);
      return;
    }

    if (!data || data.length !== count) {
      setError("Export incomplete — nothing was saved.");
      return;
    }

    if (format === "csv") {
      downloadCsv(`ledgers_users-${ledgerId}.csv`, exportColumns, data);
      return;
    }

    const exported = data as unknown as LedgerUser[];

    downloadHtmlReport(`ledgers_users-${ledgerId}.html`, {
      title: "Users",
      ledger: activeLedger,
      exportedBy: currentUserId,
      generatedAt: new Date(),
      count: countLabel(exported.length, "user"),
      rows: exported.map((user) => ({
        key: user.user_id,
        heading: user.user_id,
        meta: [
          { label: "added by", value: shortId(user.added_by), mono: true },
          { value: formatTimestamp(user.added_at) },
        ],
      })),
      empty: emptyState,
    });
  }

  useEffect(() => {
    if (ledgerLoading) return;

    if (!ledgerId) {
      setUsers([]);
      setLedgerCreatedBy(undefined);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(undefined);

      const [userResult, ledgerResult, sessionResult] = await Promise.all([
        fetchAllRows<LedgerUser>((from, to) =>
          supabase
            .from("ledgers_users")
            .select("user_id, added_by, added_at")
            .eq("ledger_id", ledgerId)
            .order("added_at")
            .order("user_id")
            .range(from, to),
        ),
        supabase
          .from("ledgers")
          .select("created_by")
          .eq("id", ledgerId)
          .maybeSingle(),
        supabase.auth.getSession(),
      ]);

      if (cancelled) return;

      setUsers(userResult.data ?? []);
      setLedgerCreatedBy(ledgerResult.data?.created_by);
      setCurrentUserId(sessionResult.data.session?.user.id);
      setError((userResult.error ?? ledgerResult.error)?.message);
      setLoading(false);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [ledgerLoading, ledgerId]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="sr-only">Users</h1>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p role="status" className="text-sm text-muted-foreground">
            {loading
              ? "Loading users"
              : countLabel(users.length, "user")}
          </p>
          {activeLedger?.description ? (
            <p className="truncate text-xs text-muted-foreground">
              {activeLedger.description}
            </p>
          ) : null}
          {ledgerCreatedBy ? (
            <p className="text-xs text-muted-foreground">
              Ledger created by{" "}
              <Actor userId={ledgerCreatedBy} currentUserId={currentUserId} />
            </p>
          ) : null}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <ExportMenu
            disabled={exporting || !ledgerId}
            onExport={handleExport}
          />
          <Button nativeButton={false} render={<Link to="/user-add" />}>
            <PlusIcon />
            Add user
          </Button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : loading ? (
        <div aria-hidden="true" className="divide-y rounded-lg border">
          {[0, 1, 2].map((row) => (
            <div key={row} className="px-4 py-3">
              <Skeleton className="h-4 w-72" />
            </div>
          ))}
        </div>
      ) : users.length ? (
        <div className="divide-y rounded-lg border">
          {users.map((user) => (
            <div
              key={user.user_id}
              className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-sm font-medium">
                  {user.user_id}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  added by{" "}
                  <Actor userId={user.added_by} currentUserId={currentUserId} />{" "}
                  · {formatTimestamp(user.added_at)}
                </span>
              </div>
              <div className="flex items-center justify-end gap-3 sm:shrink-0">
                {user.user_id === currentUserId ? (
                  <>
                    <span className="shrink-0 rounded-sm border border-primary/30 bg-primary/10 px-1.5 py-px text-xs font-medium text-primary">
                      You
                    </span>
                    {users.length === 1 ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="max-sm:h-9"
                          disabled
                          title="A ledger has to keep at least one member"
                          aria-describedby="leave-blocked"
                        >
                          <LogOutIcon />
                          Leave
                        </Button>
                        <span id="leave-blocked" className="sr-only">
                          A ledger has to keep at least one member
                        </span>
                      </>
                    ) : (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="max-sm:h-9"
                        aria-label="Leave this ledger"
                        nativeButton={false}
                        render={<Link to={`/users/delete/${user.user_id}`} />}
                      >
                        <LogOutIcon />
                        Leave
                      </Button>
                    )}
                  </>
                ) : (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="max-sm:h-9"
                    aria-label={`Delete user ${user.user_id}`}
                    nativeButton={false}
                    render={<Link to={`/users/delete/${user.user_id}`} />}
                  >
                    <Trash2Icon />
                    Delete
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-lg border p-8 text-center">
          <UsersIcon className="size-6 text-muted-foreground" />
          <p className="text-sm font-medium">{emptyState.title}</p>
          <p className="text-sm text-muted-foreground">{emptyState.body}</p>
        </div>
      )}
    </div>
  );
}
