import { themeColors } from '@/constants/theme';
import { CheckCircle2, CircleDashed, Clock3, type LucideIcon } from 'lucide-react-native';
import { Text, View } from 'react-native';

import type { RenterDocumentStatus } from '@/lib/profile/profile-data';

const statusStyles = {
  Verified: {
    className: 'border-success-border bg-success-surface',
    icon: CheckCircle2,
    iconColor: themeColors.success,
    textClassName: 'text-success',
  },
  Pending: {
    className: 'border-warning-border bg-warning-surface',
    icon: Clock3,
    iconColor: themeColors.warning,
    textClassName: 'text-warning',
  },
  'Not Uploaded': {
    className: 'border-[#E5E7EB] bg-[#F8FAFC]',
    icon: CircleDashed,
    iconColor: themeColors.mutedForeground,
    textClassName: 'text-secondary-foreground',
  },
} satisfies Record<
  RenterDocumentStatus,
  {
    className: string;
    icon: LucideIcon;
    iconColor: string;
    textClassName: string;
  }
>;

export function ProfileStatusBadge({ status }: { status: RenterDocumentStatus }) {
  const item = statusStyles[status];
  const Icon = item.icon;

  return (
    <View className={`${item.className} flex-row items-center gap-1.5 rounded-full border px-2.5 py-1.5`}>
      <Icon size={12} color={item.iconColor} strokeWidth={2.5} />
      <Text className={`font-sans ${item.textClassName} text-[11px] font-semibold `}>{status}</Text>
    </View>
  );
}
