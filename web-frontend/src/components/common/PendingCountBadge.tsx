import { AlertCircle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function PendingCountBadge({ count, label, error = false, className }: {
  count: number | null;
  label: string;
  error?: boolean;
  className?: string;
}) {
  if (!error && count === 0) return null;
  const description = error ? `${label}: unavailable` : count === null ? `${label}: checking` : `${count} ${label}`;
  return <Badge variant="outline" role="status" aria-label={description} title={description}
    className={cn("absolute -right-2 -top-2 size-6 rounded-full border-2 border-surface p-0 text-[10.5px] font-bold tabular-nums", error ? "bg-destructive-surface text-destructive" : count === null ? "bg-background text-muted-foreground" : "bg-warning-border text-warning-foreground", className)}>
    {error ? <AlertCircle aria-hidden="true" /> : count === null ? <Loader2 aria-hidden="true" className="animate-spin" /> : count > 99 ? "99+" : count}
  </Badge>;
}
