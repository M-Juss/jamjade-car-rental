import { themeColors } from '@/constants/theme';
import { CheckCircle2, CircleX, type LucideIcon } from 'lucide-react-native';
import { Text, View } from 'react-native';

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export function InfoCard({
  items,
  title,
}: {
  title?: string;
  items: { label: string; value: string; allowed?: boolean; icon?: LucideIcon }[];
}) {
  return (
    <View className="rounded-card border border-border bg-surface p-card ">
      {title ? (
        <Text className="font-sans mb-4 text-[16px] font-semibold text-foreground">{title}</Text>
      ) : null}
      <View className="gap-3">
        {items.map(({ allowed = true, icon: Icon, label, value }) => {
          const StatusIcon = Icon ?? (allowed ? CheckCircle2 : CircleX);

          return (
            <View key={label} className="flex-row items-center gap-3">
              <View
                className={cx(
                  'h-10 w-10 items-center justify-center rounded-full',
                  allowed ? 'bg-success-surface' : 'bg-destructive-surface',
                )}>
                <StatusIcon
                  size={18}
                  color={allowed ? themeColors.success : themeColors.destructive}
                  strokeWidth={2.45}
                />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="font-sans text-[13px] font-semibold text-foreground">{label}</Text>
                <Text className="font-sans mt-0.5 text-[12px] font-normal leading-5 text-secondary-foreground">
                  {value}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
