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
    <View className="rounded-[28px] border border-border bg-surface p-5 shadow-md shadow-foreground/5">
      <View className="mb-3 flex-row items-center gap-2.5">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-muted">
          <Icon size={20} color="#346EF6" strokeWidth={2.45} />
        </View>
        <Text className="min-w-0 flex-1 text-[18px] font-black text-foreground">{title}</Text>
      </View>
      {children}
    </View>
  );
}
