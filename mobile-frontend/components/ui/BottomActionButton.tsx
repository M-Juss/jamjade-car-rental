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
};

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export function BottomActionButton({
  disabled = false,
  footer,
  label,
  onPress,
  onSecondaryPress,
  secondaryLabel,
}: BottomActionButtonProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="border-t border-border bg-background/95 px-5 pt-3"
      style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
      {footer}
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPress}
        className={cx(
          'min-h-control items-center justify-center rounded-full bg-primary px-5 ',
          disabled && 'opacity-50',
        )}>
        <Text className="font-sans text-button font-medium text-surface">{label}</Text>
      </Pressable>
      {secondaryLabel && onSecondaryPress ? (
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={onSecondaryPress}
          className="mt-3 min-h-control items-center justify-center rounded-full border border-border bg-surface px-5">
          <Text className="font-sans text-[14px] font-semibold text-foreground">{secondaryLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
