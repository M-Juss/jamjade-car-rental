import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { ReleaseMonitoringPreparation, type ReleaseMonitoringContext } from '@/lib/telematics/release-monitoring';
import type { MobileTelematicsHandover } from '@/services/api';
import { getLocationSharingConsent, rememberLocationSharingConsent } from '@/services/telematics/location-sharing-consent';
import { isLocationSharingActive } from '@/services/telematics/location-monitoring-session';
import type { LocationConsentInput } from '@/validation/telematics/location-monitoring';
import { useRentalLocationMonitoring } from './useLocationMonitoring';

export function useTelematicsMonitoring(bookingCode: string, userId: number | undefined, handover: MobileTelematicsHandover | null, blocked: boolean, unavailable = false) {
  const monitoring = useRentalLocationMonitoring(bookingCode);
  const preparation = useRef(new ReleaseMonitoringPreparation());
  const [prepared, setPrepared] = useState(false);
  const [rememberedConsent, setRememberedConsent] = useState<LocationConsentInput | null>(null);
  const [consentLoading, setConsentLoading] = useState(true);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const released = handover?.eligibility.state === 'released';
  const startRef = useRef(monitoring.start);
  const stopRef = useRef(monitoring.stop);
  startRef.current = monitoring.start;
  stopRef.current = monitoring.stop;
  const { refresh, snapshot } = monitoring;
  const context = useMemo<ReleaseMonitoringContext>(() => ({
    userId: userId ?? 0, bookingCode, startedAt: handover?.setup?.startedAt ?? null,
    profile: handover?.calibration.profile.fingerprint ?? null,
  }), [userId, bookingCode, handover?.setup?.startedAt, handover?.calibration.profile.fingerprint]);
  const focused = useRef(false);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    const pending = preparation.current;
    return () => { focused.current = false; pending.clear(); setPrepared(false); };
  }, [bookingCode, userId]));
  useEffect(() => {
    if (unavailable) { preparation.current.clear(); setPrepared(false); void stopRef.current(); }
  }, [unavailable]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    const pending = preparation.current;
    return () => { subscription.remove(); pending.clear(); };
  }, []);
  useEffect(() => { if (handover && !blocked) void refresh(); }, [handover, blocked, refresh]);
  useEffect(() => {
    let current = true;
    setRememberedConsent(null);
    if (!userId || !snapshot) { setConsentLoading(monitoring.loading); return () => { current = false; }; }
    setConsentLoading(true);
    void getLocationSharingConsent({ userId, bookingCode }, snapshot.policy.consentVersion).then((consent) => {
      if (current) setRememberedConsent(consent);
    }).finally(() => { if (current) setConsentLoading(false); });
    return () => { current = false; };
  }, [userId, bookingCode, snapshot?.policy.consentVersion, monitoring.loading]);
  useEffect(() => {
    if (snapshot && !snapshot.canMonitor && isLocationSharingActive(monitoring.sharing?.phase ?? 'idle')) void stopRef.current();
    if (handover?.eligibility.state === 'rental_ended') { preparation.current.clear(); setPrepared(false); }
  }, [snapshot, monitoring.sharing?.phase, handover?.eligibility.state]);
  useEffect(() => {
    if (!prepared || blocked || !focused.current) return;
    if (!userId || !handover || !preparation.current.matches(context)) {
      preparation.current.clear();
      setPrepared(false);
      return;
    }
    if (!snapshot || !foreground) return;
    const consent = preparation.current.take(context, released, snapshot.canMonitor, foreground, snapshot.policy.consentVersion);
    if (!preparation.current.matches(context)) setPrepared(false);
    if (consent) void startRef.current(bookingCode, consent);
  }, [prepared, blocked, userId, handover, context, snapshot, foreground, released, bookingCode]);

  const prepare = (consent: LocationConsentInput | null) => {
    preparation.current.clear();
    setPrepared(false);
    if (consent && userId && handover && !released) {
      preparation.current.arm(context, consent);
      setPrepared(true);
    }
  };
  const getRememberedConsent = (consentVersion: number) => userId
    ? getLocationSharingConsent({ userId, bookingCode }, consentVersion)
    : Promise.resolve(null);
  const rememberConsent = async (consent: LocationConsentInput) => {
    if (!userId) return;
    setRememberedConsent(consent);
    await rememberLocationSharingConsent({ userId, bookingCode }, consent);
  };
  const stop = () => { preparation.current.clear(); setPrepared(false); void monitoring.stop(); };

  return { ...monitoring, stop, prepare, prepared, rememberedConsent, consentLoading, getRememberedConsent, rememberConsent,
    active: isLocationSharingActive(monitoring.sharing?.phase ?? 'idle') };
}
