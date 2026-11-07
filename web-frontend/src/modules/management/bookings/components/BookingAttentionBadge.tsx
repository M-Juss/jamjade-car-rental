import { Badge } from "@/components/ui/badge";
import type { BookingAttention } from "@/services/booking";

export function BookingAttentionBadge({ attention, elapsedMinutes }: { attention?: BookingAttention | null; elapsedMinutes?: number }) {
  if (!attention) return null;
  const overdue = attention.key === "overdue_return";
  return <span className="inline-flex flex-wrap items-center gap-2">
    <Badge className={`whitespace-normal ${overdue ? "border-destructive-border bg-destructive-surface text-destructive" : "border-warning-border bg-warning-surface text-warning"}`}>{attention.label}</Badge>
    {overdue && elapsedMinutes ? <span className="text-xs font-medium text-destructive">{Math.floor(elapsedMinutes / 60)}h {elapsedMinutes % 60}m</span> : null}
  </span>;
}
