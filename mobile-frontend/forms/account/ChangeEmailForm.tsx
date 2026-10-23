import { KeyboardFormScrollView } from '@/components/common/KeyboardFormScrollView';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Text, View } from 'react-native';

import { InputWithLabel } from '@/components/common/InputWithLabel';
import { ProfileFormSheet } from '@/components/profile';
import { useAuth } from '@/providers/AuthProvider';
import { ApiError } from '@/services/http';
import { updateAccountEmailSchema, type UpdateAccountEmailInput } from '@/validation/account/schemas';

import { AccountFormActions } from './AccountFormActions';
import { getAccountSaveErrorMessage } from './account-errors';

export function ChangeEmailForm({
  email,
  visible,
  onClose,
  onSaved,
}: {
  email: string;
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { changeEmail, signOut } = useAuth();
  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<UpdateAccountEmailInput>({
    defaultValues: { email, currentPassword: '' },
    resolver: zodResolver(updateAccountEmailSchema),
  });

  useEffect(() => {
    reset({ email, currentPassword: '' });
  }, [email, visible, reset]);
  const close = () => {
    if (!isSubmitting) {
      reset({ email, currentPassword: '' });
      onClose();
    }
  };

  const submit = async (values: UpdateAccountEmailInput) => {
    try {
      await changeEmail(values);
      reset({ email: values.email, currentPassword: '' });
      onClose();
      onSaved();
    } catch (error) {
      if (error instanceof ApiError && [401, 419].includes(error.status)) {
        reset({ email, currentPassword: '' });
        await signOut({ revokeRemoteToken: false }).catch(() => undefined);
        onClose();
        return;
      }
      if (error instanceof ApiError && error.errors) {
        if (error.errors.email?.[0]) setError('email', { type: 'server', message: error.errors.email[0] });
        if (error.errors.current_password?.[0])
          setError('currentPassword', { type: 'server', message: error.errors.current_password[0] });
      }
      setError('root', {
        message: getAccountSaveErrorMessage(error, 'Unable to update your email. Please try again.'),
      });
    }
  };

  return (
    <ProfileFormSheet title="Change email" visible={visible} onClose={close}>
      <KeyboardFormScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text className="font-sans mb-4 text-body text-secondary-foreground">
          This is the email you use to sign in. Confirm your current password to change it.
        </Text>
        <View className="gap-4 rounded-card border border-border bg-surface p-card">
          <Controller
            control={control}
            name="email"
            render={({ field, fieldState }) => (
              <InputWithLabel
                label="New email address"
                icon="mail-outline"
                required
                disabled={isSubmitting}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                maxLength={255}
                value={field.value}
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="currentPassword"
            render={({ field, fieldState }) => (
              <InputWithLabel
                label="Current password"
                icon="lock-outline"
                required
                disabled={isSubmitting}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                textContentType="password"
                value={field.value}
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
        </View>
        {errors.root?.message ? (
          <Text accessibilityRole="alert" className="font-sans mt-3 text-caption text-destructive">
            {errors.root.message}
          </Text>
        ) : null}
        <AccountFormActions
          label="Update email"
          isSubmitting={isSubmitting}
          onSubmit={handleSubmit(submit)}
          onCancel={close}
        />
      </KeyboardFormScrollView>
    </ProfileFormSheet>
  );
}
