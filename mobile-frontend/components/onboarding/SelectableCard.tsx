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
        'rounded-[24px] border p-4 ',
        isSelected ? 'border-primary bg-muted' : 'border-border bg-surface',
        disabled && 'opacity-60',
      )}>
      <View className="flex-row items-center gap-3">
        {Icon ? (
          <View
            className={cx(
              'h-10 w-10 items-center justify-center rounded-full',
              isSelected ? 'bg-primary' : 'bg-muted',
            )}>
            <Icon size={20} color={isSelected ? themeColors.surface : themeColors.primary} strokeWidth={2} />
          </View>
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
