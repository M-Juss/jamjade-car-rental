import { themeColors } from '@/constants/theme';
import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

export function SectionCard({
  children,
  icon: Icon,
  title,
}: {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <View className="rounded-card border border-border bg-surface p-card ">
      <View className="mb-3 flex-row items-center gap-2.5">
        <View className="h-8 w-8 items-center justify-center rounded-full bg-muted">
          <Icon size={20} color={themeColors.primary} strokeWidth={2.45} />
        </View>
        <Text className="font-sans min-w-0 flex-1 text-section font-semibold text-foreground">{title}</Text>
      </View>
      {children}
    </View>
  );
}
