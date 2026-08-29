import { BadgeCheck, Ban, CheckCircle2, CircleAlert, Clock3 } from 'lucide-react-native';
import { View, Text } from 'react-native';

import type { BookingStatus } from '@/types/booking';

import { cx } from './utils';

const statusStyles = {
  Pending: {
    bg: 'bg-warning-surface',
    border: 'border-warning-border',
    text: 'text-warning',
    color: '#C2410C',
    icon: Clock3,
  },
  Confirmed: {
    bg: 'bg-[#EFF6FF]',
    border: 'border-[#BFDBFE]',
    text: 'text-[#1D4ED8]',
    color: '#1D4ED8',
    icon: BadgeCheck,
  },
  Active: {
    bg: 'bg-success-surface',
    border: 'border-success-border',
    text: 'text-success',
    color: '#047857',
    icon: CheckCircle2,
  },
  Ongoing: {
    bg: 'bg-success-surface',
    border: 'border-success-border',
    text: 'text-success',
    color: '#047857',
    icon: CheckCircle2,
  },
  Returned: {
    bg: 'bg-warning-surface',
    border: 'border-warning-border',
    text: 'text-warning',
    color: '#C2410C',
    icon: Clock3,
  },
  Completed: {
    bg: 'bg-[#F0FDF4]',
    border: 'border-success-border',
    text: 'text-[#166534]',
    color: '#166534',
    icon: CheckCircle2,
  },
  Rejected: {
    bg: 'bg-destructive-surface',
    border: 'border-destructive-border',
    text: 'text-destructive',
    color: '#B91C1C',
    icon: CircleAlert,
  },
  Cancelled: {
    bg: 'bg-[#F8FAFC]',
    border: 'border-[#E5E7EB]',
    text: 'text-destructive',
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
