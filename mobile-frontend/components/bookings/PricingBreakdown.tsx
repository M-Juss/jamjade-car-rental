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
      <Text className={cx('min-w-0 flex-1 text-[13px]', emphasized ? 'font-black text-[#17315F]' : 'font-bold text-[#6C7A96]')}>
        {label}
      </Text>
      <Text className={cx('text-right text-[14px]', emphasized ? 'font-black text-[#065F46]' : 'font-extrabold text-[#17315F]')}>
        {value}
      </Text>
    </View>
  );
}

export function PricingBreakdown({ booking }: { booking: Booking }) {
  return (
    <View>
      <View className="mb-3 flex-row items-center gap-2">
        <CreditCard size={18} color="#346EF6" strokeWidth={2.35} />
        <Text className="text-[13px] font-black uppercase text-[#91A0B8]">Price summary</Text>
      </View>
      <PricingRow label="Price per day" value={formatPeso(booking.pricePerDay)} />
      <PricingRow label="Number of days" value={`${booking.duration} days`} />
      <PricingRow label="Subtotal" value={formatPeso(booking.subtotal)} />
      <PricingRow label="Delivery Fee" value={formatPeso(booking.deliveryFee)} />
      <PricingRow label="Owner's Driver Fee" value={formatPeso(booking.ownerDriverFee)} />
      <PricingRow label="Outside Manila Fee" value={formatPeso(booking.outsideManilaFee)} />
      <PricingRow label="Optional Services" value={formatPeso(booking.optionalServices)} />
      <PricingRow label="Add-ons" value={formatPeso(booking.addOns)} />
      <PricingRow label="Discount" value={formatPesoDeduction(booking.discount)} />
      <PricingRow label="Down Payment" value={formatPesoDeduction(booking.downPayment)} />
      <View className="my-3 h-px bg-[#E6EEFF]" />
      <View className="rounded-[22px] bg-[#F8FAFF] p-4">
        <PricingRow label="Total Amount" value={formatPeso(booking.totalAmount)} emphasized />
        <View className="h-px bg-[#E6EEFF]" />
        <PricingRow label="Remaining Balance" value={formatPeso(booking.remainingBalance)} emphasized />
      </View>
    </View>
  );
}
