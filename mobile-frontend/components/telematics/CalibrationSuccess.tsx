import { CircleCheck } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';

import { themeColors } from '@/constants/theme';
import { useCalibrationVisuals } from '@/hooks/telematics/useCalibrationVisuals';
import { CALIBRATION_STEPS, type CalibrationStep } from '@/lib/telematics/calibration';

export function CalibrationSuccess({ step, nextStep, ready, onComplete }: {
  step: CalibrationStep;
  nextStep: CalibrationStep | null;
  ready: boolean;
  onComplete: () => void;
}) {
  const { reducedMotion } = useCalibrationVisuals(null, 500);
  const reveal = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!ready) return;
    reveal.setValue(reducedMotion ? 1 : 0);
    const animation = Animated.timing(reveal, { toValue: 1, duration: 450, useNativeDriver: true, isInteraction: false });
    if (!reducedMotion) animation.start();
    const timer = setTimeout(onComplete, 2200);
    return () => { clearTimeout(timer); animation.stop(); };
  }, [ready, reducedMotion, reveal, onComplete]);

  return (
    <View className="items-center rounded-card border border-success-border bg-surface p-card">
      <Text className="font-sans text-caption font-semibold text-primary">STEP {Object.keys(CALIBRATION_STEPS).indexOf(step) + 1} / 5</Text>
      <Animated.View className="my-6 h-28 w-28 items-center justify-center rounded-full bg-success-surface"
        accessible={false} importantForAccessibility="no-hide-descendants"
        style={{ opacity: reveal, transform: [{ scale: reveal.interpolate({ inputRange: [0, 0.75, 1], outputRange: [0.65, 1.08, 1] }) }] }}>
        <CircleCheck size={64} color={themeColors.success} strokeWidth={2} />
      </Animated.View>
      <View accessibilityLiveRegion="polite" className="items-center gap-2">
        <Text className="font-sans text-center text-title font-semibold text-success">{nextStep ? 'Exercise complete' : 'Calibration complete'}</Text>
        <Text className="font-sans text-center text-body text-foreground">{CALIBRATION_STEPS[step].title}</Text>
        <Text className="font-sans text-center text-caption leading-5 text-secondary-foreground">{nextStep ? `Next: ${CALIBRATION_STEPS[nextStep].title}. Stop safely before continuing.` : 'Wait for staff to release the vehicle.'}</Text>
      </View>
    </View>
  );
}
