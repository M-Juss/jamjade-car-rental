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
        'rounded-[24px] border p-4 shadow-md shadow-foreground/5',
        isSelected ? 'border-primary bg-muted' : 'border-border bg-surface',
        disabled && 'opacity-60',
      )}>
      <View className="flex-row items-start justify-between gap-3">
        {Icon ? (
          <View className={cx('h-11 w-11 items-center justify-center rounded-full', isSelected ? 'bg-primary' : 'bg-muted')}>
            <Icon size={21} color={isSelected ? '#FFFFFF' : '#346EF6'} strokeWidth={2.35} />
          </View>
        ) : null}
        {isSelected ? (
          <View className="h-7 w-7 items-center justify-center rounded-full bg-primary">
            <Check size={16} color="#FFFFFF" strokeWidth={3} />
          </View>
        ) : null}
      </View>
      <Text className="mt-4 text-[16px] font-black leading-5 text-foreground">{title}</Text>
      <Text className="mt-1.5 text-[12px] font-semibold leading-5 text-muted-foreground">{description}</Text>
    </Pressable>
  );
}
