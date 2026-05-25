import { CreditCard, RotateCcw, WalletCards } from 'lucide-react-native';
import { Text, View } from 'react-native';

import type { PaymentStatus } from '@/types/booking';

import { cx } from './utils';

const paymentStyles = {
  Unpaid: {
    bg: 'bg-[#FEF2F2]',
    border: 'border-[#FECACA]',
    text: 'text-[#B91C1C]',
    color: '#B91C1C',
    icon: CreditCard,
  },
  'Partially Paid': {
    bg: 'bg-[#FFF7ED]',
    border: 'border-[#FED7AA]',
    text: 'text-[#C2410C]',
    color: '#C2410C',
    icon: WalletCards,
  },
  Paid: {
    bg: 'bg-[#ECFDF5]',
    border: 'border-[#BBF7D0]',
    text: 'text-[#047857]',
    color: '#047857',
    icon: WalletCards,
  },
  Refunded: {
    bg: 'bg-[#EEF4FF]',
    border: 'border-[#DDE8FF]',
    text: 'text-[#346EF6]',
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
