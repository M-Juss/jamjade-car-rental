import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Linking, Platform, Text, View } from 'react-native';

import { ActionButton, InfoRow } from '@/components/bookings';
import { useBackgroundLocationAccess } from '@/hooks/telematics/useBackgroundLocationAccess';
import { BackgroundLocationDisclosureDialog } from './BackgroundLocationDisclosureDialog';

export function RentalBackgroundLocationAccess({ ensureAvailable }: { ensureAvailable: () => Promise<boolean> }) {
  const { access, busy, error, attempted, prepare } = useBackgroundLocationAccess(ensureAvailable);
  const [visible, setVisible] = useState(false);
  const pending = useRef(false);
  const action = useRef<'permissions' | 'settings'>('permissions');
  const prepareRef = useRef(prepare);
  prepareRef.current = prepare;
  const begin = useCallback(() => {
    if (!pending.current) return;
    pending.current = false;
    if (AppState.currentState !== 'active') return;
    if (action.current === 'settings') {
      void Linking.openSettings().catch(() => Alert.alert('Settings unavailable', 'Open device Settings to allow location access.'));
    } else {
      void prepareRef.current();
    }
  }, []);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') { pending.current = false; setVisible(false); }
    });
    return () => { pending.current = false; subscription.remove(); };
  }, []);
  const label = busy ? 'Checking…' : !access ? 'Not checked' : access.status === 'ready' ? 'Allowed'
    : access.status === 'unavailable' ? 'Unavailable' : access.status === 'services_disabled' ? 'Location off' : 'Not allowed';
  const needsSettings = access && (access.status === 'services_disabled'
    || ((!access.canAskAgain || attempted) && (access.status === 'foreground_required' || access.status === 'background_required')));

  return <View className="mt-4 gap-3 border-t border-border pt-1">
    <InfoRow label="Background access" value={label} />
    {error ? <Text accessibilityLiveRegion="polite" className="font-sans text-caption leading-5 text-destructive">{error}</Text> : null}
    {access?.status === 'ready' ? null
      : access?.status === 'unavailable' ? <Text className="font-sans text-caption leading-5 text-secondary-foreground">Background access requires an Android or iOS development build with location support.</Text>
        : <ActionButton label={busy ? 'Checking background access…' : needsSettings ? 'Open device settings' : 'Prepare background access'} disabled={busy} onPress={() => {
          action.current = needsSettings ? 'settings' : 'permissions';
          setVisible(true);
        }} />}
    {needsSettings ? <Text className="font-sans text-caption leading-5 text-secondary-foreground">{access?.status === 'services_disabled' ? 'Enable location services in device Settings.' : Platform.OS === 'ios' ? 'Choose Always for location access in device Settings.' : 'Choose Allow all the time for location access in device Settings.'}</Text> : null}
    <BackgroundLocationDisclosureDialog visible={visible} onCancel={() => { pending.current = false; setVisible(false); }} onDismiss={begin} onContinue={() => {
      pending.current = true;
      setVisible(false);
      if (Platform.OS !== 'ios') setTimeout(begin, 0);
    }} />
  </View>;
}
