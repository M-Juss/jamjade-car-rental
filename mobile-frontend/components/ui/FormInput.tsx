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
    {
      label,
      icon,
      error,
      helperText,
      required = false,
      editable = true,
      multiline = false,
      ...props
    },
    ref,
  ) => (
    <View className={cx('relative gap-2', error || helperText ? 'mb-8' : 'mb-4')}>
      <Text className="text-[12px] font-black uppercase text-muted-foreground">
        {label}
        {required ? <Text className="text-destructive"> *</Text> : null}
      </Text>
      <View
        className={cx(
          'flex-row rounded-[20px] border bg-surface px-4',
          multiline ? 'min-h-[104px] items-start py-3' : 'min-h-[54px] items-center',
          error ? 'border-destructive-border bg-destructive-surface' : 'border-border',
          !editable && 'opacity-70',
        )}>
        {icon ? (
          <View className={cx('mr-2.5', multiline && 'mt-1')}>
            <MaterialIcons name={icon} size={20} color="#7D8798" />
          </View>
        ) : null}
        <TextInput
          ref={ref}
          editable={editable}
          multiline={multiline}
          placeholderTextColor="#9AA4B8"
          textAlignVertical={multiline ? 'top' : 'center'}
          className={cx(
            'min-w-0 flex-1 py-0 text-[14px] font-semibold text-foreground',
            multiline && 'min-h-[76px]',
          )}
          {...props}
        />
      </View>
      <View className="absolute left-1 right-1 top-full mt-1.5">
        {error || helperText ? (
          <Text className={cx('text-[11px] font-bold leading-4 text-subtle-foreground', error && 'text-destructive')}>
            {error || helperText}
          </Text>
        ) : null}
      </View>
    </View>
  ),
);

FormInput.displayName = 'FormInput';
