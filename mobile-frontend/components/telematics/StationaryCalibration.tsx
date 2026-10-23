import { Activity, CircleCheck, CirclePause, RotateCcw } from 'lucide-react-native';
import { useEffect, useRef, type ReactNode } from 'react';
import { ActivityIndicator, Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { CalibrationSensorReading } from '@/components/telematics/CalibrationSensorReading';
import { themeColors as colors } from '@/constants/theme';
import { useCalibrationVisuals } from '@/hooks/telematics/useCalibrationVisuals';
import { stationaryWithinRange, type CalibrationLiveState, type CalibrationReading } from '@/lib/telematics/calibration';
import type { MobileTelematicsHandover } from '@/services/api';

type Limits = MobileTelematicsHandover['calibration']['stationaryLimits'];

export function StationaryCalibration({ live, limits, durationSeconds, busy, rcDemo, failureReason, children, purpose = 'calibration' }: {
  live: CalibrationLiveState | null;
  limits: Limits;
  durationSeconds: number;
  busy: boolean;
  rcDemo: boolean;
  failureReason?: string | null;
  children: ReactNode;
  purpose?: 'calibration' | 'resume';
}) {
  const { reducedMotion, readingsStale } = useCalibrationVisuals(live, limits.maxGapMs);
  const pulse = useRef(new Animated.Value(0)).current;
  const phase = live?.phase;
  const reading: CalibrationReading | undefined = phase === 'preparing' ? undefined : live?.reading;
  const compact = purpose === 'resume' || busy || phase === 'passed';
  const guideSize = purpose === 'resume' ? 104 : compact ? 188 : 248;
  const passed = phase === 'passed';
  const failed = phase === 'failed' || Boolean(failureReason) && !busy;
  const withinRange = reading ? !readingsStale && stationaryWithinRange(reading, limits) : null;
  const interrupted = readingsStale || Boolean(reading && reading.maxGapMs > limits.maxGapMs);
  const color = passed ? colors.success : failed || withinRange === false ? colors.destructive : colors.primary;
  const progress = passed || phase === 'evaluating' ? 1 : reading ? Math.min(1, reading.elapsedMs / reading.durationMs) : 0;
  const label = passed ? purpose === 'resume' ? 'Stationary check passed' : 'Parked vibration measured' : phase === 'evaluating' ? purpose === 'resume' ? 'Checking stability' : 'Checking parked readings' : phase === 'preparing' ? 'Preparing sensors' : phase === 'recording' ? interrupted ? 'Readings interrupted' : withinRange ? purpose === 'resume' ? 'Checking stability' : 'Measuring parked vibration' : 'Phone is not steady' : failed ? 'Repeat this step' : 'Ready when you are';
  const movementHint = reading && reading.tilt > limits.tiltDegrees ? purpose === 'resume' ? 'The phone tilted. Keep it steady in its mount and retry.' : 'The phone tilted. Secure the mount and retry while parked.' : reading && reading.yaw > limits.yawDegrees ? purpose === 'resume' ? 'The phone rotated. Keep it steady in its mount and retry.' : 'The phone rotated. Secure it and retry while parked.' : purpose === 'resume' ? 'Keep the phone steady in its mount.' : 'Keep parked. Leave the phone untouched during this measurement.';
  const StatusIcon = passed ? CircleCheck : failed || withinRange === false ? CirclePause : Activity;

  useEffect(() => {
    pulse.setValue(0);
    if (reducedMotion || failed || !phase || phase === 'evaluating') return;
    const animation = passed ? Animated.timing(pulse, { toValue: 1, duration: 400, useNativeDriver: true })
      : Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true, isInteraction: false }),
        Animated.timing(pulse, { toValue: 0, duration: 1400, useNativeDriver: true, isInteraction: false }),
      ]));
    animation.start();
    return () => animation.stop();
  }, [pulse, reducedMotion, passed, failed, phase]);

  return (
    <View className={`rounded-card border border-border bg-surface ${purpose === 'resume' ? 'p-3' : 'p-card'}`}>
      {purpose === 'resume' ? null : <View className="flex-row items-center justify-between gap-4">
        <Text className="font-sans text-caption font-semibold text-primary">STEP 01 / 05</Text>
        <Text className="font-sans text-caption text-secondary-foreground">Stationary</Text>
      </View>}
      {purpose === 'calibration' ? <View className="mt-3 flex-row gap-1.5" accessible={false}>{[0, 1, 2, 3, 4].map((step) => <View key={step} className="h-1 flex-1 rounded-full" style={{ backgroundColor: step === 0 ? color : colors.muted }} />)}</View> : null}
      {purpose === 'resume' ? null : <Text className={`font-sans ${compact ? 'mt-2' : 'mt-5'} font-semibold text-foreground ${compact ? 'text-section' : 'text-title'}`}>Keep the vehicle parked</Text>}
      {!compact ? <Text className="font-sans mt-2 text-body leading-6 text-secondary-foreground">{`${rcDemo ? 'Keep the RC car powered on and stopped' : 'Keep the vehicle parked and idling'} for ${durationSeconds} seconds. We’ll measure the mounted phone’s background vibration.`}</Text> : null}

      <View className={purpose === 'resume' ? 'flex-row items-center gap-2' : undefined}>
      <View style={[styles.guide, { maxWidth: guideSize, marginVertical: purpose === 'resume' ? 0 : 12 }]} accessible={false} importantForAccessibility="no-hide-descendants">
        <View style={[styles.artwork, { transform: [{ scale: guideSize / 248 }] }]}><Svg width="100%" height="100%" viewBox="0 0 248 248" style={StyleSheet.absoluteFill}>
          <Circle cx={124} cy={124} r={111} fill={colors.background} stroke={colors.border} strokeWidth={1} />
          <Circle cx={124} cy={124} r={103} fill="none" stroke={colors.border} strokeWidth={5} />
          <Circle cx={124} cy={124} r={103} fill="none" stroke={color} strokeWidth={5} strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 103}`} strokeDashoffset={2 * Math.PI * 103 * (1 - progress)} rotation={-90} origin="124, 124" />
        </Svg>
        <View style={styles.mountStem} /><View style={styles.mountBase} />
        <View style={styles.phone}>
          <View style={styles.notch} />
          <View style={[styles.phoneScreen, { borderColor: color }]}>
            {passed ? <Animated.View style={{ opacity: reducedMotion ? 1 : pulse, transform: [{ scale: reducedMotion ? 1 : pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }] }}><CircleCheck size={40} color={colors.success} strokeWidth={1.6} /></Animated.View> : <>
              <View style={[styles.crosshairHorizontal, { backgroundColor: color }]} /><View style={[styles.crosshairVertical, { backgroundColor: color }]} />
              <Animated.View style={[styles.target, { borderColor: color, opacity: reducedMotion ? 1 : pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }), transform: [{ scale: reducedMotion ? 1 : pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.1] }) }] }]} />
              <View style={[styles.targetDot, { backgroundColor: color }]} />
            </>}
          </View>
          <View style={styles.homeIndicator} />
        </View>
        <View style={styles.mountGrip} /></View>
      </View>
      <View className={purpose === 'resume' ? 'min-w-0 flex-1 gap-1' : 'items-center gap-2'}>
        <View className={`flex-row items-center gap-2 ${purpose === 'resume' ? 'justify-start' : 'justify-center'}`}>
          {phase === 'preparing' || phase === 'evaluating' ? <ActivityIndicator color={color} size="small" /> : <StatusIcon size={20} color={color} />}
          <Text accessibilityLiveRegion="polite" className={`font-sans shrink font-semibold ${purpose === 'resume' ? 'text-caption' : 'text-section'}`} style={{ color }}>{label}</Text>
        </View>
        <Text className={`font-sans text-caption leading-4 text-secondary-foreground ${purpose === 'resume' ? 'text-left' : 'text-center leading-5'}`}>{purpose === 'resume' && failureReason && !busy ? failureReason : passed ? purpose === 'resume' ? 'Ready to resume.' : 'Opening forward movement…' : phase === 'preparing' ? purpose === 'resume' ? 'Hold the phone steady.' : 'Keep parked while the readings settle.' : phase === 'evaluating' ? 'Recording finished. Waiting for the result.' : phase === 'recording' ? interrupted ? purpose === 'resume' ? 'Incomplete readings. Keep steady and retry.' : 'Readings are incomplete. Keep the app open and retry while parked.' : withinRange ? purpose === 'resume' ? 'Keep it steady in the mount.' : 'Keep parked and leave the mounted phone untouched.' : movementHint : purpose === 'resume' ? 'Keep the phone mounted.' : 'Flat, upright or tilted · keep the phone mounted'}</Text>
      </View>
      </View>
      <View className={`${compact ? 'mt-2' : 'mt-5'} gap-2`} accessibilityRole="progressbar" accessibilityLabel={purpose === 'resume' ? 'Stationary check' : 'Parked vibration measurement'} accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}>
        <View className="flex-row justify-between gap-3"><Text className="font-sans text-caption text-secondary-foreground">{phase === 'evaluating' ? 'Recording complete' : purpose === 'resume' ? 'Check time' : 'Measurement time'}</Text><Text className="font-sans text-caption font-semibold text-foreground" style={{ fontVariant: ['tabular-nums'] }}>{(progress * durationSeconds).toFixed(1)} / {durationSeconds}s</Text></View>
      </View>
      {purpose === 'resume' ? null : <View className={`${compact ? 'mt-2' : 'mt-4'} flex-row gap-3`}>
        <CalibrationSensorReading icon={Activity} label="Accelerometer" value={reading?.acceleration} limit={limits.linearRms} unit="m/s² RMS" />
        <CalibrationSensorReading icon={RotateCcw} label="Gyroscope" value={reading?.rotation} limit={limits.rotationPeak} unit="°/s peak" />
      </View>}
      {purpose !== 'resume' && failureReason && !busy ? <Text accessibilityLiveRegion="polite" className="font-sans mt-4 text-body leading-6 text-destructive">{failureReason}</Text> : null}
      <View className={`${compact ? 'mt-2' : 'mt-5'}`} style={{ display: busy || passed ? 'none' : 'flex' }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  guide: { width: '100%', maxWidth: 248, aspectRatio: 1, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginVertical: 12 },
  artwork: { width: 248, height: 248, alignItems: 'center', justifyContent: 'center' },
  phone: { width: 78, height: 142, borderRadius: 17, borderWidth: 3, borderColor: colors.foreground, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginTop: -10 },
  phoneScreen: { width: 62, height: 108, borderRadius: 10, borderWidth: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  notch: { position: 'absolute', zIndex: 1, width: 25, height: 4, borderRadius: 4, top: 5, backgroundColor: colors.foreground },
  homeIndicator: { position: 'absolute', bottom: 4, width: 22, height: 3, borderRadius: 3, backgroundColor: colors.foreground },
  mountStem: { position: 'absolute', width: 12, height: 43, bottom: 41, borderRadius: 5, backgroundColor: colors.subtleForeground },
  mountBase: { position: 'absolute', width: 94, height: 10, bottom: 37, borderRadius: 6, backgroundColor: colors.foreground },
  mountGrip: { position: 'absolute', width: 96, height: 16, top: 141, borderWidth: 3, borderColor: colors.foreground, borderRadius: 6, backgroundColor: colors.surface },
  crosshairHorizontal: { position: 'absolute', width: 42, height: 1, opacity: 0.25 },
  crosshairVertical: { position: 'absolute', width: 1, height: 42, opacity: 0.25 },
  target: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5 },
  targetDot: { position: 'absolute', width: 7, height: 7, borderRadius: 4 },
});
