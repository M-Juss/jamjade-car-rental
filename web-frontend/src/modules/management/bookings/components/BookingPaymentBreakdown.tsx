import { formatPhilippinePeso } from "@/lib/formatters/currency";
import type { BookingRecord } from "@/services/booking";

const cents = (amount: number) => Math.round(amount * 100);
const peso = (amountInCents: number) => formatPhilippinePeso(amountInCents / 100);

function AmountRow({ label, amount, detail }: { label: string; amount: number; detail?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="min-w-0 text-xs text-muted-foreground">
        {label}
        {detail ? <span className="mt-0.5 block text-xs text-foreground">{detail}</span> : null}
      </dt>
      <dd className="shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">{peso(amount)}</dd>
    </div>
  );
}

export function BookingPaymentBreakdown({ booking }: { booking: BookingRecord }) {
  const customerCharges = (booking.additionalCharges ?? []).filter((charge) => charge.responsibility === "customer");
  const driverCharges = (booking.additionalCharges ?? []).filter((charge) => charge.responsibility === "driver");
  const total = cents(booking.totalAmount);
  const paid = booking.customerPaidAmount === undefined ? null : cents(booking.customerPaidAmount);
  const balance = cents(booking.remainingBalance);
  const rentalCosts = [
    { label: "Rental subtotal", amount: cents(booking.subtotal) },
    { label: "Delivery fee", amount: cents(booking.deliveryFee) },
    { label: "Delivery toll", amount: cents(booking.deliveryTollFee) },
    { label: "Assigned driver fee", amount: cents(booking.ownerDriverFee) },
    { label: "Add-ons", amount: cents(booking.addOns) },
    { label: "Discount", amount: -cents(booking.discount) },
  ];
  const itemized = rentalCosts.reduce((sum, item) => sum + item.amount, 0)
    + customerCharges.reduce((sum, charge) => sum + cents(charge.amount), 0);
  const adjustment = total - itemized;
  const balanceDiffers = paid !== null && Math.max(total - paid, 0) !== balance;
  const cancelled = booking.statusKey === "cancelled" || booking.statusKey === "rejected";
  const settled = balance === 0 && booking.paymentStatusKey === "paid" && !cancelled;
  const balanceStyle = balance > 0 && !cancelled
    ? "border-warning-border bg-warning-surface text-warning"
    : settled ? "border-success-border bg-success-surface text-success" : "border-border bg-background text-foreground";

  return (
    <>
      <section className="space-y-2 border-t border-border pt-5">
        <h2 className="text-base font-semibold text-foreground">Rental costs</h2>
        <dl>
          {rentalCosts.filter((item, index) => index === 0 || item.amount !== 0).map((item) => (
            <AmountRow key={item.label} {...item} />
          ))}
          {adjustment !== 0 ? <AmountRow label="Unitemized adjustment" amount={adjustment} /> : null}
        </dl>
      </section>

      {customerCharges.length > 0 ? (
        <section className="space-y-2 border-t border-border pt-4">
          <h2 className="text-base font-semibold text-foreground">Customer return charges</h2>
          <dl>
            {customerCharges.map((charge) => <AmountRow key={charge.id} label={charge.typeLabel} amount={cents(charge.amount)} />)}
          </dl>
        </section>
      ) : null}

      <section className="space-y-2 border-t border-border pt-4">
        <h2 className="text-base font-semibold text-foreground">Customer payment summary</h2>
        <dl>
          <AmountRow label="Total billed" amount={total} />
          {paid !== null ? <AmountRow label="Payments received" amount={paid === 0 ? 0 : -paid} /> : null}
          <div className={`mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-xl border px-3 py-2.5 ${balanceStyle}`}>
            <dt className="text-sm font-semibold">{balanceDiffers ? "Recorded remaining balance" : "Remaining balance"}</dt>
            <dd className="ml-auto text-right text-base font-semibold tabular-nums">{peso(balance)}</dd>
          </div>
        </dl>
        {balanceDiffers ? <p className="text-xs text-muted-foreground">The saved balance differs from the payment breakdown.</p> : null}
      </section>

      {driverCharges.length > 0 ? (
        <section className="space-y-2 border-t border-border pt-4">
          <h2 className="text-base font-semibold text-foreground">Assigned driver charges</h2>
          <dl>
            {driverCharges.map((charge) => <AmountRow
              key={charge.id}
              label={charge.typeLabel}
              amount={cents(charge.amount)}
              detail={charge.outstandingAmount > 0 ? `${formatPhilippinePeso(charge.outstandingAmount)} outstanding` : charge.paymentStatus === "paid" ? "Paid" : undefined}
            />)}
          </dl>
        </section>
      ) : null}
    </>
  );
}
