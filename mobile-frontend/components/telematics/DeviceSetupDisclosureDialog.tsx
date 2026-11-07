import { Info, MapPin, ShieldCheck, Smartphone, X } from 'lucide-react-native';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/bookings';
import { themeColors } from '@/constants/theme';
import { LocationSharingConsentForm } from '@/forms/telematics/LocationSharingConsentForm';
import type { LocationConsentInput, LocationMonitoringPolicy } from '@/validation/telematics/location-monitoring';

export function DeviceSetupDisclosureDialog({ visible, resetsCalibration, monitoringPolicy, rememberedConsent, isDriver = false, onCancel, onContinue }: {
  visible: boolean;
  resetsCalibration: boolean;
  onCancel: () => void;
  monitoringPolicy?: LocationMonitoringPolicy;
  rememberedConsent?: LocationConsentInput | null;
  isDriver?: boolean;
  onContinue: (consent: LocationConsentInput | null) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal transparent statusBarTranslucent navigationBarTranslucent visible={visible} animationType="none" onRequestClose={onCancel}>
      <View className="flex-1 justify-center bg-foreground/35" style={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16, paddingLeft: Math.max(20, insets.left), paddingRight: Math.max(20, insets.right) }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close device setup disclosure" onPress={onCancel} className="absolute inset-0" />
        <View accessibilityViewIsModal className="max-h-full w-full max-w-[560px] self-center rounded-card border border-border bg-surface">
          <View className="flex-row items-center gap-2 border-b border-border p-card">
            <Info size={21} color={themeColors.primary} accessible={false} />
            <Text accessibilityRole="header" className="font-sans min-w-0 flex-1 text-section font-semibold text-foreground">Before device setup</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close disclosure" onPress={onCancel} className="h-11 w-11 items-center justify-center rounded-field bg-background">
              <X size={20} color={themeColors.foreground} />
            </Pressable>
          </View>
          <ScrollView className="shrink" contentContainerClassName="gap-section p-card" showsVerticalScrollIndicator>
            <Text className="font-sans text-body leading-6 text-foreground">Keep the vehicle parked during these checks.</Text>
            <View className="flex-row items-start gap-3">
              <ShieldCheck size={21} color={themeColors.primary} />
              <View className="min-w-0 flex-1 gap-1">
                <Text className="font-sans text-body font-semibold text-foreground">Device and permissions</Text>
                <Text className="font-sans text-body leading-6 text-secondary-foreground">We’ll check motion sensors and location services, then ask for motion and location access, including background permission. Your phone may open Settings.</Text>
              </View>
            </View>
            {monitoringPolicy ? <View className="gap-2 border-t border-border pt-4">
              <Text className="font-sans text-body font-semibold text-foreground">Prepare rental GPS</Text>
              <Text className="font-sans text-body leading-6 text-secondary-foreground">{rememberedConsent ? `Your ${rememberedConsent.sharing_mode === 'foreground_background' ? 'background GPS' : 'app-open GPS'} choice is saved for this rental.` : 'Agree below to start GPS monitoring automatically after staff release this rental.'} Keep Telematics open until monitoring starts. These setup checks do not start rental monitoring.</Text>
              <Text className="font-sans text-body leading-6 text-secondary-foreground">{isDriver ? 'JamJade staff and the booking Customer can see the vehicle’s latest location.' : 'Authorized JamJade staff can see your latest location.'} No route history or rental motion readings are saved. The last point is cleared when staff receive the vehicle, or within {monitoringPolicy.retentionHours + 1} hours of its last update.</Text>
              <Text className="font-sans text-body leading-6 text-secondary-foreground">{rememberedConsent?.sharing_mode === 'foreground' ? 'App-open GPS stops when minimized.' : 'Background GPS uses battery and continues when minimized or locked.'} Allow all the time access; Android shows a notification. Closing the app may stop either mode. You can stop monitoring at any time; resuming after an interruption is manual.</Text>
            </View> : null}
            <View className="flex-row items-start gap-3">
              <MapPin size={21} color={themeColors.primary} />
              <View className="min-w-0 flex-1 gap-1">
                <Text className="font-sans text-body font-semibold text-foreground">One GPS reading</Text>
                <Text className="font-sans text-body leading-6 text-secondary-foreground">We’ll send one location reading to check GPS quality. Exact setup coordinates aren’t saved.</Text>
              </View>
            </View>
            <View className="flex-row items-start gap-3">
              <Smartphone size={21} color={themeColors.primary} />
              <View className="min-w-0 flex-1 gap-1">
                <Text className="font-sans text-body font-semibold text-foreground">Phone mount</Text>
                <Text className="font-sans text-body leading-6 text-secondary-foreground">You’ll confirm that your phone is secured in a fixed position.</Text>
              </View>
            </View>
          </ScrollView>
          <View className="gap-3 border-t border-border p-card">
            {resetsCalibration ? <Text className="font-sans text-caption leading-5 text-warning">Running device checks again will reset your calibration progress.</Text> : null}
            {monitoringPolicy && rememberedConsent ? <ActionButton label={`Continue with saved ${rememberedConsent.sharing_mode === 'foreground_background' ? 'background GPS' : 'app-open GPS'} choice`} variant="primary" disabled={!visible} onPress={() => onContinue(rememberedConsent)} /> : monitoringPolicy ? <LocationSharingConsentForm version={monitoringPolicy.consentVersion} deferred disabled={!visible} onAgree={onContinue} /> : null}
            <ActionButton label={monitoringPolicy ? 'Continue without automatic GPS' : 'Continue'} variant={monitoringPolicy ? 'secondary' : 'primary'} onPress={() => onContinue(null)} />
            <ActionButton label="Not now" onPress={onCancel} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
