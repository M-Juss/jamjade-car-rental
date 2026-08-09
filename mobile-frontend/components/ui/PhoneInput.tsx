import { FormInput } from '@/components/ui/FormInput';
import { sanitizePhoneNumber } from '@/validation';
import type { TextInputProps } from 'react-native';

type PhoneInputProps = Pick<TextInputProps, 'onBlur'> & {
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
  required?: boolean;
  placeholder?: string;
};

export function PhoneInput({
  error,
  label = 'Contact Number',
  onBlur,
  onChangeText,
  placeholder = '09XX XXX XXXX',
  required = false,
  value,
}: PhoneInputProps) {
  return (
    <FormInput
      autoComplete="tel"
      error={error}
      icon="phone"
      keyboardType="phone-pad"
      label={label}
      maxLength={11}
      onBlur={onBlur}
      onChangeText={(nextValue) => onChangeText(sanitizePhoneNumber(nextValue))}
      placeholder={placeholder}
      required={required}
      textContentType="telephoneNumber"
      value={value}
    />
  );
}
