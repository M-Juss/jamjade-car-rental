import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, Text, View } from 'react-native';

import { InputWithLabel } from '@/components/common/InputWithLabel';
import { ProfileFormSheet } from '@/components/profile';
import { useAuth } from '@/providers/AuthProvider';
import { changeAccountPassword } from '@/services/api';
import { ApiError } from '@/services/http';
import { changeAccountPasswordSchema, type ChangeAccountPasswordInput } from '@/validation/account/schemas';

import { AccountFormActions } from './AccountFormActions';
import { getAccountSaveErrorMessage } from './account-errors';

const emptyValues = { currentPassword: '', password: '', confirmPassword: '' };

export function ChangePasswordForm({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const { signOut } = useAuth();
  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChangeAccountPasswordInput>({
    defaultValues: emptyValues,
    resolver: zodResolver(changeAccountPasswordSchema),
  });
  useEffect(() => {
    reset(emptyValues);
  }, [visible, reset]);
  const close = () => {
    if (!isSubmitting) {
      reset(emptyValues);
      onClose();
    }
  };

  const submit = async (values: ChangeAccountPasswordInput) => {
    try {
      await changeAccountPassword(values);
    } catch (error) {
      if (error instanceof ApiError && [401, 419].includes(error.status)) {
        reset(emptyValues);
        await signOut({ revokeRemoteToken: false }).catch(() => undefined);
        onClose();
        router.replace('/login');
        return;
      }
      if (error instanceof ApiError && error.errors) {
        if (error.errors.current_password?.[0])
          setError('currentPassword', { type: 'server', message: error.errors.current_password[0] });
        if (error.errors.password?.[0])
          setError('password', { type: 'server', message: error.errors.password[0] });
        if (error.errors.password_confirmation?.[0])
          setError('confirmPassword', { type: 'server', message: error.errors.password_confirmation[0] });
      }
      setError('root', {
        message: getAccountSaveErrorMessage(error, 'Unable to update your password. Please try again.'),
      });
      return;
    }
    reset(emptyValues);
    // Remote sessions are revoked; AuthProvider also clears local state if secure storage is unavailable.
    await signOut({ revokeRemoteToken: false }).catch(() => undefined);
    onClose();
    router.replace({ pathname: '/login', params: { passwordChanged: '1' } });
  };

  return (
    <ProfileFormSheet title="Change password" visible={visible} onClose={close}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text className="font-sans mb-4 text-body text-secondary-foreground">
          After updating your password, you’ll be signed out on all mobile devices. Sign in again with your
          new password.
        </Text>
        <View className="gap-4 rounded-card border border-border bg-surface p-card">
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
          <Controller
            control={control}
            name="password"
            render={({ field, fieldState }) => (
              <InputWithLabel
                label="New password"
                icon="lock-outline"
                required
                disabled={isSubmitting}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
                helperText="Use at least 8 characters."
                value={field.value}
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="confirmPassword"
            render={({ field, fieldState }) => (
              <InputWithLabel
                label="Confirm new password"
                icon="lock-outline"
                required
                disabled={isSubmitting}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
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
          label="Update password"
          isSubmitting={isSubmitting}
          onSubmit={handleSubmit(submit)}
          onCancel={close}
        />
      </ScrollView>
    </ProfileFormSheet>
  );
}
