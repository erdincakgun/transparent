import { cn } from "@/lib/utils";

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
