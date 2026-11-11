import { CircleCheck } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

import { themeColors } from '@/constants/theme';
import { useCalibrationVisuals } from '@/hooks/telematics/useCalibrationVisuals';

export function SetupSuccessCheck({ ready = true }: { ready?: boolean }) {
  const { reducedMotion } = useCalibrationVisuals(null, 500);
  const reveal = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!ready || reducedMotion) {
      reveal.setValue(1);
      return;
    }

    reveal.setValue(0);
    const animation = Animated.timing(reveal, {
      toValue: 1,
      duration: 450,
      useNativeDriver: true,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [ready, reducedMotion, reveal]);

  return (
    <Animated.View
      className="my-3 h-16 w-16 items-center justify-center rounded-full bg-success-surface"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{ opacity: reveal, transform: [{ scale: reveal.interpolate({ inputRange: [0, 0.75, 1], outputRange: [0.65, 1.08, 1] }) }] }}>
      <CircleCheck size={36} color={themeColors.success} strokeWidth={2} />
    </Animated.View>
  );
}
