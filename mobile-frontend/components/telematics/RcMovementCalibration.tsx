import { Activity, ArrowUp, CarFront, CircleCheck, CornerUpLeft, CornerUpRight, Octagon, RotateCcw } from 'lucide-react-native';
import { useEffect, useRef, type ReactNode } from 'react';
import { ActivityIndicator, Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { CalibrationSensorReading } from '@/components/telematics/CalibrationSensorReading';
import { themeColors as colors } from '@/constants/theme';
import { useCalibrationVisuals } from '@/hooks/telematics/useCalibrationVisuals';
import { CALIBRATION_STEPS, rcMovementFeedback, type CalibrationLiveState, type CalibrationStep } from '@/lib/telematics/calibration';
import type { MobileTelematicsHandover } from '@/services/api';

const guides = {
  forward_calibration: { icon: ArrowUp, title: 'Move forward gently', hint: 'Move straight from rest, then stop safely.' },
  braking_calibration: { icon: Octagon, title: 'Slow to a gentle stop', hint: 'Move forward slowly, then brake gently.' },
  left_turn_calibration: { icon: CornerUpLeft, title: 'Make a gentle left turn', hint: 'Turn left slowly, then stop safely.' },
  right_turn_calibration: { icon: CornerUpRight, title: 'Make a gentle right turn', hint: 'Turn right slowly, then stop safely.' },
} as const;

export function RcMovementCalibration({ step, live, calibration, busy, failureReason, children }: {
  step: Exclude<CalibrationStep, 'stationary_calibration'>;
  live: CalibrationLiveState | null;
  calibration: MobileTelematicsHandover['calibration'];
  busy: boolean;
  failureReason?: string | null;
  children: ReactNode;
}) {
  const guide = guides[step];
  const { reducedMotion, readingsStale } = useCalibrationVisuals(live, calibration.stationaryLimits.maxGapMs);
  const animation = useRef(new Animated.Value(0)).current;
  const phase = live?.phase;
  const reading = phase === 'preparing' ? undefined : live?.reading;
  const feedback = rcMovementFeedback(step, reading, calibration.movementLimits, calibration.forwardLimits,
    calibration.stationaryLimits.maxGapMs, phase === 'recording' && readingsStale);
  const passed = phase === 'passed';
  const captured = feedback === 'captured';
  const failed = phase === 'failed' || Boolean(failureReason) && !busy;
  const detected = passed || captured && phase === 'recording';
  const pending = phase === 'preparing' || phase === 'evaluating';
  const color = detected ? colors.success : colors.primary;
  const target = step === 'forward_calibration' ? calibration.forwardLimits.durationMs
    : step === 'braking_calibration' ? calibration.movementLimits.brakingAcceleration : calibration.movementLimits.turnDegrees;
  const observed = step === 'forward_calibration' ? reading?.forward?.durationMs ?? 0
    : step === 'braking_calibration' ? reading?.movement?.braking ?? 0
      : step === 'left_turn_calibration' ? reading?.movement?.leftDegrees ?? 0 : reading?.movement?.rightDegrees ?? 0;
  const progress = passed || captured ? 1 : feedback === 'waiting' ? Math.min(0.95, observed / target) : 0;
  const label = passed ? 'Movement confirmed' : phase === 'preparing' ? 'Preparing sensors'
    : phase === 'evaluating' ? 'Checking movement' : failed ? 'Try this movement again'
      : feedback === 'interrupted' ? 'Readings interrupted' : feedback === 'position_changed' ? 'Check the phone position'
        : feedback === 'keep_straight' ? 'Keep the movement straight' : captured ? 'Movement detected' : phase === 'recording' ? 'Waiting for movement' : 'Ready when you are';
  const hint = passed ? step === 'right_turn_calibration' ? 'Calibration complete. Wait for staff release.' : 'Next exercise is opening…'
    : pending ? 'Keep parked while the sensors are prepared or the result is checked.'
      : captured ? 'Stop safely. Finishing the movement check.' : 'Follow staff directions and keep the mounted phone untouched.';
  const GuideIcon = passed || captured ? CircleCheck : guide.icon;

  useEffect(() => {
    animation.setValue(0);
    if (reducedMotion || phase !== 'recording' || captured) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(animation, { toValue: 1, duration: 900, useNativeDriver: true, isInteraction: false }),
      Animated.timing(animation, { toValue: 0, duration: 600, useNativeDriver: true, isInteraction: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [animation, reducedMotion, phase, captured]);

  return (
    <View className="rounded-card border border-border bg-surface p-card">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="font-sans text-caption font-semibold text-primary">STEP {String(Object.keys(CALIBRATION_STEPS).indexOf(step) + 1).padStart(2, '0')} / 05</Text>
        <Text className="font-sans shrink text-caption text-secondary-foreground">{CALIBRATION_STEPS[step].title}</Text>
      </View>
      <Text className="font-sans mt-5 text-section font-semibold text-foreground">{guide.title}</Text>
      {!busy && !passed ? <Text className="font-sans mt-2 text-body leading-6 text-secondary-foreground">{guide.hint} Start recording while parked.</Text> : null}
      <View className="my-5 items-center" accessible={false} importantForAccessibility="no-hide-descendants">
        <View style={styles.guide}>
          <Svg width={200} height={200} style={StyleSheet.absoluteFill}>
            <Circle cx={100} cy={100} r={91} fill={colors.background} stroke={colors.border} strokeWidth={5} />
            <Circle cx={100} cy={100} r={91} fill="none" stroke={color} strokeWidth={5} strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 91} strokeDashoffset={2 * Math.PI * 91 * (1 - progress)} rotation={-90} origin="100,100" />
          </Svg>
          <GuideIcon size={30} color={color} />
          <Animated.View style={{ transform: [
            { translateY: animation.interpolate({ inputRange: [0, 1], outputRange: [4, -5] }) },
            { rotate: animation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', step === 'left_turn_calibration' ? '-12deg' : step === 'right_turn_calibration' ? '12deg' : '0deg'] }) },
          ] }}><CarFront size={58} color={color} strokeWidth={1.5} /></Animated.View>
        </View>
      </View>
      <View className="items-center gap-2">
        {pending ? <ActivityIndicator color={colors.primary} /> : null}
        <Text accessibilityLiveRegion="polite" className="font-sans text-center text-section font-semibold" style={{ color }}>{label}</Text>
        <Text className="font-sans text-center text-caption leading-5 text-secondary-foreground">{hint}</Text>
      </View>
      <View className="mt-5 flex-row gap-3">
        <CalibrationSensorReading icon={Activity} label="Acceleration" value={step === 'braking_calibration' ? reading?.movement?.braking : step === 'forward_calibration' ? reading?.forward?.acceleration : reading?.acceleration}
          unit="m/s²" state={detected && (step === 'forward_calibration' || step === 'braking_calibration') ? 'valid' : 'neutral'} caption={step === 'braking_calibration' ? 'Deceleration' : 'Motion reading'} />
        <CalibrationSensorReading icon={RotateCcw} label="Gyroscope" value={reading?.rotation} unit="°/s peak"
          state={detected && step.endsWith('turn_calibration') ? 'valid' : 'neutral'} caption={step === 'left_turn_calibration' || step === 'right_turn_calibration'
            ? `${(step === 'left_turn_calibration' ? reading?.movement?.leftDegrees ?? 0 : reading?.movement?.rightDegrees ?? 0).toFixed(1)}° ${step === 'left_turn_calibration' ? 'left' : 'right'}` : 'Motion reading'} />
      </View>
      <View className="mt-4" accessibilityRole="progressbar" accessibilityLabel="Movement detection"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}>
        <Text className="font-sans text-center text-caption text-secondary-foreground">Recording ends when the movement is captured.</Text>
      </View>
      {failureReason && !busy ? <Text accessibilityRole="alert" className="font-sans mt-4 text-body leading-6 text-foreground">{failureReason}</Text> : null}
      <View className="mt-5 gap-3" style={{ display: busy || passed ? 'none' : 'flex' }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({ guide: { height: 200, width: 200, alignItems: 'center', justifyContent: 'center', gap: 8 } });
