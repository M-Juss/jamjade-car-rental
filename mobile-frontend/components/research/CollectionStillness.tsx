import { Text, View } from 'react-native';

import { StationaryPhoneVisual } from '@/components/telematics/StationaryPhoneVisual';
import { themeColors as colors } from '@/constants/theme';
import type { NativeSetupProgress } from '@/lib/research/native-recorder';

export function CollectionStillness({ progress, measured, error }: {
  progress: NativeSetupProgress | null;
  measured: boolean;
  error?: string | null;
}) {
  const duration = progress?.required_ms ?? 5000;
  const elapsed = measured ? duration : progress?.steady_ms ?? 0;
  const moving = progress?.phase === 'moving';
  const color = error || moving ? colors.destructive : measured ? colors.success : colors.primary;
  const label = error ? 'Check failed' : measured ? 'Stillness check complete'
    : moving ? 'Movement detected' : progress?.phase === 'steady' ? 'Hold steady' : 'Keep the phone still';
  return (
    <View className="flex-row items-center gap-3">
      <StationaryPhoneVisual guideSize={104} progress={elapsed / duration} color={color} passed={measured} />
      <View className="min-w-0 flex-1 gap-1">
        <Text accessibilityLiveRegion="polite" className="font-sans text-body font-semibold" style={{ color }}>{label}</Text>
        {error ? <Text accessibilityLiveRegion="polite" className="font-sans text-caption text-secondary-foreground">{error}</Text> : <>
          <Text accessibilityRole="progressbar" accessibilityLabel="Continuous stillness" accessibilityValue={{ min: 0, max: duration, now: elapsed }}
            className="font-sans text-body text-foreground" style={{ fontVariant: ['tabular-nums'] }}>
            {(Math.floor(elapsed / 100) / 10).toFixed(1)} / {duration / 1000} s
          </Text>
          {measured && <Text className="font-sans text-caption text-secondary-foreground">Pilot only. Alignment pending.</Text>}
        </>}
      </View>
    </View>
  );
}
