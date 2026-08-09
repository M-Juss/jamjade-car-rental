import type { LucideIcon } from 'lucide-react-native';
import { Pressable, Text } from 'react-native';

import { cx } from './utils';

export type ActionButtonVariant = 'primary' | 'secondary' | 'soft' | 'success' | 'warning' | 'danger';

const variantStyles = {
  primary: {
    button: 'border-primary bg-primary shadow-md shadow-primary/20',
    text: 'text-surface',
    icon: '#FFFFFF',
  },
  secondary: {
    button: 'border-border bg-surface',
    text: 'text-foreground',
    icon: '#17315F',
  },
  soft: {
    button: 'border-border bg-muted',
    text: 'text-primary',
    icon: '#346EF6',
  },
  success: {
    button: 'border-success-border bg-success-surface',
    text: 'text-success',
    icon: '#047857',
  },
  warning: {
    button: 'border-warning-border bg-warning-surface',
    text: 'text-warning',
    icon: '#C2410C',
  },
  danger: {
    button: 'border-destructive-border bg-destructive-surface',
    text: 'text-destructive',
    icon: '#B91C1C',
  },
} satisfies Record<ActionButtonVariant, { button: string; text: string; icon: string }>;

export function ActionButton({
  accessibilityLabel,
  className,
  icon: Icon,
  label,
  onPress,
  variant = 'secondary',
}: {
  label: string;
  icon?: LucideIcon;
  variant?: ActionButtonVariant;
  accessibilityLabel?: string;
  className?: string;
  onPress?: () => void;
}) {
  const styles = variantStyles[variant];

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      onPress={onPress}
      className={cx(
        'min-h-[46px] flex-row items-center justify-center gap-2 rounded-full border px-4',
        styles.button,
        className,
      )}>
      {Icon ? <Icon size={16} color={styles.icon} strokeWidth={2.55} /> : null}
      <Text className={cx('text-center text-[13px] font-black', styles.text)}>{label}</Text>
    </Pressable>
  );
}
