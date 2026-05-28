import { FormInput } from '@/components/ui/FormInput';

type PhoneInputProps = {
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
      onChangeText={onChangeText}
      placeholder={placeholder}
      required={required}
      textContentType="telephoneNumber"
      value={value}
    />
  );
}
