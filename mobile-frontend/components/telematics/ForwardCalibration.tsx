import { Activity, ArrowUp, CircleCheck, CirclePause, RotateCcw } from 'lucide-react-native';
import { useEffect, useRef, type ReactNode } from 'react';
import { ActivityIndicator, Animated, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { CalibrationSensorReading } from '@/components/telematics/CalibrationSensorReading';
import { themeColors as colors } from '@/constants/theme';
import { useCalibrationVisuals } from '@/hooks/telematics/useCalibrationVisuals';
import { forwardMotionFeedback, type CalibrationLiveState } from '@/lib/telematics/calibration';
import type { MobileTelematicsHandover } from '@/services/api';

const guidance = {
  waiting: ['Move forward gently', 'Follow staff directions. Move straight, then stop safely.'],
  building: ['Detecting movement', 'Keep moving gently in a straight line.'],
  captured: ['Movement captured', 'Stop safely. No more acceleration is needed.'],
  interrupted: ['Readings interrupted', 'Stop safely. Keep the app open, then retry while parked.'],
  mount_moved: ['Phone position changed', 'Stop safely. Secure the phone and restart calibration.'],
  turning: ['Keep the movement straight', 'Stop safely. Retry without turning or touching the phone.'],
  inconsistent: ['Movement was not clear', 'Stop safely. Retry only when staff says it is safe.'],
} as const;

export function ForwardCalibration({ live, limits, mountLimits, movementLimits, noiseBaseline, busy, failureReason, children }: {
  live: CalibrationLiveState | null;
  limits: MobileTelematicsHandover['calibration']['forwardLimits'];
  mountLimits: MobileTelematicsHandover['calibration']['stationaryLimits'];
  movementLimits: MobileTelematicsHandover['calibration']['movementLimits'];
  noiseBaseline: MobileTelematicsHandover['calibration']['noiseBaseline'];
  busy: boolean;
  failureReason?: string | null;
  children: ReactNode;
}) {
  const { reducedMotion, readingsStale } = useCalibrationVisuals(live, mountLimits.maxGapMs);
  const { height } = useWindowDimensions();
  const animation = useRef(new Animated.Value(0)).current;
  const phase = live?.phase;
  const reading = phase === 'preparing' ? undefined : live?.reading;
  const feedback = forwardMotionFeedback(reading, limits, mountLimits, phase === 'recording' && readingsStale, movementLimits);
  const passed = phase === 'passed';
  const failed = phase === 'failed' || Boolean(failureReason) && !busy;
  const warning = !['waiting', 'building', 'captured'].includes(feedback.state);
  const captured = feedback.state === 'captured';
  const pending = phase === 'preparing' || phase === 'evaluating';
  const color = passed ? colors.success : pending ? colors.primary : failed || warning ? colors.destructive : captured || feedback.state === 'building' ? colors.success : colors.primary;
  const progress = passed ? 1 : feedback.progress;
  const label = passed ? 'Forward direction set' : phase === 'evaluating' ? 'Checking movement' : phase === 'preparing' ? 'Preparing sensors' : phase === 'recording' ? guidance[feedback.state][0] : failed ? 'Repeat this step' : 'Ready when you are';
  const hint = passed ? 'Opening gentle braking…' : phase === 'evaluating' ? 'Keep parked while the result is checked.' : phase === 'preparing' ? 'Stay parked. Wait for the movement guide before moving.' : phase === 'recording' ? guidance[feedback.state][1] : 'Start while parked, with staff supervising and the phone mounted.';
  const compact = busy || passed;
  const guideSize = compact ? height < 700 ? 148 : 188 : 248;
  const StatusIcon = passed ? CircleCheck : failed || warning ? CirclePause : captured ? CircleCheck : ArrowUp;

  useEffect(() => {
    animation.setValue(0);
    if (reducedMotion || phase !== 'recording' || warning || captured) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(animation, { toValue: 1, duration: 1300, useNativeDriver: true, isInteraction: false }),
      Animated.timing(animation, { toValue: 0, duration: 600, useNativeDriver: true, isInteraction: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [animation, reducedMotion, phase, warning, captured]);

  return (
    <View className="rounded-card border border-border bg-surface p-card">
      <View className="flex-row items-center justify-between gap-4">
        <Text className="font-sans text-caption font-semibold text-primary">STEP 02 / 05</Text>
        <Text className="font-sans text-caption text-secondary-foreground">Forward movement</Text>
      </View>
      <View className="mt-3 flex-row gap-1.5" accessible={false}>{[0, 1, 2, 3, 4].map((step) => <View key={step} className="h-1 flex-1 rounded-full" style={{ backgroundColor: step === 0 ? colors.success : step === 1 ? color : colors.muted }} />)}</View>
      <Text className={`font-sans mt-5 font-semibold text-foreground ${compact ? 'text-section' : 'text-title'}`}>One gentle forward movement</Text>
      {!compact ? <Text className="font-sans mt-2 text-body leading-6 text-secondary-foreground">Move straight at low speed when staff directs you, then stop safely. Recording ends when enough valid movement readings are captured.</Text> : null}

      <View style={[styles.guide, { maxWidth: guideSize }]} accessible={false} importantForAccessibility="no-hide-descendants">
        <View style={{ width: 248, height: 248, transform: [{ scale: guideSize / 248 }] }}>
          <Svg width={248} height={248} viewBox="0 0 248 248" style={StyleSheet.absoluteFill}>
            <Circle cx={124} cy={124} r={111} fill={colors.background} stroke={colors.border} />
            <Circle cx={124} cy={124} r={103} fill="none" stroke={colors.border} strokeWidth={5} />
            <Circle cx={124} cy={124} r={103} fill="none" stroke={color} strokeWidth={5} strokeDasharray={`${2 * Math.PI * 103}`} strokeDashoffset={2 * Math.PI * 103 * (1 - progress)} strokeLinecap="round" rotation={-90} origin="124,124" />
            <Rect x={78} y={43} width={92} height={163} rx={28} fill={colors.muted} />
            <Path d="M88 73V177 M160 73V177" stroke={colors.border} strokeWidth={2} />
            <Path d="M124 78V51 M115 61L124 51L133 61" fill="none" stroke={color} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M124 185V196" stroke={colors.subtleForeground} strokeWidth={3} strokeLinecap="round" />
          </Svg>
          <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: animation.interpolate({ inputRange: [0, 1], outputRange: [7, -9] }) }] }]}>
            <Svg width={248} height={248} viewBox="0 0 248 248">
              <Rect x={95} y={112} width={8} height={22} rx={3} fill={colors.foreground} /><Rect x={145} y={112} width={8} height={22} rx={3} fill={colors.foreground} />
              <Rect x={95} y={150} width={8} height={22} rx={3} fill={colors.foreground} /><Rect x={145} y={150} width={8} height={22} rx={3} fill={colors.foreground} />
              <Path d="M104 106Q106 94 124 94Q142 94 144 106L148 160Q148 178 136 181H112Q100 178 100 160Z" fill={passed ? colors.success : colors.primary} stroke={colors.foreground} strokeWidth={2} />
              <Path d="M109 111Q124 104 139 111L137 126H111Z M111 150H137L139 164Q124 169 109 164Z" fill={colors.surface} opacity={0.95} />
              <Rect x={111} y={131} width={26} height={14} rx={4} fill={colors.surface} opacity={0.25} />
              <Path d="M105 103L113 100 M135 100L143 103" stroke={colors.surface} strokeWidth={3} strokeLinecap="round" />
              <Path d="M107 174H113 M135 174H141" stroke={colors.surface} strokeWidth={3} strokeLinecap="round" />
            </Svg>
          </Animated.View>
          {passed ? <View style={styles.success}><CircleCheck size={37} color={colors.success} /></View> : null}
        </View>
      </View>
      <View className="items-center gap-2">
        <View className="flex-row items-center justify-center gap-2">
          {pending ? <ActivityIndicator color={color} size="small" /> : <StatusIcon size={20} color={color} />}
          <Text accessibilityLiveRegion="polite" className="font-sans shrink text-section font-semibold" style={{ color }}>{label}</Text>
        </View>
        <Text className="font-sans text-center text-caption leading-5 text-secondary-foreground">{hint}</Text>
      </View>
      <View className="mt-4" accessibilityRole="progressbar" accessibilityLabel="Forward movement detection" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }} />
      <View className="flex-row gap-3">
        <CalibrationSensorReading icon={Activity} label="Acceleration" value={reading?.forward?.acceleration} limit={limits.acceleration} unit="m/s²" minimum state={warning ? 'invalid' : captured || feedback.state === 'building' ? 'valid' : 'neutral'} caption={captured ? 'Movement captured' : undefined} />
        <CalibrationSensorReading icon={RotateCcw} label="Gyroscope" value={reading?.rotation} limit={mountLimits.rotationPeak} unit="°/s peak" />
      </View>
      {noiseBaseline ? <Text className="font-sans mt-3 text-caption leading-5 text-secondary-foreground">Parked vibration: {noiseBaseline.horizontalRms.toFixed(2)} m/s² · {noiseBaseline.rotationRms.toFixed(2)} °/s</Text> : null}
      {failureReason && !busy ? <Text accessibilityLiveRegion="polite" className="font-sans mt-4 text-body leading-6 text-destructive">{failureReason}</Text> : null}
      <View className="mt-5 gap-3" style={{ display: busy || passed ? 'none' : 'flex' }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  guide: { width: '100%', aspectRatio: 1, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginVertical: 12 },
  success: { position: 'absolute', top: 36, left: 104, backgroundColor: colors.background, borderRadius: 20 },
});
