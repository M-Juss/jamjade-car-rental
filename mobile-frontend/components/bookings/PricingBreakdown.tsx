import { Text, View } from 'react-native';

import { formatPeso, formatPesoDeduction } from '@/lib/bookings/helpers';
import type { Booking } from '@/types/booking';

import { cx } from './utils';

function PricingRow({
  emphasized = false,
  label,
  value,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <View className="flex-row items-start justify-between gap-4 py-2">
      <Text
        className={cx(
          'font-sans',
          'min-w-0 flex-1 text-[13px] leading-5',
          emphasized ? 'font-semibold text-foreground' : 'font-medium text-secondary-foreground',
        )}>
        {label}
      </Text>
      <Text
        className={cx(
          'font-sans',
          'max-w-[58%] text-right text-[14px] font-semibold leading-5 text-foreground',
        )}>
        {value}
      </Text>
    </View>
  );
}

export function PricingBreakdown({ booking }: { booking: Booking }) {
  const additionalChargesTotal = booking.additionalCharges
    .filter((charge) => charge.responsibility === 'customer')
    .reduce((total, charge) => total + Number(charge.amount), 0);
  const fees = [
    { label: 'Delivery Fee', amount: booking.deliveryFee },
    { label: 'Delivery Toll', amount: booking.deliveryTollFee },
    { label: "Owner's Driver Fee", amount: booking.ownerDriverFee },
    { label: 'Outside Manila Fee', amount: booking.outsideManilaFee },
    { label: 'Optional Services', amount: booking.optionalServices },
    { label: 'Add-ons', amount: booking.addOns },
    { label: 'Additional Charges', amount: additionalChargesTotal },
  ].filter(({ amount }) => amount > 0);

  return (
    <View>
      {booking.attention ? <Text className="font-sans mb-3 text-[13px] font-semibold text-warning">{booking.attention.label}</Text> : null}
      {(booking.lateReturn?.billableHours ?? 0) > 0 && !booking.lateReturn?.reviewedAt ? <Text className="font-sans mb-3 text-caption text-secondary-foreground">{booking.lateReturn?.billableHours} billable late hour(s). Estimated charge: {booking.lateReturn?.estimatedAmount == null ? 'Staff will review the agreed terms' : formatPeso(booking.lateReturn.estimatedAmount)}. Staff approval is required; this estimate is separate from your payable balance.</Text> : null}
      <PricingRow label="Price per day" value={formatPeso(booking.pricePerDay)} />
      <PricingRow label="Number of days" value={`${booking.duration} days`} />
      <PricingRow label="Subtotal" value={formatPeso(booking.subtotal)} />
      {fees.length > 0 || booking.discount > 0 ? (
        <>
          <View className="my-3 h-px bg-border" />
          {fees.map(({ label, amount }) => (
            <PricingRow key={label} label={label} value={formatPeso(amount)} />
          ))}
          {booking.discount > 0 ? (
            <PricingRow label="Discount" value={formatPesoDeduction(booking.discount)} />
          ) : null}
        </>
      ) : null}
      <View className="my-3 h-px bg-border" />
      <PricingRow label="Total Amount" value={formatPeso(booking.totalAmount)} emphasized />
      <View className="my-3 h-px bg-border" />
      <PricingRow label="Down Payment" value={formatPesoDeduction(booking.downPayment)} />
      <PricingRow label="Remaining Balance" value={formatPeso(booking.remainingBalance)} emphasized />
    </View>
  );
}
