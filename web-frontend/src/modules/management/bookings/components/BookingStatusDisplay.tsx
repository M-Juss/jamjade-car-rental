import { cn } from "@/lib/utils";
import type { BookingAttention, BookingRecord, BookingStatus } from "@/services/booking";

const bookingStatusStyle: Record<BookingStatus, string> = {
  pending: "bg-warning-surface text-warning border-warning-border",
  confirmed: "bg-muted text-primary border-border",
  rejected: "bg-destructive-surface text-destructive border-destructive-border",
  ongoing: "bg-success-surface text-success border-success-border",
  returned: "bg-cyan-50 text-cyan-700 border-cyan-200",
  completed: "bg-background text-muted-foreground border-border",
  cancelled: "bg-destructive-surface text-destructive border-destructive-border",
};

const attentionText: Record<BookingAttention["key"], string | null> = {
  overdue_return: "Overdue",
  not_started: "Schedule ended",
  return_processing: "Processing return",
  awaiting_settlement: null,
  ready_to_complete: "Ready to complete",
};

type Props = {
  booking: Pick<BookingRecord, "statusKey" | "adminStatus" | "attention" | "lateReturn">;
  className?: string;
};

export function BookingStatusDisplay({ booking, className }: Props) {
  const attention = booking.attention;
  const note = attention ? attentionText[attention.key] : null;
  const overdue = attention?.key === "overdue_return";
  const needsAttention = overdue || attention?.key === "not_started";
  const elapsed = booking.lateReturn?.elapsedMinutes;
  const duration = overdue && elapsed != null && elapsed > 0
    ? elapsed < 60 ? `${elapsed}m` : `${Math.floor(elapsed / 60)}h ${elapsed % 60}m`
    : null;

  return (
    <div className={cn("flex max-w-44 flex-col items-start gap-1.5", className)}>
      <span className={cn("table-status-badge inline-flex max-w-full whitespace-normal rounded-lg border px-2.5 py-1 text-xs font-semibold [overflow-wrap:anywhere]", bookingStatusStyle[booking.statusKey])}>
        {booking.adminStatus}
      </span>
      {note && (
        <p className={cn("whitespace-nowrap text-xs font-medium leading-4", overdue ? "text-destructive" : needsAttention ? "text-warning" : "text-muted-foreground")}>
          {note}{duration ? <span className="font-normal"> {duration}</span> : null}
        </p>
      )}
    </div>
  );
}
