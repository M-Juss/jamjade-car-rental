import type { LucideIcon } from 'lucide-react-native';
import { Pressable, Text } from 'react-native';

import { cx } from './utils';

export type ActionButtonVariant = 'primary' | 'secondary' | 'soft' | 'success' | 'warning' | 'danger';

const variantStyles = {
  primary: {
    button: 'border-[#065F46] bg-[#065F46] shadow-md shadow-[#065F46]/20',
    text: 'text-white',
    icon: '#FFFFFF',
  },
  secondary: {
    button: 'border-[#DDE8FF] bg-white',
    text: 'text-[#17315F]',
    icon: '#17315F',
  },
  soft: {
    button: 'border-[#DDE8FF] bg-[#EEF4FF]',
    text: 'text-[#346EF6]',
    icon: '#346EF6',
  },
  success: {
    button: 'border-[#BBF7D0] bg-[#ECFDF5]',
    text: 'text-[#047857]',
    icon: '#047857',
  },
  warning: {
    button: 'border-[#FED7AA] bg-[#FFF7ED]',
    text: 'text-[#C2410C]',
    icon: '#C2410C',
  },
  danger: {
    button: 'border-[#FECACA] bg-[#FEF2F2]',
    text: 'text-[#B91C1C]',
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
