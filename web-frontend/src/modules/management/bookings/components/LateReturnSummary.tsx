import type { BookingRecord, LateReturnDetails } from "@/services/booking";
import { formatReturnDateTime } from "@/services/booking/return-time";
import { BookingAttentionBadge } from "./BookingAttentionBadge";

const money = (value: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);
const hasLateCharge = (late?: LateReturnDetails) => Boolean(late && (
  late.billableHours > 0 || (late.estimatedAmount ?? 0) > 0 || (late.approvedAmount ?? 0) > 0
));

export function LateChargeSummary({ booking }: { booking: BookingRecord }) {
  const late = booking.lateReturn;
  if (!late || !hasLateCharge(late)) return null;
  const items = [
    ["Agreed rate", late.hourlyRate === null ? "Manual review required" : `${money(late.hourlyRate)}/hour`],
    ["Billable late hours", String(late.billableHours)],
    [late.reviewedAt ? "Approved late charge" : "Estimated late charge", late.reviewedAt ? money(late.approvedAmount ?? 0) : late.estimatedAmount === null ? "Review agreed legacy terms" : money(late.estimatedAmount)],
  ];
  return <section className="min-w-0 space-y-2">
    <h2 className="text-sm font-semibold text-foreground">Late charge</h2>
    <dl className="grid gap-x-4 gap-y-3 text-xs sm:grid-cols-2">
      {items.map(([label, value]) => <div key={label}>
        <dt className="text-muted-foreground">{label}</dt>
        <dd className="mt-1 break-words font-semibold text-foreground">{value}</dd>
      </div>)}
    </dl>
  </section>;
}

export function LateReturnSummary({ booking }: { booking: BookingRecord }) {
  const late = booking.lateReturn;
  if (!late) return null;
  const timing = [
    ["Scheduled return", formatReturnDateTime(booking.rentalEndAt)],
    ...(late.vehicleReceivedAt ? [["Vehicle received", formatReturnDateTime(late.vehicleReceivedAt)]] : []),
    ...(late.expectedReturnAt ? [["Expected return", formatReturnDateTime(late.expectedReturnAt)]] : []),
  ];
  return <section className="space-y-3">
    {booking.attention && booking.attention.key !== "return_processing" ? <BookingAttentionBadge attention={booking.attention} elapsedMinutes={late.elapsedMinutes} /> : null}
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-foreground">Return timing</h2>
      <dl className="grid gap-x-4 gap-y-3 text-xs sm:grid-cols-2">
        {timing.map(([label, value]) => <div key={label}>
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="mt-1 break-words font-semibold text-foreground">{value}</dd>
        </div>)}
      </dl>
    </section>
    <LateChargeSummary booking={booking} />
    {(booking.upcomingBookings ?? []).map((next) => <div key={next.id} className="space-y-1 rounded-xl border border-warning-border bg-warning-surface p-3 text-xs"><p>Upcoming pickup: <strong>{next.bookingCode}</strong></p><p>{formatReturnDateTime(next.pickupAt)}</p><p>Coordinate vehicle availability before release.</p></div>)}
    {(booking.returnFollowUps ?? []).map((followUp, index) => <p key={index} className="rounded-xl bg-background p-3 text-xs"><span className="text-muted-foreground">{formatReturnDateTime(followUp.recordedAt)}</span><br />{followUp.note}</p>)}
  </section>;
}
