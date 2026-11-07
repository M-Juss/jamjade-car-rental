import { Pressable, Text, View } from 'react-native';

import { AuthSubmitButton } from '@/components/common/AuthScreenFrame';

export function AccountFormActions({
  label,
  isSubmitting,
  onSubmit,
  onCancel,
}: {
  label: string;
  isSubmitting: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <View className="mt-section gap-2">
      <AuthSubmitButton disabled={isSubmitting} label={isSubmitting ? 'Saving…' : label} onPress={onSubmit} />
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isSubmitting }}
        disabled={isSubmitting}
        onPress={onCancel}
        className="min-h-control items-center justify-center rounded-field">
        <Text className="font-sans text-button font-medium text-secondary-foreground">Cancel</Text>
      </Pressable>
    </View>
  );
}
