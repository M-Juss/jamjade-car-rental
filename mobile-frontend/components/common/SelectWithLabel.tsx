import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { themeColors } from '@/constants/theme';
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
  const insets = useSafeAreaInsets();
  const selectedOption = useMemo(() => options.find((option) => option.value === value), [options, value]);

  const handleSelect = (nextValue: string) => {
    onValueChange?.(nextValue);
    setIsOpen(false);
  };

  return (
    <View className={cx('w-full gap-1.5', wrapperClassName)}>
      <Text className="font-sans text-caption font-medium text-foreground">
        {label}
        {required && <Text className="text-destructive"> *</Text>}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${selectedOption?.label ?? placeholder}`}
        accessibilityState={{ disabled, expanded: isOpen }}
        disabled={disabled}
        onPress={() => setIsOpen(true)}
        className={cx(
          'min-h-control flex-row items-center rounded-field border border-border bg-surface px-4',
          error && 'border-destructive-border bg-destructive-surface',
          disabled && 'opacity-[0.62]',
        )}>
        {icon && (
          <View className="mr-2.5">
            <MaterialIcons name={icon} size={20} color={themeColors.mutedForeground} />
          </View>
        )}
        <Text
          className={cx(
            'font-sans',
            'min-w-0 flex-1 text-[15px] text-foreground',
            !selectedOption && 'font-medium text-secondary-foreground',
          )}
          numberOfLines={1}>
          {selectedOption?.label ?? placeholder}
        </Text>
        <MaterialIcons name="keyboard-arrow-down" size={24} color={themeColors.mutedForeground} />
      </Pressable>

      {(error || helperText) && (
        <Text
          className={cx(
            'font-sans',
            'px-1 text-caption text-secondary-foreground',
            error && 'text-destructive',
          )}>
          {error || helperText}
        </Text>
      )}

      <Modal animationType="fade" transparent visible={isOpen} onRequestClose={() => setIsOpen(false)}>
        <Pressable
          className="flex-1 justify-end bg-foreground/35 px-4"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
          onPress={() => setIsOpen(false)}>
          <Pressable className="max-h-[72%] w-full max-w-[560px] self-center rounded-sheet bg-surface p-card">
            <View className="mb-3 h-1 w-10 self-center rounded-full bg-border" />
            <Text className="font-sans mb-2 text-[16px] font-semibold text-foreground">{label}</Text>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              ItemSeparatorComponent={() => <View className="h-2" />}
              renderItem={({ item }) => {
                const isSelected = item.value === value;

                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => handleSelect(item.value)}
                    className={cx(
                      'min-h-[46px] flex-row items-center justify-between rounded-2xl px-3',
                      isSelected && 'bg-muted',
                    )}>
                    <Text
                      className={cx(
                        'font-sans',
                        'text-[15px] text-foreground',
                        isSelected && 'text-foreground',
                      )}>
                      {item.label}
                    </Text>
                    {isSelected && <MaterialIcons name="check" size={20} color={themeColors.primary} />}
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
