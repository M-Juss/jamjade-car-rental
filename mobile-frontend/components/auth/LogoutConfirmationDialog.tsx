import { LogOut, X } from 'lucide-react-native';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { themeColors } from '@/constants/theme';

type LogoutConfirmationDialogProps = {
  accountLabel: 'customer' | 'driver' | 'admin';
  isLoading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  visible: boolean;
  warning?: string;
};

export function LogoutConfirmationDialog({
  accountLabel,
  isLoading,
  onCancel,
  onConfirm,
  visible,
  warning,
}: LogoutConfirmationDialogProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      accessibilityViewIsModal
      animationType="fade"
      onRequestClose={onCancel}
      transparent
      visible={visible}>
      <View className="flex-1 justify-center bg-foreground/35 px-5">
        <Pressable accessibilityRole="button" className="absolute inset-0" onPress={onCancel} />
        <Pressable
          accessibilityRole="alert"
          className="rounded-card border border-border bg-background p-5 "
          onPress={(event) => event.stopPropagation()}
          style={{ marginBottom: Math.max(insets.bottom * 0.35, 0) }}>
          <View className="flex-row items-start gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-destructive-surface">
              <LogOut color={themeColors.destructive} size={21} strokeWidth={2.5} />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="font-sans text-[20px] font-semibold text-foreground">Log out?</Text>
              <Text className="font-sans mt-1 text-[13px] font-normal leading-5 text-secondary-foreground">
                Are you sure you want to end your {accountLabel} session on this device?
              </Text>
              {warning ? <Text className="font-sans mt-2 text-caption text-secondary-foreground">{warning}</Text> : null}
            </View>
            <Pressable
              accessibilityLabel="Close logout confirmation"
              accessibilityRole="button"
              disabled={isLoading}
              hitSlop={8}
              onPress={onCancel}
              className="h-9 w-9 items-center justify-center rounded-full bg-surface">
              <X color={themeColors.subtleForeground} size={18} strokeWidth={2.5} />
            </Pressable>
          </View>

          <View className="mt-6 flex-row gap-3">
            <Pressable
              accessibilityRole="button"
              disabled={isLoading}
              onPress={onCancel}
              className="min-h-[50px] flex-1 items-center justify-center rounded-full border border-border bg-surface">
              <Text className="font-sans text-[13px] font-semibold text-foreground">Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isLoading}
              onPress={onConfirm}
              className="min-h-[50px] flex-1 items-center justify-center rounded-full bg-destructive">
              {isLoading ? (
                <Text className="font-sans text-[13px] font-semibold text-surface">Logging out...</Text>
              ) : (
                <Text className="font-sans text-[13px] font-semibold text-surface">Log out</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </View>
    </Modal>
  );
}
