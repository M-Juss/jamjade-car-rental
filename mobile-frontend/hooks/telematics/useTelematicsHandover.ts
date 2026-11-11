import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type { CalibrationLiveState } from '@/lib/telematics/calibration';
import type { DeviceSetupStep } from '@/lib/telematics/setup';
import { getBooking, getBookingTelematicsSetup, getBookings, getCurrentTelematicsSetup, getDriverService, restartBookingTelematicsSetup, type MobileTelematicsHandover } from '@/services/api';
import { ApiError } from '@/services/http';
import { runSetupChecks } from '@/services/telematics/setup-workflow';
import { runCalibrationCheck } from '@/services/telematics/calibration-workflow';
import type { CalibrationConsentInput } from '@/validation/telematics/calibration';
import type { Booking } from '@/types/booking';
import { useAuth } from '@/providers/AuthProvider';

export function useTelematicsHandover(bookingId?: string) {
  const { user } = useAuth();
  const isDriver = user?.roles?.includes('driver') ?? false;
  const [handover, setHandover] = useState<MobileTelematicsHandover | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [accessLost, setAccessLost] = useState(false);
  const [bookingsError, setBookingsError] = useState<string | null>(null);
  const [actingStep, setActingStep] = useState<DeviceSetupStep | null>(null);
  const [restartingSetup, setRestartingSetup] = useState(false);
  const [calibrationBusy, setCalibrationBusy] = useState(false);
  const [calibrationLive, setCalibrationLive] = useState<CalibrationLiveState | null>(null);
  const [calibrationRecording, setCalibrationRecording] = useState(false);
  const calibrationAbort = useRef<AbortController | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; failed: boolean } | null>(null);
  const generation = useRef(0);
  const busy = useRef(false);
  const reading = useRef(false);
  const focused = useRef(false);
  const readHandover = useCallback(() => bookingId ? getBookingTelematicsSetup(bookingId) : getCurrentTelematicsSetup(), [bookingId]);

  const refresh = useCallback(async (silent = false) => {
    if (busy.current || !focused.current || (silent && reading.current)) return;
    const request = ++generation.current;
    reading.current = true;
    if (!silent) setLoading(true);
    const bookingRead = bookingId
      ? (isDriver ? getDriverService(bookingId) : getBooking(bookingId)).then((booking) => [booking])
      : isDriver ? Promise.resolve([] as Booking[]) : getBookings();
    const [setupResult, bookingsResult] = await Promise.allSettled([readHandover(), bookingRead]);
    if (request !== generation.current || !focused.current) return;
    reading.current = false;
    if (setupResult.status === 'fulfilled') {
      setHandover(setupResult.value);
      setLoadError(null);
      setAccessLost(!setupResult.value && Boolean(bookingId));
    } else {
      const denied = setupResult.reason instanceof ApiError && [401, 403, 404].includes(setupResult.reason.status);
      if (denied) setHandover(null);
      setAccessLost(denied);
      setLoadError(denied
        ? 'This booking is no longer available for telematics. Select another rental or return to your current rental.'
        : 'Telematics could not be refreshed. Check your connection and try again.');
    }
    if (bookingsResult.status === 'fulfilled') {
      setBookings(bookingsResult.value);
      setBookingsError(null);
    } else {
      setBookingsError('Vehicle details could not be refreshed. Try again.');
    }
    setLoading(false);
  }, [readHandover, bookingId, isDriver]);
  const latestRefresh = useRef(refresh);
  latestRefresh.current = refresh;

  useFocusEffect(useCallback(() => {
    focused.current = true;
    setHandover(null);
    setAccessLost(false);
    setFeedback(null);
    setCalibrationLive(null);
    void refresh();
    // Reads only: staff handover/release changes appear without a notification.
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') void refresh(true);
    }, 15000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') { calibrationAbort.current?.abort(); setCalibrationLive(null); }
      if (state === 'active') void refresh(true);
    });
    return () => {
      focused.current = false;
      setCalibrationLive(null);
      calibrationAbort.current?.abort();
      reading.current = false;
      generation.current += 1;
      clearInterval(interval);
      subscription.remove();
    };
  }, [refresh]));

  const checkSetup = async (confirmPhoneMount: () => Promise<boolean | null>) => {
    if (!handover || busy.current || loading || loadError || !focused.current) return;
    busy.current = true;
    const request = ++generation.current;
    reading.current = false;
    setActingStep('device_check');
    setFeedback(null);
    try {
      const result = await runSetupChecks(handover.bookingCode, {
        isActive: () => request === generation.current && focused.current,
        onStep: setActingStep,
        onUpdate: setHandover,
        confirmPhoneMount,
      });
      if (request === generation.current && focused.current && result) setFeedback(result);
    } catch (error) {
      if (request !== generation.current || !focused.current) return;
      setFeedback({ failed: true, message: error instanceof ApiError
        ? 'Setup could not be saved. Refresh the handover status and run setup again.'
        : error instanceof Error ? error.message : 'Setup could not be completed. Please try again.' });
    } finally {
      busy.current = false;
      setActingStep(null);
      if (focused.current && request !== generation.current) void latestRefresh.current();
    }
  };

  const restartSetup = async () => {
    if (!handover?.setup?.canRestart || !handover.calibration.context || busy.current || loading || loadError || !focused.current) return false;
    busy.current = true;
    reading.current = false;
    const request = ++generation.current;
    const isCurrent = () => focused.current && request === generation.current;
    setRestartingSetup(true);
    setFeedback(null);
    let shouldRefresh = false;
    try {
      const updated = await restartBookingTelematicsSetup(handover.bookingCode, handover.calibration.context);
      if (!isCurrent()) return false;
      setHandover(updated);
      setCalibrationLive(null);
      return true;
    } catch (error) {
      shouldRefresh = true;
      if (isCurrent()) {
        setFeedback({ failed: true, message: error instanceof ApiError
          ? error.errors?.telematics_setup?.[0] ?? error.errors?.context?.[0] ?? 'Setup could not be restarted. Try again.'
          : 'Setup could not be restarted. Check your connection and try again.' });
      }
      return false;
    } finally {
      busy.current = false;
      setRestartingSetup(false);
      if (focused.current && (shouldRefresh || !isCurrent())) void latestRefresh.current(true);
    }
  };

  const calibrate = async (consent: CalibrationConsentInput, restart = false) => {
    if (!handover || busy.current || loading || loadError || !focused.current) return;
    busy.current = true;
    reading.current = false;
    const request = ++generation.current;
    const controller = new AbortController();
    calibrationAbort.current = controller;
    setCalibrationBusy(true);
    setCalibrationLive(null);
    setFeedback(null);
    const active = () => request === generation.current && focused.current;
    let contextChanged = false;
    try {
      const result = await runCalibrationCheck(handover.bookingCode, consent, controller.signal,
        (updated) => {
          contextChanged = updated.calibration.context !== handover.calibration.context;
          if (active()) setHandover(updated);
        },
        (recording) => { if (active()) setCalibrationRecording(recording); }, handover.calibration.nextStep, handover.calibration.profile.fingerprint, restart, (state) => { if (active()) setCalibrationLive((previous) => ({ ...state, reading: state.reading ?? (previous?.step === state.step ? previous.reading : undefined) })); });
      if (active() && result) setFeedback(result);
    } catch (error) {
      if (active()) {
        setCalibrationLive(null);
        // A fresh context remounts the consent form. Preserve an error outside
        // that form only when its original error state can no longer render.
        if (contextChanged) {
          setFeedback({ failed: true, message: error instanceof ApiError
            ? error.errors?.step?.[0] ?? error.errors?.telematics_setup?.[0] ?? 'Calibration could not be saved. Refresh and repeat the current step while parked.'
            : error instanceof Error ? error.message : 'Calibration could not be completed. Try again while parked.' });
        }
        throw error;
      }
    } finally {
      if (calibrationAbort.current === controller) calibrationAbort.current = null;
      busy.current = false;
      setCalibrationBusy(false);
      setCalibrationRecording(false);
      if (focused.current && !active()) void latestRefresh.current();
    }
  };

  const dismissCalibrationSuccess = useCallback(() => { setCalibrationLive(null); setFeedback(null); }, []);

  return { handover, bookings, loading, loadError, accessLost, bookingsError, actingStep, feedback, refresh, checkSetup, restartSetup, restartingSetup, calibrationBusy, calibrationRecording, calibrationLive, dismissCalibrationSuccess, calibrate, cancelCalibration: () => calibrationAbort.current?.abort() };
}
