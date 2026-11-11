import type { LucideIcon } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { themeColors as colors } from '@/constants/theme';

export function CalibrationSensorReading({ label, value, limit, unit, minimum = false, state, caption, icon: Icon }: {
  label: string; value?: number; limit?: number; unit: string; minimum?: boolean;
  state?: 'valid' | 'invalid' | 'neutral'; caption?: string; icon: LucideIcon;
}) {
  const withinRange = value !== undefined && limit !== undefined && (minimum ? value >= limit : value <= limit);
  const tone = state ?? (value === undefined || limit === undefined ? 'neutral' : withinRange ? 'valid' : 'invalid');
  const color = tone === 'neutral' ? colors.mutedForeground : tone === 'valid' ? colors.success : colors.destructive;
  const reading = value === undefined ? '—' : `${value.toFixed(2)} ${unit}`;
  const target = caption ?? (limit === undefined ? undefined : `Target ${minimum ? '≥' : '≤'} ${Number(limit.toFixed(3))} ${unit}`);
  const status = tone === 'valid' ? 'within range' : tone === 'invalid' ? 'outside range' : '';
  const accessibilityLabel = [label, value === undefined ? 'waiting for recording' : reading, status, target].filter(Boolean).join(', ');
  return (
    <View accessible accessibilityLabel={accessibilityLabel} className="gap-0.5 py-1">
      <View className="flex-row flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <View className="min-w-0 shrink flex-row items-center gap-1.5">
          <Icon size={15} color={colors.secondaryForeground} />
          <Text className="font-sans shrink text-caption font-medium text-secondary-foreground">{label}</Text>
        </View>
        <Text className="font-sans text-caption font-semibold" style={{ color, fontVariant: ['tabular-nums'] }}>{reading}</Text>
      </View>
      {target ? <Text className="font-sans pl-5 text-caption text-secondary-foreground">{target}</Text> : null}
    </View>
  );
}
