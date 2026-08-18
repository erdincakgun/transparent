import { cn } from "@/lib/utils";

// Attribution columns hold a bare `auth.uid()`. `auth.users` is not exposed
// through the API, so there is no name to resolve it to and no lookup to
// attempt -- the same reason membership is granted by user id and the user
// menu offers "Copy user ID". Show the first block of the uuid, keep the whole
// of it in the tooltip, and say "you" when the row belongs to the reader.
export function Actor({
  userId,
  currentUserId,
  className,
}: {
  userId: string;
  currentUserId?: string;
  className?: string;
}) {
  const self = userId === currentUserId;

  return (
    <span
      title={userId}
      className={cn(self ? undefined : "font-mono", className)}
    >
      {self ? "you" : userId.slice(0, 8)}
    </span>
  );
}
