import { BadgeCheck, Ban, CheckCircle2, CircleAlert, Clock3 } from 'lucide-react-native';
import { View, Text } from 'react-native';

import type { BookingStatus } from '@/types/booking';

import { cx } from './utils';

const statusStyles = {
  Pending: {
    bg: 'bg-[#FFF7ED]',
    border: 'border-[#FED7AA]',
    text: 'text-[#C2410C]',
    color: '#C2410C',
    icon: Clock3,
  },
  Approved: {
    bg: 'bg-[#EFF6FF]',
    border: 'border-[#BFDBFE]',
    text: 'text-[#1D4ED8]',
    color: '#1D4ED8',
    icon: BadgeCheck,
  },
  Active: {
    bg: 'bg-[#ECFDF5]',
    border: 'border-[#BBF7D0]',
    text: 'text-[#047857]',
    color: '#047857',
    icon: CheckCircle2,
  },
  Ongoing: {
    bg: 'bg-[#ECFDF5]',
    border: 'border-[#BBF7D0]',
    text: 'text-[#047857]',
    color: '#047857',
    icon: CheckCircle2,
  },
  Completed: {
    bg: 'bg-[#F0FDF4]',
    border: 'border-[#BBF7D0]',
    text: 'text-[#166534]',
    color: '#166534',
    icon: CheckCircle2,
  },
  Rejected: {
    bg: 'bg-[#FEF2F2]',
    border: 'border-[#FECACA]',
    text: 'text-[#B91C1C]',
    color: '#B91C1C',
    icon: CircleAlert,
  },
  Cancelled: {
    bg: 'bg-[#F8FAFC]',
    border: 'border-[#E5E7EB]',
    text: 'text-[#991B1B]',
    color: '#991B1B',
    icon: Ban,
  },
} satisfies Record<
  BookingStatus,
  {
    bg: string;
    border: string;
    text: string;
    color: string;
    icon: typeof Clock3;
  }
>;

export function BookingStatusBadge({ compact = false, status }: { status: BookingStatus; compact?: boolean }) {
  const style = statusStyles[status];
  const Icon = style.icon;

  return (
    <View
      className={cx(
        'flex-row items-center gap-1 rounded-full border',
        compact ? 'px-2.5 py-1' : 'px-3 py-1.5',
        style.bg,
        style.border,
      )}>
      <Icon size={compact ? 12 : 14} color={style.color} strokeWidth={2.6} />
      <Text className={cx('font-black', compact ? 'text-[10px]' : 'text-[12px]', style.text)}>{status}</Text>
    </View>
  );
}
