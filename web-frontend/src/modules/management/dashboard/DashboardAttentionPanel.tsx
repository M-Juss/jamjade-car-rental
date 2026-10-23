import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { BookingAttention } from "@/services/booking";
import type { DashboardResponse } from "@/services/report";

const attentionLabels: Record<BookingAttention["key"], string> = {
  overdue_return: "Return overdue",
  not_started: "Schedule ended",
  return_processing: "Processing return",
  awaiting_settlement: "Awaiting payment",
  ready_to_complete: "Ready to complete",
};

type Props = {
  bookings: DashboardResponse["attentionBookings"];
  total: number;
  bookingPath: string;
};

export function DashboardAttentionPanel({ bookings, total, bookingPath }: Props) {
  return (
    <Card className="min-w-0 rounded-2xl border-border bg-surface xl:max-h-[calc(640px+var(--dashboard-calendar-extra-height,0px))]">
      <CardContent className="flex min-h-0 flex-col px-4">
        <div className="mb-3 flex items-start justify-between gap-2">
          <h2 className="min-w-0 text-sm font-bold text-foreground">Bookings Requiring Action</h2>
          <span className="shrink-0 text-xs font-semibold text-muted-foreground">{total}</span>
        </div>
        {bookings.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No bookings require action.</p>
        ) : (
          <ul aria-label="Bookings requiring action" className="min-h-0 max-h-96 space-y-1 overflow-y-auto p-1 xl:max-h-none">
            {bookings.map((booking) => {
              const overdue = booking.attention?.key === "overdue_return";
              const duration = overdue && booking.elapsedMinutes > 0
                ? booking.elapsedMinutes < 60
                  ? `${booking.elapsedMinutes}m`
                  : `${Math.floor(booking.elapsedMinutes / 60)}h ${booking.elapsedMinutes % 60}m`
                : null;

              return (
                <li key={booking.id} className="border-b border-border last:border-b-0">
                  <Link
                    href={`${bookingPath}?booking=${booking.id}`}
                    aria-label={`Open booking ${booking.bookingCode}`}
                    className="flex items-center gap-2 rounded-xl p-3 outline-none transition-colors hover:bg-background focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="break-words font-mono text-xs font-semibold text-primary">{booking.bookingCode}</p>
                      <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{booking.vehicleName || "Vehicle unavailable"}</p>
                      {booking.attention && (
                        <p className={cn("text-xs font-medium", overdue ? "text-destructive" : "text-warning")}>
                          {attentionLabels[booking.attention.key]}{duration ? ` · ${duration}` : ""}
                        </p>
                      )}
                      {booking.upcomingBookings.length > 0 && (
                        <p className="text-xs font-medium text-warning">Upcoming pickup at risk</p>
                      )}
                    </div>
                    <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {bookings.length > 0 && (
          <Button asChild variant="outline" size="sm" className="mt-3 w-full shrink-0">
            <Link href={`${bookingPath}?attention=all_attention`}>View All</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
