import { Info, X } from 'lucide-react-native';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/bookings';
import { themeColors } from '@/constants/theme';

export function CalibrationDisclosureDialog({ visible, disabled, rcDemo, onCancel, onAgree }: {
  visible: boolean;
  disabled: boolean;
  rcDemo: boolean;
  onCancel: () => void;
  onAgree: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal transparent statusBarTranslucent navigationBarTranslucent visible={visible} animationType="none" onRequestClose={onCancel}>
      <View className="flex-1 justify-center bg-foreground/35" style={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16, paddingLeft: Math.max(20, insets.left), paddingRight: Math.max(20, insets.right) }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close calibration disclosure" onPress={onCancel} className="absolute inset-0" />
        <View accessibilityViewIsModal className="max-h-full w-full max-w-[560px] self-center rounded-card border border-border bg-surface">
          <View className="flex-row items-center gap-2 border-b border-border p-card">
            <Info size={21} color={themeColors.primary} accessible={false} />
            <Text accessibilityRole="header" className="font-sans min-w-0 flex-1 text-section font-semibold text-foreground">Before calibration</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close disclosure" onPress={onCancel} className="h-11 w-11 items-center justify-center rounded-full bg-background">
              <X size={20} color={themeColors.foreground} />
            </Pressable>
          </View>
          <ScrollView className="shrink" contentContainerClassName="gap-4 p-card" showsVerticalScrollIndicator>
            {rcDemo ? <Text className="font-sans text-body leading-6 text-foreground">These recordings are RC-car prototype tests. They do not validate full-size rental vehicles.</Text> : null}
            <Text className="font-sans text-body leading-6 text-foreground">Complete five short exercises: stationary, forward acceleration, braking, left turn and right turn.</Text>
            <Text className="font-sans text-body leading-6 text-secondary-foreground">Your accelerometer and gyroscope record only after you tap Start recording for each exercise. Only summary results are saved. You can stop at any time; leaving the screen or app stops recording.</Text>
            <Text className="font-sans text-body leading-6 text-secondary-foreground">Stationary measures for six seconds. The other exercises finish when enough valid movement readings are captured, or stop at their recording limit.</Text>
            <Text className="font-sans text-body leading-6 text-secondary-foreground">{rcDemo ? 'For Stationary, keep the RC car powered on and stopped with the mounted phone untouched while we measure background vibration.' : 'For Stationary, keep the vehicle parked and idling with the phone untouched while we measure background vibration.'} An unstable mount needs another attempt.</Text>
            <Text className="font-sans text-body leading-6 text-secondary-foreground">Staff must supervise in a controlled area. Park before starting each recording, keep the phone securely mounted and untouched, and follow staff directions when moving.</Text>
            <Text className="font-sans text-body leading-6 text-foreground">By choosing Agree and continue, I consent to these recordings for this rental. Each time I start recording, I confirm staff supervision, a parked vehicle and a secure phone mount.</Text>
          </ScrollView>
          <View className="gap-3 border-t border-border p-card">
            <ActionButton label="Agree and continue" variant="primary" disabled={disabled} onPress={onAgree} />
            <ActionButton label="Not now" onPress={onCancel} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
