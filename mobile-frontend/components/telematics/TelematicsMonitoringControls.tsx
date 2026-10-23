import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingTabBarSurface } from '@/components/navigation/FloatingTabBarSurface';
import { mobileLayout } from '@/constants/layout';
import type { useTelematicsMonitoring } from '@/hooks/telematics/useTelematicsMonitoring';
import type { LocationConsentInput } from '@/validation/telematics/location-monitoring';
import { LocationSharingDisclosureDialog } from './LocationSharingDisclosureDialog';

export function TelematicsMonitoringControls({ monitoring, released, ended = false, blocked, unread, onActivity, onResumeCheck }: {
  monitoring: ReturnType<typeof useTelematicsMonitoring>; released: boolean; ended?: boolean; blocked: boolean;
  unread: number; onActivity: () => void;
  onResumeCheck: (onResume: () => void) => void;
}) {
  const insets = useSafeAreaInsets();
  const [disclosureOpen, setDisclosureOpen] = useState(false);
  const pending = useRef<LocationConsentInput | null>(null);
  const startRef = useRef(monitoring.start);
  startRef.current = monitoring.start;
  const bookingCode = monitoring.snapshot?.bookingCode;
  const begin = useCallback(() => {
    const consent = pending.current;
    pending.current = null;
    if (consent && bookingCode && AppState.currentState === 'active') void startRef.current(bookingCode, consent);
  }, [bookingCode]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => { if (state !== 'active') { pending.current = null; setDisclosureOpen(false); } });
    return () => { subscription.remove(); pending.current = null; };
  }, []);
  const requestStart = async () => {
    const current = await monitoring.refresh();
    if (!current?.canMonitor || AppState.currentState !== 'active' || !bookingCode) return;
    const consent = await monitoring.getRememberedConsent(current.policy.consentVersion);
    const start = () => {
      if (AppState.currentState !== 'active') return;
      if (consent) void startRef.current(bookingCode, consent);
      else setDisclosureOpen(true);
    };
    const phase = monitoring.sharing?.phase;
    const resuming = current.tripStatus === 'paused' || current.tripStatus === 'started' || ['paused', 'offline', 'error'].includes(phase ?? '');
    if (resuming && AppState.currentState === 'active') {
      onResumeCheck(start);
      return;
    }
    start();
  };
  const confirmPause = () => Alert.alert(
    'Pause monitoring?',
    'Vehicle activity monitoring will stop until you start it again.',
    [
      { text: 'Keep sharing', style: 'cancel' },
      { text: 'Pause', onPress: monitoring.stop },
    ],
  );
  const label = ended ? 'Ended' : !released ? monitoring.prepared ? 'Ready' : 'Await release' : 'Start';

  return <>
    <View pointerEvents="box-none" className="absolute left-0 right-0 items-center" style={{ bottom: insets.bottom + mobileLayout.floatingGap, paddingLeft: Math.max(mobileLayout.screenPadding, insets.left), paddingRight: Math.max(mobileLayout.screenPadding, insets.right) }}>
      <FloatingTabBarSurface items={[
        { key: 'pause', label: 'Pause', icon: 'pause', accessibilityLabel: 'Pause vehicle activity monitoring', onPress: confirmPause, disabled: blocked || !monitoring.active },
        { key: 'monitoring', label, icon: monitoring.active ? 'steering' : 'play', featured: true, featuredActive: monitoring.active,
          disabled: ended || monitoring.active || (!released && !monitoring.prepared) || blocked || monitoring.loading || !monitoring.snapshot?.canMonitor,
          accessibilityLabel: !released ? 'Start is available after staff release' : label,
          onPress: () => void requestStart() },
        { key: 'activity', label: 'Activity', icon: 'bell-outline', badgeCount: unread, onPress: onActivity, disabled: blocked },
      ]} />
    </View>
    {monitoring.snapshot ? <LocationSharingDisclosureDialog visible={disclosureOpen} policy={monitoring.snapshot.policy}
      onCancel={() => { pending.current = null; setDisclosureOpen(false); }} onDismiss={begin}
      onAgree={(consent) => {
        pending.current = consent;
        void monitoring.rememberConsent(consent).then(() => {
          if (AppState.currentState !== 'active') return;
          setDisclosureOpen(false);
          if (Platform.OS !== 'ios') setTimeout(begin, 0);
        });
      }} /> : null}
  </>;
}
