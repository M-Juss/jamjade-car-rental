import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useMemo, useState, type ComponentProps } from 'react';
import { FlatList, Modal, Pressable, Text, View } from 'react-native';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

export type SelectOption = {
  value: string;
  label: string;
};

type SelectWithLabelProps = {
  id?: string;
  label: string;
  icon?: MaterialIconName;
  placeholder?: string;
  options: SelectOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  error?: string;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  wrapperClassName?: string;
};

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export function SelectWithLabel({
  label,
  icon,
  placeholder = 'Select an option',
  options,
  value,
  onValueChange,
  error,
  helperText,
  required = false,
  disabled = false,
  wrapperClassName,
}: SelectWithLabelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );

  const handleSelect = (nextValue: string) => {
    onValueChange?.(nextValue);
    setIsOpen(false);
  };

  return (
    <View className={cx('w-full gap-1.5', wrapperClassName)}>
      <Text className="text-[12px] font-bold text-[#17315F]">
        {label}
        {required && <Text className="text-[#E5484D]"> *</Text>}
      </Text>

      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => setIsOpen(true)}
        className={cx(
          'min-h-[48px] flex-row items-center rounded-full border border-[#E5EAF2] bg-white px-4',
          error && 'border-[#F4A6A6] bg-[#FFF8F8]',
          disabled && 'opacity-[0.62]',
        )}>
        {icon && (
          <View className="mr-2.5">
            <MaterialIcons name={icon} size={20} color="#7D8798" />
          </View>
        )}
        <Text
          className={cx(
            'min-w-0 flex-1 text-[15px] font-semibold text-[#17315F]',
            'text-[14px]',
            !selectedOption && 'font-medium text-[#9AA4B8]',
          )}
          numberOfLines={1}>
          {selectedOption?.label ?? placeholder}
        </Text>
        <MaterialIcons name="keyboard-arrow-down" size={24} color="#7D8798" />
      </Pressable>

      {(error || helperText) && (
        <Text
          className={cx(
            'px-1 text-[11px] leading-[15px] text-[#667085]',
            error && 'text-[#D92D20]',
          )}>
          {error || helperText}
        </Text>
      )}

      <Modal
        animationType="fade"
        transparent
        visible={isOpen}
        onRequestClose={() => setIsOpen(false)}>
        <Pressable
          className="flex-1 justify-end bg-[#17315F]/35 px-4 pb-4"
          onPress={() => setIsOpen(false)}>
          <Pressable className="max-h-[72%] rounded-3xl bg-white p-4 shadow-lg shadow-[#346EF6]/20">
            <View className="mb-3 h-1 w-10 self-center rounded-full bg-[#D7DDE8]" />
            <Text className="mb-2 text-[16px] font-extrabold text-[#17315F]">{label}</Text>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              ItemSeparatorComponent={() => <View className="h-2" />}
              renderItem={({ item }) => {
                const isSelected = item.value === value;

                return (
                  <Pressable
                    onPress={() => handleSelect(item.value)}
                    className={cx(
                      'min-h-[46px] flex-row items-center justify-between rounded-2xl px-3',
                      isSelected && 'bg-[#EEF4FF]',
                    )}>
                    <Text
                      className={cx(
                        'text-[14px] font-semibold text-[#344054]',
                        isSelected && 'text-[#17315F]',
                      )}>
                      {item.label}
                    </Text>
                    {isSelected && <MaterialIcons name="check" size={20} color="#346EF6" />}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
