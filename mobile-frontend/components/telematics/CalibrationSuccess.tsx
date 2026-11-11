import { useEffect } from 'react';
import { Text, View } from 'react-native';

import { SetupSuccessCheck } from '@/components/telematics/SetupSuccessCheck';
import { CALIBRATION_STEPS, type CalibrationStep } from '@/lib/telematics/calibration';
import { CALIBRATION_CHECK_ORDER } from '@/lib/telematics/setup';

export function CalibrationSuccess({ step, nextStep, ready, onComplete }: {
  step: CalibrationStep;
  nextStep: CalibrationStep | null;
  ready: boolean;
  onComplete: () => void;
}) {
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(onComplete, 2200);
    return () => clearTimeout(timer);
  }, [ready, onComplete]);

  return (
    <View className="items-center">
      <Text className="font-sans text-caption font-semibold text-primary">STEP {CALIBRATION_CHECK_ORDER.indexOf(step) + 1} / {CALIBRATION_CHECK_ORDER.length}</Text>
      <SetupSuccessCheck ready={ready} />
      <View accessibilityLiveRegion="polite" className="items-center gap-2">
        <Text className="font-sans text-center text-title font-semibold text-success">{nextStep ? 'Exercise complete' : 'Calibration complete'}</Text>
        <Text className="font-sans text-center text-body text-foreground">{CALIBRATION_STEPS[step].title}</Text>
        <Text className="font-sans text-center text-caption leading-5 text-secondary-foreground">{nextStep ? `Next: ${CALIBRATION_STEPS[nextStep].title}. Stop safely before continuing.` : 'Wait for staff to release the vehicle.'}</Text>
      </View>
    </View>
  );
}
