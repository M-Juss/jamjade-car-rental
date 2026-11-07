import { X } from 'lucide-react-native';
import type { ReactNode, RefObject } from 'react';
import { Modal, Pressable, ScrollView, Text, View, type ModalProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { themeColors } from '@/constants/theme';

export function TelematicsStageDialog({ title, visible, busy = false, onClose, animationType = 'fade', compact = false, children, footer, scrollRef }: {
  title: string; visible: boolean; busy?: boolean; onClose: () => void;
  children: ReactNode; footer?: ReactNode; scrollRef?: RefObject<ScrollView | null>; animationType?: ModalProps['animationType']; compact?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return <Modal transparent statusBarTranslucent navigationBarTranslucent visible={visible} animationType={animationType} onRequestClose={() => { if (!busy) onClose(); }}>
    <View className="flex-1 justify-center bg-foreground/35" style={{ paddingTop: insets.top + (compact ? 6 : 12), paddingBottom: insets.bottom + (compact ? 6 : 12), paddingLeft: Math.max(20, insets.left), paddingRight: Math.max(20, insets.right) }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Close ${title}`} disabled={busy} className="absolute inset-0" onPress={onClose} />
      <View accessibilityViewIsModal className="max-h-full w-full max-w-[560px] self-center overflow-hidden rounded-sheet border border-border bg-surface">
        <View className="flex-row items-center gap-3 border-b border-border px-card py-2">
          <Text accessibilityRole="header" className="font-sans flex-1 text-section font-semibold text-foreground">{title}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Close ${title}`} accessibilityState={{ disabled: busy }} disabled={busy} onPress={onClose} className="h-11 w-11 items-center justify-center rounded-field bg-muted disabled:opacity-50">
            <X size={20} color={themeColors.foreground} />
          </Pressable>
        </View>
        <ScrollView ref={scrollRef} className="shrink" showsVerticalScrollIndicator={!compact} contentContainerClassName={compact ? 'gap-2 p-3' : 'gap-4 p-card'}>{children}</ScrollView>
        {footer ? <View className="border-t border-border p-card">{footer}</View> : null}
      </View>
    </View>
  </Modal>;
}
