import { RentalMotionMonitoring } from '@/components/telematics/RentalMotionMonitoring';
import { useFocusEffect } from '@react-navigation/native';
import { Stack, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { ArrowLeft, CircleAlert, FileCheck2, RefreshCcw } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, BackHandler, Linking, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionButton, BookingEmptyState, SectionCard } from '@/components/bookings';
import { BookingDetailsContent } from '@/components/bookings/BookingDetailsContent';
import { SetupSuccessCheck } from '@/components/telematics/SetupSuccessCheck';
import { CalibrationDisclosureDialog } from '@/components/telematics/CalibrationDisclosureDialog';
import { TelematicsCalibration } from '@/components/telematics/TelematicsCalibration';
import { TelematicsSetupChecklist } from '@/components/telematics/TelematicsSetupChecklist';
import { TelematicsSetupCards } from '@/components/telematics/TelematicsSetupCards';
import { TelematicsSetupResults } from '@/components/telematics/TelematicsSetupResults';
import { TelematicsDrawer, telematicsDrawerPositions, type TelematicsTab } from '@/components/telematics/TelematicsDrawer';
import { TelematicsMap } from '@/components/telematics/TelematicsMap';
import { TelematicsMonitoringControls } from '@/components/telematics/TelematicsMonitoringControls';
import { TelematicsStageDialog } from '@/components/telematics/TelematicsStageDialog';
import { TelematicsVehicleSummary } from '@/components/telematics/TelematicsVehicleSummary';
import { TelematicsActivity } from '@/components/telematics/TelematicsActivity';
import { StationaryResumeCheckDialog } from '@/components/telematics/StationaryResumeCheckDialog';
import { themeColors } from '@/constants/theme';
import { useTelematicsHandover } from '@/hooks/telematics/useTelematicsHandover';
import { useTelematicsMonitoring } from '@/hooks/telematics/useTelematicsMonitoring';
import { useTelematicsActivity } from '@/hooks/telematics/useTelematicsActivity';
import { useStationaryResumeCheck } from '@/hooks/telematics/useStationaryResumeCheck';
import { useCalibrationConsent } from '@/hooks/telematics/useCalibrationConsent';
import { useAuth } from '@/providers/AuthProvider';
import { isDeviceSetupStep, resolveSetupView, setupOverview, type TelematicsSetupView } from '@/lib/telematics/setup';
import { calibrationConsentSchema, type CalibrationConsentInput } from '@/validation/telematics/calibration';

