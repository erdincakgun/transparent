import { Actor } from "@/components/actor";
import { formatTimestamp } from "@/lib/utils";

export type DescriptionEntry = {
  key: string;
  description: string | null;
  createdAt: string;
  createdBy: string;
  original?: boolean;
};

export function DescriptionHistory({
  entries,
  currentUserId,
}: {
  entries: DescriptionEntry[];
  currentUserId?: string;
}) {
  return (
    <div className="divide-y rounded-lg border">
      {entries.map((entry) => (
        <div key={entry.key} className="flex flex-col gap-0.5 px-3 py-2">
          {entry.description ? (
            <span className="text-sm">{entry.description}</span>
          ) : (
            <span className="text-sm italic text-muted-foreground">
              no description
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {entry.original ? "written" : "rewritten"} by{" "}
            <Actor userId={entry.createdBy} currentUserId={currentUserId} /> ·{" "}
            {formatTimestamp(entry.createdAt)}
          </span>
        </div>
      ))}
    </div>
  );
}
