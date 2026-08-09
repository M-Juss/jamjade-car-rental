import {
  CheckCircle2,
  CircleDashed,
  Clock3,
  type LucideIcon,
} from 'lucide-react-native';
import { Text, View } from 'react-native';

import type { RenterDocumentStatus } from '@/lib/profile/profile-data';

const statusStyles = {
  Verified: {
    className: 'border-success-border bg-success-surface',
    icon: CheckCircle2,
    iconColor: '#047857',
    textClassName: 'text-success',
  },
  Pending: {
    className: 'border-warning-border bg-warning-surface',
    icon: Clock3,
    iconColor: '#C2410C',
    textClassName: 'text-warning',
  },
  'Not Uploaded': {
    className: 'border-[#E5E7EB] bg-[#F8FAFC]',
    icon: CircleDashed,
    iconColor: '#64748B',
    textClassName: 'text-muted-foreground',
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
      <Text className={`${item.textClassName} text-[10px] font-black uppercase tracking-[0.35px]`}>{status}</Text>
    </View>
  );
}
