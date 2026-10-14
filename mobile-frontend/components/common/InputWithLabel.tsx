import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { forwardRef, useState, type ComponentProps } from 'react';
import { Pressable, Text, TextInput, type TextInputProps, View } from 'react-native';

import { themeColors } from '@/constants/theme';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

type InputWithLabelProps = Omit<TextInputProps, 'style'> & {
  id?: string;
  label: string;
  icon?: MaterialIconName;
  error?: string;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  showPasswordToggle?: boolean;
  inputClassName?: string;
  wrapperClassName?: string;
};

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export const InputWithLabel = forwardRef<TextInput, InputWithLabelProps>(
  (
    {
      label,
      icon,
      error,
      helperText,
      required = false,
      disabled = false,
      showPasswordToggle = true,
      secureTextEntry,
      editable,
      inputClassName,
      wrapperClassName,
      ...props
    },
    ref,
  ) => {
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const isSecure = Boolean(secureTextEntry && !isPasswordVisible);
    const isEditable = editable !== false && !disabled;

    const hasMessage = Boolean(error || helperText);

    return (
      <View className={cx('relative w-full gap-1.5', 'mb-0', wrapperClassName)}>
        <Text className="font-sans text-caption font-medium text-foreground">
          {label}
          {required && <Text className="text-destructive"> *</Text>}
        </Text>

        <View
          className={cx(
            'min-h-control flex-row items-center rounded-field border border-border bg-surface px-4',
            error && 'border-destructive-border bg-destructive-surface',
            !isEditable && 'opacity-[0.62]',
          )}>
          {icon && (
            <View className="mr-2.5">
              <MaterialIcons name={icon} size={20} color={themeColors.mutedForeground} />
            </View>
          )}

          <TextInput
            ref={ref}
            accessibilityLabel={label}
            editable={isEditable}
            placeholderTextColor={themeColors.subtleForeground}
            secureTextEntry={isSecure}
            className={cx('font-sans', 'min-w-0 flex-1 py-0 text-[15px] text-foreground', inputClassName)}
            {...props}
          />

          {showPasswordToggle && secureTextEntry && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${isPasswordVisible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
              accessibilityState={{ disabled: !isEditable, selected: isPasswordVisible }}
              disabled={!isEditable}
              hitSlop={4}
              onPress={() => setIsPasswordVisible((value) => !value)}
              className="-mr-2 ml-1 h-11 w-11 items-center justify-center">
              <MaterialIcons
                name={isPasswordVisible ? 'visibility-off' : 'visibility'}
                size={20}
                color={themeColors.mutedForeground}
              />
            </Pressable>
          )}
        </View>

        <View className={hasMessage ? 'px-1' : 'hidden'}>
          {hasMessage ? (
            <Text
              className={cx(
                'font-sans',
                'text-[13px] leading-[18px] text-secondary-foreground',
                error && 'font-medium text-destructive',
              )}>
              {error || helperText}
            </Text>
          ) : null}
        </View>
      </View>
    );
  },
);

InputWithLabel.displayName = 'InputWithLabel';
