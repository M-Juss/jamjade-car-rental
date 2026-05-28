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
        'rounded-[24px] border p-4 shadow-md shadow-[#17315F]/5',
        isSelected ? 'border-[#346EF6] bg-[#EEF4FF]' : 'border-[#E6EEFF] bg-white',
        disabled && 'opacity-60',
      )}>
      <View className="flex-row items-start justify-between gap-3">
        {Icon ? (
          <View className={cx('h-11 w-11 items-center justify-center rounded-full', isSelected ? 'bg-[#346EF6]' : 'bg-[#F3F7FF]')}>
            <Icon size={21} color={isSelected ? '#FFFFFF' : '#346EF6'} strokeWidth={2.35} />
          </View>
        ) : null}
        {isSelected ? (
          <View className="h-7 w-7 items-center justify-center rounded-full bg-[#346EF6]">
            <Check size={16} color="#FFFFFF" strokeWidth={3} />
          </View>
        ) : null}
      </View>
      <Text className="mt-4 text-[16px] font-black leading-5 text-[#17315F]">{title}</Text>
      <Text className="mt-1.5 text-[12px] font-semibold leading-5 text-[#6C7A96]">{description}</Text>
    </Pressable>
  );
}