export function TelematicsHandoverScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isDriver = user?.roles?.includes('driver') ?? false;
  const params = useLocalSearchParams<{ bookingId?: string | string[]; tab?: string }>();
  const bookingId = (Array.isArray(params.bookingId) ? params.bookingId[0] : params.bookingId) || undefined;
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { collapsedTop } = telematicsDrawerPositions(height, insets.top, insets.bottom);
  const scroll = useRef<ScrollView>(null);
  const [tab, setTab] = useState<TelematicsTab>(params.tab === 'activity' || params.tab === 'details' ? params.tab : 'setup');
  const [expanded, setExpanded] = useState(true);
  const [requestedView, setRequestedView] = useState<TelematicsSetupView>('overview');
  const [recheckingDevices, setRecheckingDevices] = useState(false);
  const [calibrationDisclosure, setCalibrationDisclosure] = useState<string | null>(null);
  const pendingCalibration = useRef(false);
  const liveBooking = useRef<string | null>(null);
  const [calibrationConsent, setCalibrationConsent] = useState<{ bookingCode: string; profileFingerprint: string | null; values: CalibrationConsentInput } | null>(null);
  const { handover, bookings, loading, loadError, accessLost, bookingsError, actingStep, feedback, refresh, checkSetup, restartSetup, restartingSetup, calibrationBusy, calibrationRecording, calibrationLive, dismissCalibrationSuccess, calibrate, cancelCalibration } = useTelematicsHandover(bookingId);
  const disclosure = useCalibrationConsent(user?.id, handover?.bookingCode, handover?.calibration.profile.id);
  const booking = handover ? bookings.find((item) => item.id === handover.bookingCode) : undefined;
  const overview = handover ? setupOverview(handover) : null;
  const stationaryCheck = useStationaryResumeCheck(bookingId ?? '', user?.id);
  const busy = actingStep !== null || calibrationBusy || restartingSetup || stationaryCheck.busy;
  const monitoring = useTelematicsMonitoring(bookingId ?? '', user?.id, handover, busy || loading || Boolean(loadError), accessLost);
  const activity = useTelematicsActivity(bookingId ?? '');
  const released = handover?.eligibility.state === 'released';
  const ended = handover?.eligibility.state === 'rental_ended';
  const handoverCode = handover?.bookingCode;
  useFocusEffect(useCallback(() => {
    if (!handoverCode) return;
    if (released) liveBooking.current = handoverCode;
    if (!ended || liveBooking.current !== handoverCode) return;
    liveBooking.current = null;
    router.replace(isDriver ? { pathname: '/(driver)/services', params: { tab: 'history' } } : '/(tabs)');
  }, [ended, handoverCode, isDriver, released, router]));
  const closeStationaryCheck = stationaryCheck.close;
  useEffect(() => { if (handover && !released) closeStationaryCheck(); }, [handover, released, closeStationaryCheck]);
  useEffect(() => { if (released) setExpanded(false); }, [released]);
  const guidedStep = handover?.calibration.profile.id === 'rc_demo' || Boolean(calibrationLive && ['stationary_calibration', 'forward_calibration'].includes(calibrationLive.step));
  const showingSuccess = requestedView === 'calibration' && calibrationLive?.phase === 'passed'
    && handover?.setup?.status !== 'released' && calibrationConsent?.profileFingerprint === handover?.calibration.profile.fingerprint;
  const view = handover ? busy || showingSuccess ? requestedView : resolveSetupView(handover, requestedView) : 'overview';
  const guidedCapture = view === 'calibration' && calibrationLive && guidedStep && ['preparing', 'recording'].includes(calibrationLive.phase);
  const deviceComplete = overview?.device.status === 'completed';
  const showingDeviceSuccess = view === 'device_setup' && deviceComplete && !recheckingDevices && !actingStep;
  const showFeedback = feedback && !(view === 'calibration' && calibrationLive && guidedStep) && !handover?.steps.some((step) => step.failureReason === feedback.message);
  const canEnterCalibration = !busy && !loading && !disclosure.loading && !loadError && Boolean(user && handover && resolveSetupView(handover, 'calibration') === 'calibration');

  const clearCalibrationConsent = useCallback(() => {
    pendingCalibration.current = false;
    setCalibrationDisclosure(null);
    setCalibrationConsent(null);
    setRequestedView((current) => current === 'calibration' ? 'overview' : current);
  }, []);
  useFocusEffect(useCallback(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') clearCalibrationConsent();
    });
    return () => { subscription.remove(); clearCalibrationConsent(); };
  }, [bookingId, clearCalibrationConsent]));

  useEffect(() => {
    if (!busy && !loading && !showingSuccess && (!handover || resolveSetupView(handover, 'calibration') !== 'calibration')) clearCalibrationConsent();
    else if (handover && calibrationConsent && (calibrationConsent.bookingCode !== handover.bookingCode
      || calibrationConsent.profileFingerprint !== handover.calibration.profile.fingerprint)) clearCalibrationConsent();
  }, [handover, busy, loading, showingSuccess, calibrationConsent, clearCalibrationConsent]);

  useEffect(() => {
    if (handover && !busy && !loading && !showingSuccess && resolveSetupView(handover, requestedView) !== requestedView) {
      setRequestedView('overview');
      setRecheckingDevices(false);
    }
  }, [handover, busy, loading, requestedView, showingSuccess]);

  useEffect(() => {
    if (calibrationLive?.phase === 'preparing' || calibrationLive?.phase === 'passed') scroll.current?.scrollTo({ y: 0, animated: false });
  }, [calibrationLive?.phase]);

  const enterCalibration = () => {
    if (!canEnterCalibration || !handover || AppState.currentState !== 'active') return;
    setCalibrationConsent({ bookingCode: handover.bookingCode, profileFingerprint: handover.calibration.profile.fingerprint,
      values: calibrationConsentSchema.parse({ consent: true, supervised: true }) });
    setCalibrationDisclosure(null);
    setRecheckingDevices(false);
    setRequestedView('calibration');
    dismissCalibrationSuccess();
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  const openView = (next: TelematicsSetupView) => {
    if (busy || loading || loadError || !handover) return;
    if (next === 'calibration') {
      if (!canEnterCalibration) return;
      if (disclosure.accepted) enterCalibration();
      else setCalibrationDisclosure(handover.bookingCode);
      return;
    }
    clearCalibrationConsent();
    setRecheckingDevices(false);
    setRequestedView(resolveSetupView(handover, next));
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  const goBack = useCallback(() => {
    if (busy) return;
    clearCalibrationConsent();
    setRecheckingDevices(false);
    if (view === 'overview') { if (router.canGoBack()) router.back(); else router.replace(isDriver ? '/(driver)/services' : '/(tabs)/telematics'); }
    else setRequestedView('overview');
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [busy, isDriver, router, view, clearCalibrationConsent]);
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack();
      return true;
    });
    return () => subscription.remove();
  }, [goBack]));

  const confirmPhoneMount = () => new Promise<boolean | null>((resolve) => {
    Alert.alert(
      'Confirm phone mount',
      'While safely parked, confirm that the phone is secured in a fixed position. The app does not detect the holder.',
      [
        { text: 'Not yet', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Confirm mount', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(null) },
    );
  });
  const repeatSetup = () => {
    if (busy || loading || !overview?.device.canOpen) return;
    clearCalibrationConsent();
    setRequestedView('device_setup');
    setRecheckingDevices(true);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  const confirmRestartSetup = () => {
    Alert.alert(
      'Restart setup?',
      'Repeat all six device checks and both calibration steps before staff can start the rental.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Restart setup', onPress: () => {
          void restartSetup().then((restarted) => {
            if (!restarted) return;
            clearCalibrationConsent();
            monitoring.prepare(null);
            setRecheckingDevices(false);
            setRequestedView('device_setup');
          });
        } },
      ],
    );
  };
  const closeStage = () => { if (!busy) { clearCalibrationConsent(); setRequestedView('overview'); setRecheckingDevices(false); } };
  const finishCalibrationDisclosure = () => {
    if (!pendingCalibration.current) return;
    pendingCalibration.current = false;
    if (canEnterCalibration && AppState.currentState === 'active') enterCalibration();
  };
  const selectTab = (next: TelematicsTab) => { if (!busy) setTab(next); };
  const feedbackView = feedback && showFeedback && !showingSuccess ? <Text accessibilityLiveRegion="polite" className={`font-sans text-body leading-6 ${feedback.failed ? 'text-secondary-foreground' : 'text-success'}`}>{feedback.message}</Text> : null;
  const sharing = monitoring.sharing;
  const gpsReconnecting = sharing?.phase === 'reconnecting';
  const monitoringNotice = gpsReconnecting ? sharing.message : loadError ?? monitoring.error
    ?? (sharing?.phase === 'offline' || sharing?.phase === 'error' ? sharing.message : null);
  const gpsStatus = gpsReconnecting ? 'GPS reconnecting' : sharing?.phase === 'sharing' ? 'GPS sharing active' : 'Waiting for GPS…';

  return <View className="flex-1 bg-background">
    <Stack.Screen options={{ gestureEnabled: !busy }} />
    <View pointerEvents={expanded ? 'none' : 'auto'} accessibilityElementsHidden={expanded} importantForAccessibility={expanded ? 'no-hide-descendants' : 'auto'} className="absolute left-0 right-0 top-0" style={{ height: collapsedTop, opacity: expanded ? 0 : 1 }}>
      <TelematicsMap point={handover && released ? monitoring.sharing?.latestFix ?? null : null} recenter={0} />
    </View>
    <View pointerEvents="box-none" className="absolute left-0 right-0 z-10 flex-row items-center justify-between" style={{ top: insets.top + 8, paddingLeft: Math.max(20, insets.left), paddingRight: Math.max(20, insets.right) }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to rentals" accessibilityState={{ disabled: busy }} disabled={busy} onPress={goBack} className="h-11 w-11 items-center justify-center rounded-field border border-border bg-surface disabled:opacity-50">
        <ArrowLeft size={20} color={themeColors.foreground} strokeWidth={2} />
      </Pressable>
      <View className="min-w-0 flex-1 items-center px-2">
        {monitoring.prepared ? <Pressable accessibilityRole="button" accessibilityLabel="Cancel automatic monitoring" onPress={() => monitoring.prepare(null)} className="min-h-[44px] max-w-full justify-center rounded-field border border-border bg-surface px-3 py-1">
          <Text numberOfLines={2} className="font-sans text-center text-[11px] font-semibold text-foreground">Monitoring ready for release</Text>
          <Text className="font-sans text-center text-caption font-medium text-primary">Cancel</Text>
        </Pressable> : monitoring.active ? <View className="max-w-full rounded-full border border-border bg-surface px-3 py-1.5">
          <Text accessibilityLiveRegion="polite" numberOfLines={1} className="font-sans text-center text-[11px] font-semibold text-primary">{gpsStatus}</Text>
        </View> : null}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Refresh telematics" accessibilityState={{ disabled: busy || loading }} disabled={busy || loading}
        onPress={() => { void refresh(); void monitoring.refresh(); void activity.refresh(); }} className="h-11 w-11 items-center justify-center rounded-field border border-border bg-surface disabled:opacity-50">
        {loading ? <ActivityIndicator size="small" color={themeColors.primary} /> : <RefreshCcw size={20} color={themeColors.primary} />}
      </Pressable>
    </View>
    {!handover ? <View className="w-full max-w-[560px] flex-1 self-center justify-center px-screen" style={{ paddingTop: insets.top + 64, paddingBottom: insets.bottom + 110 }}>
      {loading ? <View className="items-center gap-3 rounded-card border border-border bg-surface p-8"><ActivityIndicator color={themeColors.primary} /><Text className="font-sans text-body text-secondary-foreground">Loading telematics…</Text></View>
        : loadError ? <SectionCard title={monitoring.motionActive ? 'Motion capture active' : 'Telematics unavailable'} icon={CircleAlert}>
          <Text className="font-sans mb-4 text-body text-secondary-foreground">{monitoring.motionActive ? 'Motion readings are saved on this phone until they can sync.' : loadError}</Text>
          <ActionButton label="Try again" onPress={() => void refresh()} />
        </SectionCard>
          : <BookingEmptyState title={isDriver ? 'No assigned rental' : 'No self-drive rental'} subtitle="This rental is no longer available for setup." buttonLabel={isDriver ? 'View Services' : 'View bookings'} onBrowsePress={() => router.replace(isDriver ? '/(driver)/services' : '/(tabs)/bookings')} />}
    </View> : <TelematicsDrawer tab={tab} onTab={selectTab} expanded={expanded} onExpand={setExpanded} unread={activity.unread}
      summary={tab === 'details' ? <TelematicsVehicleSummary handover={handover} /> : null}>
      <View className="gap-4">
        {tab === 'details' ? booking ? <BookingDetailsContent booking={booking} audience={isDriver ? 'driver' : 'customer'} /> : <View className="gap-3"><Text className="font-sans text-body text-secondary-foreground">{bookingsError ?? 'Booking details are unavailable.'}</Text><ActionButton label="Retry booking details" onPress={() => void refresh()} /></View> : null}
        {tab === 'setup' ? <>
          {!released && loadError ? <Text accessibilityLiveRegion="polite" className="font-sans text-caption text-secondary-foreground">{loadError}</Text> : null}
          {handover.eligibility.testMode ? <Text className="font-sans rounded-field bg-warning-surface p-3 text-caption text-warning">Local handover test mode. Phone-mount confirmation permits test release; other results remain unchanged.</Text> : null}
          {handover.eligibility.state === 'verification_required' ? <ActionButton label="Review documents" icon={FileCheck2} onPress={() => router.push('/profile/documents' as Href)} /> : null}
          <TelematicsSetupCards handover={handover} disabled={busy || loading || Boolean(loadError)} onOpen={openView}
            repeatLabel={handover.setup?.canRestart ? 'Restart setup' : undefined}
            onRepeatSetup={handover.setup?.canRestart && handover.steps.some(step => isDeviceSetupStep(step.type) && step.attemptCount > 0) ? confirmRestartSetup : overview?.device.canOpen ? repeatSetup : undefined} />
          {monitoring.prepared ? <Text className="font-sans text-caption text-primary">Keep Telematics open until monitoring starts after release.</Text> : null}
          {view === 'overview' ? feedbackView : null}
        </> : null}
        {tab === 'activity' ? <>
          {(released || ended) && user?.id && handover.calibration.profile.id === 'rc_demo' ? <RentalMotionMonitoring key={handover.bookingCode} bookingCode={handover.bookingCode} userId={user.id}
            status={monitoring.motionStatus} starting={monitoring.motionStarting} motionError={monitoring.motionError} refreshStatus={monitoring.refreshMotionStatus}
            ended={ended} gpsActive={monitoring.active && !gpsReconnecting} onResumeCheck={stationaryCheck.open} /> : null}
          {monitoringNotice || sharing?.needsSettings ? <SectionCard title="GPS monitoring" icon={CircleAlert}>
            {monitoringNotice ? <Text accessibilityLiveRegion="polite" className="font-sans text-body text-secondary-foreground">{monitoringNotice}</Text> : null}
            {sharing?.needsSettings ? <ActionButton label="Open device settings" onPress={() => void Linking.openSettings().catch(() => Alert.alert('Settings unavailable', 'Open device Settings to allow location access.'))} /> : null}
          </SectionCard> : null}
          <TelematicsActivity activity={activity} showError={!monitoringNotice} />
        </> : null}
      </View>
    </TelematicsDrawer>}
    {handover || monitoring.active || monitoring.motionActive ? <TelematicsMonitoringControls monitoring={monitoring} released={released} ended={handover?.eligibility.state === 'rental_ended' || monitoring.snapshot?.tripStatus === 'ended'} blocked={busy || loading || Boolean(loadError)} unread={activity.unread} offerMotion={handover?.calibration.profile.id === 'rc_demo'} onResumeCheck={stationaryCheck.open} onActivity={() => { selectTab('activity'); setExpanded(true); void activity.refresh(); }} /> : null}
    <StationaryResumeCheckDialog check={stationaryCheck} initialSettings={handover?.calibration} />
    <TelematicsStageDialog
      title={view === 'calibration' ? 'Calibration' : 'Device setup'}
      visible={Boolean(handover && (view === 'device_setup' || view === 'calibration') && !calibrationDisclosure)}
      busy={busy}
      onClose={closeStage}
      scrollRef={scroll}
      footer={guidedCapture
        ? <ActionButton label={calibrationRecording ? 'Stop recording' : 'Cancel'} onPress={cancelCalibration} />
        : showingDeviceSuccess
          ? <ActionButton label="Next" variant="primary" disabled={!canEnterCalibration} onPress={() => openView('calibration')} />
          : undefined}>
      {showingDeviceSuccess ? (
        <View className="items-center gap-2 py-2" accessibilityLiveRegion="polite">
          <SetupSuccessCheck />
          <Text className="font-sans text-center text-title font-semibold text-foreground">Device setup complete</Text>
          <Text className="font-sans text-center text-body text-secondary-foreground">Next is calibration.</Text>
        </View>
      ) : handover && view === 'device_setup' ? <>
        <TelematicsSetupChecklist handover={handover} actingStep={actingStep} disabled={loading || Boolean(loadError) || monitoring.loading || !monitoring.snapshot} isDriver={isDriver}
          monitoringPolicy={monitoring.snapshot?.policy}
          rememberedConsent={monitoring.rememberedConsent} consentLoading={monitoring.consentLoading}
          onCheckSetup={(consent, includeMotion) => { if (consent) void monitoring.rememberConsent(consent); monitoring.prepare(consent, includeMotion); void checkSetup(confirmPhoneMount).finally(() => setRecheckingDevices(false)); }} />
        {feedbackView}
        {handover.steps.some((step) => isDeviceSetupStep(step.type) && step.attemptCount > 0)
          ? <TelematicsSetupResults steps={handover.steps.filter((step) => isDeviceSetupStep(step.type))} disabled={busy} />
          : null}
      </> : handover && view === 'calibration' && calibrationConsent?.bookingCode === handover.bookingCode && calibrationConsent.profileFingerprint === handover.calibration.profile.fingerprint ? <>
        <TelematicsCalibration key={`calibration:${handover.bookingCode}`} handover={handover} consent={calibrationConsent.values} busy={busy} recording={calibrationRecording} live={calibrationLive} onDismissSuccess={dismissCalibrationSuccess} onStart={calibrate} onCancel={cancelCalibration} />
        {feedbackView}
      </> : null}
    </TelematicsStageDialog>
    <CalibrationDisclosureDialog rcDemo={handover?.calibration.profile.id === 'rc_demo'}
      visible={calibrationDisclosure !== null && calibrationDisclosure === handover?.bookingCode && canEnterCalibration} disabled={!canEnterCalibration}

      onCancel={() => { pendingCalibration.current = false; setCalibrationDisclosure(null); }} onAgree={() => {
        if (!canEnterCalibration || !handover || calibrationDisclosure !== handover.bookingCode || AppState.currentState !== 'active') return;
        disclosure.accept(); pendingCalibration.current = true; setCalibrationDisclosure(null);
        requestAnimationFrame(finishCalibrationDisclosure);
      }} />
  </View>;
}
