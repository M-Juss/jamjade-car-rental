import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type { DeviceSetupStep } from '@/lib/telematics/setup';
import { getBookingTelematicsSetup, getBookings, getCurrentTelematicsSetup, type MobileTelematicsHandover } from '@/services/api';
import { ApiError } from '@/services/http';
import { runSetupChecks } from '@/services/telematics/setup-workflow';
import type { Booking } from '@/types/booking';

export function useTelematicsHandover(bookingId?: string) {
  const [handover, setHandover] = useState<MobileTelematicsHandover | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bookingsError, setBookingsError] = useState<string | null>(null);
  const [actingStep, setActingStep] = useState<DeviceSetupStep | null>(null);
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
    const [setupResult, bookingsResult] = await Promise.allSettled([readHandover(), getBookings()]);
    if (request !== generation.current || !focused.current) return;
    reading.current = false;
    if (setupResult.status === 'fulfilled') {
      setHandover(setupResult.value);
      setLoadError(null);
    } else {
      setHandover(null);
      setLoadError(setupResult.reason instanceof ApiError && [403, 404].includes(setupResult.reason.status)
        ? 'This booking is no longer available for telematics. Select another rental or return to your current rental.'
        : 'Telematics could not be refreshed. Check your connection and try again.');
    }
    if (bookingsResult.status === 'fulfilled') {
      setBookings(bookingsResult.value);
      setBookingsError(null);
    } else {
      setBookingsError('Your booking list could not be refreshed. Try again to switch rentals.');
    }
    setLoading(false);
  }, [readHandover]);
  const latestRefresh = useRef(refresh);
  latestRefresh.current = refresh;

  useFocusEffect(useCallback(() => {
    focused.current = true;
    setHandover(null);
    setFeedback(null);
    void refresh();
    // Reads only: staff handover/release changes appear without a notification.
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') void refresh(true);
    }, 15000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh(true);
    });
    return () => {
      focused.current = false;
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

  return { handover, bookings, loading, loadError, bookingsError, actingStep, feedback, refresh, checkSetup };
}
