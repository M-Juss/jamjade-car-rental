import { MapPin, RefreshCcw } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Linking, Text, View } from 'react-native';

import { ActionButton, InfoRow, SectionCard } from '@/components/bookings';
import { LocationSharingDisclosureDialog } from './LocationSharingDisclosureDialog';
import { RentalBackgroundLocationAccess } from './RentalBackgroundLocationAccess';
import { themeColors } from '@/constants/theme';
import { useRentalLocationMonitoring } from '@/hooks/telematics/useLocationMonitoring';
import { formatLastShared } from '@/lib/telematics/location-monitoring';
import { isLocationSharingActive, type LocationSharingPhase } from '@/services/telematics/location-monitoring-session';
import type { LocationConsentInput, LocationMonitoringPolicy } from '@/validation/telematics/location-monitoring';

const labels: Record<LocationSharingPhase, string> = {
  idle: 'Not sharing', starting: 'Starting location sharing', waiting: 'Waiting for GPS',
  sharing: 'Sharing location', paused: 'Sharing paused', offline: 'Offline · sharing stopped', error: 'Sharing interrupted',
};

export function RentalLocationMonitoring({ bookingCode }: { bookingCode: string }) {
  const { snapshot, loading, error, refresh, sharing, start, stop } = useRentalLocationMonitoring(bookingCode);
  const [disclosure, setDisclosure] = useState<LocationMonitoringPolicy | null>(null);
  const [visible, setVisible] = useState(false);
  const pendingConsent = useRef<LocationConsentInput | null>(null);
  const startRef = useRef(start);
  startRef.current = start;
  const phase = sharing?.phase ?? 'idle';
  const active = isLocationSharingActive(phase);
  const lastUpdate = sharing?.lastUploadedAt ?? snapshot?.lastLocationAt;
  const beginPending = useCallback(() => {
    const consent = pendingConsent.current;
    pendingConsent.current = null;
    if (consent && AppState.currentState === 'active') void startRef.current(bookingCode, consent);
  }, [bookingCode]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') { pendingConsent.current = null; setVisible(false); }
    });
    return () => { subscription.remove(); pendingConsent.current = null; };
  }, []);
  const requestSharing = async () => {
    const current = await refresh();
    if (current?.canMonitor && AppState.currentState === 'active') { setDisclosure(current.policy); setVisible(true); }
  };

  return <SectionCard title="Monitoring" icon={MapPin}>
    <View accessibilityLiveRegion="polite" className="flex-row items-center gap-2">
      {phase === 'starting' || phase === 'waiting' ? <ActivityIndicator size="small" color={themeColors.primary} /> : <View className={`h-2.5 w-2.5 rounded-full ${phase === 'sharing' ? 'bg-success' : phase === 'error' || phase === 'offline' ? 'bg-warning' : 'bg-subtle-foreground'}`} />}
      <Text className={`font-sans min-w-0 flex-1 text-section font-semibold ${phase === 'sharing' ? 'text-success' : 'text-foreground'}`}>{labels[phase]}</Text>
    </View>
    {sharing?.message ? <Text className="font-sans mt-2 text-body leading-6 text-secondary-foreground">{sharing.message}</Text> : null}
    {lastUpdate ? <View className="mt-3 border-t border-border pt-1"><InfoRow label="Last shared" value={formatLastShared(lastUpdate)} /></View> : null}
    {active && sharing?.accuracy !== null && sharing?.accuracy !== undefined ? <InfoRow label="GPS accuracy" value={`±${Math.round(sharing.accuracy)} m`} /> : null}
    {phase === 'sharing' ? <InfoRow label="Sharing mode" value={sharing?.backgroundEnabled ? 'Including background' : 'App open only'} /> : null}
    {error ? <Text accessibilityLiveRegion="polite" className="font-sans mt-3 text-body leading-6 text-destructive">{error}</Text> : null}
    <View className="mt-4 gap-3">
      {active ? <ActionButton label="Stop sharing" onPress={stop} />
        : error ? <ActionButton label="Try again" icon={RefreshCcw} disabled={loading} onPress={() => void refresh()} />
          : <ActionButton label={loading ? 'Checking monitoring…' : snapshot?.tripStatus ? 'Resume sharing' : 'Share location'} variant="primary" disabled={loading || !snapshot?.canMonitor} onPress={() => void requestSharing()} />}
      {!loading && snapshot && !snapshot.canMonitor && !active ? <Text className="font-sans text-caption leading-5 text-secondary-foreground">Location sharing is unavailable for this rental.</Text> : null}
      {sharing?.needsSettings ? <ActionButton label="Open device settings" onPress={() => void Linking.openSettings().catch(() => Alert.alert('Settings unavailable', 'Open device Settings to allow location access.'))} /> : null}
    </View>
    {!active && snapshot?.canMonitor ? <RentalBackgroundLocationAccess key={bookingCode} ensureAvailable={async () => Boolean((await refresh())?.canMonitor)} /> : null}
    {disclosure ? <LocationSharingDisclosureDialog visible={visible} policy={disclosure} onCancel={() => { pendingConsent.current = null; setVisible(false); }} onAgree={(consent) => {
      pendingConsent.current = consent;
      setVisible(false);
      setTimeout(beginPending, 0);
    }} /> : null}
  </SectionCard>;
}
