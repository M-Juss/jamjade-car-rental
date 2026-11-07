import { Info, X } from 'lucide-react-native';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/bookings';
import { themeColors } from '@/constants/theme';

export function BackgroundLocationDisclosureDialog({ visible, onCancel, onContinue }: {
  visible: boolean; onCancel: () => void; onContinue: () => void;
}) {
  const insets = useSafeAreaInsets();
  return <Modal transparent statusBarTranslucent navigationBarTranslucent visible={visible} animationType="none" onRequestClose={onCancel}>
    <View className="flex-1 justify-center bg-foreground/35 px-screen" style={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close background access disclosure" onPress={onCancel} className="absolute inset-0" />
      <View accessibilityViewIsModal className="max-h-full w-full max-w-[560px] self-center rounded-card border border-border bg-surface">
        <View className="flex-row items-center gap-2 border-b border-border p-card">
          <Info size={21} color={themeColors.primary} accessible={false} />
          <Text accessibilityRole="header" className="font-sans min-w-0 flex-1 text-section font-semibold text-foreground">Before background access</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close disclosure" onPress={onCancel} className="h-11 w-11 items-center justify-center rounded-field bg-background"><X size={20} color={themeColors.foreground} /></Pressable>
        </View>
        <ScrollView className="shrink" contentContainerClassName="gap-4 p-card" showsVerticalScrollIndicator>
          <Text className="font-sans text-body leading-6 text-foreground">Background location access lets you share your latest GPS location with authorized JamJade staff during an active rental when the app is minimized or the screen is locked.</Text>
          <Text className="font-sans text-body leading-6 text-secondary-foreground">Allow location while using the app first. Android may then open device Settings; choose Allow all the time for background access.</Text>
          <Text className="font-sans text-body leading-6 text-foreground">This step only prepares permissions. To start sharing, return to Monitoring, choose Share location or Resume sharing, then agree to background sharing.</Text>
          <Text className="font-sans text-body leading-6 text-secondary-foreground">You can decline or change access later in device Settings. Sharing while the app is open remains available.</Text>
        </ScrollView>
        <View className="gap-3 border-t border-border p-card">
          <ActionButton label="Continue to permissions" variant="primary" disabled={!visible} onPress={onContinue} />
          <ActionButton label="Not now" onPress={onCancel} />
        </View>
      </View>
    </View>
  </Modal>;
}
