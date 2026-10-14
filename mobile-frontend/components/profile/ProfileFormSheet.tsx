import { themeColors } from '@/constants/theme';
import { X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function ProfileFormSheet({
  children,
  onClose,
  overlay,
  title,
  visible,
}: {
  title: string;
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  overlay?: ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-end bg-black/35">
        <Pressable accessibilityRole="button" className="flex-1" onPress={onClose} />
        <View
          className="max-h-[88%] w-full max-w-[560px] shrink self-center rounded-t-sheet bg-background px-5 pt-4"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
          <View className="mb-4 items-center">
            <View className="h-1.5 w-12 rounded-full bg-border" />
          </View>
          <View className="mb-4 flex-row items-center gap-3">
            <Text className="font-sans min-w-0 flex-1 text-[22px] font-semibold text-foreground">
              {title}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Close ${title.toLowerCase()}`}
              hitSlop={8}
              onPress={onClose}
              className="h-11 w-11 items-center justify-center rounded-full bg-surface">
              <X size={19} color={themeColors.mutedForeground} strokeWidth={2.45} />
            </Pressable>
          </View>
          {children}
        </View>
        {overlay}
      </KeyboardAvoidingView>
    </Modal>
  );
}
