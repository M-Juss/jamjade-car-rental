import { Info, X } from 'lucide-react-native';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/bookings';
import { themeColors } from '@/constants/theme';
import { LocationSharingConsentForm } from '@/forms/telematics/LocationSharingConsentForm';
import type { LocationConsentInput, LocationMonitoringPolicy } from '@/validation/telematics/location-monitoring';

export function LocationSharingDisclosureDialog({ visible, policy, onCancel, onAgree, onDismiss }: {
  visible: boolean; policy: LocationMonitoringPolicy; onCancel: () => void;
  onAgree: (consent: LocationConsentInput) => void; onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();
  return <Modal transparent statusBarTranslucent navigationBarTranslucent visible={visible} animationType="none" onRequestClose={onCancel} onDismiss={onDismiss}>
    <View className="flex-1 justify-center bg-foreground/35" style={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16, paddingLeft: Math.max(20, insets.left), paddingRight: Math.max(20, insets.right) }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close location sharing disclosure" onPress={onCancel} className="absolute inset-0" />
      <View accessibilityViewIsModal className="max-h-full w-full max-w-[560px] self-center rounded-card border border-border bg-surface">
        <View className="flex-row items-center gap-2 border-b border-border p-card">
          <Info size={21} color={themeColors.primary} accessible={false} />
          <Text accessibilityRole="header" className="font-sans min-w-0 flex-1 text-section font-semibold text-foreground">Before sharing location</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close disclosure" onPress={onCancel} className="h-11 w-11 items-center justify-center rounded-full bg-background"><X size={20} color={themeColors.foreground} /></Pressable>
        </View>
        <ScrollView className="shrink" contentContainerClassName="gap-4 p-card" showsVerticalScrollIndicator>
          <Text className="font-sans text-body leading-6 text-foreground">JamJade staff can see your rental’s latest location. On With Assigned Driver rentals, the booking Customer can see it too. Start only while safely parked.</Text>
          <Text className="font-sans text-body leading-6 text-secondary-foreground">Background sharing continues when the app is minimized and uses battery. {Platform.OS === 'ios' ? 'Allow Always access; iOS shows a location indicator.' : 'Allow all the time access; Android shows a notification.'} App-open sharing stops when minimized.</Text>
          <Text className="font-sans text-body leading-6 text-secondary-foreground">Closing the app may stop sharing. If interrupted, start again from Telematics. Only the latest GPS point is kept; no route history or motion readings are saved. The last point is cleared when staff receive the vehicle or within {policy.retentionHours + 1} hours.</Text>
          <Text className="font-sans text-body leading-6 text-secondary-foreground">Zone entries and exits are saved for JamJade staff. Enabled alerts appear in your Activity and Notifications.</Text>
          <Text className="font-sans text-body leading-6 text-foreground">Choose a sharing mode to agree. You can pause at any time from Telematics.</Text>
        </ScrollView>
        <View className="gap-3 border-t border-border p-card">
          <LocationSharingConsentForm version={policy.consentVersion} disabled={!visible} onAgree={onAgree} />
          <ActionButton label="Not now" onPress={onCancel} />
        </View>
      </View>
    </View>
  </Modal>;
}
