import { themeColors } from '@/constants/theme';
import type { LucideIcon } from 'lucide-react-native';
import { Pressable, Text } from 'react-native';

import { cx } from './utils';

export type ActionButtonVariant = 'primary' | 'secondary' | 'soft' | 'warning' | 'danger';

const variantStyles = {
  primary: {
    button: 'border-primary bg-primary ',
    text: 'text-surface',
    icon: themeColors.surface,
  },
  secondary: {
    button: 'border-border bg-surface',
    text: 'text-foreground',
    icon: themeColors.foreground,
  },
  soft: {
    button: 'border-border bg-muted',
    text: 'text-primary',
    icon: themeColors.primary,
  },
  warning: {
    button: 'border-warning-border bg-warning-surface',
    text: 'text-warning',
    icon: themeColors.warning,
  },
  danger: {
    button: 'border-destructive-border bg-destructive-surface',
    text: 'text-destructive',
    icon: themeColors.destructive,
  },
} satisfies Record<ActionButtonVariant, { button: string; text: string; icon: string }>;

export function ActionButton({
  accessibilityLabel,
  density = 'default',
  className,
  disabled = false,
  icon: Icon,
  label,
  onPress,
  variant = 'secondary',
}: {
  label: string;
  density?: 'default' | 'compact';
  icon?: LucideIcon;
  variant?: ActionButtonVariant;
  accessibilityLabel?: string;
  className?: string;
  disabled?: boolean;
  onPress?: () => void;
}) {
  const styles = variantStyles[variant];

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={cx(
        'flex-row items-center justify-center gap-2 border',
        density === 'compact' ? 'min-h-[44px] rounded-lg px-3 py-2' : 'min-h-control rounded-field px-4 py-2.5',
        styles.button,
        className,
        disabled && 'opacity-50',
      )}>
      {Icon ? <Icon size={16} color={styles.icon} strokeWidth={2.55} /> : null}
      <Text className={cx('font-sans', 'shrink text-center text-button font-medium', styles.text)}>{label}</Text>
    </Pressable>
  );
}
