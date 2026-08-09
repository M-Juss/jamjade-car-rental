import { LogIn, UserRoundPlus, X } from 'lucide-react-native';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type BookingAccountModalProps = {
  onClose: () => void;
  onContinueToAccount: () => void;
  vehicleName: string;
  visible: boolean;
};

export function BookingAccountModal({
  onClose,
  onContinueToAccount,
  vehicleName,
  visible,
}: BookingAccountModalProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}>
      <View className="flex-1 justify-end">
        <Pressable
          accessibilityLabel="Close account required message"
          accessibilityRole="button"
          onPress={onClose}
          className="absolute inset-0 bg-[#0B1220]/50"
        />
        <View
          accessibilityRole="alert"
          accessibilityViewIsModal
          className="rounded-t-[34px] border border-border bg-surface px-5 pt-4"
          style={{ paddingBottom: Math.max(insets.bottom + 18, 28) }}>
          <View className="mb-5 h-1.5 w-12 self-center rounded-full bg-[#D7DDE8]" />

          <View className="flex-row items-start justify-between gap-4">
            <View className="h-14 w-14 items-center justify-center rounded-full bg-muted">
              <UserRoundPlus size={27} color="#346EF6" strokeWidth={2.3} />
            </View>

            <Pressable
              accessibilityLabel="Close"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onClose}
              className="h-11 w-11 items-center justify-center rounded-full bg-background">
              <X size={20} color="#17315F" strokeWidth={2.5} />
            </Pressable>
          </View>

          <Text className="mt-5 text-[25px] font-black leading-[30px] text-foreground">
            Sign in to book this car
          </Text>
          <Text className="mt-3 text-[14px] font-semibold leading-6 text-muted-foreground">
            To reserve {vehicleName}, sign in or create a JamJade account. You can continue
            browsing without an account.
          </Text>

          <Pressable
            accessibilityRole="button"
            onPress={onContinueToAccount}
            className="mt-6 min-h-[58px] flex-row items-center justify-center gap-2 rounded-full bg-primary shadow-lg shadow-primary/25">
            <LogIn size={19} color="#FFFFFF" strokeWidth={2.6} />
            <Text className="text-[15px] font-black text-surface">Sign In or Create Account</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            className="mt-3 min-h-[56px] items-center justify-center rounded-full border border-border bg-surface">
            <Text className="text-[15px] font-black text-foreground">Continue Browsing</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
