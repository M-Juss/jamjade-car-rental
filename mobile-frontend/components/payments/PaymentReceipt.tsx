import { Check } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { themeColors } from '@/constants/theme';
import { InfoRow } from '@/components/bookings/InfoRow';
import { formatReceiptAmount, formatReceiptDate } from '@/lib/payments/receipt';
import type { CustomerReceipt } from '@/services/api/types';

export function PaymentReceipt({ receipt }: { receipt: CustomerReceipt }) {
  return (
    <View>
      <View className="items-center rounded-card bg-success-surface p-card">
        <Text className="font-sans text-center text-caption font-medium text-foreground">JamJade Car Rental</Text>
        <Text className="font-sans text-center text-[30px] font-semibold leading-[38px] text-foreground">
          {formatReceiptAmount(receipt.amount)}
        </Text>
        <View className="flex-row items-center justify-center gap-1.5">
          <Check accessible={false} size={14} color={themeColors.success} strokeWidth={3} />
          <Text className="font-sans shrink text-center text-caption font-semibold text-success">Payment received</Text>
        </View>
        <Text className="font-sans text-center text-caption text-secondary-foreground">{receipt.purpose}</Text>
      </View>

      <View className="mt-3">
        <InfoRow label="Receipt no." value={receipt.receiptReference} />
        <View className="h-px bg-border" />
        <InfoRow label="Booking" value={receipt.bookingReference} />
        <View className="h-px bg-border" />
        <InfoRow label="Date" value={formatReceiptDate(receipt.paidAt)} />
        <View className="h-px bg-border" />
        <InfoRow label="Payment method" value={receipt.method || 'Not provided'} />
      </View>

      <View className="mt-3 border-t border-border pt-1">
        <InfoRow label="Balance after payment" value={formatReceiptAmount(receipt.remainingBalance)} />
      </View>
      {receipt.remainingBalance > 0 && receipt.balanceDueAt ? (
        <Text className="font-sans mt-2 text-caption text-warning">
          Balance due {formatReceiptDate(receipt.balanceDueAt)}. If unpaid, the booking is cancelled and the down payment is non-refundable.
        </Text>
      ) : null}
    </View>
  );
}
