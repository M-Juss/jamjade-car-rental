import { Modal, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/bookings';
import { locationConsentSchemaFor, type LocationConsentInput, type LocationMonitoringPolicy } from '@/validation/telematics/location-monitoring';

export function DeviceSetupDisclosureDialog({ visible, resetsCalibration, monitoringPolicy, isDriver = false, offerMotion, onCancel, onContinue }: {
  visible: boolean;
  resetsCalibration: boolean;
  monitoringPolicy?: LocationMonitoringPolicy;
  isDriver?: boolean;
  offerMotion: boolean;
  onCancel: () => void;
  onContinue: (consent: LocationConsentInput | null, includeMotion: boolean) => void;
}) {
  const insets = useSafeAreaInsets();
  const agree = () => {
    if (!monitoringPolicy) return;
    const consent = locationConsentSchemaFor(monitoringPolicy.consentVersion).parse({
      consent: true, consent_version: monitoringPolicy.consentVersion, sharing_mode: 'foreground_background',
    });
    onContinue(consent, offerMotion);
  };

  return (
    <Modal transparent statusBarTranslucent navigationBarTranslucent visible={visible} animationType="none" onRequestClose={onCancel}>
      <View className="flex-1 justify-center bg-foreground/35" style={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16, paddingLeft: Math.max(20, insets.left), paddingRight: Math.max(20, insets.right) }}>
        <View accessibilityViewIsModal className="max-h-full w-full max-w-[560px] self-center rounded-card border border-border bg-surface">
          <View className="border-b border-border p-card">
            <Text accessibilityRole="header" className="font-sans text-section font-semibold text-foreground">Before device setup</Text>
          </View>
          <ScrollView className="shrink" contentContainerClassName="gap-3 p-card" showsVerticalScrollIndicator>
            <Text className="font-sans text-body leading-6 text-foreground">Keep the vehicle parked and the phone secured in its mount. We’ll check the sensors, location and permissions.</Text>
            <Text className="font-sans text-body leading-6 text-secondary-foreground">After staff release the rental, JamJade will attempt to start GPS{offerMotion ? ' and use acceleration and rotation readings to detect driving events' : ''}. Monitoring can continue while your screen is locked and uses battery. Android will show a notification and may ask for background location access.</Text>
            <Text className="font-sans text-body leading-6 text-secondary-foreground">{isDriver ? 'Authorized staff and the booking customer' : 'Authorized staff'} can see the latest location. It is cleared when the vehicle is received or within {monitoringPolicy ? monitoringPolicy.retentionHours + 1 : 'the configured number of'} hours of its last update. One location reading checks GPS during setup; setup coordinates aren’t saved.</Text>
            {offerMotion ? <Text className="font-sans text-body leading-6 text-secondary-foreground">Motion summaries and detected driving events are sent to JamJade for staff review.</Text> : null}
            <Text className="font-sans text-body leading-6 text-secondary-foreground">Keep Telematics open until monitoring starts. You can pause monitoring; after an interruption, resume it manually.{offerMotion ? ' If the phone moves before release, cancel automatic monitoring and repeat calibration.' : ''}</Text>
            {resetsCalibration ? <Text className="font-sans text-caption leading-5 text-warning">Checking setup again resets calibration progress.</Text> : null}
            {!monitoringPolicy ? <Text accessibilityRole="alert" className="font-sans text-body text-secondary-foreground">Monitoring details are unavailable. Please try again.</Text> : null}
          </ScrollView>
          <View className="gap-3 border-t border-border p-card">
            <ActionButton label="Agree and continue" variant="primary" disabled={!visible || !monitoringPolicy} onPress={agree} />
            <ActionButton label="Not now" onPress={onCancel} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
