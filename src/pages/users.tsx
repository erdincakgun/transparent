import { useEffect, useState } from "react";
import { Link } from "react-router";
import { DownloadIcon, LogOutIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLedger } from "@/components/ledger-provider";
import { Actor } from "@/components/actor";
import { downloadCsv } from "@/lib/csv";
import { fetchAllRows } from "@/lib/pagination";
import supabase from "@/lib/supabase/client";

type LedgerUser = { user_id: string; added_by: string; added_at: string };

const dateFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "medium",
  hourCycle: "h23",
});

const exportColumns = ["ledger_id", "user_id", "added_by", "added_at"];

export default function UsersPage() {
  const { activeLedger, loading: ledgerLoading } = useLedger();
  const [users, setUsers] = useState<LedgerUser[]>([]);
  const [ledgerCreatedBy, setLedgerCreatedBy] = useState<string>();
  const [currentUserId, setCurrentUserId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string>();

  const ledgerId = activeLedger?.id;

  async function handleExport() {
    if (!ledgerId) return;

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

    downloadCsv(`ledgers_users-${ledgerId}.csv`, exportColumns, data);
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
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-sm text-muted-foreground">
            {loading
              ? "Loading users"
              : `${users.length} ${users.length === 1 ? "user" : "users"}`}
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
          <Button
            variant="outline"
            disabled={exporting || !ledgerId}
            onClick={handleExport}
          >
            <DownloadIcon />
            Export CSV
          </Button>
          <Button nativeButton={false} render={<Link to="/user-add" />}>
            <PlusIcon />
            Add user
          </Button>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : loading ? (
        <div className="divide-y rounded-lg border">
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
                  · {dateFormat.format(new Date(user.added_at))}
                </span>
              </div>
              <div className="flex items-center justify-end gap-3 sm:shrink-0">
                {user.user_id === currentUserId ? (
                  <>
                    <span className="text-sm text-muted-foreground">You</span>
                    {users.length === 1 ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="max-sm:h-9"
                        disabled
                        title="A ledger has to keep at least one member"
                      >
                        <LogOutIcon />
                        Leave
                      </Button>
                    ) : (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="max-sm:h-9"
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
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          This ledger has no users yet
        </div>
      )}
    </div>
  );
}
