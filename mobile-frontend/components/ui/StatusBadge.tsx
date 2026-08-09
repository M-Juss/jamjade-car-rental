import { Text, View } from 'react-native';

import type { SelfDriveStatus } from '@/types/customer';

const STATUS_STYLES: Record<SelfDriveStatus, { bg: string; border: string; text: string; label: string }> = {
  'not-eligible': {
    bg: 'bg-warning-surface',
    border: 'border-warning-border',
    label: 'Booking Unavailable',
    text: 'text-warning',
  },
  'not-verified': {
    bg: 'bg-[#F1F5F9]',
    border: 'border-border',
    label: 'Self-drive Not Verified',
    text: 'text-[#475569]',
  },
  pending: {
    bg: 'bg-warning-surface',
    border: 'border-warning-border',
    label: 'Verification Pending',
    text: 'text-warning',
  },
  verified: {
    bg: 'bg-success-surface',
    border: 'border-success-border',
    label: 'Self-drive Verified',
    text: 'text-success',
  },
};

export function StatusBadge({ status }: { status: SelfDriveStatus }) {
  const style = STATUS_STYLES[status];

  return (
    <View className={`self-start rounded-full border px-3 py-1.5 ${style.bg} ${style.border}`}>
      <Text className={`text-[10px] font-black uppercase ${style.text}`}>
        {style.label}
      </Text>
    </View>
  );
}
