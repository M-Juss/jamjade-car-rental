import { Text, View } from 'react-native';

import type { SelfDriveStatus } from '@/types/customer';

const STATUS_STYLES: Record<SelfDriveStatus, { bg: string; border: string; text: string; label: string }> = {
  'not-eligible': {
    bg: 'bg-warning-surface',
    border: 'border-warning-border',
    label: 'Self-drive ineligible',
    text: 'text-warning',
  },
  'not-verified': {
    bg: 'bg-muted',
    border: 'border-border',
    label: 'Self-drive not verified',
    text: 'text-secondary-foreground',
  },
  'emergency-contact-required': {
    bg: 'bg-warning-surface',
    border: 'border-warning-border',
    label: 'Emergency contact required',
    text: 'text-warning',
  },
  pending: {
    bg: 'bg-warning-surface',
    border: 'border-warning-border',
    label: 'Self-drive pending',
    text: 'text-warning',
  },
  verified: {
    bg: 'bg-success-surface',
    border: 'border-success-border',
    label: 'Self-drive verified',
    text: 'text-success',
  },
};

export function StatusBadge({ status }: { status: SelfDriveStatus }) {
  const style = STATUS_STYLES[status];

  return (
    <View className={`max-w-full self-start rounded-full border px-2 py-0.5 ${style.bg} ${style.border}`}>
      <Text className={`font-sans text-[11px] font-medium ${style.text}`}>{style.label}</Text>
    </View>
  );
}
