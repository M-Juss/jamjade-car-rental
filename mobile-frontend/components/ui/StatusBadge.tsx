import { Text, View } from 'react-native';

import type { SelfDriveStatus } from '@/types/customer';

const STATUS_STYLES: Record<SelfDriveStatus, { bg: string; border: string; text: string; label: string }> = {
  'not-eligible': {
    bg: 'bg-[#FFF7ED]',
    border: 'border-[#FED7AA]',
    label: "Owner's Driver Only",
    text: 'text-[#C2410C]',
  },
  'not-verified': {
    bg: 'bg-[#F1F5F9]',
    border: 'border-[#CBD5E1]',
    label: 'Self-drive Not Verified',
    text: 'text-[#475569]',
  },
  pending: {
    bg: 'bg-[#FFF9E8]',
    border: 'border-[#FFE7A6]',
    label: 'Verification Pending',
    text: 'text-[#806128]',
  },
  verified: {
    bg: 'bg-[#ECFDF5]',
    border: 'border-[#BBF7D0]',
    label: 'Self-drive Verified',
    text: 'text-[#047857]',
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
