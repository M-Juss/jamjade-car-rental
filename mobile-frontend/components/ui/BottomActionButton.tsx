import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type BottomActionButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondaryLabel?: string;
  onSecondaryPress?: () => void;
  footer?: ReactNode;
  layout?: 'stacked' | 'inline';
};

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export function BottomActionButton({
  disabled = false,
  footer,
  label,
  layout = 'stacked',
  onPress,
  onSecondaryPress,
  secondaryLabel,
}: BottomActionButtonProps) {
  const insets = useSafeAreaInsets();
  const inline = layout === 'inline' && Boolean(secondaryLabel && onSecondaryPress);

  return (
    <View
      className="border-t border-border bg-background/95 px-5 pt-3"
      style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
      {footer}
      <View className={inline ? 'flex-row gap-3' : undefined}>
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={onPress}
          className={cx(
            'min-h-control items-center justify-center rounded-full bg-primary',
            inline ? 'flex-1 px-3 py-3' : 'px-5',
            disabled && 'opacity-50',
          )}>
          <Text className="font-sans text-center text-button font-medium text-surface">{label}</Text>
        </Pressable>
        {secondaryLabel && onSecondaryPress ? (
          <Pressable
            accessibilityRole="button"
            disabled={disabled}
            onPress={onSecondaryPress}
            className={cx(
              'min-h-control items-center justify-center rounded-full border border-border bg-surface',
              inline ? 'flex-1 px-3 py-3' : 'mt-3 px-5',
            )}>
            <Text className="font-sans text-center text-[14px] font-semibold text-foreground">{secondaryLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
