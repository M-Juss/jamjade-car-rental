import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { getLocationMonitoring, type LocationMonitoringSnapshot } from '@/services/api/location-monitoring.service';
import { locationMonitoring } from '@/services/telematics/location-monitoring';
import { isLocationSharingActive } from '@/services/telematics/location-monitoring-session';

export function useLocationMonitoringLifecycle(userId: number | null) {
  useEffect(() => {
    locationMonitoring.reset();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && isLocationSharingActive(locationMonitoring.getSnapshot().phase) && !locationMonitoring.canContinueInBackground()) {
        locationMonitoring.stop('Sharing stopped when the app left the foreground. Tap Resume sharing to continue.');
      }
      if (state === 'active') void locationMonitoring.check();
    });
    return () => { subscription.remove(); locationMonitoring.reset(); };
  }, [userId]);
}

export function useRentalLocationMonitoring(bookingCode: string) {
  const sharing = useSyncExternalStore(locationMonitoring.subscribe, locationMonitoring.getSnapshot, locationMonitoring.getSnapshot);
  const [snapshot, setSnapshot] = useState<LocationMonitoringSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const focused = useRef(false);
  const refresh = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 10_000);
    setLoading(true);
    setError(null);
    try {
      const current = await getLocationMonitoring(bookingCode, controller.signal);
      if (request.current !== controller || !focused.current || controller.signal.aborted) return null;
      setSnapshot(current);
      return current;
    } catch {
      if (request.current === controller && focused.current) {
        setSnapshot(null);
        setError('Monitoring could not be checked. Check your connection and try again.');
      }
      return null;
    } finally {
      clearTimeout(timeout);
      if (request.current === controller && focused.current) setLoading(false);
    }
  }, [bookingCode]);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    void refresh();
    return () => { focused.current = false; request.current?.abort(); };
  }, [refresh]));

  return { snapshot, loading, error, refresh, sharing: sharing.bookingCode === bookingCode ? sharing : null, start: locationMonitoring.start.bind(locationMonitoring), stop: () => locationMonitoring.stop() };
}
