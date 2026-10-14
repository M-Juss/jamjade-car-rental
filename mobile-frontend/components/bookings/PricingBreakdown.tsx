import { themeColors } from '@/constants/theme';
import { CreditCard } from 'lucide-react-native';
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
    <View className="flex-row items-center justify-between gap-4 py-2">
      <Text
        className={cx(
          'font-sans',
          'min-w-0 flex-1 text-[13px]',
          emphasized ? 'font-semibold text-foreground' : 'font-medium text-secondary-foreground',
        )}>
        {label}
      </Text>
      <Text
        className={cx(
          'font-sans',
          'text-right text-[14px]',
          emphasized ? 'font-semibold text-success' : 'font-semibold text-foreground',
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

  return (
    <View>
      <View className="mb-3 flex-row items-center gap-2">
        <CreditCard size={18} color={themeColors.primary} strokeWidth={2.35} />
        <Text className="font-sans text-[13px] font-normal text-secondary-foreground">Price summary</Text>
      </View>
      <PricingRow label="Price per day" value={formatPeso(booking.pricePerDay)} />
      <PricingRow label="Number of days" value={`${booking.duration} days`} />
      <PricingRow label="Subtotal" value={formatPeso(booking.subtotal)} />
      <PricingRow label="Delivery Toll" value={formatPeso(booking.deliveryTollFee)} />
      <PricingRow label="Delivery Fee" value={formatPeso(booking.deliveryFee)} />
      <PricingRow label="Owner's Driver Fee" value={formatPeso(booking.ownerDriverFee)} />
      <PricingRow label="Outside Manila Fee" value={formatPeso(booking.outsideManilaFee)} />
      <PricingRow label="Optional Services" value={formatPeso(booking.optionalServices)} />
      <PricingRow label="Add-ons" value={formatPeso(booking.addOns)} />
      {additionalChargesTotal > 0 ? (
        <PricingRow label="Additional Charges" value={formatPeso(additionalChargesTotal)} />
      ) : null}
      <PricingRow label="Discount" value={formatPesoDeduction(booking.discount)} />
      <PricingRow label="Down Payment" value={formatPesoDeduction(booking.downPayment)} />
      <View className="my-3 h-px bg-border" />
      <View className="rounded-[22px] bg-background p-4">
        <PricingRow label="Total Amount" value={formatPeso(booking.totalAmount)} emphasized />
        <View className="h-px bg-border" />
        <PricingRow label="Remaining Balance" value={formatPeso(booking.remainingBalance)} emphasized />
      </View>
    </View>
  );
}
