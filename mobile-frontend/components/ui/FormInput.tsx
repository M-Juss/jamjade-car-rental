import { themeColors } from '@/constants/theme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { forwardRef, type ComponentProps } from 'react';
import { Text, TextInput, type TextInputProps, View } from 'react-native';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

type FormInputProps = Omit<TextInputProps, 'style'> & {
  label: string;
  icon?: MaterialIconName;
  error?: string;
  helperText?: string;
  required?: boolean;
  multiline?: boolean;
};

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export const FormInput = forwardRef<TextInput, FormInputProps>(
  (
    { label, icon, error, helperText, required = false, editable = true, multiline = false, ...props },
    ref,
  ) => (
    <View className="gap-1.5">
      <Text className="font-sans text-caption font-medium text-foreground">
        {label}
        {required ? <Text className="text-destructive"> *</Text> : null}
      </Text>
      <View
        className={cx(
          'flex-row rounded-field border bg-surface px-4',
          multiline ? 'min-h-[104px] items-start py-3' : 'min-h-control items-center',
          error ? 'border-destructive-border bg-destructive-surface' : 'border-border',
          !editable && 'opacity-70',
        )}>
        {icon ? (
          <View className={cx('mr-2.5', multiline && 'mt-1')}>
            <MaterialIcons name={icon} size={20} color={themeColors.mutedForeground} />
          </View>
        ) : null}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          editable={editable}
          multiline={multiline}
          placeholderTextColor={themeColors.subtleForeground}
          textAlignVertical={multiline ? 'top' : 'center'}
          className={cx(
            'font-sans',
            'min-w-0 flex-1 py-0 text-[15px] text-foreground',
            multiline && 'min-h-[76px]',
          )}
          {...props}
        />
      </View>
      <View className={error || helperText ? 'px-1' : 'hidden'}>
        {error || helperText ? (
          <Text
            className={cx(
              'font-sans',
              'text-caption text-secondary-foreground',
              error && 'text-destructive',
            )}>
            {error || helperText}
          </Text>
        ) : null}
      </View>
    </View>
  ),
);

FormInput.displayName = 'FormInput';
