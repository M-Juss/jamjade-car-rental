import { themeColors } from '@/constants/theme';
import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

export function SectionCard({
  children,
  density = 'default',
  icon: Icon,
  title,
}: {
  title: string;
  density?: 'default' | 'compact';
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <View className={density === 'compact' ? 'rounded-lg border border-border bg-surface p-3' : 'rounded-card border border-border bg-surface p-card'}>
      <View className={density === 'compact' ? 'mb-2 flex-row items-center gap-2' : 'mb-3 flex-row items-center gap-2.5'}>
        <Icon size={density === 'compact' ? 17 : 18} color={themeColors.primary} strokeWidth={2} />
        <Text className="font-sans min-w-0 flex-1 text-section font-semibold text-foreground">{title}</Text>
      </View>
      {children}
    </View>
  );
}
