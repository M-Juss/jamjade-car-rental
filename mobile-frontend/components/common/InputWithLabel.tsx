import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { forwardRef, useState, type ComponentProps } from 'react';
import { Pressable, Text, TextInput, type TextInputProps, View } from 'react-native';

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
      showPasswordToggle = false,
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
      <View
        className={cx(
          'relative w-full gap-1.5',
          hasMessage ? 'mb-8' : 'mb-4',
          wrapperClassName,
        )}>
        <Text className="text-[12px] font-bold text-foreground">
          {label}
          {required && <Text className="text-destructive"> *</Text>}
        </Text>

        <View
          className={cx(
            'min-h-[48px] flex-row items-center rounded-full border border-[#E5EAF2] bg-surface px-4',
            error && 'border-destructive-border bg-destructive-surface',
            !isEditable && 'opacity-[0.62]',
          )}>
          {icon && (
            <View className="mr-2.5">
              <MaterialIcons name={icon} size={20} color="#7D8798" />
            </View>
          )}

          <TextInput
            ref={ref}
            editable={isEditable}
            placeholderTextColor="#9AA4B8"
            secureTextEntry={isSecure}
            className={cx('min-w-0 flex-1 py-0 text-[14px] font-medium text-foreground', inputClassName)}
            {...props}
          />

          {showPasswordToggle && secureTextEntry && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isPasswordVisible ? 'Hide password' : 'Show password'}
              hitSlop={10}
              onPress={() => setIsPasswordVisible((value) => !value)}
              className="ml-2.5">
              <MaterialIcons
                name={isPasswordVisible ? 'visibility-off' : 'visibility'}
                size={20}
                color="#7D8798"
              />
            </Pressable>
          )}
        </View>

        <View className="absolute left-1 right-1 top-full mt-1.5">
          {hasMessage ? (
            <Text
              className={cx(
                'text-[11px] leading-[16px] text-[#667085]',
                error && 'font-bold text-destructive',
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
