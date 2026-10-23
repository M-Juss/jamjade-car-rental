import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import type { CalibrationLiveState } from '@/lib/telematics/calibration';

export function useCalibrationVisuals(live: CalibrationLiveState | null, maxGapMs: number) {
  const [reducedMotion, setReducedMotion] = useState(true);
  const [readingsStale, setReadingsStale] = useState(false);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (active) setReducedMotion(value); }).catch(() => { /* Keep animation disabled if the preference is unavailable. */ });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => { active = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    setReadingsStale(false);
    if (live?.phase !== 'recording' || !live.reading) return;
    const timer = setTimeout(() => setReadingsStale(true), maxGapMs + 50);
    return () => clearTimeout(timer);
  }, [live?.reading, live?.phase, maxGapMs]);
  return { reducedMotion, readingsStale };
}
