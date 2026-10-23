import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { themeColors as colors } from '@/constants/theme';

export function CalibrationSensorReading({ label, value, limit, unit, minimum = false, state, caption, icon: Icon }: {
  label: string; value?: number; limit?: number; unit: string; minimum?: boolean;
  state?: 'valid' | 'invalid' | 'neutral'; caption?: string; icon: LucideIcon;
}) {
  const withinRange = value !== undefined && limit !== undefined && (minimum ? value >= limit : value <= limit);
  const tone = state ?? (value === undefined || limit === undefined ? 'neutral' : withinRange ? 'valid' : 'invalid');
  const color = tone === 'neutral' ? colors.mutedForeground : tone === 'valid' ? colors.success : colors.destructive;
  return (
    <View accessible accessibilityLabel={`${label}, ${value === undefined ? 'waiting for recording' : `${value.toFixed(2)} ${unit}, ${caption ?? (tone === 'valid' ? 'within range' : tone === 'invalid' ? 'outside range' : 'waiting for movement')}`}`} className="min-w-0 flex-1 rounded-field border border-border bg-background p-3">
      <View className="flex-row items-center gap-1.5"><Icon size={15} color={colors.secondaryForeground} /><Text className="font-sans shrink text-caption font-medium text-secondary-foreground">{label}</Text></View>
      <Text className="font-sans mt-2 text-title font-semibold" style={{ color, fontVariant: ['tabular-nums'] }}>{value === undefined ? '—' : value.toFixed(2)}</Text>
      <Text className="font-sans text-caption text-secondary-foreground">{unit}</Text>
      {limit !== undefined ? <View accessible={false} className="mt-3 h-2 flex-row rounded-full" style={{ overflow: 'hidden' }}>
        <View className={`flex-1 ${minimum ? 'bg-destructive-surface' : 'bg-success-surface'}`} /><View className={`flex-1 ${minimum ? 'bg-success-surface' : 'bg-destructive-surface'}`} />
        <View style={[styles.limitMarker, { backgroundColor: colors.subtleForeground }]} />
        {value !== undefined ? <View style={[styles.readingMarker, { backgroundColor: color, left: `${Math.max(0, Math.min(98, value / limit * 50))}%` }]} /> : null}
      </View> : null}
      <Text className="font-sans mt-2 text-caption text-secondary-foreground">{caption ?? (limit === undefined ? 'Recorded reading' : `Target ${minimum ? '≥' : '≤'} ${Number(limit.toFixed(3))} ${unit}`)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  limitMarker: { position: 'absolute', width: 1, height: '100%', left: '50%' },
  readingMarker: { position: 'absolute', width: 3, height: '100%', borderRadius: 2 },
});
