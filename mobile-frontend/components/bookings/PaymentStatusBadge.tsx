import { CreditCard, RotateCcw, WalletCards } from 'lucide-react-native';
import { Text, View } from 'react-native';

import type { PaymentStatus } from '@/types/booking';

import { cx } from './utils';

const paymentStyles = {
  Unpaid: {
    bg: 'bg-destructive-surface',
    border: 'border-destructive-border',
    text: 'text-destructive',
    color: '#B91C1C',
    icon: CreditCard,
  },
  'Partially Paid': {
    bg: 'bg-warning-surface',
    border: 'border-warning-border',
    text: 'text-warning',
    color: '#C2410C',
    icon: WalletCards,
  },
  Paid: {
    bg: 'bg-success-surface',
    border: 'border-success-border',
    text: 'text-success',
    color: '#047857',
    icon: WalletCards,
  },
  Refunded: {
    bg: 'bg-muted',
    border: 'border-border',
    text: 'text-primary',
    color: '#346EF6',
    icon: RotateCcw,
  },
} satisfies Record<
  PaymentStatus,
  {
    bg: string;
    border: string;
    text: string;
    color: string;
    icon: typeof CreditCard;
  }
>;

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const style = paymentStyles[status];
  const Icon = style.icon;

  return (
    <View className={cx('flex-row items-center gap-1 rounded-full border px-2.5 py-1', style.bg, style.border)}>
      <Icon size={12} color={style.color} strokeWidth={2.5} />
      <Text className={cx('text-[10px] font-black', style.text)}>{status}</Text>
    </View>
  );
}
