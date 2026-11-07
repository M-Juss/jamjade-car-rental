import { themeColors } from '@/constants/theme';
import { Check, type LucideIcon } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export function SelectableCard({
  description,
  disabled = false,
  icon: Icon,
  isSelected,
  onPress,
  title,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
  isSelected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected: isSelected }}
      disabled={disabled}
      onPress={onPress}
      className={cx(
        'min-h-control rounded-card border p-card',
        isSelected ? 'border-primary bg-muted' : 'border-border bg-surface',
        disabled && 'opacity-60',
      )}>
      <View className="flex-row items-center gap-3">
        {Icon ? (
          <Icon size={20} color={themeColors.primary} strokeWidth={2} />
        ) : null}
        <View className="min-w-0 flex-1">
          <Text className="font-sans text-[15px] font-semibold leading-5 text-foreground">{title}</Text>
          <Text className="font-sans mt-1 text-caption text-secondary-foreground">{description}</Text>
        </View>
        {isSelected ? <Check size={19} color={themeColors.primary} /> : null}
      </View>
    </Pressable>
  );
}
