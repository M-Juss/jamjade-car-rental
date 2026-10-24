import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type { CalibrationLiveState } from '@/lib/telematics/calibration';
import type { StationaryResumeSettings } from '@/lib/telematics/stationary-resume';
import { runStationaryResumeCheck, StationaryResumeCheckIssue } from '@/services/telematics/stationary-resume-check';

export function useStationaryResumeCheck(bookingCode: string, userId: number | undefined) {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<CalibrationLiveState | null>(null);
  const [settings, setSettings] = useState<StationaryResumeSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsSettings, setNeedsSettings] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const opened = useRef(false);
  const focused = useRef(false);
  const passedAt = useRef(0);
  const continuation = useRef<(() => void) | null>(null);
  const pendingResume = useRef<(() => void) | null>(null);

  const close = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    opened.current = false;
    continuation.current = null;
    pendingResume.current = null;
    passedAt.current = 0;
    setVisible(false);
    setBusy(false);
    setLive(null);
    setSettings(null);
    setError(null);
    setNeedsSettings(false);
  }, []);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    return () => { focused.current = false; close(); };
  }, [bookingCode, userId, close]));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => { if (state !== 'active') close(); });
    return () => subscription.remove();
  }, [close]);

  const open = (onResume: () => void) => {
    if (!focused.current || opened.current || AppState.currentState !== 'active') return;
    close();
    opened.current = true;
    continuation.current = onResume;
    setVisible(true);
  };
  const run = async () => {
    if (!opened.current || controller.current || !focused.current || AppState.currentState !== 'active') return;
    const request = new AbortController();
    controller.current = request;
    passedAt.current = 0;
    setBusy(true);
    setError(null);
    setNeedsSettings(false);
    setLive({ step: 'stationary_calibration', phase: 'preparing' });
    const current = () => controller.current === request && !request.signal.aborted && opened.current && focused.current;
    try {
      const passed = await runStationaryResumeCheck(bookingCode, request.signal,
        (value) => { if (current()) setSettings(value); },
        (value) => { if (current()) setLive((previous) => ({ ...value, reading: value.reading ?? previous?.reading })); });
      if (current() && passed) passedAt.current = Date.now();
    } catch (failure) {
      if (current()) {
        setLive((previous) => ({ step: 'stationary_calibration', phase: 'failed', reading: previous?.reading }));
        setError(failure instanceof Error ? failure.message : 'The check could not finish. Retry while parked.');
        setNeedsSettings(failure instanceof StationaryResumeCheckIssue && failure.needsSettings);
      }
    } finally {
      if (current()) { controller.current = null; setBusy(false); }
    }
  };
  const finishResume = () => {
    const start = pendingResume.current;
    pendingResume.current = null;
    if (!opened.current) { setLive(null); setSettings(null); setError(null); }
    if (start && focused.current && AppState.currentState === 'active') start();
  };
  const resume = () => {
    if (controller.current || !opened.current || live?.phase !== 'passed') return;
    if (!passedAt.current || Date.now() - passedAt.current > 60_000) {
      setLive({ step: 'stationary_calibration', phase: 'failed' });
      setError('The check expired. Repeat it before resuming.');
      return;
    }
    pendingResume.current = continuation.current;
    continuation.current = null;
    passedAt.current = 0;
    opened.current = false;
    setVisible(false);
    // Wait for the native modal to dismiss before GPS permissions or another disclosure.
    setTimeout(finishResume, 0);
  };
  return { visible, busy, live, settings, error, needsSettings, open, run, close, resume };
}
