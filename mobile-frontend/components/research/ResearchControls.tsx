import { Info, X, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { themeColors } from '@/constants/theme';

export function ResearchIconButton({ icon: Icon, label, onPress, disabled = false, destructive = false }: {
  icon: LucideIcon; label: string; onPress: () => void; disabled?: boolean; destructive?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled}
    onPress={onPress} hitSlop={2} className={`min-h-[44px] min-w-[44px] items-center justify-center ${destructive ? 'rounded-lg border border-destructive-border bg-surface' : ''} ${disabled ? 'opacity-50' : ''}`}>
    <Icon size={18} color={destructive ? themeColors.destructive : themeColors.foreground} strokeWidth={2} />
  </Pressable>;
}

// Uses the existing calibration disclosure's centered, safe-area-aware dialog layout.
export function ResearchDialog({ visible, title, onClose, children, footer, icon: Icon = Info }: {
  visible: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; icon?: LucideIcon;
}) {
  const insets = useSafeAreaInsets();
  return <Modal transparent statusBarTranslucent navigationBarTranslucent visible={visible} animationType="fade" onRequestClose={onClose}>
    <View className="flex-1 justify-center bg-foreground/35" style={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16, paddingLeft: Math.max(20, insets.left), paddingRight: Math.max(20, insets.right) }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Close ${title}`} onPress={onClose} className="absolute inset-0" />
      <View accessibilityViewIsModal className="max-h-full w-full max-w-[560px] self-center rounded-xl border border-border bg-surface">
        <View className="flex-row items-center gap-2 border-b border-border px-3 py-1">
          <Icon size={18} color={themeColors.primary} accessible={false} />
          <Text accessibilityRole="header" className="font-sans min-w-0 flex-1 text-section font-semibold text-foreground">{title}</Text>
          <ResearchIconButton icon={X} label={`Close ${title}`} onPress={onClose} />
        </View>
        <ScrollView className="shrink" contentContainerClassName="gap-3 p-3" keyboardShouldPersistTaps="handled">{children}</ScrollView>
        {footer && <View className="border-t border-border p-3">{footer}</View>}
      </View>
    </View>
  </Modal>;
}
