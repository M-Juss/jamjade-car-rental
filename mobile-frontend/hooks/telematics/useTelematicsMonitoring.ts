import { beginRentalDriveMonitoring, pauseRentalDriveMonitoring, rentalMotionStatus, type RentalMotionStatus } from '@/services/telematics/rental-drive-monitoring';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { ReleaseMonitoringPreparation, type ReleaseMonitoringContext } from '@/lib/telematics/release-monitoring';
import type { MobileTelematicsHandover } from '@/services/api';
import { getLocationSharingConsent, rememberLocationSharingConsent } from '@/services/telematics/location-sharing-consent';
import { isLocationSharingActive } from '@/services/telematics/location-monitoring-session';
import type { LocationConsentInput } from '@/validation/telematics/location-monitoring';
import { useRentalLocationMonitoring } from './useLocationMonitoring';

export function useTelematicsMonitoring(bookingCode: string, userId: number | undefined, handover: MobileTelematicsHandover | null, blocked: boolean, accessLost: boolean) {
  const monitoring = useRentalLocationMonitoring(bookingCode);
  const preparation = useRef(new ReleaseMonitoringPreparation());
  const [prepared, setPrepared] = useState(false);
  const [rememberedConsent, setRememberedConsent] = useState<LocationConsentInput | null>(null);
  const [consentLoading, setConsentLoading] = useState(true);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [motionStatus, setMotionStatus] = useState<RentalMotionStatus | null>(null);
  const [motionError, setMotionError] = useState<string | null>(null);
  const [motionStarting, setMotionStarting] = useState(false);
  const motionIntent = useRef<{ started: boolean; gpsStarting: boolean } | null>(null);
  const released = handover?.eligibility.state === 'released';
  const ended = handover?.eligibility.state === 'rental_ended';
  const checkMotionStatus = released || ended || !handover;
  const motionActive = motionStatus?.active === true && motionStatus.booking_code === bookingCode;
  const startRef = useRef(monitoring.start);
  const stopRef = useRef(monitoring.stop);
  startRef.current = monitoring.start;
  stopRef.current = () => {
    motionIntent.current = null;
    setMotionStarting(false);
    void pauseRentalDriveMonitoring().catch(() => setMotionError('Motion could not be stopped from this screen. Use Stop readings in the Android notification.'));
    return monitoring.stop();
  };
  const { refresh, snapshot } = monitoring;
  const gpsActive = isLocationSharingActive(monitoring.sharing?.phase ?? 'idle');
  const context = useMemo<ReleaseMonitoringContext>(() => ({
    userId: userId ?? 0, bookingCode, startedAt: handover?.setup?.startedAt ?? null,
    profile: handover?.calibration.profile.fingerprint ?? null,
  }), [userId, bookingCode, handover?.setup?.startedAt, handover?.calibration.profile.fingerprint]);
  const focused = useRef(false);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    const pending = preparation.current;
    return () => { focused.current = false; pending.clear(); motionIntent.current = null; setPrepared(false); setMotionStarting(false); };
  }, [bookingCode, userId]));
  useEffect(() => {
    if (accessLost || ended) {
      preparation.current.clear();
      setPrepared(false);
      if (motionActive || gpsActive) void stopRef.current();
    }
  }, [accessLost, ended, gpsActive, motionActive]);

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
    if (snapshot && !snapshot.canMonitor && (motionActive || isLocationSharingActive(monitoring.sharing?.phase ?? 'idle'))) void stopRef.current();
  }, [snapshot, monitoring.sharing?.phase, motionActive]);

  const refreshMotionStatus = useCallback(async () => {
    if (checkMotionStatus && bookingCode && userId && focused.current && AppState.currentState === 'active') {
      const status = await rentalMotionStatus(userId);
      if (focused.current) setMotionStatus(status);
    }
  }, [checkMotionStatus, bookingCode, userId]);
  useEffect(() => {
    if (!checkMotionStatus || !bookingCode || !userId || !foreground) return;
    const refreshStatus = () => { void refreshMotionStatus().catch(() => undefined); };
    refreshStatus();
    const timer = setInterval(refreshStatus, 2000);
    return () => clearInterval(timer);
  }, [checkMotionStatus, bookingCode, userId, foreground, refreshMotionStatus]);

  const start = useCallback((code: string, consent: LocationConsentInput, includeMotion = false) => {
    if (!focused.current || AppState.currentState !== 'active' || code !== bookingCode) return;
    motionIntent.current = includeMotion && userId && handover?.calibration.profile.id === 'rc_demo' ? { started: false, gpsStarting: false } : null;
    setMotionError(null);
    setMotionStarting(Boolean(motionIntent.current));
    void startRef.current(code, consent);
  }, [bookingCode, userId, handover?.calibration.profile.id]);

  const sharingPhase = monitoring.sharing?.phase;
  useEffect(() => {
    const intent = motionIntent.current;
    if (!intent || !userId || !released || !focused.current) return;
    if (sharingPhase === 'starting' || sharingPhase === 'waiting') intent.gpsStarting = true;
    if ((sharingPhase === 'paused' && intent.gpsStarting) || sharingPhase === 'offline' || sharingPhase === 'error') {
      motionIntent.current = null;
      setMotionStarting(false);
      return;
    }
    if (intent.started || !foreground || sharingPhase !== 'sharing') return;
    intent.started = true;
    const isCurrent = () => motionIntent.current === intent && focused.current && AppState.currentState === 'active';
    void (async () => {
      try {
        const status = await rentalMotionStatus(userId);
        if (!isCurrent()) return;
        if (status?.active && status.booking_code === bookingCode) return;
        if (status?.unfinished.some(item => item.booking_code === bookingCode)) throw new Error('Finish the previous motion sync before resuming both.');
        await beginRentalDriveMonitoring(userId, bookingCode, isCurrent);
      } catch (error) {
        if (isCurrent()) setMotionError(error instanceof Error ? error.message : 'Drive Monitoring could not start.');
      } finally {
        if (motionIntent.current === intent) {
          motionIntent.current = null;
          setMotionStarting(false);
          void refreshMotionStatus().catch(() => undefined);
        }
      }
    })();
  }, [bookingCode, userId, released, foreground, sharingPhase, refreshMotionStatus]);
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
    if (consent) start(bookingCode, consent.consent, consent.includeMotion);
  }, [prepared, blocked, userId, handover, context, snapshot, foreground, released, bookingCode, start]);

  const prepare = (consent: LocationConsentInput | null, includeMotion = false) => {
    preparation.current.clear();
    setPrepared(false);
    if (consent && userId && handover && !released) {
      preparation.current.arm(context, consent, includeMotion);
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
  const stop = () => { preparation.current.clear(); setPrepared(false); void stopRef.current(); };

  return { ...monitoring, start, stop, prepare, prepared, rememberedConsent, consentLoading, getRememberedConsent, rememberConsent,
    motionStatus, motionError, motionStarting, refreshMotionStatus,
    motionActive,
    active: gpsActive };
}
